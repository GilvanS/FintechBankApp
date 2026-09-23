#!/usr/bin/env node
/**
 * Pausa os reinícios do `npm run dev` (scripts/dev-watch.cjs) — para rodar testes
 * ou operações longas do painel Admin sem a API reiniciar no meio.
 *
 *   npm run dev:pause -- 60     → nenhuma mudança de arquivo reinicia a API por 60 min
 *   npm run dev:pause -- off    → libera; o que mudou durante a pausa é aplicado na hora
 *   npm run dev:pause           → mostra se há pausa ativa
 */
const fs = require('fs');
const path = require('path');

const ARQUIVO = path.join(__dirname, '..', '.dev-watch-pause');
const arg = (process.argv[2] || '').trim().toLowerCase();

function status() {
    try {
        const ate = Date.parse(fs.readFileSync(ARQUIVO, 'utf8').trim());
        if (Number.isFinite(ate) && ate > Date.now()) {
            const min = Math.ceil((ate - Date.now()) / 60000);
            return `Pausa ativa até ${new Date(ate).toLocaleTimeString('pt-BR')} (faltam ${min} min).`;
        }
    } catch { /* sem pausa */ }
    return 'Sem pausa — a API reinicia quando um arquivo muda de verdade.';
}

if (!arg) {
    console.log(status());
} else if (arg === 'off') {
    fs.rmSync(ARQUIVO, { force: true });
    console.log('Pausa removida — mudanças pendentes serão aplicadas em até 5s.');
} else {
    const minutos = Number(arg);
    if (!Number.isFinite(minutos) || minutos <= 0 || minutos > 24 * 60) {
        console.error('Uso: npm run dev:pause -- <minutos (1 a 1440)> | off');
        process.exit(1);
    }
    fs.writeFileSync(ARQUIVO, new Date(Date.now() + minutos * 60000).toISOString());
    console.log(status());
}
