const { getDb, esc } = require('./context');
const { nowDb } = require('../utils/timezone');
const { computeNextInvoiceDueDate } = require('../utils/billing');

const MASS_MERCHANTS = ['iFood', 'Amazon BR', 'Posto Shell', 'Farmacia Pague Menos', 'Netflix', 'Uber', 'Magazine Luiza', 'Zara', 'Mercado Livre', 'Spotify'];
const round2 = (n) => Math.round(n * 100) / 100;

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
 * Gera os dados de faturamento coerentes com o estado da massa recém-criada:
 *  - adimplente: compras a crédito no ciclo ATUAL (fatura aberta calculada on-the-fly)
 *  - inadimplente: compras no ciclo anterior + fatura FECHADA vencida com os 5 encargos
 *    (mesma fórmula do dashboard) e snapshot itemized_transactions.
 *
 * As compras são SHOP_CREDIT com amount negativo (convenção do app). O limite
 * disponível do cartão é reduzido pelo total das compras.
 */
async function seedMassBilling(db, cpf, { accountStatus, daysOverdue, overdueAmount, creditLimit }) {
    const genId = () => (db.generateUUID ? db.generateUUID() : `tx-${cpf}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    const pickMerchant = () => MASS_MERCHANTS[Math.floor(Math.random() * MASS_MERCHANTS.length)];
    const insertPurchase = async (amount, description, dateIso) => {
        const id = genId();
        await db.executeQuery(`
            INSERT INTO ${db.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date)
            VALUES (${esc(id)}, ${esc(cpf)}, 'SHOP_CREDIT', ${esc((-Math.abs(amount)).toFixed(2))}, ${esc(description)}, NULL, NULL, NULL, ${esc(dateIso)})
        `);
        return { id, amount: Math.abs(amount), merchant: description, date: dateIso, type: 'CREDIT' };
    };

    if (accountStatus === 'inadimplente' && daysOverdue > 0 && overdueAmount > 0) {
        const principal = round2(Number(overdueAmount));

        // Vencimento no passado (fatura já fechada e vencida)
        const dueDate = new Date();
        dueDate.setHours(12, 0, 0, 0);
        dueDate.setDate(dueDate.getDate() - daysOverdue);

        // Compras do ciclo anterior somando o principal (datadas antes do vencimento)
        const parts = splitAmount(principal, 3);
        const items = [];
        for (const amt of parts) {
            const txDate = new Date(dueDate);
            txDate.setDate(txDate.getDate() - (7 + Math.floor(Math.random() * 10)));
            items.push(await insertPurchase(amt, pickMerchant(), txDate.toISOString()));
        }

        // 5 encargos ISO — mesma fórmula do endpoint /admin/overdue-masses-dashboard
        const multa = round2(principal * 0.02);
        const jurosMora = round2(principal * 0.000333 * daysOverdue);
        const jurosRem = round2(principal * 0.00513 * daysOverdue);
        const iofAdicional = round2(principal * 0.0038);
        const iofDiario = round2(principal * 0.000082 * daysOverdue);
        const iof = round2(iofAdicional + iofDiario);

        const now = nowDb();
        const invoiceId = genId();
        const itemizedJson = JSON.stringify(items.map(it => ({
            id: it.id, date: it.date, amount: it.amount, merchant: it.merchant, type: it.type,
        })));

        await db.executeQuery(`
            INSERT INTO ${db.fq('invoices')}
            (id, cpf, status, due_date, valor_total, created_at, updated_at, data_pagamento, dias_atraso, saldo_anterior, valor_multa, valor_juros_mora, valor_juros_remuneratorios, valor_iof, itemized_transactions)
            VALUES (${esc(invoiceId)}, ${esc(cpf)}, 'FECHADA', ${esc(dueDate.toISOString())}, ${principal.toFixed(2)}, ${esc(now)}, ${esc(now)}, NULL, ${daysOverdue}, 0, ${multa}, ${jurosMora}, ${jurosRem}, ${iof}, ${esc(itemizedJson)})
        `);

        // billing_charges (invoice_reference = YYYY-MM do vencimento)
        const ref = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
        const charges = [['multa', multa], ['juros_mora', jurosMora], ['juros_remuneratorios', jurosRem], ['iof', iof]];
        for (const [type, amount] of charges) {
            await db.executeQuery(`
                INSERT INTO ${db.fq('billing_charges')}
                (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount, created_at, status)
                VALUES (${esc(genId())}, ${esc(cpf)}, ${esc(ref)}, ${esc(type)}, ${amount}, ${daysOverdue}, ${principal.toFixed(2)}, ${esc(now)}, 'pending')
            `);
        }

        // Consome o limite disponível e alinha o status/dias de atraso
        await db.executeQuery(`
            UPDATE ${db.fq('users')}
            SET credit_card_available_limit = GREATEST(0, COALESCE(credit_card_available_limit, ${Number(creditLimit) || 5000}) - ${principal.toFixed(2)}),
                account_status = 'inadimplente',
                days_overdue = ${daysOverdue},
                updated_at = CURRENT_TIMESTAMP
            WHERE cpf = ${esc(cpf)}
        `);

        // Além da fatura FECHADA vencida, gera compras no ciclo ATUAL para que a
        // fatura ABERTA (calculada on-the-fly) também tenha conteúdo.
        const openParts = splitAmount(round2(300 + Math.random() * 500), 3); // R$ 300–800
        let openGasto = 0;
        for (const amt of openParts) {
            const txDate = new Date();
            txDate.setDate(txDate.getDate() - Math.floor(Math.random() * 6));
            await insertPurchase(amt, pickMerchant(), txDate.toISOString());
            openGasto += amt;
        }
        await db.executeQuery(`
            UPDATE ${db.fq('users')}
            SET credit_card_available_limit = GREATEST(0, COALESCE(credit_card_available_limit, ${Number(creditLimit) || 5000}) - ${openGasto.toFixed(2)}),
                updated_at = CURRENT_TIMESTAMP
            WHERE cpf = ${esc(cpf)}
        `);
    } else if (accountStatus === 'adimplente') {
        // Compras correntes no ciclo atual — a fatura aberta é calculada on-the-fly
        const parts = splitAmount(round2(400 + Math.random() * 600), 3); // R$ 400–1000
        let totalGasto = 0;
        for (const amt of parts) {
            const txDate = new Date();
            txDate.setDate(txDate.getDate() - Math.floor(Math.random() * 8));
            await insertPurchase(amt, pickMerchant(), txDate.toISOString());
            totalGasto += amt;
        }
        await db.executeQuery(`
            UPDATE ${db.fq('users')}
            SET credit_card_available_limit = GREATEST(0, COALESCE(credit_card_available_limit, ${Number(creditLimit) || 5000}) - ${totalGasto.toFixed(2)}),
                account_status = 'adimplente',
                days_overdue = 0,
                updated_at = CURRENT_TIMESTAMP
            WHERE cpf = ${esc(cpf)}
        `);
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

async function createMassUser(payload) {
    const db = getDb();
    const cleanCpf = (payload.cpf || '').replace(/\D/g, '');
    const id = db.generateUUID ? db.generateUUID() : `user-${cleanCpf}`;
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(payload.password || 'admin999', 10);
    const now = nowDb();

    const tutor = payload.tutor || {};
    const addr = payload.address || {};

    const dueDay = payload.dueDay || 10;
    const invoiceDueDate = computeNextInvoiceDueDate(dueDay).toISOString();

    await db.executeQuery(`
        INSERT INTO ${db.fq('users')}
        (
            id, full_name, cpf, email, password_hash, balance, pix_daily_limit, role, is_blocked,
            birth_date, age, has_tutor, tutor_name, tutor_cpf, tutor_relationship, country_origin,
            address_cep, address_street, address_number, address_complement, address_neighborhood, address_city, address_state,
            card_brand, card_due_day, credit_card_due_day, credit_card_invoice_due_date, days_overdue, account_status,
            credit_card_total_limit, credit_card_available_limit, created_at, updated_at
        )
        VALUES (
            ${esc(id)}, ${esc(payload.fullName)}, ${esc(cleanCpf)}, ${esc(payload.email)}, ${esc(hash)},
            ${esc(payload.initialBalance || 2000)}, ${esc(payload.pixLimit || 1000)}, 'user', false,
            ${esc(payload.birthDate || null)}, ${esc(payload.age || null)}, ${esc(payload.hasTutor || false)},
            ${esc(tutor.fullName || null)}, ${esc(tutor.cpf || null)}, ${esc(tutor.relationship || null)}, ${esc(payload.countryOrigin || 'Brasil')},
            ${esc(addr.cep || null)}, ${esc(addr.street || null)}, ${esc(addr.number || null)}, ${esc(addr.complement || null)}, ${esc(addr.neighborhood || null)}, ${esc(addr.city || null)}, ${esc(addr.state || null)},
            ${esc(payload.cardBrand || 'MASTERCARD')}, ${esc(dueDay)}, ${esc(dueDay)}, ${esc(invoiceDueDate)}, ${esc(payload.daysOverdue || 0)}, ${esc(payload.accountStatus || 'adimplente')},
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
        const cardType = (cardData.cardType || 'PHYSICAL').toLowerCase();
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

    // Geração de compras + fatura SEMPRE roda — independente da ativação do cartão.
    // A ativação do cartão é sobre uso futuro (novas compras); a fatura fechada
    // (histórico) deve existir para a conta aparecer no Painel de Massas em Atraso
    // mesmo quando o cartão está "AWAITING_ACTIVATION". Misturar os dois fazia
    // ~50% das massas inadimplentes caírem no else e nunca ganharem fatura.
    try {
        await seedMassBilling(db, cleanCpf, {
            accountStatus: payload.accountStatus || 'adimplente',
            daysOverdue: Number(payload.daysOverdue || 0),
            overdueAmount: Number(payload.overdueAmount || 0),
            creditLimit: Number(payload.creditLimit || 5000),
        });
    } catch (billingErr) {
        console.warn('⚠️ Erro ao gerar faturamento da massa:', billingErr.message);
    }

    return { id, cpf: cleanCpf, fullName: payload.fullName };
}

module.exports = { findByCpf, upsertSeed, updateBalance, restoreAvailableLimit, listUsers, deposit, setBlocked, updatePixLimit, setPasswordResetRequested, setTempPassword, createMassUser, seedMassPixKeys, seedMassBilling };