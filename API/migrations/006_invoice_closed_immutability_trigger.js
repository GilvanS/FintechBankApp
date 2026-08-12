// Migration: trigger que torna fatura FECHADA monetariamente imutável.
//
// docs/REGRAS-NEGOCIO-FATURA.md §22 — fatura fechada não recebe novos eventos
// monetários: o pagamento e o saldo credor pertencem à fatura ABERTA. Sem essa
// trava, qualquer UPDATE novo (refactor, script, SQL manual) reverte a regra.
//
// Bloqueia UPDATE nas colunas monetárias quando OLD.status = 'FECHADA'. A
// transição para FECHADA (ABERTA → FECHADA) continua livre — o fechamento é
// justamente o momento que congela a fatura. Colunas não-monetárias (status
// em si, updated_at) seguem editáveis.
//
// Habilitar e desabilitar com ALTER TABLE ... DISABLE/ENABLE TRIGGER (superuser).
// A suíte audit_completo.js depende dessa porta de manutenção.
const MONETARY_COLUMNS = [
    'valor_total',
    'saldo_anterior',
    'valor_iof',
    'valor_multa',
    'valor_juros_remuneratorios',
    'valor_juros_mora',
    'valor_total_com_encargos',
    'valor_pago',
    'data_pagamento',
    'data_ultimo_pagamento',
    'itemized_transactions'
];

exports.up = async function(knex) {
    const schema = process.env.DB_SCHEMA || 'fintech';
    const guardFn = 'invoices_block_closed_monetary_update';
    const triggerName = 'trg_invoices_immutable_when_closed';

    const colsList = MONETARY_COLUMNS.map(c => `NEW.${c} IS DISTINCT FROM OLD.${c}`).join(' OR ');

    await knex.raw(`
        CREATE OR REPLACE FUNCTION ${schema}.${guardFn}()
        RETURNS trigger AS $$
        BEGIN
            IF OLD.status = 'FECHADA' AND (${colsList}) THEN
                RAISE EXCEPTION 'invoices_immutability: fatura % ja esta FECHADA; colunas monetarias nao podem mudar', OLD.id
                    USING ERRCODE = 'check_violation';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    const exists = await knex.raw(`
        SELECT 1 FROM pg_trigger
        WHERE tgname = '${triggerName}'
          AND tgrelid = '${schema}.invoices'::regclass
    `);
    if (!exists.rows.length) {
        await knex.raw(`
            CREATE TRIGGER ${triggerName}
            BEFORE UPDATE ON ${schema}.invoices
            FOR EACH ROW
            EXECUTE FUNCTION ${schema}.${guardFn}();
        `);
    }
};

exports.down = async function(knex) {
    const schema = process.env.DB_SCHEMA || 'fintech';
    const triggerName = 'trg_invoices_immutable_when_closed';
    await knex.raw(`DROP TRIGGER IF EXISTS ${triggerName} ON ${schema}.invoices;`);
    await knex.raw(`DROP FUNCTION IF EXISTS ${schema}.invoices_block_closed_monetary_update();`);
};
