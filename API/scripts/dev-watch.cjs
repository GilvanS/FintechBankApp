#!/usr/bin/env node
/**
 * dev-watch.cjs — substituto do `node --watch-path=... index.cjs` do `npm run dev`.
 *
 * Por quê: no Windows, o `node --watch` reinicia em QUALQUER evento do sistema de
 * arquivos — inclusive quando outro processo (antivírus, indexador, editor) só toca
 * o arquivo sem mudar o conteúdo. Medido em 2026-09-23: evento "change" em
 * src/controllers/adminScriptsController.js com conteúdo e mtime idênticos
 * derrubou a API; operações longas do Admin (UTI, recalcular limite) caíam com
 * "API fora do ar" sem nada no logs/crash.log.
 *
 * Aqui só reinicia quando o CONTEÚDO muda (hash sha1) ou um arquivo é criado/apagado.
 * Se a API sair sozinha (crash), espera a próxima mudança real, como o node --watch.
 */
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ALVOS = ['index.cjs', 'src', 'services', 'repositories', 'utils', 'middlewares', 'workers', 'config'];
const IGNORAR = /(^|[\\/])(node_modules|__pycache__|\.git)([\\/]|$)|\.(log|tmp|swp)$|~$/;
const DEBOUNCE_MS = 300;

const hashes = new Map(); // caminho absoluto -> sha1 (null = não existe)
let filho = null;
let timer = null;
const pendentes = new Set();

function hashDe(arquivo) {
    try {
        if (!fs.statSync(arquivo).isFile()) return undefined; // diretório: ignora
        return crypto.createHash('sha1').update(fs.readFileSync(arquivo)).digest('hex');
    } catch {
        return null; // apagado (ou sem acesso no instante do evento)
    }
}

function indexar(p) {
    let st;
    try { st = fs.statSync(p); } catch { return; }
    if (st.isDirectory()) {
        for (const nome of fs.readdirSync(p)) {
            const filhoPath = path.join(p, nome);
            if (!IGNORAR.test(filhoPath)) indexar(filhoPath);
        }
    } else {
        hashes.set(p, hashDe(p));
    }
}

function iniciar() {
    filho = spawn(process.execPath, ['index.cjs'], { cwd: RAIZ, stdio: 'inherit', env: process.env });
    const este = filho;
    este.on('exit', (code, signal) => {
        if (filho !== este) return; // saída de um processo que nós mesmos reiniciamos
        filho = null;
        console.log(`\n[dev-watch] API saiu (code=${code}${signal ? `, signal=${signal}` : ''}). Aguardando mudança de arquivo para reiniciar...`);
    });
}

function reiniciar(motivos) {
    console.log(`\n[dev-watch] Reiniciando — mudou: ${motivos.join(', ')}`);
    if (filho) {
        const antigo = filho;
        filho = null;
        antigo.once('exit', iniciar);
        antigo.kill();
    } else {
        iniciar();
    }
}

function aoEvento(arquivo) {
    if (IGNORAR.test(arquivo)) return;
    pendentes.add(arquivo);
    clearTimeout(timer);
    timer = setTimeout(() => {
        const mudaram = [];
        for (const f of pendentes) {
            const novo = hashDe(f);
            if (novo === undefined) continue;
            const antigo = hashes.has(f) ? hashes.get(f) : null;
            if (novo !== antigo) {
                hashes.set(f, novo);
                mudaram.push(path.relative(RAIZ, f));
            }
        }
        pendentes.clear();
        if (mudaram.length > 0) reiniciar(mudaram);
    }, DEBOUNCE_MS);
}

for (const alvo of ALVOS) {
    const abs = path.join(RAIZ, alvo);
    if (!fs.existsSync(abs)) continue;
    indexar(abs);
    const ehDir = fs.statSync(abs).isDirectory();
    fs.watch(abs, { recursive: ehDir }, (_evento, nome) => {
        aoEvento(ehDir && nome ? path.join(abs, nome) : abs);
    });
}

console.log(`[dev-watch] Vigiando ${hashes.size} arquivo(s); reinicia só com mudança de conteúdo.`);
iniciar();

for (const sinal of ['SIGINT', 'SIGTERM']) {
    process.on(sinal, () => {
        if (filho) filho.kill();
        process.exit(0);
    });
}
