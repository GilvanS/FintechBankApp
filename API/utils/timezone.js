const APP_TIMEZONE = 'America/Sao_Paulo';

/**
 * Timestamp para colunas `timestamp without time zone`.
 * Formata a hora de parede de Brasília — NÃO usar toISOString() (converte p/ UTC
 * e grava o dia seguinte quando são >21h no Brasil).
 * @param {Date} [date=new Date()]
 * @returns {string} 'YYYY-MM-DD HH:mm:ss.SSS'
 */
function nowDb(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return nowDb();
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: APP_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year').value;
    const mo = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const h = parts.find(p => p.type === 'hour').value;
    const mi = parts.find(p => p.type === 'minute').value;
    const s = parts.find(p => p.type === 'second').value;
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${y}-${mo}-${day} ${h}:${mi}:${s}.${ms}`;
}

/**
 * Chave de agrupamento por dia no calendário brasileiro.
 * @param {Date|string} [date=new Date()]
 * @returns {string} 'YYYY-MM-DD'
 */
function dayKey(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return dayKey();
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year').value;
    const mo = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${y}-${mo}-${day}`;
}

/** Início do dia (00:00:00.000) em Brasília. */
function startOfDay(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return startOfDay();
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year').value;
    const mo = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${y}-${mo}-${day} 00:00:00.000`;
}

/** Fim do dia (23:59:59.999) em Brasília. */
function endOfDay(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return endOfDay();
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year').value;
    const mo = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${y}-${mo}-${day} 23:59:59.999`;
}

/**
 * Dias inteiros entre duas datas, ancorado na virada de dia de Brasília.
 * @param {Date|string} from
 * @param {Date|string} to
 * @returns {number}
 */
function daysBetween(from, to) {
    const f = from instanceof Date ? from : new Date(from);
    const t = to instanceof Date ? to : new Date(to);
    if (isNaN(f.getTime()) || isNaN(t.getTime())) return 0;
    const fDay = new Date(startOfDay(f));
    const tDay = new Date(startOfDay(t));
    const diffMs = tDay.getTime() - fDay.getTime();
    return Math.max(0, Math.floor(diffMs / 86400000));
}

/**
 * Valida fuso do processo e da sessão do banco.
 * @param {object} db - provider com executeQuery
 * @throws {Error} se qualquer um divergir de America/Sao_Paulo
 */
async function assertTimezone(db) {
    const expected = 'America/Sao_Paulo';
    const processTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (processTz !== expected) {
        throw new Error(
            `[Timezone Guard] Process timezone é "${processTz}", esperado "${expected}". ` +
            `Defina TZ=America/Sao_Paulo no ambiente (ex: TZ=America/Sao_Paulo npm run dev).`
        );
    }
    const dbTzRows = await db.executeQuery("SHOW timezone");
    const dbTz = dbTzRows[0]?.TimeZone || dbTzRows[0]?.timezone;
    if (dbTz !== expected) {
        throw new Error(
            `[Timezone Guard] Banco timezone é "${dbTz}", esperado "${expected}". ` +
            `Configure PGTZ=America/Sao_Paulo no Postgres ou options: '-c timezone=America/Sao_Paulo' no pool.`
        );
    }
}

module.exports = {
    APP_TIMEZONE,
    nowDb,
    dayKey,
    startOfDay,
    endOfDay,
    daysBetween,
    assertTimezone,
};