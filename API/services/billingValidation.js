/**
 * services/billingValidation.js
 */
const DatabaseFactory = require('../services/database/DatabaseFactory');
const dbService = DatabaseFactory.createDatabaseService();
const notificationsRepo = require('../repositories/notificationsRepo');

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function calcMulta(amount) { return round2((Number(amount) || 0) * 0.02); }
function calcIof(amount, days) {
  const a = Number(amount) || 0;
  const d = Math.max(0, parseInt(days, 10) || 0);
  if (a <= 0 || d <= 0) return 0;
  return round2(a * (0.0038 + 0.000082 * d));
}
function calcIofDiario(amount, days) {
  const a = Number(amount) || 0;
  const d = Math.max(0, parseInt(days, 10) || 0);
  if (a <= 0 || d <= 0) return 0;
  return round2(a * (0.000082 * d));
}
function calcJurosMora(amount, days) {
  const a = Number(amount) || 0;
  const d = Math.max(0, parseInt(days, 10) || 0);
  if (a <= 0 || d <= 0) return 0;
  return round2(a * (0.01 / 30) * d);
}
function calcJurosRemuneratorios(amount, days) {
  const a = Number(amount) || 0;
  const d = Math.max(0, parseInt(days, 10) || 0);
  if (a <= 0 || d <= 0) return 0;
  return round2(a * (0.14 / 30) * d);
}
function overdueStatusFor(status, days) {
  if (days <= 0) return status === 'closed' ? 'closed' : 'open';
  if (days <= 60) return 'overdue_grace';
  if (days <= 90) return 'overdue_critical';
  return 'overdue_pre_loss';
}
function computeCurrentCycle(cfg) {
  const now = new Date();
  const closingDay = parseInt(cfg.closing_day || 15, 10);
  const dueDay = parseInt(cfg.due_day || 25, 10);
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (now.getDate() > closingDay) {
    month++;
    if (month > 12) { month = 1; year++; }
  }
  const closingDate = new Date(year, month - 1, closingDay);
  const dueDate = new Date(year, month - 1, dueDay);
  const ref = String(year) + '-' + String(month).padStart(2, '0');
  return { reference: ref, closingDate, dueDate };
}
function planDistribution(invoicesArray, totalAmount) {
  let rem = Number(totalAmount) || 0;
  const sorted = [...(invoicesArray || [])].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  const res = {};
  for (const inv of sorted) {
    const tot = Number(inv.valor_total) || 0;
    const p = Math.min(rem, tot);
    res[inv.id] = p;
    rem -= p;
  }
  return res;
}

// rota POST /admin/billing/validate-all podem disparar runBillingValidation no
// mesmo processo. Sem este lock em memória, duas execuções simultâneas inseriam
// o incremento do MESMO dia 2x (causa raiz das 958 duplicatas em 107 massas).
let _billingValidationRunning = false;

async function runBillingValidation(opts) {
    if (_billingValidationRunning) {
        console.warn('[BillingValidation] Já em execução — chamada concorrente ignorada (anti-duplicata).');
        return { success: true, message: 'Já em execução (ignorado para evitar duplicatas de incremento diário).', skipped: true, errors: [], processadas: 0, falhas: 0, updated: { inadimplente: 0, adimplente: 0 }, charges: { generated: 0, detail: [] } };
    }
    _billingValidationRunning = true;
    try {
        return await runBillingValidationInner(opts);
    } finally {
        _billingValidationRunning = false;
    }
}

async function runBillingValidationInner(opts) {
    // Escopo opcional: com `onlyCpf`, o motor processa APENAS aquele CPF. Usado pelos
    // testes de integração (engineIdempotency) para NÃO vazar o motor para as outras
    // suítes que compartilham o mesmo banco — sem filtro, o motor percorria todos os
    // usuários (inclusive o CPF de teste de pagamento e as massas reais), re-marcando
    // account_status e inserindo charges em corrida com o teste de pagamento.
    const { onlyCpf } = opts || {};
    const scopeFilter = onlyCpf ? `WHERE cpf = '${onlyCpf}'` : '';
    const invoiceScopeFilter = onlyCpf ? `AND i.cpf = '${onlyCpf}'` : '';
    const configRows = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('billing_config')} WHERE id = 1`);
    if (!configRows.length) return { success: false, message: 'Configuração de faturamento não encontrada.' };
    const cfg = configRows[0];
    if (!cfg.is_active) return { success: true, message: 'Ciclo de faturamento inativo. Nenhuma validação executada.' };

    const cycle = computeCurrentCycle(cfg);
    const today = new Date();

    const users = await dbService.executeQuery(`
        SELECT cpf, credit_card_invoice_due_date,
               COALESCE(account_status,'adimplente') AS account_status,
               COALESCE(days_overdue, 0) AS days_overdue,
               COALESCE(credit_card_available_limit, 0) AS credit_card_available_limit,
               COALESCE(credit_card_total_limit, 5000) AS credit_card_total_limit
        FROM ${dbService.fq('users')}
        ${scopeFilter}
    `);

    // Vencimento real de cada fatura FECHADA ainda não paga — não usar
    // user.credit_card_invoice_due_date aqui: o invoiceEngine rola esse campo para o
    // PRÃ“XIMO ciclo assim que o corte da fatura atual passa (7 dias antes do vencimento),
    // então no dia do vencimento (e durante todo o período de atraso) esse campo já
    // aponta para um ciclo futuro, fazendo daysOverdue ficar sempre 0.
    // ORDER BY ASC (nao DESC): precisamos da fatura NAO PAGA MAIS ANTIGA por CPF, nao a
    // mais recente. Com DESC + "primeira que chega ganha" no loop abaixo, uma massa com
    // 2 faturas FECHADA nao pagas (uma vencida ha semanas, outra vencendo agora) tinha a
    // mais recente escolhida, dava daysOverdue=0 e a massa era marcada adimplente --
    // parando de acumular multa/juros/IOF silenciosamente. Mesma regra ja usada no
    // caminho de leitura em enrichUserCreditCardData (_closedInvoiceOldestDueDate).
    // HIBRIDO (mesma regra de getClosedInvoiceDebt em src/controllers/invoiceController.js):
    // a fatura FECHADA e imutavel, entao valor_pago/data_pagamento ficam zerados/nulos no
    // fluxo novo (trigger da migration 005 bloqueia a escrita). A fonte de verdade da
    // quitacao e a SOMA dos INVOICE_PAYMENT vinculados por transactions.invoice_id.
    // Faturas anteriores a 005 nao tem vinculo — para essas, valor_pago legado segue valendo.
    // Sem este JOIN o motor cobrava multa/juros/IOF sobre fatura JA PAGA, porque so olhava
    // data_pagamento IS NULL (que nunca e escrito).
    const closedInvoiceRows = await dbService.executeQuery(`
        SELECT i.id, i.cpf, i.due_date, i.valor_total,
               COALESCE(i.valor_pago, 0) AS valor_pago,
               COALESCE(pagos.total, 0) AS pago_vinculado,
               CASE WHEN pagos.total IS NULL THEN 0 ELSE 1 END AS tem_vinculo,
               COALESCE(pagos_cpf.total, 0) AS pago_total_cpf
        FROM ${dbService.fq('invoices')} i
        LEFT JOIN (
            SELECT invoice_id, SUM(ABS(CAST(amount AS DECIMAL(15,2)))) AS total
            FROM ${dbService.fq('transactions')}
            WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NOT NULL
            GROUP BY invoice_id
        ) pagos ON pagos.invoice_id = i.id
        LEFT JOIN (
            SELECT cpf, SUM(ABS(CAST(amount AS DECIMAL(15,2)))) AS total
            FROM ${dbService.fq('transactions')}
            WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NOT NULL
            GROUP BY cpf
        ) pagos_cpf ON pagos_cpf.cpf = i.cpf
        WHERE i.status = 'FECHADA' AND i.data_pagamento IS NULL
          ${invoiceScopeFilter}
        ORDER BY i.due_date ASC
    `);
    // CASCATA (mesma regra do enrich/auditor/sync): o pagamento é UMA transação com o
    // valor total (comprovante); a quitação de cada fatura é derivada distribuindo o
    // TOTAL de INVOICE_PAYMENT do CPF da mais antiga para a mais nova (planDistribution).
    const _cascadeMotor = new Map();
    {
        const _byCpfMotor = new Map();
        for (const _r of closedInvoiceRows) {
            if (!_byCpfMotor.has(_r.cpf)) _byCpfMotor.set(_r.cpf, []);
            _byCpfMotor.get(_r.cpf).push(_r);
        }
        for (const [cpf, rs] of _byCpfMotor) {
            const _totalCpf = parseFloat(rs[0]?.pago_total_cpf || 0);
            if (_totalCpf <= 0.005) continue;
            const _dist = planDistribution(rs, _totalCpf);
            for (const inv of _dist.invoices) _cascadeMotor.set(inv.id, inv.newValorPago);
        }
    }
    const closedDueByCpf = new Map();
    for (const row of closedInvoiceRows) {
        const valorTotal = parseFloat(row.valor_total || 0);
        // CASCATA tem precedência (1 tx única cobre as faturas da massa); sem cascata,
        // híbrido legado — vínculo por invoice_id; sem vínculo, valor_pago (pré-005).
        const pago = _cascadeMotor.has(row.id)
            ? _cascadeMotor.get(row.id)
            : (parseInt(row.tem_vinculo, 10) === 1
                ? parseFloat(row.pago_vinculado || 0)
                : parseFloat(row.valor_pago || 0));
        const residual = Math.max(0, valorTotal - pago);
        // Fatura ja quitada nao entra no mapa: nao gera encargo nem mantem inadimplente.
        // O `continue` precisa vir ANTES do has(): sem ele, a fatura quitada (mais antiga,
        // por causa do ORDER BY ASC) ocuparia o slot do CPF e mascararia uma fatura
        // seguinte legitimamente em aberto.
        if (residual <= 0.005) continue;
        if (!closedDueByCpf.has(row.cpf)) {
            closedDueByCpf.set(row.cpf, {
                dueDate: row.due_date,
                amount: residual,
                valorTotal,
                valorPago: pago,
                // Pagamento MÍNIMO (>= 10% da fatura) recebido mas com residual em aberto:
                // a conta é regularizada (dias de atraso zerados e mantidos em 0) mas os
                // encargos CONTINUAM acumulando até o pagamento total. Pagamento abaixo
                // do mínimo (< 10%) mantém a inadimplência e os dias contando.
                // MESMO critério da rota de pay (invoiceController: minPayment =
                // Math.max(totalDue * 0.10, 10)): o piso de R$ 10 evita que faturas
                // pequenas (ex.: R$ 50) tenham mínimo irrisório de R$ 5 e classifiquem
                // PARCIAL como MÍNIMO.
                pagamentoMinimo: pago >= Math.max(valorTotal * 0.10, 10) - 0.01,
            });
        }
    }

    let markedInadimplente = 0;
    let markedAdimplente = 0;
    let chargesGenerated = 0;
    const chargesDetail = [];
    const errors = [];

    for (const u of users) {
      // Isolamento por massa: uma falha em um CPF nao pode impedir o processamento dos
      // seguintes. Antes deste try/catch, um erro aqui abortava o laco inteiro e as massas
      // restantes ficavam sem encargos no dia, sem nenhum aviso de que foram puladas.
      // A indentacao do corpo foi preservada de proposito: o diff mostra apenas as bordas.
      try {
        const closedInvoiceData = closedDueByCpf.get(u.cpf);
        // Sem fatura FECHADA com residual > 0: o CPF nao tem divida vencida em aberto.
        // Pode ser que nunca teve, ou que acabou de quitar (o mapa acima agora exclui
        // faturas cobertas por pagamento vinculado). Nos dois casos o estado correto e
        // adimplente/0 — antes o `continue` seco deixava o status antigo congelado, e
        // quem pagava continuava marcado inadimplente para sempre.
        if (!closedInvoiceData) {
            if (u.account_status !== 'adimplente' || parseInt(u.days_overdue) !== 0) {
                await dbService.executeQuery(`
                    UPDATE ${dbService.fq('users')}
                    SET account_status = 'adimplente', days_overdue = 0, overdue_status = 'EM_DIA', updated_at = CURRENT_TIMESTAMP
                    WHERE cpf = '${u.cpf}'
                `);
                markedAdimplente++;
            }
            continue;
        }

        const dueDate = new Date(closedInvoiceData.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const todayMidnight = new Date(today);
        todayMidnight.setHours(0, 0, 0, 0);
        
        const diffMs = todayMidnight - dueDate;
        const daysOverdue = diffMs > 0 ? Math.floor(diffMs / 86400000) : 0;
        
        // Pagamento mínimo (>= 10%) mantém o contador ZERADO (regra de negócio): mesmo com
        // a fatura ainda devendo, o cliente fez acordo e a conta fica "em dia" — os
        // encargos continuam acumulando (bloco abaixo), mas os dias de atraso exibidos
        // ficam 0 até a quitação TOTAL. Abaixo do mínimo (< 10%): segue inadimplente,
        // os dias continuam contando e os encargos continuam acumulando.
        const displayDays = closedInvoiceData.pagamentoMinimo ? 0 : daysOverdue;
        const newStatus = closedInvoiceData.pagamentoMinimo
            ? 'adimplente'
            : (daysOverdue >= 1 ? 'inadimplente' : 'adimplente');

        console.log(`[DEBUG] CPF: ${u.cpf}, dueDate: ${dueDate}, today: ${todayMidnight}, diffMs: ${diffMs}, daysOverdue: ${daysOverdue}, displayDays: ${displayDays}, newStatus: ${newStatus}`);

        // Recalcular encargos diariamente enquanto em atraso (multa 2%, IOF 0,38% + 0,0082%/dia,
        // juros remuneratórios 15,39% a.m., juros de mora 1% a.m.)
        // Acumula encargos enquanto houver residual em aberto E (fatura vencida OU pagamento
        // mínimo já feito). Com mínimo o contador de dias fica 0 mas os juros/IOF seguem
        // incrementando sobre o residual até o pagamento TOTAL.
        if (daysOverdue > 0 || closedInvoiceData.pagamentoMinimo) {
            // Usa o saldo RESIDUAL da fatura fechada (valor_total - valor_pago) para calcular os encargos.
            // Para massas com pagamento parcial, o encargo incide apenas sobre o que 
            // efetivamente falta pagar — NÃO sobre o valor_total bruto.
            // O residual é definido em closedDueByCpf.set(..., { amount: residual, ... }) na linha 4060.
            const invoiceAmount = Math.max(0, parseFloat(closedInvoiceData.amount || 0));
            if (invoiceAmount > 0) {
                // ———— REGRA DE ACUMULAÇÃO DE ENCARGOS (INCREMENTO DIÁRIO) ————
                // NÃO deletar encargos antigos! Cada execução do billing ADICIONA
                // o incremento de 1 dia sobre o saldo residual atual. Após pagamento
                // parcial o residual cai, e os incrementos diários passam a ser
                // calculados sobre o novo residual menor — a penalidade já acumulada
                // (encargos antigos) NÃO diminui, apenas os novos dias passam a
                // render menos.
                //
                // Encargos de multa (2%) e IOF adicional (0,38%) são cobranças
                // ÃšNICAS — inseridas apenas na primeira execução, calculadas sobre
                // o valor_total ORIGINAL (não o residual). Juros de mora, juros
                // remuneratórios e IOF diário são incrementos DIÁRIOS sobre o
                // residual — sempre inseridos a cada execução.
                // REF ESTÁVEL (fix da análise mensal e da multa duplicada): a referência das
                // charges NÃO pode ser o ciclo corrente. cycle.invoiceRef muda conforme a
                // config de faturamento e, na massa 805.357.576-54, girou (2026-07 → 2026-08
                // → 2026-09) fazendo o motor recriar a multa de 2% (cobrança ÚNICA) a cada
                // troca de ref — duplicando a cobrança. A ref agora é o MÊS DA FATURA MAIS
                // ANTIGA NÃO PAGA (a que ancora os encargos): estável enquanto essa dívida
                // existir, e todas as charges do mesmo débito compartilham a mesma ref.
                const stableRef = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
                // Checagem de "encargos únicos" (multa 2% e IOF adicional) GLOBAL por CPF:
                // sem filtro de invoice_reference — qualquer multa/IOF pending do CPF já
                // inibe nova inserção. Com o filtro por ref instável, cada troca de ref
                // criava multa duplicada (77,42 em 2026-07 E em 2026-08 na massa 805).
                const existingCharges = await dbService.executeQuery(`
                    SELECT charge_type, COALESCE(SUM(amount), 0) AS total
                    FROM ${dbService.fq('billing_charges')}
                    WHERE cpf = '${u.cpf}' AND status = 'pending'
                    GROUP BY charge_type
                `);
                const getExisting = (type) => {
                    const row = existingCharges.find(e => e.charge_type === type);
                    return row ? parseFloat(row.total) : 0;
                };

                // IDEMPOTÊNCIA DIÁRIA: o motor roda 1x/dia (cron 00:00) mas também é
                // disparado pelo boot catch-up e pela rota admin. Sem esta checagem,
                // cada execução adicional inseria o incremento do MESMO dia de novo
                // (juros_mora/juros_remuneratorios/iof duplicados por dia — 958 linhas
                // em 107 massas). Regra: 1 incremento por (cpf, invoice_reference,
                // charge_type, days_overdue) — a chave inclui a ref estável para não
                // colidir caso a âncora mude (fatura mais antiga não paga) ou existam
                // charges legadas de refs antigas no histórico. Multa/IOF adicional
                // continuam no check global acima (uma única vez por débito).
                const existingDayRows = await dbService.executeQuery(`
                    SELECT invoice_reference, charge_type, days_overdue
                    FROM ${dbService.fq('billing_charges')}
                    WHERE cpf = '${u.cpf}' AND status = 'pending'
                `);
                // A chave usa o invoice_reference REAL de cada linha existente (não o
                // stableRef corrente): linhas legadas de refs antigas (ex.: 2026-09 com
                // dias 1-27 do período de base errada) NÃO bloqueiam o incremento correto
                // de hoje sob a ref estável — só bloqueia quem tem a MESMA ref e o MESMO
                // dia. Se usasse stableRef aqui, uma linha legada 2026-09|dia 27 viraria
                // "juros_mora|2026-07|27" e o motor pularia o incremento real de hoje
                // para as massas que ainda têm histórico legado (bug reportado no review).
                const existingDays = new Set((existingDayRows || []).map(r => `${r.charge_type}|${r.invoice_reference}|${r.days_overdue}`));
                const dayAlreadyInserted = (type) => existingDays.has(`${type}|${stableRef}|${daysOverdue}`);
                const markDayInserted = (type) => existingDays.add(`${type}|${stableRef}|${daysOverdue}`);

                // INSERT com guarda TOCTOU (race cross-process): o SELECT acima e o INSERT
                // abaixo têm uma janela entre si — se 2 processos (cron + catch-up de outro
                // worker, dev API + teste) passarem pelo SELECT juntos e chegarem ao INSERT
                // juntos, o unique index billing_charges_daily_unique (fase 2 da limpeza)
                // rejeita o segundo com 23505. Isto NÃO é erro de massa: o dia já existe.
                // Captura 23505 e trata como "já inserido" — sem ON CONFLICT porque o índice
                // pode ainda não existir em ambientes que não rodaram a limpeza.
                const insertCharge = async (chargeType, amount) => {
                    const idBase = `${u.cpf}_${stableRef}_${Date.now()}_${chargeType}`;
                    try {
                        await dbService.executeQuery(`
                            INSERT INTO ${dbService.fq('billing_charges')}
                            (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount)
                            VALUES
                            ('${idBase}', '${u.cpf}', '${stableRef}', '${chargeType}', ${amount}, ${daysOverdue}, ${invoiceAmount})
                        `);
                        return true;
                    } catch (err) {
                        if (err && (err.code === '23505' || /duplicate key/i.test(err.message || ''))) {
                            console.warn(`[BillingValidation] ${u.cpf}: ${chargeType} do dia ${daysOverdue} já inserido por outro processo — ignorado.`);
                            return false;
                        }
                        throw err;
                    }
                };

                const originalValorTotal = parseFloat(closedInvoiceData.valorTotal || 0);
                let totalLineCharges = 0;

                // ———— MULTA (2%): única vez sobre o valor_total ORIGINAL ————
                if (getExisting('multa') < 0.005) {
                    const multa = calcMulta(originalValorTotal);
                    if (multa > 0.005) {
                        markDayInserted('multa');
                        if (await insertCharge('multa', multa)) {
                            chargesGenerated++;
                            totalLineCharges += multa;
                        }
                    }
                } else {
                    totalLineCharges += getExisting('multa');
                }

                // ———— IOF: primeira vez = adicional(única) + diário(acumulado);
                //     subsequente = apenas IOF diário(1 dia) sobre o residual ————
                if (getExisting('iof') < 0.005) {
                    // Primeira cobrança: IOF adicional (única, sobre original) + IOF diário acumulado
                    const iof = calcIof(originalValorTotal, daysOverdue);
                    if (iof > 0.005) {
                        markDayInserted('iof');
                        if (await insertCharge('iof', iof)) {
                            chargesGenerated++;
                            totalLineCharges += iof;
                        }
                    }
                } else {
                    // Cobranças subsequentes: apenas IOF diário (1 dia) sobre o residual
                    const dailyIof = calcIofDiario(invoiceAmount, 1);
                    if (!dayAlreadyInserted('iof') && dailyIof > 0.005) {
                        markDayInserted('iof');
                        if (await insertCharge('iof', dailyIof)) {
                            chargesGenerated++;
                            totalLineCharges += dailyIof;
                        }
                    } else {
                        totalLineCharges += getExisting('iof');
                    }
                }

                // ———— JUROS DE MORA: incremento diário sobre o residual ————
                {
                    const dailyJurosMora = calcJurosMora(invoiceAmount, 1);
                    if (!dayAlreadyInserted('juros_mora') && dailyJurosMora > 0.005) {
                        markDayInserted('juros_mora');
                        if (await insertCharge('juros_mora', dailyJurosMora)) {
                            chargesGenerated++;
                            totalLineCharges += dailyJurosMora;
                        }
                    } else {
                        totalLineCharges += getExisting('juros_mora');
                    }
                }

                // ———— JUROS REMUNERATÃ“RIOS: incremento diário sobre o residual ————
                {
                    const dailyJurosRem = calcJurosRemuneratorios(invoiceAmount, 1);
                    if (!dayAlreadyInserted('juros_remuneratorios') && dailyJurosRem > 0.005) {
                        markDayInserted('juros_remuneratorios');
                        if (await insertCharge('juros_remuneratorios', dailyJurosRem)) {
                            chargesGenerated++;
                            totalLineCharges += dailyJurosRem;
                        }
                    } else {
                        totalLineCharges += getExisting('juros_remuneratorios');
                    }
                }
                chargesDetail.push({
                    cpf: u.cpf, invoiceRef: stableRef,
                    invoiceAmount,
                    multa: getExisting('multa') || calcMulta(originalValorTotal),
                    iof: getExisting('iof') || calcIof(invoiceAmount, daysOverdue),
                    jurosRem: getExisting('juros_remuneratorios') || calcJurosRemuneratorios(invoiceAmount, 1),
                    jurosMora: getExisting('juros_mora') || calcJurosMora(invoiceAmount, 1),
                    total: round2(totalLineCharges)
                });
            }
        }

        // ———— Notificação de Pagamento Mínimo Detectado ————
        // Se o usuário fez pagamento mínimo (â‰¥10% do total) mas ainda tem residual,
        // multa e juros de mora estão estacionados — o sistema notifica isso 1x/dia.
        if (closedInvoiceData.valorPago > 0 && closedInvoiceData.valorTotal > 0) {
            const pctPago = closedInvoiceData.valorPago / closedInvoiceData.valorTotal;
            const isMinimoDetectado = pctPago >= 0.10 && closedInvoiceData.amount > 0;
            if (isMinimoDetectado) {
                try {
                    const dayAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
                    const recentNotifs = await dbService.executeQuery(`
                        SELECT id FROM ${dbService.fq('notifications')}
                        WHERE cpf = '${u.cpf}'
                          AND title = 'Pagamento mínimo de fatura ✅'
                          AND created_at > '${dayAgo}'
                        LIMIT 1
                    `);
                    if (recentNotifs.length === 0) {
                        await notificationsRepo.addNotification({
                            cpf: u.cpf,
                            title: 'Pagamento mínimo de fatura ✅',
                            message: `R$ ${closedInvoiceData.valorPago.toFixed(2)} pagos (mínimo). Multa e juros de mora estacionados! Juros remuneratórios continuam sobre o saldo residual de R$ ${closedInvoiceData.amount.toFixed(2)}.`,
                            actionUrl: '/dashboard'
                        });
                        console.log(`[Notif] Pagamento mínimo detectado para ${u.cpf} — notificação enviada.`);
                    }
                } catch (notifErr) {
                    console.warn(`⚠️ Erro ao enviar notificação de pagamento mínimo para ${u.cpf}:`, notifErr.message);
                }
            }

            // ———— Notificação de Pagamento ABAIXO do Mínimo (⚠️ Crítico) ————
            // Se o usuário pagou MAS o valor pago é INSUFICIENTE (abaixo de 10% do total),
            // o saldo residual continua gerando encargos e a massa está em situação crítica.
            // O admin precisa saber para priorizar ação de cobrança.
            const isAbaixoCritico = pctPago > 0 && pctPago < 0.10 && closedInvoiceData.amount > 0;
            if (isAbaixoCritico) {
                try {
                    const dayAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
                    const recentAbaixoNotifs = await dbService.executeQuery(`
                        SELECT id FROM ${dbService.fq('notifications')}
                        WHERE cpf = '${u.cpf}'
                          AND (title LIKE '%Abaixo%' OR title LIKE '%abaixo%' OR title LIKE '%crítico%' OR title LIKE '%critico%')
                          AND created_at > '${dayAgo}'
                        LIMIT 1
                    `);
                    if (recentAbaixoNotifs.length === 0) {
                        const minimoNeeded = round2(closedInvoiceData.valorTotal * 0.10);
                        await notificationsRepo.addNotification({
                            cpf: u.cpf,
                            title: '⚠️ Pagamento abaixo do mínimo crítico',
                            message: `Apenas R$ ${closedInvoiceData.valorPago.toFixed(2)} pagos (${(pctPago * 100).toFixed(0)}% do total). Mínimo necessário: R$ ${minimoNeeded.toFixed(2)}. Saldo residual: R$ ${closedInvoiceData.amount.toFixed(2)}. Encargos totais continuam!`,
                            actionUrl: '/admin/requests'
                        });
                        console.log(`[Notif] ⚠️ ABAIXO crítico detectado para ${u.cpf} — pagou apenas ${(pctPago * 100).toFixed(0)}% do total.`);
                    }
                } catch (notifErr) {
                    console.warn(`⚠️ Erro ao enviar notificação de ABAIXO crítico para ${u.cpf}:`, notifErr.message);
                }
            }
        }

        if (newStatus !== u.account_status || displayDays !== parseInt(u.days_overdue)) {
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('users')}
                SET account_status = '${newStatus}', days_overdue = ${displayDays}, overdue_status = '${overdueStatusFor(newStatus, displayDays)}', updated_at = CURRENT_TIMESTAMP
                WHERE cpf = '${u.cpf}'
            `);
            if (newStatus === 'inadimplente') markedInadimplente++;
            else markedAdimplente++;
        }
      } catch (massErr) {
        errors.push({ cpf: u.cpf, etapa: 'billing_validation', mensagem: massErr.message });
        console.error(`[BillingValidation] Falha na massa ${u.cpf}:`, massErr);
      }
    }

    // ── Sincronizar dias_atraso nas invoices (sempre, não apenas quando users muda) ──
    // Usa a CASCATA (mesma regra do enrich/auditor/sync): o pago por fatura é derivado
    // do TOTAL de INVOICE_PAYMENT do CPF via planDistribution (1 tx única cobre as
    // faturas da mais antiga para a mais nova) — NÃO do valor_pago do DB (sempre 0 na
    // pós-005, fechada imutável) nem do vínculo por invoice_id isolado (a tx única fica
    // só na fatura mais recente). Sem cascata, fatura quitada por tx única voltava a
    // exibir dias reais a cada execução (regressão 381/805).
    // 1) ZERO nas fechadas sem dívida (residual <= 0.005) ou com pagamento mínimo (>= 10%);
    // 2) demais: real-time (hoje - vencimento).
    try {
        const _zeroIds = new Set();
        for (const row of closedInvoiceRows) {
            const valorTotal = parseFloat(row.valor_total || 0);
            const pago = _cascadeMotor.has(row.id)
                ? _cascadeMotor.get(row.id)
                : (parseInt(row.tem_vinculo, 10) === 1
                    ? parseFloat(row.pago_vinculado || 0)
                    : parseFloat(row.valor_pago || 0));
            const residual = Math.max(0, valorTotal - pago);
            const pagMin = pago >= Math.max(valorTotal * 0.10, 10) - 0.01;
            if (residual <= 0.005 || pagMin) _zeroIds.add(row.id);
        }
        if (_zeroIds.size) {
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('invoices')}
                SET dias_atraso = 0, updated_at = CURRENT_TIMESTAMP
                WHERE status = 'FECHADA' AND data_pagamento IS NULL
                  ${onlyCpf ? `AND cpf = '${onlyCpf}'` : ''}
                  AND id IN (${[..._zeroIds].map(id => `'${id}'`).join(',')})
                  AND dias_atraso != 0
            `);
        }
        const _idsSqlZero = _zeroIds.size
            ? ` AND id NOT IN (${[..._zeroIds].map(id => `'${id}'`).join(',')})`
            : '';
        // Demais (dívida real): real-time individual do vencimento.
        await dbService.executeQuery(`
            UPDATE ${dbService.fq('invoices')}
            SET dias_atraso = GREATEST(0, (CURRENT_DATE - due_date::date)),
                updated_at = CURRENT_TIMESTAMP
            WHERE status = 'FECHADA' AND data_pagamento IS NULL
              AND due_date < CURRENT_TIMESTAMP
              ${onlyCpf ? `AND cpf = '${onlyCpf}'` : ''}
              ${_idsSqlZero}
              AND dias_atraso IS DISTINCT FROM GREATEST(0, (CURRENT_DATE - due_date::date))
        `);
    } catch (invoiceSyncErr) {
        console.warn('⚠️ Erro ao sincronizar dias_atraso nas invoices:', invoiceSyncErr.message);
    }

    return {
        success: true,
        processadas: users.length - errors.length,
        falhas: errors.length,
        errors,
        message: `Validação concluída. ${markedInadimplente} inadimplentes, ${markedAdimplente} adimplentes, ${chargesGenerated} encargos gerados${errors.length ? `, ${errors.length} massa(s) com falha` : ''}.`,
        cycle: {
            ref: cycle.invoiceRef, status: cycle.cycleStatus,
            closeDate: cycle.closeDate, dueDate: cycle.dueDate,
            overdueDeadline: cycle.overdueDeadline
        },
        updated: { inadimplente: markedInadimplente, adimplente: markedAdimplente },
        charges: { generated: chargesGenerated, detail: chargesDetail }
    };
}

// ———— Sincronização autônoma de dias_atraso nas invoices ————
// Função standalone que atualiza dias_atraso em TODAS as invoices FECHADAS não pagas
// com base na data atual. Pode ser chamada via cron ou manualmente.
// Diferente do sync embutido no runBillingValidation, esta função:
// - Ã‰ independente (não depende do status do usuário mudar)
// - Retorna contagem de quantas invoices foram atualizadas
// - Pode ser chamada a qualquer momento sem efeitos colaterais
const syncInvoiceDiasAtraso = async () => {
    try {
        // CASCATA (mesma regra do motor/enrich/auditor): o pago por fatura é derivado
        // do TOTAL de INVOICE_PAYMENT do CPF via planDistribution — não do valor_pago
        // do DB (0 na pós-005) nem do vínculo por invoice_id isolado. Busca as fechadas
        // não pagas com o total por CPF, distribui da mais antiga para a mais nova e
        // zera dias das quitadas/mínimo; as demais seguem real-time.
        const invRowsSync = await dbService.executeQuery(`
            SELECT i.id, i.cpf, i.due_date, i.valor_total,
                   COALESCE(i.valor_pago, 0) AS valor_pago,
                   COALESCE(pagos.total, 0) AS pago_vinculado,
                   CASE WHEN pagos.total IS NULL THEN 0 ELSE 1 END AS tem_vinculo,
                   COALESCE(pagos_cpf.total, 0) AS pago_total_cpf
            FROM ${dbService.fq('invoices')} i
            LEFT JOIN (
                SELECT invoice_id, SUM(ABS(CAST(amount AS DECIMAL(15,2)))) AS total
                FROM ${dbService.fq('transactions')}
                WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NOT NULL
                GROUP BY invoice_id
            ) pagos ON pagos.invoice_id = i.id
            LEFT JOIN (
                SELECT cpf, SUM(ABS(CAST(amount AS DECIMAL(15,2)))) AS total
                FROM ${dbService.fq('transactions')}
                WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NOT NULL
                GROUP BY cpf
            ) pagos_cpf ON pagos_cpf.cpf = i.cpf
            WHERE i.status = 'FECHADA' AND i.data_pagamento IS NULL
            ORDER BY i.due_date ASC
        `);
        const _cascadeSync = (() => {
            const map = new Map();
            const byCpf = new Map();
            for (const r of invRowsSync) {
                if (!byCpf.has(r.cpf)) byCpf.set(r.cpf, []);
                byCpf.get(r.cpf).push(r);
            }
            for (const [cpf, rs] of byCpf) {
                const total = parseFloat(rs[0]?.pago_total_cpf || 0);
                if (total <= 0.005) continue;
                const dist = planDistribution(rs, total);
                for (const inv of dist.invoices) map.set(inv.id, inv.newValorPago);
            }
            return map;
        })();
        const _zeroIdsSync = new Set();
        for (const row of invRowsSync) {
            const valorTotal = parseFloat(row.valor_total || 0);
            const pago = _cascadeSync.has(row.id)
                ? _cascadeSync.get(row.id)
                : (parseInt(row.tem_vinculo, 10) === 1
                    ? parseFloat(row.pago_vinculado || 0)
                    : parseFloat(row.valor_pago || 0));
            const residual = Math.max(0, valorTotal - pago);
            const pagMin = pago >= Math.max(valorTotal * 0.10, 10) - 0.01;
            if (residual <= 0.005 || pagMin) _zeroIdsSync.add(row.id);
        }
        if (_zeroIdsSync.size) {
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('invoices')}
                SET dias_atraso = 0, updated_at = CURRENT_TIMESTAMP
                WHERE status = 'FECHADA' AND data_pagamento IS NULL
                  AND id IN (${[..._zeroIdsSync].map(id => `'${id}'`).join(',')})
                  AND dias_atraso != 0
            `);
        }
        const _idsSqlSync = _zeroIdsSync.size
            ? ` AND id NOT IN (${[..._zeroIdsSync].map(id => `'${id}'`).join(',')})`
            : '';
        const result = await dbService.executeQuery(`
            UPDATE ${dbService.fq('invoices')}
            SET dias_atraso = GREATEST(0, (CURRENT_DATE - due_date::date)),
                updated_at = CURRENT_TIMESTAMP
            WHERE status = 'FECHADA' AND data_pagamento IS NULL
              AND due_date < CURRENT_TIMESTAMP
              ${_idsSqlSync}
              AND dias_atraso IS DISTINCT FROM GREATEST(0, (CURRENT_DATE - due_date::date))
        `);
        const updatedCount = result?.rowCount || result?.length || 0;
        
        // Verificar quantas invoices totais existem
        const verify = await dbService.executeQuery(`
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN COALESCE(dias_atraso, 0) = GREATEST(0, (CURRENT_DATE - due_date::date)) THEN 1 ELSE 0 END) AS corretas
            FROM ${dbService.fq('invoices')}
            WHERE status = 'FECHADA' AND data_pagamento IS NULL AND due_date < CURRENT_TIMESTAMP
        `);
        const total = parseInt(verify?.[0]?.total || 0);
        const corretas = parseInt(verify?.[0]?.corretas || 0);
        
        return { success: true, updated: updatedCount, total, corretas };
    } catch (err) {
        console.error('[syncInvoiceDiasAtraso] Erro:', err.message);
        return { success: false, error: err.message, updated: 0 };
    }
};
module.exports = {
  runBillingValidation,
  runBillingValidationInner,
  syncInvoiceDiasAtraso,
  runDailyBillingValidation: runBillingValidation,
  syncAllInvoiceDaysOverdue: syncInvoiceDiasAtraso
};
