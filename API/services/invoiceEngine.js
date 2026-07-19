const { getDb, esc } = require('../repositories/context');
const { v4: uuidv4 } = require('uuid');
const { computeCurrentCycle } = require('../utils/billing');

async function runEngine(targetCpf = null) {
  const db = getDb();
  console.log(`[InvoiceEngine] Iniciando verificação de faturas${targetCpf ? ` para CPF ${targetCpf}` : ''}...`);

  try {
    let query = `SELECT cpf, credit_card_invoice_due_date, credit_card_due_day FROM ${db.fq('users')} WHERE credit_card_invoice_due_date IS NOT NULL`;
    if (targetCpf) {
      query += ` AND cpf = ${esc(targetCpf)}`;
    }

    const users = await db.executeQuery(query);
    console.log(`[InvoiceEngine] ${users.length} usuários encontrados para verificação.`);

    // Ciclo atual (para referenciar os encargos pendentes gerados pelo billing)
    const cfgRows = await db.executeQuery(`SELECT * FROM ${db.fq('billing_config')} WHERE id = 1`);
    const billingCfg = cfgRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3 };
    const invoiceRef = computeCurrentCycle(billingCfg).invoiceRef;

    let processedCount = 0;
    const now = new Date();

    for (const user of users) {
      const dueDate = new Date(user.credit_card_invoice_due_date);
      if (isNaN(dueDate.getTime())) continue;

      // Corte é 7 dias antes do vencimento
      const cutoffDate = new Date(dueDate);
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      cutoffDate.setUTCHours(23, 59, 59, 999);

      // Margem de teste: Se a data de corte for até o dia 8 de julho (vencimento 15/07), permitimos fechar hoje (dia 6/7)
      const isTestOverride = cutoffDate.getTime() <= new Date('2026-07-08T23:59:59.999Z').getTime();

      if (now > cutoffDate || isTestOverride) {
        // Passou da data de corte: fechar fatura atual e rolar vencimento para próximo mês
        console.log(`[InvoiceEngine] Fatura do CPF ${user.cpf} passou da data de corte (${cutoffDate.toISOString()}) ou override de teste. Fechando fatura...`);

        // 1. Obter o último fechamento para definir o início do ciclo
        const lastClosed = await db.executeQuery(`
          SELECT due_date FROM ${db.fq('invoices')}
          WHERE cpf = ${esc(user.cpf)} AND status = 'FECHADA'
          ORDER BY due_date DESC LIMIT 1
        `);
        let prevCutoffDate = null;
        if (lastClosed.length > 0) {
          const lastClosedDueDate = new Date(lastClosed[0].due_date);
          prevCutoffDate = new Date(lastClosedDueDate);
          prevCutoffDate.setDate(prevCutoffDate.getDate() - 7);
          prevCutoffDate.setUTCHours(23, 59, 59, 999);
        } else {
          prevCutoffDate = new Date(cutoffDate);
          prevCutoffDate.setMonth(prevCutoffDate.getMonth() - 1);
        }

        // 2. Buscar transações de cartão do usuário
        const cardTransactions = await db.executeQuery(`
          SELECT id, type, amount, description, date
          FROM ${db.fq('transactions')}
          WHERE cpf = ${esc(user.cpf)}
            AND type IN ('SHOP_CREDIT','CREDIT','INVOICE_INSTALLMENT','INVOICE_PAYMENT','INVOICE_ANTICIPATION')
            AND (status IS NULL OR status <> 'cancelled')
          ORDER BY date DESC
        `);

        // 3. Mapear transações (regra idêntica ao index.cjs)
        const mappedTransactions = cardTransactions.map(r => {
          const base = {
            id: r.id,
            type: r.type,
            amount: parseFloat(r.amount),
            date: r.date,
            merchant: r.description
          };
          if (r.type === 'INVOICE_INSTALLMENT') {
            const desc = r.description || '';
            const m = desc.match(/\((\d+)\/(\d+)\)/);
            const currentInstallment = m ? parseInt(m[1], 10) : undefined;
            const totalInstallments = m ? parseInt(m[2], 10) : undefined;
            const installments = m ? `${m[1]}/${m[2]}` : undefined;
            const merchantName = desc.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim() || 'Compra credito';
            return { ...base, merchant: merchantName, type: 'INVOICE_INSTALLMENT', installments, currentInstallment, totalInstallments };
          }
          if (r.type === 'SHOP_CREDIT' || r.type === 'CREDIT') {
            const desc = r.description || '';
            const m = desc.match(/\((\d+)\/(\d+)\)/);
            if (m) {
              const currentInstallment = m ? parseInt(m[1], 10) : undefined;
              const totalInstallments = m ? parseInt(m[2], 10) : undefined;
              const installments = m ? `${m[1]}/${m[2]}` : undefined;
              const merchantName = desc.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim() || 'Compra credito';
              return { ...base, merchant: merchantName, type: 'INVOICE_INSTALLMENT', installments, currentInstallment, totalInstallments };
            }
            return { ...base, merchant: desc, type: 'CREDIT' };
          }
          return null;
        }).filter(Boolean);

        // Buscar ids de compras parceladas para excluir o valor principal da fatura
        let splitTxIds = new Set();
        try {
          const planRows = await db.executeQuery(`
            SELECT purchase_tx_id FROM ${db.fq('installment_plans')}
            WHERE cpf = ${esc(user.cpf)}
          `);
          splitTxIds = new Set(planRows.map(p => p.purchase_tx_id).filter(Boolean));
        } catch (err) {
          console.warn('Erro ao buscar installment_plans para splitTxIds:', err.message);
        }

        // 4. Selecionar as transações que compõem esta fatura (compras + parcelas do ciclo)
        const invoiceLineItems = mappedTransactions
          .filter(tx => {
            const txDate = new Date(tx.date).getTime();
            if (txDate <= prevCutoffDate.getTime()) return false;
            if (txDate > cutoffDate.getTime()) return false;

            // Se for a compra principal de um parcelamento, excluir do somatório da fatura
            if (splitTxIds.has(tx.id)) return false;

            if (tx.type === 'INVOICE_INSTALLMENT') return true;
            if (tx.type === 'CREDIT' || tx.type === 'SHOP_CREDIT') return true;

            return false;
          });
        const invoiceAmount = invoiceLineItems.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

        // Snapshot imutável das compras/parcelas desta fatura. Necessário porque pagar ou
        // antecipar parcelas APAGA as linhas correspondentes em transactions
        // (cardRepo.payDueInstallments/anticipateInstallments) — sem este snapshot, a lista de
        // compras da fatura fechada desaparece assim que o cliente paga, mesmo com o valor_total
        // preservado.
        const itemizedTransactionsJson = JSON.stringify(invoiceLineItems.map(tx => ({
          id: tx.id,
          date: tx.date,
          amount: Math.abs(tx.amount),
          merchant: tx.merchant,
          type: tx.type,
          installments: tx.installments,
          currentInstallment: tx.currentInstallment,
          totalInstallments: tx.totalInstallments,
        })));

        // 5. Inserir fatura fechada na tabela invoices
        const invoiceId = uuidv4();

        // Buscar saldo anterior (última fatura fechada anterior que não foi paga)
        const prevUnpaidInvoice = (await db.executeQuery(`
          SELECT valor_total FROM ${db.fq('invoices')}
          WHERE cpf = ${esc(user.cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
          ORDER BY due_date DESC LIMIT 1
        `))[0];
        const saldoAnterior = prevUnpaidInvoice ? parseFloat(prevUnpaidInvoice.valor_total || 0) : 0.00;

        // Buscar charges pendentes geradas para o ciclo que está fechando
        const charges = await db.executeQuery(`
          SELECT charge_type, SUM(amount) as amount FROM ${db.fq('billing_charges')}
          WHERE cpf = ${esc(user.cpf)} AND invoice_reference = ${esc(invoiceRef)} AND status = 'pending'
          GROUP BY charge_type
        `);
        const getCharge = (type) => parseFloat(charges.find(c => c.charge_type === type)?.amount || 0);

        const multa = getCharge('multa');
        const iof = getCharge('iof');
        const jurosRem = getCharge('juros_remuneratorios');
        const jurosMora = getCharge('juros_mora');

        await db.executeQuery(`
          INSERT INTO ${db.fq('invoices')} (id, cpf, status, due_date, valor_total, created_at, updated_at, saldo_anterior, valor_iof, valor_juros_remuneratorios, valor_juros_mora, valor_multa, itemized_transactions)
          VALUES (${esc(invoiceId)}, ${esc(user.cpf)}, 'FECHADA', ${esc(dueDate.toISOString())}, ${invoiceAmount.toFixed(2)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${saldoAnterior}, ${iof}, ${jurosRem}, ${jurosMora}, ${multa}, ${esc(itemizedTransactionsJson)})
        `);

        // Marcar charges do ciclo como consolidadas na fatura fechada
        await db.executeQuery(`
          UPDATE ${db.fq('billing_charges')}
          SET status = 'paid'
          WHERE cpf = ${esc(user.cpf)} AND invoice_reference = ${esc(invoiceRef)}
        `);

        // 2. Calcular nova data de vencimento baseada no due_day do usuário
        const dueDay = user.credit_card_due_day || 15;
        const nextDueDate = new Date(dueDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        nextDueDate.setDate(dueDay);

        // 3. Atualizar usuário
        await db.executeQuery(`
          UPDATE ${db.fq('users')}
          SET credit_card_invoice_due_date = ${esc(nextDueDate.toISOString())}, updated_at = CURRENT_TIMESTAMP
          WHERE cpf = ${esc(user.cpf)}
        `);

        // 4. Processar e rolar planos de parcelamento ativos (installment_plans)
        try {
          const nextDueDateCutoff = new Date(nextDueDate);
          nextDueDateCutoff.setDate(nextDueDateCutoff.getDate() - 7);
          nextDueDateCutoff.setUTCHours(23, 59, 59, 999);

          const plans = await db.executeQuery(`
            SELECT p.*, t.description as tx_description
            FROM ${db.fq('installment_plans')} p
            LEFT JOIN ${db.fq('transactions')} t ON p.purchase_tx_id = t.id
            WHERE p.cpf = ${esc(user.cpf)} AND LOWER(p.status) = 'active' AND p.remaining_installments > 0
          `);

          for (const plan of (plans || [])) {
            const planNextDue = new Date(plan.next_due_date);
            if (isNaN(planNextDue.getTime())) continue;

            // Se o vencimento da próxima parcela for menor ou igual à data de corte do novo ciclo
            if (planNextDue.getTime() <= nextDueDateCutoff.getTime()) {
              const currentInstNum = plan.installments - plan.remaining_installments + 1;
              const instDescBase = plan.tx_description || plan.description || 'Compra shop';
              const cleanDesc = instDescBase.replace(/\s*\(credito\)\s*$/i, '').trim();
              const installmentDescription = `${cleanDesc} (${currentInstNum}/${plan.installments})`;
              
              const newInstTxId = uuidv4();
              await db.executeQuery(`
                INSERT INTO ${db.fq('transactions')} (id, cpf, type, amount, description, date)
                VALUES (
                  ${esc(newInstTxId)}, 
                  ${esc(user.cpf)}, 
                  'INVOICE_INSTALLMENT', 
                  -${parseFloat(plan.installment_amount).toFixed(2)}, 
                  ${esc(installmentDescription)}, 
                  ${esc(plan.next_due_date.toISOString() || planNextDue.toISOString())}
                )
              `);

              const newRemaining = plan.remaining_installments - 1;
              const newRemainingBalance = Math.max(0, parseFloat(plan.remaining_balance || 0) - parseFloat(plan.installment_amount || 0));
              const nextNextDueDate = new Date(planNextDue);
              nextNextDueDate.setMonth(nextNextDueDate.getMonth() + 1);
              const newStatus = newRemaining === 0 ? 'COMPLETED' : 'ACTIVE';

              await db.executeQuery(`
                UPDATE ${db.fq('installment_plans')}
                SET remaining_installments = ${newRemaining},
                    remaining_balance = ${newRemainingBalance.toFixed(2)},
                    next_due_date = ${esc(nextNextDueDate.toISOString())},
                    status = ${esc(newStatus)},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${esc(plan.id)}
              `);
              
              console.log(`[InvoiceEngine] CPF ${user.cpf}: Gerada parcela ${currentInstNum}/${plan.installments} para o plano ${plan.id}.`);
            }
          }
        } catch (planError) {
          console.error(`[InvoiceEngine] Erro ao rolar planos de parcelamento do CPF ${user.cpf}:`, planError);
        }
        
        processedCount++;
      }
    }

    console.log(`[InvoiceEngine] Concluído. ${processedCount} faturas fechadas/roladas.`);
    return { success: true, processed: processedCount };
  } catch (error) {
    console.error(`[InvoiceEngine] Erro durante a execução:`, error);
    throw error;
  }
}

module.exports = { runEngine };
