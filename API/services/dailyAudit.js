const telegramService = require('./telegramService');
const { nowDb } = require('../utils/timezone');
const { toDateOnly } = require('../utils/dateUtils');
const { computeLastPassedDueDate } = require('../repositories/usersRepo');
const { computeNextInvoiceDueDate, INVOICE_CUTOFF_DAYS } = require('../utils/billing');
const { paidPrincipalSql } = require('../utils/invoiceMath');

async function runDailyAudit(dbService, auditLog, recalcularLimiteDisponivel = null) {
    console.log('[Audit] Iniciando auditoria diária de anomalias...');
    const db = dbService;
    const errors = [];

    try {
        // Anomalia 1: Pagamento parcial após vencimento sem novos encargos
        // Se a fatura venceu, houve pagamento parcial (ou nenhum) e não foram gerados encargos (multa/juros)
        const closedUnpaid = await db.executeQuery(`
            SELECT i.cpf, i.due_date, i.valor_total, COALESCE(i.valor_pago, 0) as valor_pago, u.full_name
            FROM ${db.fq('invoices')} i
            JOIN ${db.fq('users')} u ON u.cpf = i.cpf
            WHERE i.status = 'FECHADA' AND i.data_pagamento IS NULL AND i.due_date < CURRENT_TIMESTAMP
        `);

        for (const inv of closedUnpaid) {
            const charges = await db.executeQuery(`
                SELECT id FROM ${db.fq('billing_charges')}
                WHERE cpf = '${inv.cpf}' AND amount > 0
            `);
            if (charges.length === 0 && inv.valor_pago > 0) {
                errors.push({
                    cpf: inv.cpf,
                    name: inv.full_name,
                    type: 'PAGAMENTO_PARCIAL_SEM_ENCARGOS',
                    details: `Fatura vencida em ${toDateOnly(inv.due_date)} com pagamento parcial (R$ ${inv.valor_pago}) mas sem encargos de atraso gerados.`
                });
            }
        }

        // Anomalia 2: Saldo credor (excedente) estacionado > 30 dias
        // Transações de INVOICE_PAYMENT/reversão que deixaram o saldo devedor negativo (saldo credor)
        // Se o usuário tem limite disponível maior que o total (disponível > total), ele tem saldo credor.
        const credores = await db.executeQuery(`
            SELECT cpf, full_name, credit_card_available_limit, credit_card_total_limit, updated_at
            FROM ${db.fq('users')}
            WHERE credit_card_available_limit > credit_card_total_limit
              AND updated_at < CURRENT_TIMESTAMP - INTERVAL '30' DAY
        `);

        for (const u of credores) {
            const diff = parseFloat(u.credit_card_available_limit) - parseFloat(u.credit_card_total_limit);
            errors.push({
                cpf: u.cpf,
                name: u.full_name,
                type: 'SALDO_CREDOR_ESTACIONADO',
                details: `Saldo credor de R$ ${diff.toFixed(2)} estacionado há mais de 30 dias (última atualização: ${toDateOnly(u.updated_at)}).`
            });
        }

        // Anomalia 3: Limite de crédito DIVERGENTE da dívida real.
        // Limite disponível negativo NÃO é mais tratado como erro em si — é o estado
        // correto de uma massa que estourou o limite de verdade (limite_total < dívida
        // real), desde que o motor diário (00h) passou a reconciliar
        // credit_card_available_limit com a fórmula canônica (recalcularLimiteDisponivel,
        // mesma fonte do "Próxima Fatura"). A anomalia real agora é DIVERGÊNCIA: o valor
        // gravado não bate com o que a fórmula diz que deveria ser — sinal de que algum
        // dos ~15 pontos que escrevem esse campo (compra/pagamento/estorno) o deixou
        // dessincronizado durante o dia. Quando recalcularLimiteDisponivel é injetado,
        // a auditoria já corrige na hora (mesma ação do botão "Recalcular Limite
        // Disponível" do painel); sem ele (chamada legada/testes), cai no fallback
        // antigo só para não quebrar quem ainda não passou a dependência.
        if (typeof recalcularLimiteDisponivel === 'function') {
            const candidatos = await db.executeQuery(`
                SELECT cpf, full_name, credit_card_available_limit
                FROM ${db.fq('users')}
                WHERE role != 'admin' AND credit_card_available_limit IS NOT NULL
            `);
            for (const u of candidatos) {
                try {
                    const r = await recalcularLimiteDisponivel(u.cpf);
                    if (r && r.alterado) {
                        errors.push({
                            cpf: u.cpf,
                            name: u.full_name,
                            type: 'LIMITE_DIVERGENTE',
                            details: `Limite disponível estava R$ ${r.limiteAnterior.toFixed(2)} mas deveria ser R$ ${r.limiteNovo.toFixed(2)} pela fórmula canônica — corrigido automaticamente pela auditoria.${r.estourado ? ' Limite de crédito estourado (dívida real acima do limite total) — estado válido, não é bug.' : ''}`
                        });
                    }
                } catch (limErr) {
                    console.warn(`[Audit] Erro ao verificar limite do CPF ${u.cpf}:`, limErr.message);
                }
            }
        } else {
            const estourados = await db.executeQuery(`
                SELECT cpf, full_name, credit_card_available_limit
                FROM ${db.fq('users')}
                WHERE credit_card_available_limit < 0
            `);
            for (const u of estourados) {
                errors.push({
                    cpf: u.cpf,
                    name: u.full_name,
                    type: 'LIMITE_EXCEDIDO',
                    details: `Limite de crédito estourado. Limite disponível negativo: R$ ${parseFloat(u.credit_card_available_limit).toFixed(2)}.`
                });
            }
        }

        // Anomalia 4: Encargos zerados com saldo devedor positivo
        // Usuário inadimplente com dias de atraso > 0 mas sem encargos gerados
        const inadimplentesSemEncargos = await db.executeQuery(`
            SELECT cpf, full_name, days_overdue
            FROM ${db.fq('users')}
            WHERE account_status = 'inadimplente' AND days_overdue > 0
        `);

        for (const u of inadimplentesSemEncargos) {
            const charges = await db.executeQuery(`
                SELECT SUM(amount) as total FROM ${db.fq('billing_charges')}
                WHERE cpf = '${u.cpf}' AND status = 'pending'
            `);
            const totalCharges = parseFloat(charges[0]?.total || 0);
            if (totalCharges === 0) {
                errors.push({
                    cpf: u.cpf,
                    name: u.full_name,
                    type: 'INADIMPLENTE_SEM_ENCARGOS',
                    details: `Usuário marcado como inadimplente há ${u.days_overdue} dias, mas com total de encargos pendentes zerado.`
                });
            }
        }

        // Anomalia 6: Faturas duplicadas (mesmo cpf + due_date)
        const duplicatas = await db.executeQuery(`
            SELECT i.cpf, i.due_date, u.full_name,
                   COUNT(*) as total,
                   array_agg(i.id) as ids,
                   array_agg(i.valor_total ORDER BY i.created_at) as valores
            FROM ${db.fq('invoices')} i
            JOIN ${db.fq('users')} u ON u.cpf = i.cpf
            WHERE i.status = 'FECHADA'
            GROUP BY i.cpf, i.due_date, u.full_name
            HAVING COUNT(*) > 1
        `);

        for (const dup of duplicatas) {
            errors.push({
                cpf: dup.cpf,
                name: dup.full_name || '(duplicata)',
                type: 'FATURA_DUPLICADA',
                details: `${dup.total} faturas FECHADA com vencimento ${toDateOnly(dup.due_date)}. IDs: ${dup.ids.join(', ')}. Valores: ${dup.valores.join(', ')}. Risco de cobrança duplicada e distorção no painel admin.`
            });
        }

        // Anomalia 5: Transações de cartão órfãs
        // Transações de INVOICE_INSTALLMENT sem plano correspondente ativo ou completo
        const orphanTxs = await db.executeQuery(`
            SELECT t.cpf, t.id, t.description, t.amount, t.date, u.full_name
            FROM ${db.fq('transactions')} t
            JOIN ${db.fq('users')} u ON u.cpf = t.cpf
            WHERE t.type = 'INVOICE_INSTALLMENT'
              AND NOT EXISTS (
                  SELECT 1 FROM ${db.fq('installment_plans')} p
                  WHERE p.cpf = t.cpf AND p.purchase_tx_id = t.id OR t.description LIKE '%' || p.id || '%'
              )
        `);

        for (const tx of orphanTxs) {
            errors.push({
                cpf: tx.cpf,
                name: tx.full_name,
                type: 'TRANSACAO_ORFA',
                details: `Parcela de fatura órfã detectada: R$ ${Math.abs(parseFloat(tx.amount)).toFixed(2)} (${tx.description}) em ${toDateOnly(tx.date)} sem plano de parcelamento correspondente.`
            });
        }

        // Anomalia 7: Pagamento sem comprovante entregue (velvet-skipping-dream.md)
        // Todo INVOICE_PAYMENT gera um comprovante PDF + envio ao Telegram
        // (invoiceController.sendPaymentReceipt, category 'payment_receipt'), logado em
        // telegram_message_log. Cobre os dois furos possíveis: falha silenciosa na geração
        // do PDF (nem chega a logar) e falha de envio ao Telegram (loga ok=false). Janela de
        // 48h evita reprocessar pagamentos antigos a cada rodada.
        const paymentsSemComprovante = await db.executeQuery(`
            SELECT t.cpf, t.id, t.amount, t.date, u.full_name
            FROM ${db.fq('transactions')} t
            JOIN ${db.fq('users')} u ON u.cpf = t.cpf
            WHERE t.type = 'INVOICE_PAYMENT' AND t.date >= CURRENT_TIMESTAMP - INTERVAL '48' HOUR
              AND NOT EXISTS (
                  SELECT 1 FROM ${db.fq('telegram_message_log')} l
                  WHERE l.cpf = t.cpf AND l.category = 'payment_receipt' AND l.ok = true
                    AND l.created_at BETWEEN t.date - INTERVAL '10' MINUTE AND t.date + INTERVAL '30' MINUTE
              )
        `);

        for (const p of paymentsSemComprovante) {
            errors.push({
                cpf: p.cpf,
                name: p.full_name,
                type: 'PAGAMENTO_SEM_COMPROVANTE',
                details: `Pagamento de R$ ${Math.abs(parseFloat(p.amount)).toFixed(2)} em ${toDateOnly(p.date)} sem comprovante 'payment_receipt' entregue ao Telegram (PDF pode ter falhado na geração ou no envio).`
            });
        }

        // Anomalia 8: Fatura FECHADA com due_date que não bate com o dueDay real do
        // cartão (ex.: cartão vence dia 23, mas a fatura fechada venceu dia 01 —
        // nasceu de "hoje - daysOverdue" solto em vez de ancorada no dueDay).
        // Autocorrige: recalcula due_date/dias_atraso E regera os encargos pending
        // (multa/juros/IOF) do zero com a fórmula de seedMassBilling — os charges
        // antigos foram acumulados dia a dia com base num days_overdue que também
        // estava errado (calculado a partir do due_date errado), então corrigir só
        // a data e deixar o rastro de charges antigo geraria valores inconsistentes.
        const round2 = (n) => Math.round(n * 100) / 100;
        const faturasDueDateDivergente = await db.executeQuery(`
            SELECT i.id, i.cpf, i.due_date, i.status, i.valor_total, u.full_name, u.credit_card_due_day
            FROM ${db.fq('invoices')} i
            JOIN ${db.fq('users')} u ON u.cpf = i.cpf
            WHERE i.status = 'FECHADA' AND i.data_pagamento IS NULL
              AND u.credit_card_due_day IS NOT NULL
              AND EXTRACT(DAY FROM i.due_date) != u.credit_card_due_day
            ORDER BY i.updated_at ASC
            LIMIT 150
        `);

        for (const inv of faturasDueDateDivergente) {
            const now = new Date();
            const dueDay = Number(inv.credit_card_due_day);
            const correctedDueDate = computeLastPassedDueDate(dueDay, now);
            const daysOverdueNovo = Math.max(1, Math.round((now.getTime() - correctedDueDate.getTime()) / 86400000));
            const principal = round2(Number(inv.valor_total));
            const newRef = `${correctedDueDate.getFullYear()}-${String(correctedDueDate.getMonth() + 1).padStart(2, '0')}`;

            await db.executeQuery(`
                UPDATE ${db.fq('invoices')}
                SET due_date = '${correctedDueDate.toISOString()}', dias_atraso = ${daysOverdueNovo}, updated_at = CURRENT_TIMESTAMP
                WHERE id = '${inv.id}'
            `);
            await db.executeQuery(`
                UPDATE ${db.fq('users')}
                SET days_overdue = ${daysOverdueNovo}, updated_at = CURRENT_TIMESTAMP
                WHERE cpf = '${inv.cpf}'
            `);

            // Descarta o rastro de encargos calculado com o due_date errado (amarrado
            // ao invoice_amount desta fatura, único jeito de referenciá-la sem FK direta)
            // e regera um snapshot único consistente com o daysOverdue corrigido.
            await db.executeQuery(`
                DELETE FROM ${db.fq('billing_charges')}
                WHERE cpf = '${inv.cpf}' AND invoice_amount = ${principal} AND status = 'pending'
            `);
            const multa = round2(principal * 0.02);
            const jurosMora = round2(principal * 0.000333 * daysOverdueNovo);
            const jurosRem = round2(principal * 0.00513 * daysOverdueNovo);
            const iof = round2(principal * 0.0038 + principal * 0.000082 * daysOverdueNovo);
            const chargesNovos = [['multa', multa], ['juros_mora', jurosMora], ['juros_remuneratorios', jurosRem], ['iof', iof]];
            for (const [type, amount] of chargesNovos) {
                const chargeId = db.generateUUID ? db.generateUUID() : `chg-${inv.cpf}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
                await db.executeQuery(`
                    INSERT INTO ${db.fq('billing_charges')}
                    (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount, created_at, status)
                    VALUES ('${chargeId}', '${inv.cpf}', '${newRef}', '${type}', ${amount}, ${daysOverdueNovo}, ${principal}, CURRENT_TIMESTAMP, 'pending')
                `);
            }

            errors.push({
                cpf: inv.cpf,
                name: inv.full_name,
                type: 'FATURA_VENCIMENTO_DIVERGENTE_CORRIGIDO',
                details: `Fatura fechada vencia dia ${toDateOnly(inv.due_date)} mas o cartão vence todo dia ${dueDay} — corrigido para ${toDateOnly(correctedDueDate.toISOString())} (${daysOverdueNovo}d de atraso); encargos pending regerados do zero (eram calculados com o days_overdue antigo, também errado).`
            });
        }

        // Anomalia 8b: encargos pending órfãos — invoices cujo due_date/dias_atraso
        // já foi corrigido (Anomalia 8, em rodada anterior a esta lógica existir, ou
        // manualmente), mas os billing_charges pending ainda refletem o days_overdue
        // antigo/errado, porque a invoice não entra mais no filtro da Anomalia 8 acima
        // (due_date já bate com o dueDay) e por isso nunca seria regerada sem este passo.
        // Lógica em services/chargesProactiveFix.js — reusada pelo botão do admin
        // (POST /admin/fix-charges-proactive) e por script manual, sem duplicar a
        // fórmula aqui. Escopo cobre FECHADA + ABERTA (corrige antes do próximo
        // corte/vencimento reforçar o erro num novo ciclo).
        const { runChargesProactiveFix } = require('./chargesProactiveFix');
        const chargesFixResult = await runChargesProactiveFix(db, { limit: 150 });
        for (const d of chargesFixResult.details) {
            if (d.action !== 'regenerated') continue;
            errors.push({
                cpf: d.cpf,
                name: d.name,
                type: 'ENCARGOS_ORFAOS_REGERADOS',
                details: `Encargos pending estavam calculados com ${d.oldDaysOverdue}d de atraso, mas a fatura já está com ${d.correctDaysOverdue}d — regerados do zero.`
            });
        }

        // Anomalia 8c: pagamento excedente em fatura fechada — soma de INVOICE_PAYMENT/
        // INVOICE_ANTICIPATION vinculados (transactions.invoice_id) à mesma fatura
        // FECHADA passa do devido (principal + encargos). NÃO autocura: o destino do
        // excedente (crédito pra próxima fatura, estorno pro saldo) é decisão de
        // negócio, não da auditoria — só detecta e sinaliza pra cura manual/UTI.
        // Caso real 71040451128 (2026-09-20): Mínimo (R$387,09) + Total (R$3.870,86,
        // valor ORIGINAL de novo, não o residual) pagos na mesma fatura fechada =
        // R$187,63 de excedente por pegar massa que já tinha pagamento anterior.
        const faturasComPagamentoLigado = await db.executeQuery(`
            SELECT i.id, i.cpf, i.valor_total, u.full_name
            FROM ${db.fq('invoices')} i
            JOIN ${db.fq('users')} u ON u.cpf = i.cpf
            JOIN ${db.fq('transactions')} t ON t.invoice_id = i.id AND t.type IN ('INVOICE_PAYMENT', 'INVOICE_ANTICIPATION')
            WHERE i.status = 'FECHADA'
            GROUP BY i.id, i.cpf, i.valor_total, u.full_name
        `);

        for (const inv of faturasComPagamentoLigado) {
            const pagosRows = await db.executeQuery(`
                SELECT COALESCE(SUM(${paidPrincipalSql()}), 0) AS total
                FROM ${db.fq('transactions')}
                WHERE invoice_id = '${inv.id}' AND type IN ('INVOICE_PAYMENT', 'INVOICE_ANTICIPATION')
            `);
            const totalPago = round2(parseFloat(pagosRows[0]?.total || 0));

            const principal = round2(parseFloat(inv.valor_total));
            const chargesRows = await db.executeQuery(`
                SELECT COALESCE(SUM(amount), 0) AS total
                FROM ${db.fq('billing_charges')}
                WHERE cpf = '${inv.cpf}' AND invoice_amount = ${principal}
            `);
            const encargos = round2(parseFloat(chargesRows[0]?.total || 0));
            const devido = round2(principal + encargos);
            const excedente = round2(totalPago - devido);

            if (excedente > 0.02) {
                errors.push({
                    cpf: inv.cpf,
                    name: inv.full_name,
                    type: 'PAGAMENTO_EXCEDENTE_FATURA_FECHADA',
                    details: `Fatura fechada de R$ ${principal.toFixed(2)} (+ R$ ${encargos.toFixed(2)} de encargos = R$ ${devido.toFixed(2)} devido) recebeu R$ ${totalPago.toFixed(2)} em pagamentos vinculados — excedente de R$ ${excedente.toFixed(2)}. Provável massa que recebeu pagamento parcial (Mínimo/Parcial) e depois 'Total' (que cobra o valor original de novo, não o residual restante).`
                });
            }
        }

        // Anomalia 9: fatura ABERTA (credit_card_invoice_due_date) com mês adiantado
        // incorretamente — bug histórico de computeNextInvoiceDueDate que sempre
        // pulava pro mês seguinte mesmo antes do corte deste mês (ex.: hoje 18/09,
        // corte 18/09, due_date mostrando 23/10 em vez de 23/09). Recalcula com a
        // fórmula corrigida e corrige se divergir.
        const usersComVencimentoAberto = await db.executeQuery(`
            SELECT cpf, full_name, credit_card_due_day, credit_card_invoice_due_date
            FROM ${db.fq('users')}
            WHERE credit_card_due_day IS NOT NULL AND credit_card_invoice_due_date IS NOT NULL
        `);

        for (const u of usersComVencimentoAberto) {
            const dueDay = Number(u.credit_card_due_day);
            const correctDueDate = computeNextInvoiceDueDate(dueDay, new Date());
            const currentDueDate = new Date(u.credit_card_invoice_due_date);
            // Compara só ano/mês/dia — desconsidera hora, que varia por fuso/seed
            const sameDay = currentDueDate.getFullYear() === correctDueDate.getFullYear()
                && currentDueDate.getMonth() === correctDueDate.getMonth()
                && currentDueDate.getDate() === correctDueDate.getDate();
            if (!sameDay) {
                await db.executeQuery(`
                    UPDATE ${db.fq('users')}
                    SET credit_card_invoice_due_date = '${correctDueDate.toISOString()}', updated_at = CURRENT_TIMESTAMP
                    WHERE cpf = '${u.cpf}'
                `);
                errors.push({
                    cpf: u.cpf,
                    name: u.full_name,
                    type: 'FATURA_ABERTA_MES_DIVERGENTE_CORRIGIDO',
                    details: `Vencimento da fatura aberta estava ${toDateOnly(u.credit_card_invoice_due_date)}, corrigido para ${toDateOnly(correctDueDate.toISOString())} (dueDay ${dueDay}).`
                });
            }
        }

        // Anomalia 10: ciclos de fatura PERDIDOS — usuário cujo corte já passou há
        // 1+ meses mas nunca teve invoice FECHADA cobrindo aquele período. Causa: o
        // due_date nasceu errado (bug histórico), então o runEngine nunca viu esse
        // corte específico chegar e "pulou" direto pro ciclo atual sem fechar o(s)
        // anterior(es). Reconstrói cada ciclo perdido usando as transações que já
        // existem no período (mesma regra de janela do runEngine: da última fatura
        // fechada — ou created_at — até o corte do ciclo perdido). Sinaliza >90d
        // como candidato a blacklist (regra existente, tabela cemitério vem depois).
        const usersParaCiclosPerdidos = await db.executeQuery(`
            SELECT cpf, full_name, credit_card_due_day, credit_card_invoice_due_date, created_at
            FROM ${db.fq('users')}
            WHERE credit_card_due_day IS NOT NULL AND credit_card_invoice_due_date IS NOT NULL
            ORDER BY updated_at ASC
            LIMIT 80
        `);

        for (const u of usersParaCiclosPerdidos) {
            const now = new Date();
            const createdAt = new Date(u.created_at);
            let cicloAtualDue = new Date(u.credit_card_invoice_due_date);
            let ciclosFechados = 0;

            // Volta ciclo a ciclo (1 mês por vez) até chegar em created_at — 12 ciclos
            // de limite de segurança (nunca deveria haver mais que isso na prática).
            for (let i = 0; i < 12; i++) {
                const cicloPerdidoDue = new Date(cicloAtualDue);
                cicloPerdidoDue.setMonth(cicloPerdidoDue.getMonth() - 1);
                if (cicloPerdidoDue <= createdAt || cicloPerdidoDue > now) break;

                const existing = await db.executeQuery(`
                    SELECT id FROM ${db.fq('invoices')}
                    WHERE cpf = '${u.cpf}' AND status = 'FECHADA'
                      AND EXTRACT(YEAR FROM due_date) = ${cicloPerdidoDue.getFullYear()}
                      AND EXTRACT(MONTH FROM due_date) = ${cicloPerdidoDue.getMonth() + 1}
                `);
                if (existing.length > 0) { cicloAtualDue = cicloPerdidoDue; continue; }

                const cutoffPerdido = new Date(cicloPerdidoDue);
                cutoffPerdido.setDate(cutoffPerdido.getDate() - INVOICE_CUTOFF_DAYS);
                const cicloAnteriorDue = new Date(cicloPerdidoDue);
                cicloAnteriorDue.setMonth(cicloAnteriorDue.getMonth() - 1);
                const inicioJanela = cicloAnteriorDue > createdAt ? cicloAnteriorDue : createdAt;

                const txs = await db.executeQuery(`
                    SELECT amount FROM ${db.fq('transactions')}
                    WHERE cpf = '${u.cpf}'
                      AND type IN ('SHOP_CREDIT','CREDIT','SUBSCRIPTION','INVOICE_INSTALLMENT')
                      AND date > '${inicioJanela.toISOString()}' AND date <= '${cutoffPerdido.toISOString()}'
                      AND (status IS NULL OR status <> 'cancelled')
                `);
                const total = txs.reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);

                if (total > 0.005) {
                    const daysOverdueCiclo = Math.max(1, Math.round((now.getTime() - cicloPerdidoDue.getTime()) / 86400000));
                    const invoiceId = db.generateUUID ? db.generateUUID() : `inv-${u.cpf}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
                    await db.executeQuery(`
                        INSERT INTO ${db.fq('invoices')}
                        (id, cpf, status, due_date, valor_total, created_at, updated_at, data_pagamento, dias_atraso, saldo_anterior)
                        VALUES ('${invoiceId}', '${u.cpf}', 'FECHADA', '${cicloPerdidoDue.toISOString()}', ${round2(total)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, ${daysOverdueCiclo}, 0)
                    `);
                    ciclosFechados++;
                    errors.push({
                        cpf: u.cpf,
                        name: u.full_name,
                        type: daysOverdueCiclo > 90 ? 'CICLO_PERDIDO_FECHADO_CANDIDATO_BLACKLIST' : 'CICLO_PERDIDO_FECHADO',
                        details: `Ciclo de ${toDateOnly(inicioJanela.toISOString())} a ${toDateOnly(cicloPerdidoDue.toISOString())} nunca foi fechado (due_date nasceu errado) — reconstruído com R$ ${round2(total).toFixed(2)} em compras já existentes, ${daysOverdueCiclo}d de atraso.${daysOverdueCiclo > 90 ? ' CANDIDATO A BLACKLIST (>90d) — aguardando tabela cemitério.' : ''}`
                    });
                }
                cicloAtualDue = cicloPerdidoDue;
            }

            if (ciclosFechados > 0) {
                const piorAtraso = await db.executeQuery(`
                    SELECT MAX(dias_atraso) as pior FROM ${db.fq('invoices')}
                    WHERE cpf = '${u.cpf}' AND status = 'FECHADA' AND data_pagamento IS NULL
                `);
                const pior = Number(piorAtraso[0]?.pior || 0);
                if (pior > 0) {
                    const tier = pior <= 7 ? 'EM_ATRASO_7D' : pior <= 15 ? 'EM_ATRASO_15D' : 'EM_ATRASO_30D';
                    await db.executeQuery(`
                        UPDATE ${db.fq('users')}
                        SET account_status = 'inadimplente', days_overdue = ${pior}, overdue_status = '${tier}', updated_at = CURRENT_TIMESTAMP
                        WHERE cpf = '${u.cpf}'
                    `);
                }
            }
        }

        // Anomalia N: Massa com days_overdue >= 90 mas NÃO sincronizada como blacklist.
        // Sintoma: is_blacklisted/credit_card_is_blocked/blacklist_since desatualizados
        // (acontece quando dado é inserido direto no banco — seed/backfill/migração —
        // sem passar pelo runBillingValidation, que é quem normalmente seta esses 3
        // campos). Cura: só resincroniza os campos (idempotente, mesma lógica de
        // billingValidation.js:551-570) — NÃO mexe/apaga fatura nenhuma, isso é uma
        // decisão separada e mais delicada (histórico de dívida pra área de cobrança).
        const blacklistDessincronizada = await db.executeQuery(`
            SELECT cpf, full_name, days_overdue, is_blacklisted, credit_card_is_blocked
            FROM ${db.fq('users')}
            WHERE COALESCE(days_overdue, 0) >= 90 AND COALESCE(is_blacklisted, false) = false
        `);
        for (const u of blacklistDessincronizada) {
            errors.push({
                cpf: u.cpf,
                name: u.full_name,
                type: 'BLACKLIST_DESSINCRONIZADA',
                details: `days_overdue=${u.days_overdue} (>=90) mas is_blacklisted=false/credit_card_is_blocked=${u.credit_card_is_blocked}. Provável dado inserido fora do fluxo runBillingValidation.`
            });
            try {
                await db.executeQuery(`
                    UPDATE ${db.fq('users')}
                    SET is_blacklisted = true, credit_card_is_blocked = true,
                        blacklist_since = COALESCE(blacklist_since, CURRENT_TIMESTAMP),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE cpf = '${u.cpf}'
                `);
                console.log(`[Audit] Cura aplicada: ${u.cpf} sincronizado pra blacklist.`);
            } catch (curaErr) {
                console.warn(`[Audit] Falha ao curar blacklist de ${u.cpf}:`, curaErr.message);
            }
        }

        // Registrar no audit_log e mandar para o Telegram
        if (errors.length > 0) {
            console.log(`[Audit] ${errors.length} anomalias encontradas.`);
            for (const err of errors) {
                const reqDummy = { user: { cpf: '00000000000', role: 'system' } };
                await auditLog(reqDummy, 'daily_audit_anomaly', 'error', err);

                // Alerta no grupo geral
                telegramService.alertGroup(`⚠️ <b>Auditoria de Anomalia [${err.type}]</b>\n\n<b>Cliente:</b> ${err.name} (${telegramService.formatCpf(err.cpf)})\n<b>Detalhes:</b> ${err.details}`, 'daily_anomaly');
            }
        } else {
            console.log('[Audit] Nenhuma anomalia de faturamento encontrada.');
        }

        // Relatório persistente — cada rodada do cron (a cada 2h) grava um snapshot
        // consultável (não só o alerta efêmero do Telegram), para o painel Admin/Web
        // poder listar o histórico de auditorias e o que foi autocorrigido.
        try {
            await db.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${db.fq('audit_reports')} (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    run_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    total_anomalias INTEGER NOT NULL,
                    por_tipo JSONB,
                    detalhes JSONB
                )
            `);
            const porTipo = {};
            for (const e of errors) porTipo[e.type] = (porTipo[e.type] || 0) + 1;
            await db.executeQuery(`
                INSERT INTO ${db.fq('audit_reports')} (total_anomalias, por_tipo, detalhes)
                VALUES (${errors.length}, '${JSON.stringify(porTipo).replace(/'/g, "''")}', '${JSON.stringify(errors).replace(/'/g, "''")}')
            `);
        } catch (reportErr) {
            console.warn('[Audit] Não foi possível salvar relatório persistente:', reportErr.message);
        }

        return { success: true, count: errors.length, errors };
    } catch (e) {
        console.error('[Audit] Erro ao executar auditoria diária:', e);
        telegramService.alertGroup(`🚨 <b>ERRO na Auditoria Diária:</b> ${e.message}`, 'system_error');
        throw e;
    }
}

async function checkOrphanInstallments(db, cpf = null) {
    const cpfDigits = cpf ? String(cpf).replace(/\D/g, '') : '';
    const cpfFilter = cpfDigits ? ` AND t.cpf = '${cpfDigits}'` : '';
    const orphanTxs = await db.executeQuery(`
        SELECT t.cpf, t.id, t.description, t.amount, t.date, u.full_name
        FROM ${db.fq('transactions')} t
        JOIN ${db.fq('users')} u ON u.cpf = t.cpf
        WHERE t.type = 'INVOICE_INSTALLMENT'
          AND NOT EXISTS (
              SELECT 1 FROM ${db.fq('installment_plans')} p
              WHERE p.cpf = t.cpf AND p.purchase_tx_id = t.id OR t.description LIKE '%' || p.id || '%'
          )
          ${cpfFilter}
    `);
    const errors = [];
    for (const tx of orphanTxs) {
        errors.push({
            cpf: tx.cpf,
            name: tx.full_name,
            type: 'TRANSACAO_ORFA',
            details: `Parcela de fatura órfã detectada: R$ ${Math.abs(parseFloat(tx.amount)).toFixed(2)} (${tx.description}) em ${toDateOnly(tx.date)} sem plano de parcelamento correspondente.`
        });
    }
    return errors;
}

module.exports = { runDailyAudit, checkOrphanInstallments };
