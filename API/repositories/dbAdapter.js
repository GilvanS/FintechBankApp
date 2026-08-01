/**
 * dbAdapter — shim que delega ao provider global (Databricks/Postgres) registrado
 * via `context.setDb()` no bootstrap de `index.cjs`. Usado por módulos fora do
 * ciclo de request (cron, scripts) que precisam de `executeQuery`/`fq`/`esc`.
 */
const context = require('./context');

function db() {
    return context.getDb();
}

module.exports = {
    executeQuery: (sql) => db().executeQuery(sql),
    fq: (name) => db().fq(name),
    esc: (value) => context.esc(value),
};
