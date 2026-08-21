/**
 * Exporta massas de teste do PostgreSQL para CSV, usados como:
 *  1. Dado de exemplo navegável direto no GitHub (a pasta é renderizada como tabela).
 *  2. Fonte de dados do modo mock do WEB (login só funciona se o CPF existir aqui).
 *
 * Re-executar sempre que o schema mudar — colunas são introspectadas ao vivo
 * via information_schema, não hardcoded. Qualquer coluna que pareça sensível
 * (senha, hash, pin, cvv, número de cartão cru) é excluída automaticamente.
 *
 *   node scripts/export_demo_csv.cjs
 */
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
dotenv.config({ path: path.join(__dirname, '../.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');

const TABLES = ['users', 'cards', 'transactions', 'invoices', 'pix_keys'];
const OUT_DIR = path.join(__dirname, '../../WEB/public/demo-data');

// Qualquer coluna cujo nome contenha um destes termos é excluída do CSV.
const SENSITIVE_NAME_PARTS = ['password', 'hash', 'secret', 'token', 'pin', 'cvv', '_raw', 'salt'];

// Colunas que o front precisa exibir, mas cujo valor não pode sair em claro.
// O número do cartão vira **** **** **** 1234 (mantém só os 4 últimos dígitos).
const MASKED_NAME_PARTS = ['card_number', 'cardnumber'];

function isSensitiveColumn(name) {
    const lower = name.toLowerCase();
    return SENSITIVE_NAME_PARTS.some((part) => lower.includes(part));
}

function isMaskedColumn(name) {
    const lower = name.toLowerCase();
    return MASKED_NAME_PARTS.some((part) => lower.includes(part));
}

function maskPan(value) {
    if (value === null || value === undefined) return value;
    const digits = String(value).replace(/\D/g, '');
    if (digits.length < 4) return value;
    return `**** **** **** ${digits.slice(-4)}`;
}

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    let str;
    if (value instanceof Date) str = value.toISOString();
    else if (typeof value === 'object') str = JSON.stringify(value);
    else str = String(value);
    if (/[",\n\r]/.test(str)) {
        str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function rowsToCsv(columns, rows) {
    const header = columns.map(csvEscape).join(',');
    const lines = rows.map((row) =>
        columns.map((col) => csvEscape(isMaskedColumn(col) ? maskPan(row[col]) : row[col])).join(',')
    );
    return [header, ...lines].join('\r\n') + '\r\n';
}

async function exportTable(db, table) {
    const schema = db.schema || 'fintech';

    const colsQuery = `
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = '${schema}' AND table_name = '${table}'
        ORDER BY ordinal_position
    `;
    const colRows = await db.executeQuery(colsQuery);
    if (!colRows.length) {
        console.warn(`⚠️  Tabela "${table}" não encontrada no schema "${schema}" — pulando.`);
        return;
    }

    const columns = colRows.map((r) => r.column_name).filter((c) => !isSensitiveColumn(c));
    const excluded = colRows.map((r) => r.column_name).filter((c) => isSensitiveColumn(c));
    if (excluded.length) {
        console.log(`   🔒 Excluídas de "${table}": ${excluded.join(', ')}`);
    }
    const masked = columns.filter(isMaskedColumn);
    if (masked.length) {
        console.log(`   🎭 Mascaradas em "${table}": ${masked.join(', ')}`);
    }

    const dataQuery = `SELECT ${columns.map((c) => `"${c}"`).join(', ')} FROM ${db.fq(table)} ORDER BY 1`;
    const rows = await db.executeQuery(dataQuery);

    const csv = rowsToCsv(columns, rows);
    const outPath = path.join(OUT_DIR, `${table}.csv`);
    fs.writeFileSync(outPath, csv, 'utf8');
    console.log(`✅ ${table}.csv — ${rows.length} linha(s), ${columns.length} coluna(s)`);
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const db = DatabaseFactory.createDatabaseService();
    await db.connect();

    console.log(`\n📦 Exportando massas de teste para CSV em ${OUT_DIR}\n`);
    for (const table of TABLES) {
        await exportTable(db, table);
    }
    console.log('\n🎉 Export concluído.\n');
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Erro no export:', err.message);
    process.exit(1);
});
