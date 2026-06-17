/**
 * Invoice lifecycle fields — interest, fees, payment tracking.
 * Source: schema_invoice_lifecycle.sql
 * Required for Phase 5 invoice late-payment enforcement.
 */
exports.up = async function (knex) {
    const addIfMissing = async (table, column, definition) => {
        const exists = await knex.raw(
            `SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'fintech' AND table_name = ? AND column_name = ?`,
            [table, column]
        );
        if (exists.rows.length === 0) {
            await knex.raw(`ALTER TABLE fintech.${table} ADD COLUMN ${column} ${definition}`);
        }
    };

    await addIfMissing('invoices', 'valor_total',              'DECIMAL(15,2) NOT NULL DEFAULT 0');
    await addIfMissing('invoices', 'data_pagamento',           'TIMESTAMP NULL');
    await addIfMissing('invoices', 'dias_atraso',              'INTEGER DEFAULT 0');
    await addIfMissing('invoices', 'valor_juros',              'DECIMAL(15,2) DEFAULT 0.00');
    await addIfMissing('invoices', 'valor_multa',              'DECIMAL(15,2) DEFAULT 0.00');
    await addIfMissing('invoices', 'valor_total_com_encargos', 'DECIMAL(15,2) DEFAULT 0.00');

    await addIfMissing('users', 'credit_card_due_day',      'INTEGER DEFAULT 10');
    await addIfMissing('users', 'invoice_last_closed_date', 'TIMESTAMP NULL');
    await addIfMissing('users', 'days_overdue',             'INTEGER DEFAULT 0');

    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_invoices_cpf_status
        ON fintech.invoices (cpf, status)
    `);
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_invoices_due_date
        ON fintech.invoices (due_date)
        WHERE status IN ('OPEN', 'OVERDUE')
    `);
};

exports.down = async function (knex) {
    await knex.raw('DROP INDEX IF EXISTS fintech.idx_invoices_due_date');
    await knex.raw('DROP INDEX IF EXISTS fintech.idx_invoices_cpf_status');

    for (const col of ['valor_total', 'data_pagamento', 'dias_atraso', 'valor_juros', 'valor_multa', 'valor_total_com_encargos']) {
        await knex.raw(`ALTER TABLE fintech.invoices DROP COLUMN IF EXISTS ${col}`);
    }
    for (const col of ['credit_card_due_day', 'invoice_last_closed_date', 'days_overdue']) {
        await knex.raw(`ALTER TABLE fintech.users DROP COLUMN IF EXISTS ${col}`);
    }
};
