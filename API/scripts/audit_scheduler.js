#!/usr/bin/env node
/**
 * audit_scheduler.js — Rotina de Auditoria Automática Agendável
 *
 * Executa audit_completo.js como processo filho com --json, analisa o
 * relatório, salva em arquivo timestampado, e retorna exit code para
 * alertas externos (cron, CI/CD, monit, etc.).
 *
 * Exit codes:
 *   0 = Tudo limpo, sem discrepâncias
 *   1 = Erro de execução (banco, permissão, etc.)
 *   2 = Discrepâncias encontradas (acima do threshold)
 *   3 = Discrepâncias + erros mistos
 *
 * Uso:
 *   node scripts/audit_scheduler.js                              # padrão: salva em ./audit_reports/
 *   node scripts/audit_scheduler.js --output-dir=./audits        # diretório personalizado
 *   node scripts/audit_scheduler.js --alert-threshold=5          # alerta só se > 5 anomalias
 *   node scripts/audit_scheduler.js --quiet                      # sem output no console (cron)
 *   node scripts/audit_scheduler.js --no-ansi                    # sem cores (log files)
 *   node scripts/audit_scheduler.js --fix --confirm              # habilita correção automática
 *   node scripts/audit_scheduler.js --help                       # ajuda
 *
 * Cron (exemplo — roda todo dia às 06:00):
 *   0 6 * * * cd /F/GITHUB/FintechBankApp/API && node scripts/audit_scheduler.js --quiet
 *
 * ⚠️ READ-ONLY por padrão. Use --fix --confirm para corrigir automaticamente.
 */

// ─── CLI Args ─────────────────────────────────────────────────────────────────
const HELP = process.argv.includes('--help') || process.argv.includes('-h');
const QUIET = process.argv.includes('--quiet');
const NO_ANSI = process.argv.includes('--no-ansi');
const ALLOW_FIX = process.argv.includes('--fix') && process.argv.includes('--confirm');
const OUTPUT_DIR = process.argv.find(a => a.startsWith('--output-dir='))?.split('=')[1] || './audit_reports';
const ALERT_THRESHOLD = parseInt(process.argv.find(a => a.startsWith('--alert-threshold='))?.split('=')[1] || '1', 10);

if (HELP) {
    console.log(`
audit_scheduler.js — Rotina de Auditoria Automática Agendável

Exit codes:
  0 = Tudo limpo, sem discrepâncias
  1 = Erro de execução (banco, permissão, etc.)
  2 = Discrepâncias encontradas (acima do threshold)
  3 = Discrepâncias + erros mistos

Flags:
  --help                 Mostra esta ajuda
  --quiet                Suprime output no console (cron-friendly)
  --no-ansi              Remove cores ANSI do output
  --output-dir=<path>    Diretório para salvar relatórios (padrão: ./audit_reports)
  --alert-threshold=<N>  Alerta só se anomalias > N (padrão: 1)
  --fix --confirm        Habilita correção automática

Exemplos:
  node scripts/audit_scheduler.js
  node scripts/audit_scheduler.js --quiet
  node scripts/audit_scheduler.js --output-dir=./audits --alert-threshold=5
  node scripts/audit_scheduler.js --fix --confirm
`);
    process.exit(0);
}

// ─── Core ─────────────────────────────────────────────────────────────────────
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const resolve = (p) => path.resolve(__dirname, '..', p);

const colors = {
    reset: NO_ANSI ? '' : '\x1b[0m',
    red: NO_ANSI ? '' : '\x1b[31m',
    green: NO_ANSI ? '' : '\x1b[32m',
    yellow: NO_ANSI ? '' : '\x1b[33m',
    cyan: NO_ANSI ? '' : '\x1b[36m',
    bold: NO_ANSI ? '' : '\x1b[1m',
};

const log = (msg) => { if (!QUIET) console.log(msg); };

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    const startTime = Date.now();
    const auditScript = resolve('scripts/audit_completo.js');

    log('');
    log(`${colors.bold}╔══════════════════════════════════════════════════════╗${colors.reset}`);
    log(`${colors.bold}║      AUDIT SCHEDULER — FintechBankApp                ║${colors.reset}`);
    log(`${colors.bold}╚══════════════════════════════════════════════════════╝${colors.reset}`);
    log(`  Data:      ${new Date().toISOString()}`);
    log(`  Threshold: ${ALERT_THRESHOLD} anomalia(s) para alerta`);
    log(`  Modo:      ${ALLOW_FIX ? 'AUDITORIA + CORREÇÃO' : 'APENAS AUDITORIA'}`);
    log('');

    // ── Montar args para audit_completo.js ──
    const auditArgs = ['--json'];
    if (ALLOW_FIX) { auditArgs.push('--fix', '--confirm'); }
    if (!QUIET) { auditArgs.push('--verbose'); }
    if (NO_ANSI) { auditArgs.push('--no-ansi'); }

    log(`${colors.cyan}▶ Executando audit_completo.js...${colors.reset}`);
    log('');

    const result = spawnSync('node', [auditScript, ...auditArgs], {
        cwd: path.dirname(auditScript),
        encoding: 'utf-8',
        timeout: 120000, // 2 min timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    const stderrOutput = (result.stderr || '').trim();
    if (stderrOutput && !QUIET) {
        log(`${colors.yellow}⚠️  stderr do audit_completo.js:${colors.reset}`);
        log(stderrOutput);
        log('');
    }

    const durationMs = Date.now() - startTime;
    let auditReport = {
        ranAt: new Date().toISOString(),
        flags: { quiet: QUIET, allowFix: ALLOW_FIX, alertThreshold: ALERT_THRESHOLD },
        summary: { anomalies: 0, fixed: 0, errors: 0, hasAlert: false, durationMs },
        audits: { doubleCount: null, negativeBalance: null },
        auditCompleto: { exitCode: result.status, signal: result.signal, stderr: stderrOutput || null }
    };

    // ── Mostrar output do audit_completo.js (a menos que --quiet) ──
    if (!QUIET && result.stdout) {
        // O audit_completo.js imprime JSON no final do stdout.
        // Remove o JSON da exibição para não poluir o terminal.
        const lines = result.stdout.split('\n');
        const jsonStartIdx = lines.findIndex(l => l.trim().startsWith('{"ranAt'));
        const displayLines = jsonStartIdx >= 0 ? lines.slice(0, jsonStartIdx) : lines;
        console.log(displayLines.join('\n'));
    }

    // ── Extrair JSON do stdout (último bloco {…} válido) ──
    let parsed = null;
    if (result.stdout) {
        try {
            // Estratégia: pegar TODOS os blocos JSON (delimitados por {…} no topo)
            // e validar cada um. O último bloco JSON válido com "ranAt" é o relatório.
            const stdout = result.stdout;
            const jsonCandidates = [];
            let braceDepth = 0;
            let jsonStart = -1;

            for (let i = 0; i < stdout.length; i++) {
                if (stdout[i] === '{') {
                    if (braceDepth === 0) jsonStart = i;
                    braceDepth++;
                } else if (stdout[i] === '}') {
                    braceDepth--;
                    if (braceDepth === 0 && jsonStart >= 0) {
                        try {
                            const candidate = stdout.slice(jsonStart, i + 1);
                            const obj = JSON.parse(candidate);
                            if (obj && typeof obj === 'object') {
                                jsonCandidates.push(obj);
                            }
                        } catch (_) { /* pseudo-JSON ignorado */ }
                        jsonStart = -1;
                    }
                }
            }

            // O último candidato JSON com ranAt e totalIssues é o relatório
            const matched = jsonCandidates
                .filter(c => c.ranAt && 'totalIssues' in c && c.summary)
                .pop();
            if (matched) parsed = matched;

            // Fallback: último candidato que for um objeto não-vazio
            if (!parsed && jsonCandidates.length > 0) {
                parsed = jsonCandidates[jsonCandidates.length - 1];
            }
        } catch (_) { /* fallback: parsed permanece null */ }
    }

    // ── Se conseguiu parsear, usar dados estruturados ──
    if (parsed) {
        const dc = parsed.doubleCount;
        const nb = parsed.negativeBalance;

        // Auditoria 1: discrepâncias ativas (exclui "resolvido")
        const dcActive = dc?.details
            ? dc.details.filter(d => d.status === 'discrepancy').length
            : (dc?.discrepancies || 0);

        // Auditoria 2: unique CPFs flagged (evita threshold inflation)
        // Ao invés de somar per-category, conta unique CPFs
        const nbUniqueCpf = new Set();
        if (nb?.categories) {
            for (const [, cat] of Object.entries(nb.categories)) {
                for (const u of cat.users) {
                    if (u.cpf) nbUniqueCpf.add(u.cpf);
                }
            }
        }

        const totalAnomalies = dcActive + nbUniqueCpf.size;
        const totalFixed = (dc?.fixed || 0) + (nb?.fixed || 0);
        const totalErrors = (dc?.errors || 0) + (nb?.errors || 0);

        auditReport.audits.doubleCount = {
            scanned: dc?.scanned || 0,
            withPayments: dc?.withPayments || 0,
            discrepancies: dcActive,
            resolved: dc?.details?.filter(d => d.status === 'resolvido').length || 0,
            fixed: dc?.fixed || 0,
            errors: dc?.errors || 0,
            details: dc?.details || []
        };

        auditReport.audits.negativeBalance = nb || null;

        auditReport.summary.anomalies = totalAnomalies;
        auditReport.summary.fixed = totalFixed;
        auditReport.summary.errors = totalErrors;
        auditReport.summary.hasAlert = totalAnomalies > ALERT_THRESHOLD;
        auditReport.summary.durationMs = durationMs;

        // ── Resumo ──
        log('');
        log(`${colors.bold}═══ RESUMO ═══${colors.reset}`);
        log(`  Anomalias:    ${totalAnomalies > 0 ? `${colors.red}${totalAnomalies}${colors.reset}` : `${colors.green}0${colors.reset}`}`);
        log(`    DC ativas:  ${dcActive}`);
        log(`    NB unique:  ${nbUniqueCpf.size}`);
        log(`  Corrigidas:   ${totalFixed > 0 ? `${colors.yellow}${totalFixed}${colors.reset}` : `0`}`);
        log(`  Erros:        ${totalErrors > 0 ? `${colors.red}${totalErrors}${colors.reset}` : `${colors.green}0${colors.reset}`}`);
        log(`  Duração:      ${durationMs}ms`);
        log(`  Alerta:       ${auditReport.summary.hasAlert ? `${colors.red}SIM (threshold: ${ALERT_THRESHOLD})${colors.reset}` : `${colors.green}NÃO${colors.reset}`}`);
        log('');

    } else {
        // Fallback: não conseguiu parsear JSON, usar exit code do processo
        log(`${colors.yellow}⚠️  Não foi possível parsear o relatório JSON do audit_completo.js${colors.reset}`);
        log(`    Exit code do processo filho: ${result.status}`);
        if (result.error) log(`    Erro: ${result.error.message}`);
        log('');

        auditReport.summary.hasAlert = (result.status !== 0);
        auditReport.summary.errors = result.status !== 0 ? 1 : 0;
    }

    // ── Salvar relatório em arquivo ──
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const reportFile = path.resolve(OUTPUT_DIR, `audit-${timestamp}.json`);
    const alertFile = path.resolve(OUTPUT_DIR, 'audit-alert.latest.json');

    try {
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }
        fs.writeFileSync(reportFile, JSON.stringify(auditReport, null, 2));

        // .alert file (overwritten each run, for external monitoring)
        fs.writeFileSync(alertFile, JSON.stringify({
            ranAt: auditReport.ranAt,
            anomalies: auditReport.summary.anomalies,
            dcActive: auditReport.audits.doubleCount?.discrepancies || 0,
            nbUniqueCpf: auditReport.audits.negativeBalance
                ? Object.values(auditReport.audits.negativeBalance.categories || {}).reduce((acc, cat) => {
                    for (const u of (cat.users || [])) if (u.cpf) acc.add(u.cpf);
                    return acc;
                }, new Set()).size
                : 0,
            fixed: auditReport.summary.fixed,
            errors: auditReport.summary.errors,
            threshold: ALERT_THRESHOLD,
            hasAlert: auditReport.summary.hasAlert,
            durationMs
        }, null, 2));

        log(`📁 Relatório: ${reportFile}`);
        log(`📁 Alerta:    ${alertFile}`);
        log('');

    } catch (fileErr) {
        log(`⚠️  Erro ao salvar relatório: ${fileErr.message}`);
        auditReport.summary.errors++;
    }

    // ── Exit code ──
    const ec = auditReport.summary;
    if (ec.errors > 0 && ec.anomalies > 0) {
        process.exit(3); // Erros + Discrepâncias
    } else if (ec.anomalies > ALERT_THRESHOLD) {
        process.exit(2); // Discrepâncias acima do threshold
    } else if (ec.errors > 0) {
        process.exit(1); // Erros de execução
    } else {
        process.exit(0); // Tudo limpo
    }
}

main().catch(err => {
    console.error('❌ Fatal:', err.message);
    process.exit(1);
});
