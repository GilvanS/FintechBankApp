let db = null;

function setDb(service) {
    db = service;
}
function getDb() {
    if (!db) throw new Error('DB não inicializado');
    return db;
}

// Escapar valores para SQL simples (Databricks) — parametrização básica
function esc(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    const str = String(value).replace(/'/g, "''");
    return `'${str}'`;
}

module.exports = { setDb, getDb, esc };