/**
 * adminScriptsController.js — Handlers das rotas ADMIN de "Scripts & Massas".
 *
 * Expõe no painel Admin ações que hoje só rodam via terminal
 * (`node scripts/algumacoisa.js --cpf=...`). Cada handler chama o script
 * correspondente via child_process.execFileSync — NUNCA exec/string de shell
 * (evita injection), sempre com o caminho do script fixo no código (nunca
 * vindo do cliente), args sanitizados antes de montar o array.
 */
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');
const cleanCpf = (cpf) => String(cpf || '').replace(/\D/g, '');

module.exports = function createAdminScriptsController(deps) {
    const { dbService, repoContext, cardEngine, auditLog, recalcularLimiteDisponivel, listUsers } = deps;

    // IMPORTANTE: execFile assíncrono, NUNCA execFileSync — vários desses
    // scripts fazem login via HTTP contra a própria API (localhost:3001).
    // Uma versão síncrona bloquearia a event loop inteira do processo Node,
    // travando a própria requisição HTTP que o script filho está esperando
    // (deadlock: a API nunca processa a chamada que o filho precisa).
    async function runNodeScript(scriptFile, args, timeoutMs = 30000) {
        const scriptPath = path.join(SCRIPTS_DIR, scriptFile);
        const { stdout } = await execFileAsync('node', [scriptPath, ...args], {
            encoding: 'utf-8',
            timeout: timeoutMs,
            cwd: path.join(__dirname, '..', '..'),
        });
        return stdout;
    }

    // POST /admin/scripts/audit-fix — body { cpf?, dryRun? }. Mesma detecção/correção
    // do audit_completo.js --fix, mas DENTRO da API (services/discrepanciasAudit.js),
    // pelo mesmo motivo do recalcular-limite: o script filho imprimia o log antes do
    // JSON (parse falhava) e, na base toda, estourava o timeout de 30s do proxy do
    // DESKTOP. dryRun=true só simula (mesma conta, sem UPDATE).
    const auditFix = async (req, res) => {
        const { runDiscrepanciasAudit } = require('../../services/discrepanciasAudit');
        const cpf = cleanCpf(req.body?.cpf);
        const dryRun = req.body?.dryRun === true;
        try {
            const data = await runDiscrepanciasAudit({
                db: dbService,
                esc: repoContext.esc,
                cpf: cpf.length === 11 ? cpf : null,
                dryRun,
                recalcularLimiteDisponivel,
            });
            if (!dryRun) auditLog(req, 'admin_script_audit_fix', 'info', { cpf: cpf || 'ALL', corrigidas: data.totalCorrecoes });
            res.json({ success: true, data, executedAt: new Date().toISOString() });
        } catch (err) {
            res.status(500).json({ success: false, message: 'Erro ao corrigir discrepâncias: ' + err.message });
        }
    };

    // POST /admin/scripts/sync-overdue-days — sync_invoice_dias_atraso.js --fix --cpf=
    const syncOverdueDays = async (req, res) => {
        const cpf = cleanCpf(req.body?.cpf);
        if (cpf.length !== 11) {
            return res.status(400).json({ success: false, message: 'CPF inválido.' });
        }
        try {
            const output = await runNodeScript('sync_invoice_dias_atraso.js', ['--fix', `--cpf=${cpf}`]);
            auditLog(req, 'admin_script_sync_overdue_days', 'info', { cpf });
            res.json({ success: true, data: { cpf, log: output }, executedAt: new Date().toISOString() });
        } catch (err) {
            res.status(500).json({ success: false, message: 'Erro ao ressincronizar dias de atraso: ' + err.message });
        }
    };

    // POST /admin/scripts/invoice-pdf-preview — render_massa_pdf_preview.cjs <cpf>
    const invoicePdfPreview = async (req, res) => {
        const cpf = cleanCpf(req.body?.cpf);
        if (cpf.length !== 11) {
            return res.status(400).json({ success: false, message: 'CPF inválido.' });
        }
        try {
            const output = await runNodeScript('render_massa_pdf_preview.cjs', [cpf], 120000);
            auditLog(req, 'admin_script_invoice_pdf_preview', 'info', { cpf });
            res.json({ success: true, data: { cpf, log: output }, executedAt: new Date().toISOString() });
        } catch (err) {
            res.status(500).json({ success: false, message: 'Erro ao gerar prévia de fatura: ' + err.message });
        }
    };

    // POST /admin/scripts/massa-report — generate_pdf_report.cjs --live --cpf=
    // Repassa o próprio token do admin (já validado por authenticateAdmin para
    // chegar até aqui) via --token= — o script só manda Authorization se
    // receber esse argumento, senão a chamada dele a /admin/overdue-masses-
    // dashboard cai em 401 e ele erra com "API não respondeu" (mensagem
    // genérica do script, não distingue sem-resposta de erro-de-auth).
    const massaReport = async (req, res) => {
        const cpf = cleanCpf(req.body?.cpf);
        if (cpf.length !== 11) {
            return res.status(400).json({ success: false, message: 'CPF inválido.' });
        }
        const adminToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        try {
            const output = await runNodeScript('generate_pdf_report.cjs', ['--live', `--cpf=${cpf}`, `--token=${adminToken}`], 120000);
            auditLog(req, 'admin_script_massa_report', 'info', { cpf });
            res.json({ success: true, data: { cpf, log: output }, executedAt: new Date().toISOString() });
        } catch (err) {
            res.status(500).json({ success: false, message: 'Erro ao gerar relatório de massa: ' + err.message });
        }
    };

    // GET /admin/scripts/pending-cards?cpf= — prévia de quem seria afetado (não altera
    // nada); cpf opcional filtra pra só 1 massa.
    const getPendingCards = async (req, res) => {
        const { esc } = repoContext;
        const cpf = cleanCpf(req.query?.cpf);
        const cpfClause = cpf.length === 11 ? `AND cpf = ${esc(cpf)}` : '';
        const rows = await dbService.executeQuery(`
            SELECT cpf, full_name, card_brand, card_tier
            FROM ${dbService.fq('users')}
            WHERE role = 'customer' AND card_is_activated = false ${cpfClause}
            ORDER BY full_name
        `);
        res.json({ success: true, users: rows });
    };

    // POST /admin/scripts/activate-pending-cards — ativa em lote reaproveitando o mesmo
    // motor do POST /cards/physical/activate (cardEngine + mesmo INSERT/UPDATE), só sem
    // exigir CVV/validade: é ação administrativa, não do próprio titular.
    const activatePendingCards = async (req, res) => {
        const { esc } = repoContext;
        const cpf = cleanCpf(req.body?.cpf);
        const cpfClause = cpf.length === 11 ? `AND cpf = ${esc(cpf)}` : '';
        const pending = await dbService.executeQuery(`
            SELECT cpf, card_brand, card_tier, card_product_type, card_cvv, card_expiry
            FROM ${dbService.fq('users')}
            WHERE role = 'customer' AND card_is_activated = false ${cpfClause}
        `);

        const activated = [];
        const failed = [];

        for (const user of pending) {
            try {
                const requestedBrand = user.card_brand ? String(user.card_brand).toLowerCase() : undefined;
                let cardRaw, cardFormatted, cardBrand, cardBin;
                let attempts = 0;
                while (attempts < 10) {
                    const gen = cardEngine.generateCardNumber(requestedBrand);
                    const [existing] = await dbService.executeQuery(
                        `SELECT id FROM fintech.cards WHERE card_number_raw = ${esc(gen.raw)}`
                    );
                    if (!existing) { cardRaw = gen.raw; cardFormatted = gen.formatted; cardBrand = gen.brand; cardBin = gen.bin; break; }
                    attempts++;
                }
                if (!cardRaw) { failed.push({ cpf: user.cpf, reason: 'Não foi possível gerar número único.' }); continue; }

                const expiryShort = user.card_expiry || '12/30';
                const [mm, yy] = String(expiryShort).split('/');
                const expiryFull = `${mm}/20${yy}`;

                await dbService.executeQuery(`
                    INSERT INTO fintech.cards (user_cpf, card_number, card_number_raw, card_type, card_brand, bin, expiry, expiry_short, cvv, pin, is_activated, card_tier, product_type)
                    VALUES (${esc(user.cpf)}, ${esc(cardFormatted)}, ${esc(cardRaw)}, 'physical', ${esc(cardBrand)}, ${esc(cardBin)}, ${esc(expiryFull)}, ${esc(expiryShort)}, ${esc(user.card_cvv || '000')}, ${esc('9898')}, true, ${esc(user.card_tier || null)}, ${esc(user.card_product_type || 'PHYSICAL')})
                `);
                await dbService.executeQuery(`
                    UPDATE ${dbService.fq('users')}
                    SET card_is_activated = true, card_delivery_status = 'unlocked', updated_at = CURRENT_TIMESTAMP
                    WHERE cpf = ${esc(user.cpf)}
                `);
                activated.push(user.cpf);
            } catch (err) {
                failed.push({ cpf: user.cpf, reason: err.message });
            }
        }

        auditLog(req, 'admin_script_activate_pending_cards', 'info', { activatedCount: activated.length, failedCount: failed.length });
        res.json({
            success: true,
            data: { activated, failed, total: pending.length },
            executedAt: new Date().toISOString(),
        });
    };

    // GET /admin/scripts/export-massas-csv?cpf= — FONTE ÚNICA em utils/tblDeMassasExport.cjs,
    // compartilhada com o script standalone scripts/export_tbl_massas.cjs (antes eram duas
    // cópias quase idênticas da query, cada uma podendo divergir a cada mudança). Devolve o
    // CSV como texto na resposta (o script original grava em caminho hardcoded fora do repo,
    // A:\Workspace\poc-fintech-playwright\..., específico de uma máquina). cpf opcional
    // filtra pra só 1 massa — ID_MASSA continua refletindo a posição real dela no conjunto
    // inteiro (calculado antes do filtro, não recomeça em ID_0001 pra um export de 1 CPF).
    const exportMassasCsv = async (req, res) => {
        const { getExportMassasData, rowsToCsv } = require('../../utils/tblDeMassasExport.cjs');
        const cpf = cleanCpf(req.query?.cpf);
        try {
            const rows = await getExportMassasData(dbService, { cpf: cpf.length === 11 ? cpf : undefined });
            const csv = rowsToCsv(rows);
            auditLog(req, 'admin_script_export_massas_csv', 'info', { cpf: cpf || 'ALL', count: rows.length });
            res.json({ success: true, data: { csv, count: rows.length }, executedAt: new Date().toISOString() });
        } catch (err) {
            res.status(500).json({ success: false, message: 'Erro ao exportar CSV de massas: ' + err.message });
        }
    };

    // POST /admin/scripts/recalcular-limite — body { cpf?, dryRun? }.
    // Corrige credit_card_available_limit com a mesma fórmula canônica do
    // "Próxima Fatura" (limite_total - currentInvoiceTotal) — pode resultar em
    // negativo de propósito quando a dívida real excede o limite total.
    // Roda DENTRO da API (não via recalcular_limite_disponivel.cjs): o script
    // imprime os logs do Postgres no stdout antes do JSON, então o parse falhava
    // e o painel recebia um blob de log; e o timeout de 60s do processo filho não
    // cobre a base inteira. dryRun=true só simula (mesma conta, sem UPDATE).
    const LIMITE_CONCORRENCIA = 5;
    const recalcularLimite = async (req, res) => {
        const cpf = cleanCpf(req.body?.cpf);
        const dryRun = req.body?.dryRun === true;
        try {
            const alvos = cpf.length === 11
                ? [cpf]
                : (await listUsers()).filter(u => u.role !== 'admin').map(u => u.cpf);

            const resultados = [];
            let proximo = 0;
            const worker = async () => {
                while (proximo < alvos.length) {
                    const alvo = alvos[proximo++];
                    try {
                        const r = await recalcularLimiteDisponivel(alvo, { persist: !dryRun });
                        if (r) resultados.push(r);
                    } catch (err) {
                        resultados.push({ cpf: alvo, erro: err.message });
                    }
                }
            };
            await Promise.all(Array.from({ length: Math.min(LIMITE_CONCORRENCIA, alvos.length) }, worker));

            const divergentes = resultados.filter(r => r.alterado);
            const erros = resultados.filter(r => r.erro);
            const data = {
                modo: dryRun ? 'SIMULACAO' : 'APLICADO',
                cpfFiltro: cpf.length === 11 ? cpf : 'TODAS',
                totalVerificado: resultados.length,
                divergentes: divergentes.length,
                estourados: divergentes.filter(r => r.estourado).length,
                erros: erros.length,
                // Só o que interessa ao painel: quem muda e quem falhou.
                detalhes: [...divergentes, ...erros],
            };
            if (!dryRun) auditLog(req, 'admin_script_recalcular_limite', 'info', { cpf: cpf || 'ALL', corrigidos: divergentes.length });
            res.json({ success: true, data, executedAt: new Date().toISOString() });
        } catch (err) {
            res.status(500).json({ success: false, message: 'Erro ao recalcular limite disponível: ' + err.message });
        }
    };

    // POST /admin/scripts/uti-recuperacao — roda uti_massa.cjs --confirm --json
    // (+ --cpf= opcional: sem ele, roda contra TODA massa em
    // tbl_cemiterio_teste com status 'precisa_massa_nova'). Força a correção
    // (apaga/regera billing_charges, consolida fatura duplicada, etc.) das
    // massas que a auditoria diária não sabe curar sozinha — ver
    // scripts/uti_massa.cjs para a lista de anomalias tratadas.
    const utiRecuperacao = async (req, res) => {
        const cpf = cleanCpf(req.body?.cpf);
        const args = ['--confirm', '--json'];
        if (cpf.length === 11) args.push(`--cpf=${cpf}`);
        try {
            const output = await runNodeScript('uti_massa.cjs', args, 60000);
            let result;
            try { result = JSON.parse(output); } catch { result = { log: output }; }
            auditLog(req, 'admin_script_uti_recuperacao', 'info', { cpf: cpf || 'ALL' });
            res.json({ success: true, data: result, executedAt: new Date().toISOString() });
        } catch (err) {
            res.status(500).json({ success: false, message: 'Erro ao rodar uti_massa.cjs: ' + err.message });
        }
    };

    return {
        auditFix,
        syncOverdueDays,
        invoicePdfPreview,
        massaReport,
        getPendingCards,
        activatePendingCards,
        exportMassasCsv,
        recalcularLimite,
        utiRecuperacao,
    };
};
