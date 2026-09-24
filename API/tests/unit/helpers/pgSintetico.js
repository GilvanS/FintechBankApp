/**
 * pgSintetico.js — roda a SQL REAL de um serviço no Postgres, SÓ LEITURA, sobre
 * tabelas SINTÉTICAS: `db.fq('x')` devolve `fake_x` e cada executeQuery ganha, na frente,
 * uma CTE `fake_x(...) AS (VALUES ...)` para cada tabela citada. Nenhuma tabela real é
 * lida ou gravada (a query que citar `fintech` ou tentar escrever falha o teste).
 *
 * temPostgres() decide NO LOAD do arquivo de teste (síncrono) se há Postgres acessível,
 * para o teste usar `(temPostgres() ? describe : describe.skip)` — sem banco, os
 * cenários aparecem como SKIPPED no relatório, e não como passed sem ter rodado.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const API_DIR = path.join(__dirname, '..', '..', '..');
const SONDA = `
const f = require('./services/database/DatabaseFactory');
const s = f.createDatabaseService();
s.connect().then(() => s.executeQuery('SELECT 1')).then(() => process.exit(0), () => process.exit(1));
`;

let _temPostgres;
function temPostgres() {
    if (_temPostgres !== undefined) return _temPostgres;
    try {
        execFileSync(process.execPath, ['-e', SONDA], { cwd: API_DIR, env: process.env, stdio: 'ignore', timeout: 20000 });
        _temPostgres = true;
    } catch (_) {
        _temPostgres = false;
    }
    return _temPostgres;
}

/** Conexão real (só para executar as consultas sintéticas). */
async function conectar() {
    const DatabaseFactory = require('../../../services/database/DatabaseFactory');
    const svc = DatabaseFactory.createDatabaseService();
    await svc.connect();
    return svc;
}

const literal = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

/** CTE de uma tabela sintética. colunas: [['id', 'varchar'], ...]; linhas: objetos. */
function cte(nome, colunas, linhas) {
    if (!linhas.length) {
        return `fake_${nome} AS (SELECT ${colunas.map(([c, tipo]) => `NULL::${tipo} AS ${c}`).join(', ')} WHERE false)`;
    }
    const valores = linhas.map((l) => `(${colunas.map(([c, tipo]) => `${literal(l[c])}::${tipo}`).join(', ')})`).join(', ');
    return `fake_${nome}(${colunas.map(([c]) => c).join(', ')}) AS (VALUES ${valores})`;
}

/**
 * Prefixa a SQL com as CTEs das tabelas que ela cita. SQL que já começa com WITH
 * recebe as CTEs dentro do mesmo WITH.
 * @param {string} sql
 * @param {Object<string, {colunas: Array, linhas: Array}>} tabelas
 */
function comTabelasSinteticas(sql, tabelas) {
    const q = String(sql);
    if (/fintech/i.test(q)) throw new Error(`SQL sintética cita tabela real: ${q.slice(0, 120)}`);
    const ctes = Object.entries(tabelas)
        .filter(([nome]) => new RegExp(`\\bfake_${nome}\\b`).test(q))
        .map(([nome, t]) => cte(nome, t.colunas, t.linhas));
    if (!ctes.length) return q;
    return /^\s*WITH\s/i.test(q)
        ? q.replace(/^\s*WITH\s/i, `WITH ${ctes.join(',\n')},\n`)
        : `WITH ${ctes.join(',\n')}\n${q}`;
}

/**
 * dbService falso sobre o Postgres real: fq → fake_x; SELECT/WITH rodam com as tabelas
 * sintéticas; ALTER (garantirColunasQuitacao) é ignorado; qualquer outra escrita falha.
 */
function bancoSintetico(pg, tabelas) {
    const sqls = [];
    return {
        sqls,
        fq: (t) => `fake_${t}`,
        generateUUID: () => 'uuid-teste',
        async executeQuery(sql) {
            const q = String(sql);
            sqls.push(q);
            if (/^\s*ALTER\s+TABLE/i.test(q)) return [];
            if (!/^\s*(SELECT|WITH)\b/i.test(q)) throw new Error(`escrita em banco sintético: ${q.trim().slice(0, 80)}`);
            return pg.executeQuery(comTabelasSinteticas(q, tabelas));
        },
    };
}

// Colunas usadas pelos serviços de auditoria (só as necessárias para as consultas).
const COLUNAS = {
    users: [['cpf', 'varchar'], ['full_name', 'text'], ['balance', 'numeric'], ['role', 'varchar'],
        ['credit_card_due_day', 'int'], ['is_blacklisted', 'boolean']],
    invoices: [['id', 'varchar'], ['cpf', 'varchar'], ['status', 'varchar'], ['due_date', 'timestamp'],
        ['created_at', 'timestamp'], ['updated_at', 'timestamp'], ['valor_total', 'numeric'], ['saldo_anterior', 'numeric'],
        ['valor_pago', 'numeric'], ['data_pagamento', 'timestamp']],
    transactions: [['id', 'varchar'], ['cpf', 'varchar'], ['type', 'varchar'], ['amount', 'numeric'],
        ['description', 'text'], ['date', 'timestamp'], ['invoice_id', 'varchar'], ['status', 'varchar']],
    billing_charges: [['id', 'varchar'], ['cpf', 'varchar'], ['charge_type', 'varchar'], ['amount', 'numeric'],
        ['status', 'varchar'], ['invoice_amount', 'numeric'], ['payment_id', 'varchar'], ['created_at', 'timestamp']],
};

/** Monta o mapa de tabelas com as colunas padrão. */
function tabelasPadrao({ users = [], invoices = [], transactions = [], billing_charges = [] } = {}) {
    const completa = (colunas, linhas) => linhas.map((l) => Object.fromEntries(colunas.map(([c]) => [c, l[c] ?? null])));
    return {
        users: { colunas: COLUNAS.users, linhas: completa(COLUNAS.users, users) },
        invoices: { colunas: COLUNAS.invoices, linhas: completa(COLUNAS.invoices, invoices) },
        transactions: { colunas: COLUNAS.transactions, linhas: completa(COLUNAS.transactions, transactions) },
        billing_charges: { colunas: COLUNAS.billing_charges, linhas: completa(COLUNAS.billing_charges, billing_charges) },
    };
}

module.exports = { temPostgres, conectar, cte, comTabelasSinteticas, bancoSintetico, tabelasPadrao, COLUNAS };
