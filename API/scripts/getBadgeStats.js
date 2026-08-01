#!/usr/bin/env node
/**
 * getBadgeStats.js — Extrai estatísticas de validação para o badge
 *
 * Lê SKILL.md da raiz, conta seções, cross-references, e valida âncoras.
 * Saída: JSON com { passed, failed, warnings, total, score, schemasSeen, anchorsOk }
 *
 * Uso:
 *   node scripts/getBadgeStats.js
 */

const { computeStats } = require('./statsUtils');

const result = computeStats();

if (result.error) {
    process.stderr.write(`Erro: ${result.error}\n`);
    process.exit(1);
}

process.stdout.write(JSON.stringify(result));
