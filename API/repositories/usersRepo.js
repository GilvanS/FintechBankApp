const { getDb, esc } = require('./context');
const { nowDb } = require('../utils/timezone');
const { computeNextInvoiceDueDate } = require('../utils/billing');

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

// Merchants do gerador de massa. Compras em merchant INTERNACIONAL carregam IOF
// de câmbio fixo (6,38%, sem componente diário), somado ao IOF doméstico da
// fatura em atraso (0,38% fixo + 0,0082%/dia).
// Assinaturas (Netflix/Spotify/Crunchyroll) saíram da lista NACIONAL geral —
// entram só na compra À VISTA (SHOP_CREDIT), nunca na compra PARCELADA de uma
// sequência inadimplente (ninguém parcela R$15 de streaming; confirmado
// 2026-09-20, listas de nomes continuam achatadas/`string[]` por compat com
// pickMerchant() e os testes que checam `.includes(nome)`).
const MASS_MERCHANTS_NACIONAL = ['iFood', 'Amazon BR', 'Posto Shell', 'Farmacia Pague Menos', 'Uber', 'Magazine Luiza', 'Zara', 'Mercado Livre', 'Atacadao', 'Acougue'];
const MASS_MERCHANTS_INTERNACIONAL = ['Shopee', 'Amazon.com', 'Temu', 'AliExpress', 'Shein'];
const MASS_MERCHANTS_ASSINATURA = ['Netflix', 'Spotify', 'Crunchyroll'];
const MASS_MERCHANTS = MASS_MERCHANTS_NACIONAL; // compat com código que ainda usa o nome antigo
const IOF_INTERNACIONAL_RATE = 0.0638;
const MASS_INTERNACIONAL_PROB = 0.3;
const MAX_MASS_CYCLES = 6;
const round2 = (n) => Math.round(n * 100) / 100;

// Faixa de preço realista por merchant — pedido 2026-09-20 pra parar de repetir
// sempre o mesmo valor entre massas diferentes. min===max é assinatura (preço de
// tabela fixo, não varia). Netflix: valor de referência (plano Padrão, sem
// anúncios) — NÃO confirmado por busca ao vivo nesta sessão (indisponível);
// ajustar se o valor real divergir. Merchants sem entrada aqui caem no fallback
// genérico já existente nos loops de compra à vista.
const MERCHANT_PRICE_RANGES = {
    Netflix: [44.90, 44.90],
    Spotify: [40.39, 40.39],
    Crunchyroll: [15.00, 15.00],
    Atacadao: [400, 1700],
    Acougue: [100, 500],
    Temu: [100, 1400],
    'Mercado Livre': [50, 7000],
};

function sortearValorMerchant(nome, fallbackMin, fallbackMax) {
    const faixa = MERCHANT_PRICE_RANGES[nome];
    const [min, max] = faixa || [fallbackMin, fallbackMax];
    return round2(min + Math.random() * (max - min));
}

function calcIofInternacional(amount) {
    return round2((Number(amount) || 0) * IOF_INTERNACIONAL_RATE);
}

// Sorteia um merchant PARA COMPRA PARCELADA (sequência inadimplente) — nunca uma
// assinatura, só merchant de ticket alto o bastante pra fazer sentido parcelar.
// ~30% das compras são internacionais.
function pickMerchant() {
    const internacional = Math.random() < MASS_INTERNACIONAL_PROB;
    const lista = internacional ? MASS_MERCHANTS_INTERNACIONAL : MASS_MERCHANTS_NACIONAL;
    return { nome: lista[Math.floor(Math.random() * lista.length)], internacional };
}

// Sorteia um merchant PARA COMPRA À VISTA (SHOP_CREDIT) — inclui assinaturas.
// Devolve nome + valor já sorteado dentro da faixa realista do merchant.
function pickMerchantAvistaComValor(fallbackMin, fallbackMax) {
    const todos = [...MASS_MERCHANTS_ASSINATURA, ...MASS_MERCHANTS_NACIONAL];
    const nome = todos[Math.floor(Math.random() * todos.length)];
    return { nome, valor: sortearValorMerchant(nome, fallbackMin, fallbackMax) };
}

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

// Divide um total em `parts` compras com pesos decrescentes, ajustando a última
// para bater a soma exata (evita drift de arredondamento).
function splitAmount(total, parts) {
    const weights = [0.4, 0.3, 0.2, 0.1].slice(0, parts);
    const sumW = weights.reduce((a, b) => a + b, 0);
    const values = weights.map(w => round2((total * w) / sumW));
    const diff = round2(total - values.reduce((a, b) => a + b, 0));
    values[values.length - 1] = round2(values[values.length - 1] + diff);
    return values;
}

/**
 * Cria chaves PIX para a massa (CPF + EMAIL), evitando duplicatas. PIX por chave
 * é a funcionalidade central do app bancário — sem isso a tela "Minhas Chaves PIX"
 * fica vazia e a massa não pode receber por chave EMAIL.
 */
async function seedMassPixKeys(db, cpf, email) {
    const genId = () => (db.generateUUID ? db.generateUUID() : `pk-${cpf}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    const now = nowDb();
    const keys = [{ type: 'CPF', key: cpf }];
    if (email) keys.push({ type: 'EMAIL', key: String(email).toLowerCase().trim() });

    for (const k of keys) {
        const exists = await db.executeQuery(`
            SELECT id FROM ${db.fq('pix_keys')} WHERE cpf=${esc(cpf)} AND type=${esc(k.type)} LIMIT 1
        `);
        if (!exists.length) {
            await db.executeQuery(`
                INSERT INTO ${db.fq('pix_keys')} (id, cpf, type, key, created_at)
                VALUES (${esc(genId())}, ${esc(cpf)}, ${esc(k.type)}, ${esc(k.key)}, ${esc(now)})
            `);
        }
    }
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
    const lastIsInadimplente = cycles[cycles.length - 1] === 'inadimplente';
    // Compat: payload legado informa `daysOverdue` (7/15/30) — vira o atraso mínimo pedido.
    const minPedido = Number(minOverdueDays ?? daysOverdue) || 0;
    const minDias = lastIsInadimplente ? Math.max(MIN_DIAS_ATRASO_CICLO_ATUAL, minPedido) : 0;
    const anchor = dueDay ? computeLastPassedDueDate(Number(dueDay), now, minDias) : now;
    const anchorDay = dueDay ? Number(dueDay) : anchor.getDate();
    const cycleDueDates = cycles.map((_, idx) => shiftMonthsSameDay(anchor, -(cycles.length - 1 - idx), anchorDay));

    let saldoAnteriorAcumulado = 0;
    let installmentValue = 0;
    let installmentIndex = 0;
    let totalInstallments = 0;
    let isInternacional = false; // merchant da compra parcelada da sequência inadimplente ATUAL (Task 3: IOF de câmbio)
    let sequenceStartDueDate = null; // data da 1ª fatura da sequência inadimplente ATUAL — days_overdue final usa esta, não a do último ciclo (decisão de design #5 do spec)

    for (let i = 0; i < cycles.length; i++) {
        const status = cycles[i];
        const dueDate = cycleDueDates[i];
        const isLast = i === cycles.length - 1;

        if (status === 'inadimplente') {
            const isFirstOfSequence = i === 0 || cycles[i - 1] !== 'inadimplente';

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
                saldoAnteriorAcumulado = 0;
            } else {
                installmentIndex++;
                const txDate = new Date(dueDate);
                txDate.setDate(txDate.getDate() - (20 + Math.floor(Math.random() * 5)));
                await insertPurchase(installmentValue, pickMerchantName(), txDate.toISOString(), 'INVOICE_INSTALLMENT', `${installmentIndex}/${totalInstallments}`);
            }

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
            // 3 compras independentes, cada uma com merchant + valor sorteados dentro
            // da faixa realista dele (substitui o split de uma soma única — 3 recibos
            // de mercado diferentes, não 1/3 de um total arbitrário).
            let totalGasto = 0;
            for (let k = 0; k < 3; k++) {
                const { nome, valor } = pickMerchantAvistaComValor(400 / 3, 1000 / 3);
                const txDate = new Date(dueDate);
                txDate.setDate(txDate.getDate() - (5 + Math.floor(Math.random() * 15)));
                await insertPurchase(valor, nome, txDate.toISOString());
                totalGasto = round2(totalGasto + valor);
            }
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

        if (isLast && status === 'adimplente') {
            // Ciclo aberto atual: mesma lógica de merchant+valor realista das compras
            // fechadas acima, 3 recibos independentes em vez de 1/3 de uma soma.
            for (let k = 0; k < 3; k++) {
                const { nome, valor } = pickMerchantAvistaComValor(300 / 3, 800 / 3);
                const txDate = new Date();
                txDate.setDate(txDate.getDate() - Math.floor(Math.random() * 6));
                await insertPurchase(valor, nome, txDate.toISOString());
            }
        }
    }
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

    if (Array.isArray(cyclesOrStatus)) {
        const esperadas = cyclesOrStatus.filter(c => (typeof c === 'string' ? c : c?.accountStatus) === 'inadimplente').length;
        if (fechadasNaoPagas !== esperadas) {
            ok = false;
            const labels = cyclesOrStatus.map(c => typeof c === 'string' ? c : c?.accountStatus).join(',');
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

async function findByCpf(cpf) {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT *
        FROM ${db.fq('users')}
        WHERE cpf=${esc(cpf)}
    `);
    return rows[0] || null;
}

async function upsertSeed({ cpf, fullName, email, passwordHash, balance, role }) {
    const db = getDb();
    const exists = await db.executeQuery(`
        SELECT cpf FROM ${db.fq('users')} WHERE cpf=${esc(cpf)}
    `);
    if (!exists.length) {
        const now = nowDb();
        const dueDay = 10; // alinhado ao billing_config.due_day
        const invoiceDueDate = computeNextInvoiceDueDate(dueDay).toISOString();
        await db.executeQuery(`
            INSERT INTO ${db.fq('users')}
            (cpf, full_name, email, password_hash, balance, role, is_blocked, login_attempts, pix_daily_limit, password_reset_requested, credit_card_total_limit, credit_card_available_limit, credit_card_is_blocked, credit_card_points_balance, credit_card_due_day, credit_card_invoice_due_date, created_at, updated_at)
            VALUES (${esc(cpf)}, ${esc(fullName)}, ${esc(email)}, ${esc(passwordHash)}, ${esc(balance)}, ${esc(role)}, false, 0, 2000.00, false, 5000.00, 5000.00, false, 0, ${dueDay}, ${esc(invoiceDueDate)}, ${esc(now)}, ${esc(now)})
        `);
    }
}

async function updateBalance(cpf, newBalance) {
    const db = getDb();
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET balance=${esc(newBalance)}
        WHERE cpf=${esc(cpf)}
    `);
}

// Devolve valor ao limite disponível do cartão (usado no estorno de compra a
// crédito cuja fatura de origem ainda está aberta).
async function restoreAvailableLimit(cpf, amount) {
    const db = getDb();
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET credit_card_available_limit = COALESCE(credit_card_available_limit, 0) + ${esc(Number(amount).toFixed(2))}
        WHERE cpf=${esc(cpf)}
    `);
}

async function listUsers() {
    const db = getDb();
    return db.executeQuery(`
        SELECT *
        FROM ${db.fq('users')}
        ORDER BY created_at DESC
    `);
}

async function deposit(cpf, amount) {
    const db = getDb();
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET balance = COALESCE(balance, 0) + ${esc(amount)}
        WHERE cpf=${esc(cpf)}
    `);
    const id = db.generateUUID();
    const now = nowDb();
    await db.executeQuery(`
        INSERT INTO ${db.fq('transactions')}
        (id, cpf, type, amount, description, from_user, to_user, to_key, date)
        VALUES (${esc(id)}, ${esc(cpf)}, 'DEPOSIT', ${esc(Number(amount).toFixed(2))}, ${esc('Deposito administrativo')}, NULL, NULL, NULL, ${esc(now)})
    `);
}

async function setBlocked(cpf, blocked) {
    const db = getDb();
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET is_blocked = ${esc(blocked)}
        WHERE cpf=${esc(cpf)}
    `);
}

async function updatePixLimit(cpf, newLimit) {
    const db = getDb();
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET pix_daily_limit = ${esc(newLimit)}
        WHERE cpf=${esc(cpf)}
    `);
}

async function setPasswordResetRequested(cpf, requested) {
    const db = getDb();
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET password_reset_requested = ${esc(requested)}
        WHERE cpf=${esc(cpf)}
    `);
}

async function setTempPassword(cpf, tempPassword) {
    const db = getDb();
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(tempPassword, 10);
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET password_hash = ${esc(hash)}
        WHERE cpf=${esc(cpf)}
    `);
}

async function createMassUser(payload, { onStep } = {}) {
    // Progresso real pro painel do gerador (Todo List): o chamador decide pra onde
    // manda (SSE). Falha do callback nunca pode derrubar a criação da massa.
    const step = (id, status, detail) => {
        if (typeof onStep !== 'function') return;
        try { onStep(id, status, detail); } catch { /* best-effort */ }
    };
    const db = getDb();
    const cleanCpf = (payload.cpf || '').replace(/\D/g, '');
    const id = db.generateUUID ? db.generateUUID() : `user-${cleanCpf}`;
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(payload.password || 'admin999', 10);
    const email = payload.email ? payload.email.replace('@', `_${cleanCpf}@`) : `massa_${cleanCpf}@fintech.com`;
    const now = nowDb();

    const tutor = payload.tutor || {};
    const addr = payload.address || {};

    const dueDay = payload.dueDay || 10;
    const invoiceDueDate = computeNextInvoiceDueDate(dueDay).toISOString();

    // Gerador 4.0: histórico de 1-6 ciclos de fatura. Sem `cycles` no payload (clientes
    // antigos), deriva 1 ciclo do accountStatus — comportamento idêntico ao anterior.
    const cycles = normalizeMassCycles(payload.cycles, payload.accountStatus);
    const accountStatus = cycles[cycles.length - 1];

    step('cadastro', 'running');
    await db.executeQuery(`
        INSERT INTO ${db.fq('users')}
        (
            id, full_name, cpf, email, password_hash, balance, pix_daily_limit, role, is_blocked,
            birth_date, age, has_tutor, tutor_name, tutor_cpf, tutor_relationship, country_origin,
            address_cep, address_street, address_number, address_complement, address_neighborhood, address_city, address_state,
            card_brand, card_due_day, credit_card_due_day, credit_card_invoice_due_date, days_overdue, account_status, overdue_status,
            credit_card_total_limit, credit_card_available_limit, created_at, updated_at
        )
        VALUES (
            ${esc(id)}, ${esc(payload.fullName)}, ${esc(cleanCpf)}, ${esc(email)}, ${esc(hash)},
            ${esc(10000.00)}, ${esc(payload.pixLimit || 1000)}, 'user', false,
            ${esc(payload.birthDate || null)}, ${esc(payload.age || null)}, ${esc(payload.hasTutor || false)},
            ${esc(tutor.fullName || null)}, ${esc(tutor.cpf || null)}, ${esc(tutor.relationship || null)}, ${esc(payload.countryOrigin || 'Brasil')},
            ${esc(addr.cep || null)}, ${esc(addr.street || null)}, ${esc(addr.number || null)}, ${esc(addr.complement || null)}, ${esc(addr.neighborhood || null)}, ${esc(addr.city || null)}, ${esc(addr.state || null)},
            ${esc(payload.cardBrand || 'MASTERCARD')}, ${esc(dueDay)}, ${esc(dueDay)}, ${esc(invoiceDueDate)}, ${esc(payload.daysOverdue || 0)}, ${esc(accountStatus)}, ${esc(overdueStatusFor(accountStatus, payload.daysOverdue))},
            ${esc(payload.creditLimit || 5000)}, ${esc(payload.creditLimit || 5000)}, ${esc(now)}, ${esc(now)}
        )
    `);

    // Gravação dos cartões na tabela fintech.cards
    try {
        const cardData = payload.creditCard || {};
        const cardBrandUpper = (cardData.brand || payload.cardBrand || 'MASTERCARD').toUpperCase();
        const cardBrand = cardBrandUpper.toLowerCase();

        let bin = '54427460';
        if (cardBrandUpper === 'AMEX') bin = '37828000';
        else if (cardBrandUpper === 'VISA') bin = '45767460';
        else if (cardBrandUpper === 'ELO') bin = '65050666';
        else if (cardBrandUpper === 'HIPERCARD') bin = '60628200';

        let rawNum = (cardData.cardNumber || '').replace(/\D/g, '');
        if (!rawNum) {
            if (cardBrandUpper === 'AMEX') {
                rawNum = `3782${Math.floor(1000000000 + Math.random() * 9000000000)}`.slice(0, 15);
            } else {
                rawNum = `${bin}${Math.floor(100000000 + Math.random() * 900000000)}`.slice(0, 16);
            }
        }

        let formattedNum = rawNum;
        if (cardBrandUpper === 'AMEX') {
            formattedNum = `${rawNum.slice(0, 4)} ${rawNum.slice(4, 10)} ${rawNum.slice(10, 15)}`;
        } else {
            formattedNum = rawNum.replace(/(\d{4})/g, '$1 ').trim();
        }

        const cvv = cardData.cvv || (cardBrandUpper === 'AMEX' ? '8821' : '333');
        const expiryShort = cardData.expirationDate || '07/31';
        let expiryFull = expiryShort;
        if (expiryShort.length === 5 && expiryShort.includes('/')) {
            const [expM, expY] = expiryShort.split('/');
            expiryFull = `${expM}/20${expY}`;
        }
        const cardType = (payload.cardType || cardData.cardType || 'PHYSICAL').toLowerCase();
        // Ativação vem do payload (cardActivation) ou do objeto creditCard; padrão: ativado.
        const activationState = payload.cardActivation || cardData.activationState;
        const isActivated = activationState === 'AWAITING_ACTIVATION' ? false : true;

        // Se for PHYSICAL ou BOTH (ou padrão), grava cartão físico
        if (cardType === 'physical' || cardType === 'both' || cardType === 'fisico') {
            const cardId = db.generateUUID ? db.generateUUID() : `card-phys-${cleanCpf}`;
            await db.executeQuery(`
                INSERT INTO ${db.fq('cards')}
                (id, user_cpf, card_number, card_number_raw, card_type, card_brand, bin, expiry, expiry_short, cvv, pin, is_activated, is_blocked, created_at, updated_at)
                VALUES (
                    ${esc(cardId)}, ${esc(cleanCpf)}, ${esc(formattedNum)}, ${esc(rawNum)}, 'physical',
                    ${esc(cardBrand)}, ${esc(bin.slice(0,8))}, ${esc(expiryFull)}, ${esc(expiryShort)}, ${esc(cvv)}, '9898', ${esc(isActivated)}, false, ${esc(now)}, ${esc(now)}
                )
            `);

            // Atualiza no usuário se o cartão físico está ativado e o status de entrega
            const deliveryStatus = isActivated ? 'unlocked' : 'manufacturing';
            await db.executeQuery(`
                UPDATE ${db.fq('users')}
                SET card_is_activated = ${esc(isActivated)}, card_delivery_status = ${esc(deliveryStatus)}
                WHERE cpf = ${esc(cleanCpf)}
            `);
        }

        // Se for VIRTUAL ou BOTH, grava cartão virtual
        if (cardType === 'virtual' || cardType === 'both') {
            let virtRawNum = '';
            if (cardBrandUpper === 'AMEX') {
                virtRawNum = `3782${Math.floor(1000000000 + Math.random() * 9000000000)}`.slice(0, 15);
            } else {
                virtRawNum = `${bin}${Math.floor(100000000 + Math.random() * 900000000)}`.slice(0, 16);
            }

            let virtFormatted = virtRawNum;
            if (cardBrandUpper === 'AMEX') {
                virtFormatted = `${virtRawNum.slice(0, 4)} ${virtRawNum.slice(4, 10)} ${virtRawNum.slice(10, 15)}`;
            } else {
                virtFormatted = virtRawNum.replace(/(\d{4})/g, '$1 ').trim();
            }

            const cardIdVirt = db.generateUUID ? db.generateUUID() : `card-virt-${cleanCpf}`;
            await db.executeQuery(`
                INSERT INTO ${db.fq('cards')}
                (id, user_cpf, card_number, card_number_raw, card_type, card_brand, bin, expiry, expiry_short, cvv, pin, is_activated, is_blocked, nickname, created_at, updated_at)
                VALUES (
                    ${esc(cardIdVirt)}, ${esc(cleanCpf)}, ${esc(virtFormatted)}, ${esc(virtRawNum)}, 'virtual',
                    ${esc(cardBrand)}, ${esc(bin.slice(0,8))}, ${esc(expiryFull)}, ${esc(expiryShort)}, ${esc(cvv)}, '9898', true, false, 'Cartao Virtual Gerado', ${esc(now)}, ${esc(now)}
                )
            `);
        }
    } catch (cardErr) {
        console.warn('⚠️ Erro ao registrar cartões na tabela fintech.cards:', cardErr.message);
    }

    // Chaves PIX (CPF + EMAIL) — funcionalidade central do app bancário.
    try {
        await seedMassPixKeys(db, cleanCpf, payload.email);
    } catch (pixErr) {
        console.warn('⚠️ Erro ao gerar chaves PIX da massa:', pixErr.message);
    }
    step('cadastro', 'done', `${payload.fullName} • ${(payload.cardBrand || 'MASTERCARD').toUpperCase()}`);

    // Geração de compras + fatura SEMPRE roda — independente da ativação do cartão.
    // A ativação do cartão é sobre uso futuro (novas compras); a fatura fechada
    // (histórico) deve existir para a conta aparecer no Painel de Massas em Atraso
    // mesmo quando o cartão está "AWAITING_ACTIVATION". Misturar os dois fazia
    // ~50% das massas inadimplentes caírem no else e nunca ganharem fatura.
    step('ciclos', 'running');
    try {
        await seedMassBilling(db, cleanCpf, {
            cycles,
            overdueAmountBase: Number(payload.overdueAmountBase ?? payload.overdueAmount ?? 0),
            creditLimit: Number(payload.creditLimit || 5000),
            dueDay,
            minOverdueDays: Number(payload.minOverdueDays ?? payload.daysOverdue ?? 0),
        });
        const inadimplentes = cycles.filter(c => c === 'inadimplente').length;
        step('ciclos', 'done', `${cycles.length} ciclo(s) • ${inadimplentes} inadimplente(s)`);
    } catch (billingErr) {
        console.warn('⚠️ Erro ao gerar faturamento da massa:', billingErr.message);
        step('ciclos', 'error', billingErr.message);
    }

    // T7: valida que a massa nasceu na forma canônica (ver validarInvarianteMassa).
    let massaValidation = null;
    try {
        massaValidation = await validarInvarianteMassa(db, cleanCpf, cycles);
    } catch (validErr) {
        console.warn('⚠️ Erro ao validar invariante da massa:', validErr.message);
    }

    // Inserir assinatura recorrente padrão (Spotify R$ 19,90 no crédito)
    try {
        const subId = db.generateUUID ? db.generateUUID() : `sub-${cleanCpf}-${Date.now()}`;
        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        await db.executeQuery(`
            INSERT INTO ${db.fq('subscriptions')}
            (id, cpf, name, amount, frequency, payment_method, status, next_billing_date, created_at, updated_at)
            VALUES ('${subId}', '${cleanCpf}', 'Spotify', 19.90, 'monthly', 'credit', 'active', '${nextBilling.toISOString()}', '${now}', '${now}')
        `);
        console.log(`✅ Assinatura padrão Spotify (R$ 19,90) inserida para a massa ${cleanCpf}`);
    } catch (subErr) {
        console.warn('⚠️ Erro ao inserir assinatura padrão para a massa:', subErr.message);
    }

    return { id, cpf: cleanCpf, fullName: payload.fullName, cycles, massaValidation };
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
        const invalido = cycles.find(c => !VALID.includes(c));
        if (invalido !== undefined) {
            throw new Error(`Ciclo inválido: ${String(invalido)}. Use 'adimplente' ou 'inadimplente'.`);
        }
        return [...cycles];
    }
    return [accountStatus === 'inadimplente' ? 'inadimplente' : 'adimplente'];
}

module.exports = { findByCpf, upsertSeed, updateBalance, restoreAvailableLimit, listUsers, deposit, setBlocked, updatePixLimit, setPasswordResetRequested, setTempPassword, createMassUser, seedMassPixKeys, seedMassBilling, validarInvarianteMassa, overdueStatusFor, computeLastPassedDueDate, shiftMonthsSameDay, MIN_DIAS_ATRASO_CICLO_ATUAL, MASS_MERCHANTS_NACIONAL, MASS_MERCHANTS_INTERNACIONAL, calcIofInternacional, pickMerchant, normalizeMassCycles, MAX_MASS_CYCLES };