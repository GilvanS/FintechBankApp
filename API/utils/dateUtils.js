/**
 * dateUtils.js — Helpers de data compartilhados.
 *
 * PROBLEMA QUE RESOLVE: o driver pg retorna colunas TIMESTAMP como objeto Date.
 * `String(date).split('T')[0]` produz lixo ('Tue Aug 10 2026 00:00:00 GMT-0300 (...)')
 * porque Date.toString() não tem 'T'. `toDateOnly` normaliza QUALQUER entrada
 * (Date object, string ISO 'YYYY-MM-DDTHH:mm:ss', ou 'YYYY-MM-DD') para 'YYYY-MM-DD'.
 */

/** Normaliza qualquer data para 'YYYY-MM-DD' (usa componentes locais, não UTC). */
function toDateOnly(value, fallback = '') {
    if (value === null || value === undefined || value === '') return fallback;
    if (value instanceof Date && !isNaN(value.getTime())) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    return fallback;
}

/** Converte para 'DD/MM/YYYY' (ex.: para comprovantes/exibição). */
function toDateBR(value, fallback = '') {
    const only = toDateOnly(value, fallback);
    if (!only || only === fallback) return fallback;
    return only.split('-').reverse().join('/');
}

module.exports = { toDateOnly, toDateBR };
