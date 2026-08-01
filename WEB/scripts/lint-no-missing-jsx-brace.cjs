#!/usr/bin/env node
/**
 * lint-no-missing-jsx-brace.cjs
 *
 * Detecta   }\`>   (falta } entre ` e > no fechamento de atributo JSX)
 * Correto:  }\`}>
 *
 * ---
 * Uso:
 *   node scripts/lint-no-missing-jsx-brace.cjs          # escaneia tudo
 *   node scripts/lint-no-missing-jsx-brace.cjs --fix    # corrige automaticamente
 *   node scripts/lint-no-missing-jsx-brace.cjs Arquivo.tsx Outro.tsx
 *
 * Exit code: 0 = limpo, 1 = encontrou ocorrências (modo read-only)
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const SHOULD_FIX = args.includes('--fix');
const fileArgs = args.filter(a => !a.startsWith('--') && (a.endsWith('.tsx') || a.endsWith('.ts')));

const C = { RST: '\x1b[0m', RD: '\x1b[31m', GR: '\x1b[32m', YL: '\x1b[33m', CY: '\x1b[36m', BD: '\x1b[1m' };

let totalBugs = 0;
let totalFixed = 0;

/**
 * Detecta o padrão bugado no arquivo inteiro (multilinha incluso).
 * Retorna array de { pos, line, col, context }.
 *
 * Bug: }\x60>[^}]
 * Match: } + ` + > + qualquer coisa exceto }
 */
function findBugs(content) {
    const bugs = [];
    const re = /\}\x60>/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        const pos = m.index;           // posição do `}`
        const next = content[pos + 3]; // char após `>`
        // Pula se for o padrão correto }\x60}>
        if (next === '}' || next === '`') continue;
        // Calcula linha/coluna
        const before = content.substring(0, pos);
        const line = (before.match(/\n/g) || []).length + 1;
        const col = pos - before.lastIndexOf('\n');
        const ctx = content.substring(Math.max(0, pos - 15), Math.min(content.length, pos + 20)).replace(/\n/g, '\\n');
        bugs.push({ pos, line: line, col: col + 1, context: ctx });
    }
    return bugs;
}

function processFile(filePath) {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
        console.log(`  ${C.YL}\u26a0${C.RST} Arquivo não encontrado: ${filePath}`);
        return;
    }

    let content = fs.readFileSync(absPath, 'utf8');
    const bugs = findBugs(content);

    if (bugs.length === 0) return;

    if (SHOULD_FIX) {
        // Aplica fix no conteúdo completo (não split por linhas)
        // Processa de trás pra frente para preservar posições
        const sorted = [...bugs].sort((a, b) => b.pos - a.pos);
        let fixed = 0;
        for (const bug of sorted) {
            // A posição exata do bug é bug.pos: }`>
            // O fix: insere `}` entre ` (pos+1) e > (pos+2)
            // content[bug.pos]     = }
            // content[bug.pos + 1] = `
            // content[bug.pos + 2] = >
            const insertAt = bug.pos + 2; // depois da crase, antes do >
            content = content.slice(0, insertAt) + '}' + content.slice(insertAt);
            fixed++;
            // Ajusta posições dos próximos bugs (mais à esquerda) devido ao deslocamento
            // (sorted é processado de trás pra frente, então os bugs à esquerda
            //  já estão na posição correta antes da inserção)
        }

        fs.writeFileSync(absPath, content, 'utf8');
        totalFixed += fixed;

        // Re-escaneia para verificar
        const remaining = findBugs(content);
        if (remaining.length === 0) {
            console.log(`  ${C.GR}\u2714${C.RST} ${path.relative(process.cwd(), absPath)} \u2014 ${fixed} corrigida(s)`);
        } else {
            console.log(`  ${C.YL}\u26a0${C.RST} ${path.relative(process.cwd(), absPath)} \u2014 ${fixed} corrigida(s), ${remaining.length} restante(s)`);
            for (const b of remaining) {
                console.log(`    ${C.RD}\u2192${C.RST} linha ${b.line}: ...${b.context}...`);
            }
        }
        return;
    }

    // Read-only: reporta
    totalBugs += bugs.length;
    console.log(`  ${C.RD}\u2717${C.RST} ${path.relative(process.cwd(), absPath)} \u2014 ${bugs.length} ocorr\u00eancia(s)`);
    for (const b of bugs) {
        console.log(`    ${C.RD}\u2192${C.RST} linha ${b.line}:\n      ...${b.context}...`);
        console.log(`      ${C.CY}Sugest\u00e3o:${C.RST} adicione } entre \` e >  \u2192 }\`}>`);
    }
}

// ── MAIN ──

console.log(`\n  ${C.BD}\u{D83D}\u{DD0D} lint-no-missing-jsx-brace${C.RST} \u2014 detecta }\`> sem } entre \` e >`);
console.log(`  ${SHOULD_FIX ? '  \u2713 Modo: CORRE\u00C7\u00C3O (--fix)' : '  \u25CB Modo: APENAS VERIFICA\u00C7\u00C3O (use --fix para corrigir)'}`);
console.log(`  ${'\u2500'.repeat(55)}\n`);

if (fileArgs.length === 0) {
    const walk = (dir) => {
        if (!fs.existsSync(dir)) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && e.name !== 'node_modules' && e.name !== '.vite') walk(full);
            else if (e.isFile() && (e.name.endsWith('.tsx') || e.name.endsWith('.ts'))) processFile(full);
        }
    };
    walk(process.cwd());
} else {
    for (const f of fileArgs) processFile(f);
}

console.log(`\n  ${'\u2500'.repeat(55)}`);
if (totalBugs === 0 && totalFixed === 0) {
    console.log(`  ${C.GR}\u2714 Nenhum padr\u00e3o suspeito encontrado.${C.RST}`);
} else {
    console.log(`  ${totalFixed} corrigida(s), ${totalBugs} restante(s).`);
}
console.log(`  ${'\u2500'.repeat(55)}\n`);

process.exit(totalBugs > 0 && !SHOULD_FIX ? 1 : 0);
