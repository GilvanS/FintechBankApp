'use strict';
const { calcCharges } = require('./billing');

// ── Prefixos de transações mockadas ──────────────────────────────────────────
// [TEST]  = gerado automaticamente pelo seeder, descartado no próximo reset
// [MOCK]  = salvo pelo admin via /admin/billing/save-as-mock; restaurado no reset
const PREFIX_TEST = '[TEST]';
const PREFIX_MOCK = '[MOCK]';

// ── Cenários padrão (usados quando não há baseline salvo) ─────────────────────
const DEFAULT_SCENARIOS = {
    '11111111111': { accountStatus: 'adimplente',   daysOverdue: 0,  dueDaysFromNow: 30,  monthlyAvg: 1200 },
    '22222222222': { accountStatus: 'adimplente',   daysOverdue: 2,  dueDaysFromNow: -2,  monthlyAvg: 2800 },
    '33333333333': { accountStatus: 'inadimplente', daysOverdue: 15, dueDaysFromNow: -15, monthlyAvg: 4500 },
    '44444444444': { accountStatus: 'inadimplente', daysOverdue: 45, dueDaysFromNow: -45, monthlyAvg: 800  },
};

const MOCK_MERCHANTS = [
    'Mercado Extra', 'iFood', 'Amazon Prime', 'Netflix',
    'Posto Shell', 'Farmácia Drogasil', 'Uber', 'Magazine Luiza',
    'Shopee', 'Rappi', 'Americanas',
];

function daysOffset(base, days) {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
}
function isoTs(d)            { return d.toISOString(); }
function rand(min, max)      { return Math.round((Math.random() * (max - min) + min) * 100) / 100; }
function safeSql(s)          { return String(s).replace(/'/g, "''"); }

// ── Garante que billing_mock_baselines existe no banco ────────────────────────
async function ensureMockBaselineTable(db) {
    await db.executeQuery(`
        CREATE TABLE IF NOT EXISTS ${db.fq('billing_mock_baselines')} (
            cpf               VARCHAR(11)   PRIMARY KEY,
            account_status    VARCHAR(20)   NOT NULL DEFAULT 'adimplente',
            days_overdue      INTEGER       NOT NULL DEFAULT 0,
            due_days_from_now INTEGER       NOT NULL DEFAULT 30,
            invoice_amount    DECIMAL(15,2),
            saved_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

// ── Gera transações mock para um mês específico ───────────────────────────────
async function seedMonthTransactions(db, cpf, monthOffset, targetTotal, prefix) {
    const now   = new Date();
    const year  = now.getFullYear() + Math.floor((now.getMonth() + monthOffset) / 12);
    const month = ((now.getMonth() + monthOffset) % 12 + 12) % 12;
    const count = 3 + Math.floor(Math.random() * 4);
    const perTx = targetTotal / count;

    for (let i = 0; i < count; i++) {
        const txDate   = new Date(year, month, 2 + i * 4);
        const merchant = MOCK_MERCHANTS[Math.floor(Math.random() * MOCK_MERCHANTS.length)];
        const amount   = rand(perTx * 0.6, perTx * 1.4);
        const txId     = `${prefix.replace(/[\[\]]/g,'')}_${cpf}_m${monthOffset < 0 ? 'n' : ''}${Math.abs(monthOffset)}_${i}`;
        const desc     = `${prefix} ${merchant}`;

        await db.executeQuery(`
            INSERT INTO ${db.fq('transactions')}
                (id, cpf, type, amount, description, to_user, from_user, to_key, date)
            VALUES
                ('${txId}', '${cpf}', 'INVOICE_INSTALLMENT', ${(-amount).toFixed(2)},
                 '${safeSql(desc)}', NULL, NULL, NULL, '${isoTs(txDate)}')
            ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount
        `);
    }
}

// ── Aplica estado de billing a um usuário e gera encargos se inadimplente ─────
async function applyBillingState(db, cpf, accountStatus, daysOverdue, dueDaysFromNow, invoiceAmount) {
    const now     = new Date();
    const dueDate = daysOffset(now, dueDaysFromNow);

    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET account_status               = '${accountStatus}',
            days_overdue                 = ${daysOverdue},
            credit_card_invoice_due_date = '${isoTs(dueDate)}',
            updated_at                   = CURRENT_TIMESTAMP
        WHERE cpf = '${cpf}'
    `);

    // Limpar encargos do ciclo atual e regerar se inadimplente
    const ref = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await db.executeQuery(`
        DELETE FROM ${db.fq('billing_charges')}
        WHERE cpf = '${cpf}' AND invoice_reference = '${ref}'
    `);

    if (accountStatus === 'inadimplente' && invoiceAmount > 0) {
        const { multa, juros } = calcCharges(invoiceAmount, daysOverdue);
        const idBase = `${cpf}_${ref}_seed`;
        await db.executeQuery(`
            INSERT INTO ${db.fq('billing_charges')}
                (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount)
            VALUES
                ('${idBase}_multa', '${cpf}', '${ref}', 'multa',      ${multa.toFixed(2)}, ${daysOverdue}, ${invoiceAmount.toFixed(2)}),
                ('${idBase}_juros', '${cpf}', '${ref}', 'juros_mora', ${juros.toFixed(2)}, ${daysOverdue}, ${invoiceAmount.toFixed(2)})
            ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount
        `);
    }
}

/**
 * Aplica um cenário de billing pré-definido a um CPF.
 * Chamado pelo endpoint POST /admin/billing/seed-test-scenarios.
 *
 * @param {object} db
 * @param {string} cpf
 * @param {'adimplente'|'vencida'|'inadimplente'|'reset'} scenario
 * @param {{ daysOverdue?, invoiceAmount? }} [opts]
 */
async function applyScenario(db, cpf, scenario, opts = {}) {
    const presets = {
        adimplente:   { accountStatus: 'adimplente',   daysOverdue: 0,  dueDaysFromNow: 30  },
        vencida:      { accountStatus: 'adimplente',   daysOverdue: 2,  dueDaysFromNow: -2  },
        inadimplente: { accountStatus: 'inadimplente', daysOverdue: 15, dueDaysFromNow: -15 },
        reset:        { accountStatus: 'adimplente',   daysOverdue: 0,  dueDaysFromNow: 30  },
    };
    const p = presets[scenario];
    if (!p) throw new Error(`Cenário inválido: "${scenario}". Use: adimplente, vencida, inadimplente, reset.`);

    const daysOverdue   = opts.daysOverdue    != null ? Number(opts.daysOverdue)   : p.daysOverdue;
    const invoiceAmount = opts.invoiceAmount  != null ? Number(opts.invoiceAmount)  : 0;

    await applyBillingState(db, cpf, p.accountStatus, daysOverdue, p.dueDaysFromNow, invoiceAmount);
    return { cpf, scenario, daysOverdue, accountStatus: p.accountStatus };
}

/**
 * Salva o estado de billing atual de um CPF como novo baseline mock.
 * Após salvar, o próximo reset restaura ESTE estado (não o hardcoded).
 * Também converte transações [TEST] desse CPF em [MOCK] (persistentes).
 *
 * @param {object} db
 * @param {string} cpf
 */
async function saveAsMockBaseline(db, cpf) {
    await ensureMockBaselineTable(db);

    // 1. Ler estado atual do usuário
    const rows = await db.executeQuery(`
        SELECT account_status, days_overdue, credit_card_invoice_due_date,
               COALESCE(credit_card_total_limit, 5000)      AS total_limit,
               COALESCE(credit_card_available_limit, 0)     AS available_limit
        FROM ${db.fq('users')} WHERE cpf = '${cpf}'
    `);
    if (!rows.length) throw new Error(`CPF ${cpf} não encontrado.`);
    const u = rows[0];

    const dueDate        = u.credit_card_invoice_due_date ? new Date(u.credit_card_invoice_due_date) : new Date();
    const dueDaysFromNow = Math.round((dueDate - new Date()) / 86400000);
    const invoiceAmount  = Math.max(0, parseFloat(u.total_limit) - parseFloat(u.available_limit));

    // 2. Persistir baseline
    await db.executeQuery(`
        INSERT INTO ${db.fq('billing_mock_baselines')}
            (cpf, account_status, days_overdue, due_days_from_now, invoice_amount, saved_at)
        VALUES
            ('${cpf}', '${u.account_status}', ${u.days_overdue}, ${dueDaysFromNow}, ${invoiceAmount.toFixed(2)}, NOW())
        ON CONFLICT (cpf) DO UPDATE
            SET account_status    = EXCLUDED.account_status,
                days_overdue      = EXCLUDED.days_overdue,
                due_days_from_now = EXCLUDED.due_days_from_now,
                invoice_amount    = EXCLUDED.invoice_amount,
                saved_at          = NOW()
    `);

    // 3. Converter transações [TEST] desse CPF em [MOCK] (sobrevivem ao reset)
    await db.executeQuery(`
        UPDATE ${db.fq('transactions')}
        SET description = REPLACE(description, '${PREFIX_TEST}', '${PREFIX_MOCK}'),
            id          = REPLACE(id, 'test_', 'mock_')
        WHERE cpf = '${cpf}' AND description LIKE '${PREFIX_TEST}%' AND type = 'INVOICE_INSTALLMENT'
    `);

    return { cpf, savedBaseline: { accountStatus: u.account_status, daysOverdue: u.days_overdue, dueDaysFromNow, invoiceAmount } };
}

/**
 * Remove o baseline salvo de um CPF, voltando ao padrão hardcoded.
 * @param {object} db
 * @param {string} cpf
 */
async function clearMockBaseline(db, cpf) {
    await ensureMockBaselineTable(db);
    await db.executeQuery(`DELETE FROM ${db.fq('billing_mock_baselines')} WHERE cpf = '${cpf}'`);
    // Converter transações [MOCK] de volta para [TEST] (serão limpas no próximo reset)
    await db.executeQuery(`
        UPDATE ${db.fq('transactions')}
        SET description = REPLACE(description, '${PREFIX_MOCK}', '${PREFIX_TEST}'),
            id          = REPLACE(id, 'mock_', 'test_')
        WHERE cpf = '${cpf}' AND description LIKE '${PREFIX_MOCK}%' AND type = 'INVOICE_INSTALLMENT'
    `);
    return { cpf, cleared: true };
}

/**
 * Seed/reset completo de dados de billing no startup.
 *
 * Fluxo por CPF de teste:
 *   1. Deleta transações [TEST] (geradas anteriormente)
 *   2. Se tem baseline salvo ([MOCK]) → restaura aquele estado
 *   3. Se não tem → gera novo histórico [TEST] + aplica cenário padrão
 */
async function seedBillingMockData(db) {
    console.log('🌱 [BillingMock] Resetando massa de dados de faturamento...');

    await ensureMockBaselineTable(db);

    // Limpar TODAS as transações [TEST] (geradas pelo seeder; não toca em [MOCK])
    await db.executeQuery(`
        DELETE FROM ${db.fq('transactions')}
        WHERE description LIKE '${PREFIX_TEST}%' AND type = 'INVOICE_INSTALLMENT'
    `);

    // Carregar baselines salvos
    const savedRows = await db.executeQuery(`SELECT * FROM ${db.fq('billing_mock_baselines')}`);
    const saved     = Object.fromEntries(savedRows.map(r => [r.cpf, r]));

    for (const [cpf, defaults] of Object.entries(DEFAULT_SCENARIOS)) {
        const exists = await db.executeQuery(`SELECT cpf FROM ${db.fq('users')} WHERE cpf = '${cpf}'`);
        if (!exists.length) continue;

        const baseline = saved[cpf];

        if (baseline) {
            // ── Tem baseline salvo: restaurar esse estado ──────────────────────
            console.log(`   ${cpf} → restaurando baseline salvo (${baseline.account_status})`);
            await applyBillingState(
                db, cpf,
                baseline.account_status,
                baseline.days_overdue,
                baseline.due_days_from_now,
                parseFloat(baseline.invoice_amount ?? 0)
            );
            // Transações [MOCK] já estão no banco — não precisa recriar
        } else {
            // ── Sem baseline: gerar histórico [TEST] + cenário padrão ──────────
            const scenario = defaults.accountStatus === 'inadimplente' ? 'inadimplente'
                : defaults.daysOverdue > 0 ? 'vencida'
                : 'adimplente';
            console.log(`   ${cpf} → padrão (${scenario})`);

            for (let m = -5; m <= -1; m++) {
                const total = rand(defaults.monthlyAvg * 0.7, defaults.monthlyAvg * 1.3);
                await seedMonthTransactions(db, cpf, m, total, PREFIX_TEST);
            }

            await applyBillingState(
                db, cpf,
                defaults.accountStatus,
                defaults.daysOverdue,
                defaults.dueDaysFromNow,
                defaults.monthlyAvg * 3
            );
        }
    }

    console.log('✅ [BillingMock] Massa aplicada. Baselines salvos: ' + savedRows.length);
    console.log('   Dica: POST /admin/billing/save-as-mock para persistir estado customizado.');
}

module.exports = { seedBillingMockData, applyScenario, saveAsMockBaseline, clearMockBaseline };
