// Migration: vincula pagamento -> fatura em fintech.transactions.
//
// Sem esse vínculo a quitação de uma fatura FECHADA só podia ser derivada
// denormalizando valor_pago/data_pagamento DENTRO da própria fatura — o que
// viola a imutabilidade da fatura fechada (docs/REGRAS-NEGOCIO-FATURA.md).
// Com invoice_id a quitação vira SUM(pagamentos do invoice) e a fatura
// fechada fica congelada no fechamento.
//
// Nullable: as linhas históricas não têm como ser reatribuídas com segurança.
exports.up = async function(knex) {
    const schema = process.env.DB_SCHEMA || 'fintech';
    const has = await knex.schema.withSchema(schema).hasColumn('transactions', 'invoice_id');
    if (!has) {
        await knex.schema.withSchema(schema).alterTable('transactions', (t) => {
            // varchar(255) para casar com invoices.id / transactions.id
            t.string('invoice_id', 255).nullable();
            // Quitação lê SUM(amount) por (cpf, invoice_id) a cada cálculo de dívida
            t.index(['cpf', 'invoice_id'], 'idx_transactions_cpf_invoice');
        });
    }
};

exports.down = async function(knex) {
    const schema = process.env.DB_SCHEMA || 'fintech';
    const has = await knex.schema.withSchema(schema).hasColumn('transactions', 'invoice_id');
    if (has) {
        await knex.schema.withSchema(schema).alterTable('transactions', (t) => {
            t.dropIndex(['cpf', 'invoice_id'], 'idx_transactions_cpf_invoice');
            t.dropColumn('invoice_id');
        });
    }
};
