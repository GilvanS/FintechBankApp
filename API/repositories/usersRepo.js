const { getDb, esc } = require('./context');
const { nowDb } = require('../utils/timezone');
const { computeNextInvoiceDueDate } = require('../utils/billing');
// Gerador de Massa 4.0 (seedMassBilling e afins) mora em massBilling.js (M-3, Task 5 —
// este arquivo tinha passado de 500 linhas). Re-exportado abaixo com os MESMOS nomes —
// nenhum import de teste ou de outro módulo precisou mudar.
const {
    shiftMonthsSameDay, computeLastPassedDueDate, MIN_DIAS_ATRASO_CICLO_ATUAL,
    MASS_MERCHANTS_NACIONAL, MASS_MERCHANTS_INTERNACIONAL, calcIofInternacional, pickMerchant,
    overdueStatusFor, statusDoCiclo, seedMassBilling, validarInvarianteMassa,
    normalizeMassCycles, MAX_MASS_CYCLES,
} = require('./massBilling');

// Divide um total em `parts` compras com pesos decrescentes, ajustando a última
// para bater a soma exata (evita drift de arredondamento). Não usado hoje por
// nenhum caminho (seedMassBilling migrou para merchant+valor sorteados por compra
// em massBilling.js) — mantido aqui, fora do escopo mecânico da Task 5/M-3.
function splitAmount(total, parts) {
    const round2 = (n) => Math.round(n * 100) / 100;
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
    const accountStatus = statusDoCiclo(cycles[cycles.length - 1]);

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
        const inadimplentes = cycles.filter(c => statusDoCiclo(c) === 'inadimplente').length;
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

    return { id, cpf: cleanCpf, fullName: payload.fullName, cycles, accountStatus, massaValidation };
}

module.exports = { findByCpf, upsertSeed, updateBalance, restoreAvailableLimit, listUsers, deposit, setBlocked, updatePixLimit, setPasswordResetRequested, setTempPassword, createMassUser, seedMassPixKeys, seedMassBilling, validarInvarianteMassa, overdueStatusFor, computeLastPassedDueDate, shiftMonthsSameDay, MIN_DIAS_ATRASO_CICLO_ATUAL, MASS_MERCHANTS_NACIONAL, MASS_MERCHANTS_INTERNACIONAL, calcIofInternacional, pickMerchant, normalizeMassCycles, MAX_MASS_CYCLES };
