// Migration: cria fintech.audit_log (idempotente via createTableIfNotExists)
exports.up = async function(knex) {
    const schema = process.env.DB_SCHEMA || 'fintech';
    await knex.schema.withSchema(schema).createTableIfNotExists('audit_log', (t) => {
        t.uuid('id').primary();
        t.string('req_id', 64);
        t.string('cpf', 11);
        t.string('action', 128).notNullable();
        t.string('level', 16).defaultTo('info');
        t.jsonb('meta');
        t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    });
};

exports.down = async function(knex) {
    const schema = process.env.DB_SCHEMA || 'fintech';
    await knex.schema.withSchema(schema).dropTableIfExists('audit_log');
};
