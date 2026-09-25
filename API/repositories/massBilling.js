// massBilling.js — Gerador de Massa 4.0: histórico de faturamento (seedMassBilling),
// modo "pagamento" (seedCiclosComPagamento), normalização de ciclos e o invariante de
// forma da massa (validarInvarianteMassa). Extraído de usersRepo.js (M-3, Task 5 —
// arquivo tinha passado de 500 linhas) — usersRepo.js requer daqui e re-exporta com os
// MESMOS nomes, então nenhum import de teste ou de outro módulo precisou mudar.
const { esc } = require('./context');
const { nowDb } = require('../utils/timezone');
const { garantirColunasQuitacao } = require('../services/encargosPagamento');
const { sqlResidualFechadas } = require('../services/saldoAnterior');
const { TOLERANCIA_QUITACAO } = require('../utils/invoiceMath');
const {
    simularCiclosComPagamento, normalizarTipoPagamento, normalizarDiasAtrasoPagamento, TIPOS_PAGAMENTO_MASSA,
} = require('../services/massaPagamentos');
const {
    MASS_MERCHANTS_NACIONAL, MASS_MERCHANTS_INTERNACIONAL, MASS_MERCHANTS,
    calcIofInternacional, pickMerchant, pickMerchantAvistaComValor,
} = require('./massMerchants');

// Vencimento REAL mais recente que já passou para um dado dia-do-mês (dueDay).
// Usado para ancorar a fatura FECHADA da massa no dueDay do cartão em vez de
// numa data solta (hoje - daysOverdue), que diverge do dia configurado.
// Mesmo dia-do-mês `k` meses antes/depois, sem overflow (dueDay 31 em fevereiro => 28/29).
function shiftMonthsSameDay(date, k, dueDay) {
    const y = date.getFullYear();
    const m = date.getMonth() + k;
    const lastDay = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(dueDay, lastDay), 12, 0, 0);
}

// `minDaysPassed` (opcional): garante que o vencimento devolvido tenha ao menos N dias
// de atraso em relação à referência — recua mês a mês até satisfazer. Usado para o ciclo
// ATUAL inadimplente da massa: uma fatura que venceu hoje (ou há 2 dias) não pode nascer
// como "inadimplente" — o piso é MIN_DIAS_ATRASO_CICLO_ATUAL (7d, regra de bloqueio >=8d fica
// a 1 dia de ser atingida) e o tier escolhido pode elevar (15d/30d).
function computeLastPassedDueDate(dueDay, referenceDate = new Date(), minDaysPassed = 0) {
    let d = shiftMonthsSameDay(referenceDate, 0, dueDay);
    if (d > referenceDate) d = shiftMonthsSameDay(d, -1, dueDay);
    if (minDaysPassed > 0) {
        const limite = new Date(referenceDate);
        limite.setDate(limite.getDate() - minDaysPassed);
        let guard = 0;
        while (d > limite && guard++ < 24) d = shiftMonthsSameDay(d, -1, dueDay);
    }
    return d;
}

const MIN_DIAS_ATRASO_CICLO_ATUAL = 7;
const MAX_MASS_CYCLES = 6;
const round2 = (n) => Math.round(n * 100) / 100;

// Tier de atraso do gerador de massas (WEB/utils/massGenerator.ts OverdueState),
// derivado do estado real — usado para manter users.overdue_status sincronizado
// com account_status × days_overdue (o campo nunca era gravado: toda massa nascia
// com o DEFAULT 'EM_DIA', mesmo as inadimplentes).
function overdueStatusFor(accountStatus, daysOverdue) {
    const days = Number(daysOverdue) || 0;
    if (accountStatus !== 'inadimplente' || days <= 0) return 'EM_DIA';
    if (days <= 7) return 'EM_ATRASO_7D';
    if (days <= 15) return 'EM_ATRASO_15D';
    return 'EM_ATRASO_30D';
}

// Ciclo do payload: string (legado) ou objeto { status, pagamento, ... }.
function statusDoCiclo(c) {
    return typeof c === 'string' ? c : (c && (c.status || c.accountStatus)) || null;
}

/** INSERT simples a partir de um objeto (valores via esc: número sem aspas, null = NULL). */
function sqlInsert(db, tabela, row) {
    const cols = Object.keys(row);
    return `INSERT INTO ${db.fq(tabela)} (${cols.join(', ')}) VALUES (${cols.map(c => esc(row[c])).join(', ')})`;
}

/**
 * Gerador 4.0 — gera o histórico de faturamento da massa como um loop sobre
 * `cycles: Array<'adimplente'|'inadimplente'>` (1 a 6 posições, mais antigo primeiro):
 *  - adimplente: 3 compras SHOP_CREDIT no ciclo + fatura FECHADA paga no vencimento
 *    (+ compras no ciclo aberto atual quando é o último ciclo).
 *  - inadimplente: fatura FECHADA vencida não paga com os 4 encargos (multa, juros
 *    mora, juros remuneratórios, IOF). Sequências consecutivas encadeiam
 *    `saldo_anterior` e usam UMA compra parcelada (10-12x) aberta no 1º ciclo da
 *    sequência — cartão bloqueado (>=8d) nunca origina compra nova. Merchant
 *    internacional soma IOF de câmbio 6,38% ao IOF de cada parcela.
 *
 * `users.days_overdue` final = dias desde a fatura MAIS ANTIGA da sequência ativa.
 * Compat: payload legado `{accountStatus, daysOverdue, overdueAmount}` vira
 * `cycles=[accountStatus]` / `overdueAmountBase=overdueAmount`.
 *
 * Ciclo com PAGAMENTO em atraso — `{ status: 'inadimplente', pagamento: 'TOTAL' |
 * 'MINIMO' | 'ABAIXO_MINIMO' | 'PARCIAL', diasAtrasoPagamento }` — liga o modo
 * "pagamento" da massa inteira (seedCiclosComPagamento): tudo gravado pela regra de
 * encargos primeiro, com pagamentos vinculados e datas retroativas. Só strings mantém
 * o histórico legado abaixo, byte a byte (contrato dos testes e massas existentes).
 */
async function seedMassBilling(db, cpf, options = {}) {
    let { cycles, overdueAmountBase, creditLimit, dueDay, minOverdueDays, accountStatus, daysOverdue, overdueAmount } = options;

    if (!Array.isArray(cycles) || cycles.length === 0) {
        const st = accountStatus || (daysOverdue > 0 ? 'inadimplente' : 'adimplente');
        cycles = [st];
        if (overdueAmountBase === undefined) {
            overdueAmountBase = overdueAmount || 0;
        }
    }
    if (overdueAmountBase === undefined) {
        overdueAmountBase = overdueAmount || 0;
    }
    const ehObjeto = c => c !== null && typeof c === 'object';
    if (cycles.some(ehObjeto)) cycles = normalizeMassCycles(cycles);
    const comPagamento = cycles.some(ehObjeto);

    const genId = () => (db.generateUUID ? db.generateUUID() : `tx-${cpf}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    const pickMerchantName = () => MASS_MERCHANTS[Math.floor(Math.random() * MASS_MERCHANTS.length)];
    const insertPurchase = async (amount, description, dateIso, type = 'SHOP_CREDIT', installments = null) => {
        const id = genId();
        await db.executeQuery(`
            INSERT INTO ${db.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date)
            VALUES (${esc(id)}, ${esc(cpf)}, ${esc(type)}, ${esc((-Math.abs(amount)).toFixed(2))}, ${esc(installments ? `${description} (${installments})` : description)}, NULL, NULL, NULL, ${esc(dateIso)})
        `);
        return { id, amount: Math.abs(amount), merchant: description, date: dateIso, type };
    };

    const now = new Date();
    now.setHours(12, 0, 0, 0);

    // Âncora = vencimento do ciclo ATUAL (último). Se ele é inadimplente, o vencimento
    // precisa ter pelo menos `minDias` de atraso (piso 7d; tier pode pedir 15d/30d) —
    // senão recua 1 mês. Ciclos anteriores recuam 1 mês cada a partir da âncora, sempre
    // no mesmo dueDay, para a cadeia bater com o calendário do cartão.
    const ultimo = cycles[cycles.length - 1];
    const lastIsInadimplente = statusDoCiclo(ultimo) === 'inadimplente';
    // Compat: payload legado informa `daysOverdue` (7/15/30) — vira o atraso mínimo pedido.
    const minPedido = Number(minOverdueDays ?? daysOverdue) || 0;
    // Ciclo atual pago em atraso: o pagamento (vencimento + N dias) tem de ter saído
    // antes de hoje, com ao menos 1 dia de encargo depois dele.
    const diasDoPagamentoAtual = ehObjeto(ultimo) ? ultimo.diasAtrasoPagamento + 1 : 0;
    const minDias = lastIsInadimplente ? Math.max(MIN_DIAS_ATRASO_CICLO_ATUAL, minPedido, diasDoPagamentoAtual) : 0;
    const anchor = dueDay ? computeLastPassedDueDate(Number(dueDay), now, minDias) : now;
    const anchorDay = dueDay ? Number(dueDay) : anchor.getDate();
    const cycleDueDates = cycles.map((_, idx) => shiftMonthsSameDay(anchor, -(cycles.length - 1 - idx), anchorDay));

    let saldoAnteriorAcumulado = 0;
    let installmentValue = 0;
    let installmentIndex = 0;
    let totalInstallments = 0;
    let isInternacional = false; // merchant da compra parcelada da sequência inadimplente ATUAL (Task 3: IOF de câmbio)
    let sequenceStartDueDate = null; // data da 1ª fatura da sequência inadimplente ATUAL — days_overdue final usa esta, não a do último ciclo (decisão de design #5 do spec)

    // Compras do ciclo inadimplente: a 1ª da sequência abre UMA compra parcelada
    // (10-12x) + plano; as seguintes lançam só a próxima parcela. O principal da
    // fatura é o valor da parcela (installmentValue).
    const comprasInadimplente = async (dueDate, isFirstOfSequence) => {
        if (isFirstOfSequence) {
            sequenceStartDueDate = dueDate;
            totalInstallments = 10 + Math.floor(Math.random() * 3);
            // Step 1.5: Fuzzing de Valores (+/- 10%)
            const baseVal = Number(overdueAmountBase) || 0;
            const fuzzFactor = 0.9 + (Math.random() * 0.2);
            const principalTotal = round2(baseVal > 0 ? baseVal * fuzzFactor : 0);
            installmentValue = round2(principalTotal / totalInstallments);
            installmentIndex = 1;

            const merchant = pickMerchant();
            isInternacional = merchant.internacional;

            const purchaseDate = new Date(dueDate);
            purchaseDate.setDate(purchaseDate.getDate() - (20 + Math.floor(Math.random() * 5)));
            await insertPurchase(principalTotal, merchant.nome, purchaseDate.toISOString(), 'INVOICE_INSTALLMENT', `1/${totalInstallments}`);

            const planId = genId();
            await db.executeQuery(`
                INSERT INTO ${db.fq('installment_plans')}
                (id, cpf, description, total_amount, installments, installment_amount, remaining_balance, remaining_installments)
                VALUES (${esc(planId)}, ${esc(cpf)}, ${esc(merchant.nome)}, ${principalTotal.toFixed(2)}, ${totalInstallments}, ${installmentValue.toFixed(2)}, ${principalTotal.toFixed(2)}, ${totalInstallments})
            `);
        } else {
            installmentIndex++;
            const txDate = new Date(dueDate);
            txDate.setDate(txDate.getDate() - (20 + Math.floor(Math.random() * 5)));
            await insertPurchase(installmentValue, pickMerchantName(), txDate.toISOString(), 'INVOICE_INSTALLMENT', `${installmentIndex}/${totalInstallments}`);
        }
        return installmentValue;
    };

    // 3 compras independentes, cada uma com merchant + valor sorteados dentro da faixa
    // realista dele (substitui o split de uma soma única — 3 recibos de mercado
    // diferentes, não 1/3 de um total arbitrário). Devolve o total gasto no ciclo.
    const comprasAdimplente = async (dueDate) => {
        let totalGasto = 0;
        for (let k = 0; k < 3; k++) {
            const { nome, valor } = pickMerchantAvistaComValor(400 / 3, 1000 / 3);
            const txDate = new Date(dueDate);
            txDate.setDate(txDate.getDate() - (5 + Math.floor(Math.random() * 15)));
            await insertPurchase(valor, nome, txDate.toISOString());
            totalGasto = round2(totalGasto + valor);
        }
        return totalGasto;
    };

    // Ciclo aberto atual: mesma lógica de merchant+valor realista das compras
    // fechadas, 3 recibos independentes em vez de 1/3 de uma soma.
    const comprasCicloAberto = async () => {
        for (let k = 0; k < 3; k++) {
            const { nome, valor } = pickMerchantAvistaComValor(300 / 3, 800 / 3);
            const txDate = new Date();
            txDate.setDate(txDate.getDate() - Math.floor(Math.random() * 6));
            await insertPurchase(valor, nome, txDate.toISOString());
        }
    };

    if (comPagamento) {
        return seedCiclosComPagamento(db, cpf, {
            cycles, cycleDueDates, now, genId,
            comprasInadimplente, comprasAdimplente, comprasCicloAberto,
            sequenciaInternacional: () => isInternacional,
        });
    }

    for (let i = 0; i < cycles.length; i++) {
        const status = cycles[i];
        const dueDate = cycleDueDates[i];
        const isLast = i === cycles.length - 1;

        if (status === 'inadimplente') {
            const isFirstOfSequence = i === 0 || cycles[i - 1] !== 'inadimplente';
            await comprasInadimplente(dueDate, isFirstOfSequence);
            if (isFirstOfSequence) saldoAnteriorAcumulado = 0;

            const principal = installmentValue;
            const daysOverdue = Math.max(1, Math.round((now.getTime() - dueDate.getTime()) / 86400000));

            const multa = round2(principal * 0.02);
            const jurosMora = round2(principal * 0.000333 * daysOverdue);
            const jurosRem = round2(principal * 0.00513 * daysOverdue);
            const iofAdicional = round2(principal * 0.0038);
            const iofDiario = round2(principal * 0.000082 * daysOverdue);
            // IOF de câmbio (6,38% fixo) só quando a compra parcelada da sequência é internacional.
            const iofExtra = isInternacional ? calcIofInternacional(principal) : 0;
            const iof = round2(iofAdicional + iofDiario + iofExtra);

            const invoiceId = genId();
            const nowIso = nowDb();
            await db.executeQuery(`
                INSERT INTO ${db.fq('invoices')}
                (id, cpf, status, due_date, valor_total, created_at, updated_at, data_pagamento, dias_atraso, saldo_anterior, valor_multa, valor_juros_mora, valor_juros_remuneratorios, valor_iof)
                VALUES (${esc(invoiceId)}, ${esc(cpf)}, 'FECHADA', ${esc(dueDate.toISOString())}, ${principal.toFixed(2)}, ${esc(nowIso)}, ${esc(nowIso)}, NULL, ${daysOverdue}, ${saldoAnteriorAcumulado.toFixed(2)}, ${multa}, ${jurosMora}, ${jurosRem}, ${iof})
            `);

            const ref = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
            for (const [type, amount] of [['multa', multa], ['juros_mora', jurosMora], ['juros_remuneratorios', jurosRem], ['iof', iof]]) {
                await db.executeQuery(`
                    INSERT INTO ${db.fq('billing_charges')}
                    (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount, created_at, status)
                    VALUES (${esc(genId())}, ${esc(cpf)}, ${esc(ref)}, ${esc(type)}, ${amount}, ${daysOverdue}, ${principal.toFixed(2)}, ${esc(nowIso)}, 'pending')
                `);
            }

            saldoAnteriorAcumulado = round2(saldoAnteriorAcumulado + principal);

            if (isLast) {
                // days_overdue final = dias desde a fatura MAIS ANTIGA não paga da
                // sequência ativa (decisão de design #5), não do ciclo mais recente.
                const daysOverdueFinal = Math.max(1, Math.round((now.getTime() - sequenceStartDueDate.getTime()) / 86400000));
                await db.executeQuery(`
                    UPDATE ${db.fq('users')}
                    SET account_status = 'inadimplente', days_overdue = ${daysOverdueFinal},
                        overdue_status = ${esc(overdueStatusFor('inadimplente', daysOverdueFinal))},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE cpf = ${esc(cpf)}
                `);
            }
        } else {
            saldoAnteriorAcumulado = 0;
            const totalGasto = await comprasAdimplente(dueDate);
            const invoiceId = genId();
            const nowIso = nowDb();
            await db.executeQuery(`
                INSERT INTO ${db.fq('invoices')}
                (id, cpf, status, due_date, valor_total, created_at, updated_at, data_pagamento, valor_pago, dias_atraso, saldo_anterior, valor_multa, valor_juros_mora, valor_juros_remuneratorios, valor_iof)
                VALUES (${esc(invoiceId)}, ${esc(cpf)}, 'FECHADA', ${esc(dueDate.toISOString())}, ${totalGasto.toFixed(2)}, ${esc(nowIso)}, ${esc(nowIso)}, ${esc(dueDate.toISOString())}, ${totalGasto.toFixed(2)}, 0, 0, 0, 0, 0, 0)
            `);
            await db.executeQuery(`
                INSERT INTO ${db.fq('transactions')}
                (id, cpf, type, amount, description, from_user, to_user, to_key, date)
                VALUES (${esc(genId())}, ${esc(cpf)}, 'INVOICE_PAYMENT', ${totalGasto.toFixed(2)}, 'Pagamento fatura', NULL, NULL, NULL, ${esc(dueDate.toISOString())})
            `);
            if (isLast) {
                await db.executeQuery(`
                    UPDATE ${db.fq('users')}
                    SET account_status = 'adimplente', days_overdue = 0, overdue_status = 'EM_DIA', updated_at = CURRENT_TIMESTAMP
                    WHERE cpf = ${esc(cpf)}
                `);
            }
        }

        if (isLast && status === 'adimplente') await comprasCicloAberto();
    }
}

/**
 * Modo "pagamento" do Gerador 4.0: compras por ciclo iguais às do legado; faturas,
 * pagamentos e encargos vêm de simularCiclosComPagamento (services/massaPagamentos.js,
 * que documenta a regra) e são só INSERIDOS — a FECHADA nasce com os valores do
 * fechamento e nunca recebe UPDATE. Datas gravadas com toISOString, como due_date e a
 * data dos pagamentos do legado: a auditoria compara essas colunas entre si.
 *
 * M-4 (Task 5, fix round 1): este modo NÃO debita `users.balance` nem atualiza
 * `installment_plans.remaining_balance/remaining_installments` pelos pagamentos
 * simulados — igual ao legado acima, que também nunca mexeu nesses campos pela massa
 * (só a rota de pagamento real e o motor diário fazem isso). A massa nasce com o
 * histórico de faturas/encargos coerente; saldo e plano de parcelamento ficam com o
 * valor "de largada" (balance inicial do payload, remaining = total do plano).
 */
async function seedCiclosComPagamento(db, cpf, ctx) {
    const { cycles, cycleDueDates, now, genId } = ctx;

    const ciclos = [];
    for (let i = 0; i < cycles.length; i++) {
        const c = cycles[i];
        const status = statusDoCiclo(c);
        const dueDate = cycleDueDates[i];
        let principal;
        let iofFixoExtra = 0;
        if (status === 'inadimplente') {
            principal = await ctx.comprasInadimplente(dueDate, i === 0 || statusDoCiclo(cycles[i - 1]) !== 'inadimplente');
            // IOF de câmbio (6,38% fixo) só quando a compra parcelada da sequência é internacional.
            if (ctx.sequenciaInternacional()) iofFixoExtra = calcIofInternacional(principal);
        } else {
            principal = await ctx.comprasAdimplente(dueDate);
        }
        ciclos.push({
            status, dueDate, principal, iofFixoExtra,
            pagamento: typeof c === 'object' ? c.pagamento : null,
            diasAtrasoPagamento: typeof c === 'object' ? c.diasAtrasoPagamento : undefined,
        });
    }

    const sim = simularCiclosComPagamento({ ciclos, agora: now.getTime(), genId });
    const ts = (ms) => new Date(ms).toISOString();

    for (const f of sim.faturas) {
        await db.executeQuery(sqlInsert(db, 'invoices', {
            id: f.id, cpf, status: 'FECHADA', due_date: ts(f.dueDate), valor_total: f.valorTotal,
            created_at: ts(f.createdAt), updated_at: ts(f.createdAt), data_pagamento: null, dias_atraso: f.diasAtraso,
            saldo_anterior: f.saldoAnterior, valor_multa: f.valorMulta, valor_juros_mora: f.valorJurosMora,
            valor_juros_remuneratorios: f.valorJurosRemuneratorios, valor_iof: f.valorIof,
        }));
    }
    for (const p of sim.pagamentos) {
        await db.executeQuery(sqlInsert(db, 'transactions', {
            id: p.id, cpf, type: 'INVOICE_PAYMENT', amount: -p.amount, description: p.description,
            from_user: null, to_user: null, to_key: null, date: ts(p.date), invoice_id: p.invoice_id,
        }));
    }
    await garantirColunasQuitacao(db);
    for (const r of sim.encargos) {
        await db.executeQuery(sqlInsert(db, 'billing_charges', {
            id: r.id, cpf, invoice_reference: r.invoice_reference, charge_type: r.charge_type, amount: r.amount,
            days_overdue: r.days_overdue, invoice_amount: r.invoice_amount, invoice_id: r.invoice_id,
            created_at: ts(r.created_at), status: r.status,
            paid_at: r.paid_at === null ? null : ts(r.paid_at), payment_id: r.payment_id,
        }));
    }

    const { accountStatus, daysOverdue } = sim.usuario;
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET account_status = ${esc(accountStatus)}, days_overdue = ${daysOverdue},
            overdue_status = ${esc(overdueStatusFor(accountStatus, daysOverdue))},
            updated_at = CURRENT_TIMESTAMP
        WHERE cpf = ${esc(cpf)}
    `);
    if (statusDoCiclo(cycles[cycles.length - 1]) === 'adimplente') await ctx.comprasCicloAberto();
    return sim;
}

/**
 * T7 — Contrato de forma da massa, verificado logo após a geração.
 *
 * Gerador 4.0 (`cycles` array): o número de faturas FECHADAS não pagas deve ser
 *   exatamente o número de ciclos 'inadimplente' na composição.
 * Legado (`accountStatus` string): inadimplente => exatamente 1 fatura FECHADA não
 *   paga (duas ou mais = corrupção de estado — padrão das 39 massas sem encargo
 *   antes do fix em runBillingValidation; zero = sem lastro); adimplente => zero.
 *
 * Não bloqueia a criação da massa (o cadastro já aconteceu); apenas grava um
 * erro alto no log e retorna o resultado para o chamador decidir o que fazer.
 * Falhar em silêncio é exatamente o padrão que esta investigação encontrou e
 * corrigiu em outros pontos do sistema — não repetir aqui.
 */
async function validarInvarianteMassa(db, cpf, cyclesOrStatus) {
    const rows = await db.executeQuery(`
        SELECT COUNT(*) AS total FROM ${db.fq('invoices')}
        WHERE cpf = ${esc(cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
    `);
    const fechadasNaoPagas = parseInt(rows[0]?.total || 0, 10);

    let ok = true;
    let motivo = null;

    const comPagamento = Array.isArray(cyclesOrStatus) && cyclesOrStatus.some(c => c && typeof c === 'object' && c.pagamento);
    if (comPagamento) {
        // Modo pagamento: nenhuma fechada leva data_pagamento (quitação derivada dos
        // pagamentos vinculados), então a contagem acima = todas as fechadas. Confere
        // (1) uma fechada por ciclo e (2) débito em aberto pela MESMA derivação do motor
        // (sqlResidualFechadas): some só quando o último ciclo quita tudo — adimplente
        // (TOTAL no vencimento) ou pagamento TOTAL.
        await garantirColunasQuitacao(db);
        const [r] = await db.executeQuery(`
            SELECT COUNT(*) AS abertas FROM (${sqlResidualFechadas(db, esc(cpf))}) r
            WHERE r.residual > ${TOLERANCIA_QUITACAO}
        `);
        const abertas = parseInt(r?.abertas || 0, 10);
        const ultimo = cyclesOrStatus[cyclesOrStatus.length - 1];
        const quitaNoFim = statusDoCiclo(ultimo) === 'adimplente' || (ultimo && ultimo.pagamento === 'TOTAL');
        const labels = cyclesOrStatus.map(c => typeof c === 'string' ? c : `${statusDoCiclo(c)}:${c.pagamento || '-'}`).join(',');
        if (fechadasNaoPagas !== cyclesOrStatus.length) {
            ok = false;
            motivo = `massa com cycles=[${labels}] deveria ter ${cyclesOrStatus.length} fatura(s) FECHADA sem data_pagamento, tem ${fechadasNaoPagas}`;
        } else if (quitaNoFim ? abertas !== 0 : abertas === 0) {
            ok = false;
            motivo = `massa com cycles=[${labels}] deveria ${quitaNoFim ? 'estar quitada' : 'ter débito em aberto'}, tem ${abertas} fechada(s) devendo`;
        }
        if (!ok) console.error(`❌ [validarInvarianteMassa] CPF ${cpf}: ${motivo}`);
        return { ok, motivo, fechadasNaoPagas: abertas };
    }

    if (Array.isArray(cyclesOrStatus)) {
        const esperadas = cyclesOrStatus.filter(c => statusDoCiclo(c) === 'inadimplente').length;
        if (fechadasNaoPagas !== esperadas) {
            ok = false;
            const labels = cyclesOrStatus.map(statusDoCiclo).join(',');
            motivo = `massa com cycles=[${labels}] deveria ter ${esperadas} fatura(s) FECHADA não paga(s), tem ${fechadasNaoPagas}`;
        }
    } else {
        const accountStatus = typeof cyclesOrStatus === 'string' ? cyclesOrStatus : cyclesOrStatus?.accountStatus;
        if (accountStatus === 'inadimplente') {
            if (fechadasNaoPagas !== 1) {
                ok = false;
                motivo = `massa inadimplente deveria ter exatamente 1 fatura FECHADA não paga, tem ${fechadasNaoPagas}`;
            }
        } else if (accountStatus === 'adimplente') {
            if (fechadasNaoPagas !== 0) {
                ok = false;
                motivo = `massa adimplente deveria ter 0 faturas FECHADA não pagas, tem ${fechadasNaoPagas}`;
            }
        }
    }

    if (!ok) {
        console.error(`❌ [validarInvarianteMassa] CPF ${cpf}: ${motivo}`);
    }
    return { ok, motivo, fechadasNaoPagas };
}

/**
 * Normaliza `cycles` do payload do gerador: array de 1 a 6 'adimplente'|'inadimplente'.
 * Sem array válido, cai em 1 ciclo derivado do accountStatus (default adimplente).
 */
function normalizeMassCycles(cycles, accountStatus) {
    const VALID = ['adimplente', 'inadimplente'];
    if (Array.isArray(cycles) && cycles.length > 0) {
        if (cycles.length > MAX_MASS_CYCLES) {
            throw new Error(`Máximo de ${MAX_MASS_CYCLES} ciclos de fatura por massa (recebido ${cycles.length}).`);
        }
        return cycles.map(normalizarCiclo);
    }
    return [accountStatus === 'inadimplente' ? 'inadimplente' : 'adimplente'];

    // String fica string (contrato legado). Objeto: sem pagamento vira a string do
    // status; com pagamento só vale em ciclo inadimplente (adimplente já é pago no
    // vencimento) e sai { status, pagamento, diasAtrasoPagamento } canônico.
    function normalizarCiclo(c) {
        if (typeof c === 'string' && VALID.includes(c)) return c;
        const status = c !== null && typeof c === 'object' ? statusDoCiclo(c) : null;
        if (!VALID.includes(status)) {
            const rotulo = typeof c === 'object' && c !== null ? JSON.stringify(c) : String(c);
            throw new Error(`Ciclo inválido: ${rotulo}. Use 'adimplente' ou 'inadimplente'.`);
        }
        if (c.pagamento === undefined || c.pagamento === null || c.pagamento === '') return status;
        const pagamento = normalizarTipoPagamento(c.pagamento);
        if (!pagamento) {
            throw new Error(`Pagamento inválido no ciclo: ${String(c.pagamento)}. Use ${TIPOS_PAGAMENTO_MASSA.join(', ')}.`);
        }
        if (status !== 'inadimplente') {
            throw new Error(`Ciclo adimplente já é pago (TOTAL) no vencimento — pagamento ${pagamento} só vale em ciclo inadimplente.`);
        }
        return { status, pagamento, diasAtrasoPagamento: normalizarDiasAtrasoPagamento(c.diasAtrasoPagamento) };
    }
}

module.exports = {
    shiftMonthsSameDay, computeLastPassedDueDate, MIN_DIAS_ATRASO_CICLO_ATUAL,
    MASS_MERCHANTS_NACIONAL, MASS_MERCHANTS_INTERNACIONAL, calcIofInternacional, pickMerchant,
    overdueStatusFor, statusDoCiclo, seedMassBilling, seedCiclosComPagamento,
    validarInvarianteMassa, normalizeMassCycles, MAX_MASS_CYCLES,
};
