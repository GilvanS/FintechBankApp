// Migration: quanto de cada pagamento foi para encargos (billing_charges).
//
// Um INVOICE_PAYMENT pode quitar encargos E principal de uma vez. Sem separar as
// duas partes, toda soma de "pago" contava os encargos como principal: a cascata
// (planDistribution) sobrava saldo credor fantasma e o pagamento com a fatura
// ABERTA não tinha como ser vinculado depois sem contar o dinheiro duas vezes.
//
// Nullable de propósito: NULL = linha anterior a esta regra (tratada como 0 e
// NUNCA vinculada pelo invoiceEngine). Linha da regra nova sempre grava um número
// (0 quando nada foi para encargos). Ver docs/REGRAS-NEGOCIO-FATURA.md §25.
exports.up = async function(knex) {
    const schema = process.env.DB_SCHEMA || 'fintech';
    const has = await knex.schema.withSchema(schema).hasColumn('transactions', 'applied_to_charges');
    if (!has) {
        await knex.schema.withSchema(schema).alterTable('transactions', (t) => {
            t.decimal('applied_to_charges', 15, 2).nullable();
        });
    }
};

exports.down = async function(knex) {
    const schema = process.env.DB_SCHEMA || 'fintech';
    const has = await knex.schema.withSchema(schema).hasColumn('transactions', 'applied_to_charges');
    if (has) {
        await knex.schema.withSchema(schema).alterTable('transactions', (t) => {
            t.dropColumn('applied_to_charges');
        });
    }
};
