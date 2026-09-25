/**
 * invoiceController.js — Handlers das rotas de fatura/pagamento.
 *
 * [PILOTO] Extraído do index.cjs (god file de 7.801 linhas) sem alterar lógica.
 * Factory com Dependency Injection: o index.cjs injeta serviços/repos/helpers
 * compartilhados; este módulo apenas os consome e devolve os handlers.
 *
 * Regra de negócio central (fonte única): a dívida da fatura FECHADA é
 * valor_total - valor_pago; encargos de atraso são HERDADOS pela fatura ABERTA.
 * Ver docs/REGRAS-NEGOCIO-FATURA.md e SKILL.md.
 */
module.exports = function createInvoiceController(deps) {
    const { nowDb } = require('../../utils/timezone');
    const { toDateOnly } = require('../../utils/dateUtils');
    const telegramService = require('../../services/telegramService');
    const {
        dbService,
        repoContext,
        usersRepo,
        invoiceRepo,
        notificationsRepo,
        cardRepo,
        normalizeUser,
        enrichUserCreditCardData,
        fetchUnpaidClosedInvoices,
        auditLog,
        paymentGeneratorScriptPath,
    } = deps;

    const { computeCurrentCycle, buildInstallmentOptions, computeNextInvoiceDueDate } = require('../../utils/billing');
    const { calcularParcelamentoFatura, TIPOS_ENTRADA } = require('../../services/installmentCalcEngine');

    // Comprovante Telegram: sem essas duas o valor sai '4070.86' e a data '2026-07-15'.
    const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dataBR = (v) => {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return String(v || '');
        return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };
    const diaBR = (v) => {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return String(v || '');
        return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    };
    const { computeInvoiceGross, planDistribution, paidPrincipalSql } = require('../../utils/invoiceMath');
    const { planOpenCyclePayment } = require('../../services/openCyclePayment');

    // ── Comprovante de pagamento em PDF (evento de pagamento → tópico da massa) ──
    // Projeto de estudo para automação: todo pagamento de fatura (total, mínimo ou
    // parcial) gera um comprovante PDF e envia ao tópico Telegram da massa.
    async function sendPaymentReceipt(cpf, user, data) {
        try {
            // Montagem do PDF em services/paymentReceipt.js (fonte única com a 2ª via da UTI).
            // Toggle payment_receipt no painel admin decide se o comprovante vai ao Telegram.
            await require('../../services/paymentReceipt').enviarComprovante(cpf, user, data);
        } catch (err) {
            console.error('[invoiceController] Erro ao gerar/enviar comprovante PDF:', err.message);
        }
    }

    // Normaliza data vinda do banco: o driver pg pode retornar due_date como
    // objeto Date (String(date) não tem 'T' → split('T')[0] devolve lixo).
    // Sempre produz 'YYYY-MM-DD' para o Python E para o fallback JS.
    // Usa componentes LOCAIS (não toISOString, que é UTC e pode deslocar o dia
    // para timestamps com hora ≠ meia-noite — ex.: 22:00 -03:00 → dia seguinte).
    function normalizeDueDate(d, fallback) {
        if (!d) return fallback;
        if (d instanceof Date && !isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        }
        const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return m[0];
        return fallback;
    }

    // ── Helpers da fatura fechada (movidos verbatim do index.cjs) ────────────
    // Simula a distribuição do pagamento entre as faturas (mais antiga primeiro) SEM
    // persistir nada: a fatura FECHADA é imutável (docs/REGRAS-NEGOCIO-FATURA.md).
    // O vínculo real do pagamento fica em transactions.invoice_id.
    async function distributePaymentAmongInvoices(cpf, payAmount) {
        const rows = await fetchUnpaidClosedInvoices(cpf);
        return planDistribution(rows, payAmount);
    }

    // Reavalia o status do usuário após um pagamento. Escreve SÓ em `users` — a
    // quitação de cada fatura é derivada da distribuição do pagamento (cascata,
    // mais antiga primeiro) em getClosedInvoiceDebt, nunca carimbada dentro da
    // fatura FECHADA (imutável). Quando não sobra nenhuma fechada devendo, o
    // usuário volta a adimplente.
    //
    // PERSISTE UMA ÚNICA transação INVOICE_PAYMENT com o valor total pago — o mesmo
    // do COMPROVANTE (o usuário pagou uma vez; o extrato mostra um lançamento). A
    // distribuição entre as faturas em aberto é DERIVADA na leitura por cascata
    // (planDistribution: mais antiga primeiro, excedente = saldo credor), não
    // persistida como N transações. Manter 1 pagamento = 1 lançamento era o
    // comportamento esperado: dividir em N fazia a web exibir "2 pagamentos" para
    // uma única quitação (feedback 805/381).
    //
    // `invoices` = closedDebt.invoices (order by due_date ASC, só faturas com dívida).
    async function persistPaymentDistribution({ cpf, invoices, payAmount, dateIso, description, appliedToCharges = 0 }) {
        const { esc } = repoContext;
        const round2 = n => Math.round(n * 100) / 100;
        const payId = dbService.generateUUID();
        const amount = round2(payAmount);
        if (amount <= 0.005) return [];
        // Vínculo na fatura MAIS RECENTE em aberto (a que ancora o comprovante).
        // A quitação das demais é derivada por cascata na leitura — o invoice_id
        // aqui é apenas a âncora do lançamento no extrato.
        // applied_to_charges: parte deste pagamento que quitou billing_charges. Sempre
        // gravado (0 quando nada) — NULL fica reservado às linhas anteriores à §25.
        const anchor = invoices[invoices.length - 1] || null;
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date, invoice_id, applied_to_charges)
            VALUES (${esc(payId)}, ${esc(cpf)}, 'INVOICE_PAYMENT', ${esc((-amount).toFixed(2))}, ${esc(description)}, NULL, NULL, NULL, ${esc(dateIso)}, ${anchor ? esc(anchor.id) : 'NULL'}, ${round2(appliedToCharges).toFixed(2)})
        `);
        return [{ invoiceId: anchor ? anchor.id : null, amount }];
    }

    async function refreshAccountStatus(cpf) {
        const { esc } = repoContext;
        const debt = await getClosedInvoiceDebt(cpf);
        const stillOpen = debt ? debt.invoices.length : 0;

        if (stillOpen === 0) {
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('users')}
                SET account_status = 'adimplente', days_overdue = 0, overdue_status = 'EM_DIA',
                    credit_card_is_blocked = false, is_blacklisted = false, updated_at = CURRENT_TIMESTAMP
                WHERE cpf = ${esc(cpf)}
            `);
        }

        return { stillOpen, owed: debt ? debt.owed : 0 };
    }

    // Dívida consolidada de TODAS as faturas FECHADAS não pagas: valores congelados no
    // fechamento (compras à vista + parcelas do ciclo + encargos consolidados nas colunas
    // valor_*), líquidos de pagamentos parciais feitos após o fechamento. Não depende de
    // linhas INVOICE_INSTALLMENT em transactions — compras à vista (SHOP_CREDIT) não geram
    // parcelas.
    //
    // Retorna todas as faturas em aberto porque a distribuição de pagamento
    // (distributePaymentAmongInvoices) percorre todas elas: cobrar só a mais recente
    // deixava saldo devedor para trás enquanto settleClosedInvoices quitava o conjunto.
    //
    // `invoice` = a mais RECENTE em aberto e ancora o cutoff das parcelas (o corte precisa
    // cobrir todos os ciclos que estão sendo pagos). `oldest` ancora atraso/encargos.
    // TOTAL pago de uma massa (soma de TODOS os INVOICE_PAYMENT). A distribuição
    // entre as faturas é feita por CASCATA na leitura (planDistribution: mais antiga
    // primeiro, excedente = saldo credor) — o pagamento é UMA transação (igual ao
    // comprovante), então o pago não pode ser derivado por invoice_id isolado.
    async function fetchPaidByInvoice(cpf) {
        const { esc } = repoContext;
        const rows = await dbService.executeQuery(`
            SELECT COALESCE(SUM(${paidPrincipalSql()}), 0) AS total
            FROM ${dbService.fq('transactions')}
            WHERE cpf = ${esc(cpf)} AND type = 'INVOICE_PAYMENT' AND invoice_id IS NOT NULL
        `);
        return parseFloat(rows[0]?.total || 0);
    }

    async function getClosedInvoiceDebt(cpf) {
        const { esc } = repoContext;
        const rows = await dbService.executeQuery(`
            SELECT id, due_date, created_at, valor_total, saldo_anterior, valor_iof,
                   valor_multa, valor_juros_remuneratorios, valor_juros_mora,
                   COALESCE(valor_pago, 0) AS valor_pago
            FROM ${dbService.fq('invoices')}
            WHERE cpf = ${esc(cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
            ORDER BY due_date ASC
        `);
        if (!rows.length) return null;

        const totalPago = await fetchPaidByInvoice(cpf);
        const round2 = n => Math.round(n * 100) / 100;
        // CASCATA: o pagamento é UMA transação com o valor total; a quitação de cada
        // fatura é derivada distribuindo o total pago da mais antiga para a mais nova
        // (planDistribution). Fatura com valor_pago legado (pré-migration 005) já entra
        // com esse pago base; as demais começam em 0 e recebem a parcela da cascata.
        const dist = planDistribution(rows, totalPago);
        const pagoPorId = new Map(dist.invoices.map(inv => [inv.id, inv.newValorPago]));
        const invoices = rows.map(row => {
            // owed = valor_total - pago (NÃO inclui encargos: multa, juros, IOF).
            // Encargos são calculados separadamente em enrichUserCreditCardData para exibição
            // (closedInvoiceCharges). Incluí-los no valor devido faz o pagamento "total"
            // cobrar mais que a fatura — ex: R$ 4.284,94 em vez de R$ 3.870,86.
            const gross = round2(computeInvoiceGross(row));
            const pago = pagoPorId.get(row.id) ?? parseFloat(row.valor_pago || 0);
            const residual = round2(parseFloat(row.valor_total || 0) - pago);
            return { ...row, gross, valor_pago_efetivo: round2(pago), owed: Math.max(0, residual) };
        // Quitada pelo caminho novo: sem data_pagamento (fatura imutável), some da lista
        // por ter owed zerado — senão seria cobrada de novo a cada pagamento.
        }).filter(inv => inv.owed > 0.005);

        if (!invoices.length) return null;
        const owed = round2(invoices.reduce((sum, inv) => sum + inv.owed, 0));

        return {
            invoice: invoices[invoices.length - 1],
            invoices,
            oldest: invoices[0],
            owed
        };
    }

    function generatePaymentCodesFallback(cpf, name, amount, dueDate, invoiceId) {
        const crypto = require('crypto');
        // FONTE ÚNICA: padrão Febraban (fator 5 dígitos, DV do código de barras na
        // posição 20, campo livre 24) — o MESMO buildBoletoData do PDF garante que a
        // linha digitável exibida gere o MESMO código de barras da página 4.
        const { buildBoletoData } = require('../../utils/boletoMath');
        const dueObj = new Date(dueDate + 'T00:00:00');
        // Nosso número derivado do CPF (últimos 10 dígitos) — MESMA regra da rota
        // send-pdf (index.cjs), para o label impresso no PDF bater com o campo
        // livre codificado no código de barras. O DV do código de barras fica na
        // POSIÇÃO 20 (módulo 11) e o fator de vencimento tem 5 dígitos.
        const nossoNumero = String(cpf).replace(/\D/g, '').slice(-10);
        const boletoData = buildBoletoData({
            banco: '598', bancoDv: 9, bancoNome: '598 - Fintech Bank App',
            agencia: '0001', conta: '00000001', carteira: '09',
            nossoNumero,
            documento: String(invoiceId).replace(/[^0-9]/g, '').slice(0, 20) || nossoNumero,
            vencimento: dueDate + 'T00:00:00',
            emissao: new Date().toISOString(),
            valor: amount,
            sacado: name, sacadoCpf: cpf,
        });
        const barcode = boletoData.codigoBarras;
        const linhaDigitavel = boletoData.linhaDigitavel;
        const linhaDigitavelRaw = boletoData.linhaDigitavelRaw;
        const factor = parseInt(boletoData.fator, 10);
    
        // PIX EMV
        function emvField(tag, value) {
            return `${tag}${String(value.length).padStart(2, '0')}${value}`;
        }
        function crc16(data) {
            let crc = 0xFFFF;
            for (let i = 0; i < data.length; i++) {
                crc ^= data.charCodeAt(i) << 8;
                for (let j = 0; j < 8; j++) {
                    if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
                    else crc = crc << 1;
                    crc &= 0xFFFF;
                }
            }
            return crc.toString(16).toUpperCase().padStart(4, '0');
        }
    
        const pixKey = 'financeiro@fintechbank.com.br';
        const txid = invoiceId.replace(/[-\s]/g, '').slice(0, 25);
        const gui = emvField('00', 'BR.GOV.BCB.PIX');
        const pixKeyField = emvField('01', pixKey);
        const merchantAccount = emvField('26', gui + pixKeyField);
        const txidField = emvField('05', txid);
        const additionalData = emvField('62', txidField);
        const payloadParts = [
            emvField('00', '01'), emvField('01', '12'), merchantAccount,
            emvField('52', '0000'), emvField('53', '986'),
            emvField('54', amount.toFixed(2)), emvField('58', 'BR'),
            emvField('59', 'Fintech Bank App'.slice(0, 25)),
            emvField('60', 'Sao Paulo'.slice(0, 15)), additionalData
        ];
        const payloadNoCrc = payloadParts.join('') + '6304';
        const crcVal = crc16(payloadNoCrc);
        const pixPayload = payloadNoCrc + crcVal;
    
        const cpfClean = cpf.replace(/\D/g, '').padStart(11, '0');
        const cpfFmt = `${cpfClean.slice(0, 3)}.${cpfClean.slice(3, 6)}.${cpfClean.slice(6, 9)}-${cpfClean.slice(9, 11)}`;
        const amountFmt = `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const dueFmt = dueObj.toLocaleDateString('pt-BR');
    
        return {
            invoice: { id: invoiceId, amount, amountFormatted: amountFmt, dueDate, dueDateFormatted: dueFmt, payerName: name, payerCpf: cpf },
            boleto: {
                barcode, linhaDigitavel, linhaDigitavelRaw: linhaDigitavelRaw,
                amount, amountFormatted: amountFmt, dueDate, dueDateFormatted: dueFmt, dueDateFactor: factor,
                beneficiary: { name: 'Fintech Bank App S.A.', cnpj: '00000000000191', bankCode: '598', bankName: '598 - Fintech Bank App' },
                payer: { name, cpf: cpfClean, cpfFormatted: cpfFmt }, invoiceId
            },
            pix: {
                payload: pixPayload, qrcodeSvg: '', amount, amountFormatted: amountFmt,
                pixKey, txid,
                beneficiary: { name: 'Fintech Bank App S.A.', cnpj: '00000000000191' },
                payer: { name, cpf: cpfClean, cpfFormatted: cpfFmt }, invoiceId
            },
            generatedAt: new Date().toISOString()
        };
    }

    // ── Handlers (movidos verbatim do index.cjs) ─────────────────────────────
    const generatePaymentCodes = async (req, res) => {
        const { cpf, name, amount, dueDate: rawDueDate, invoiceId } = req.body;
        // Normaliza também o body: o cliente pode enviar 'YYYY-MM-DDTHH:mm:ss' ou
        // até Date string — sem isso o fallback faz 'dueDate + T00:00:00' inválido
        // e o fator zera de novo.
        const dueDate = normalizeDueDate(rawDueDate, rawDueDate || null);
    
        if (!cpf || !name || !amount || !dueDate || !invoiceId) {
            return res.status(400).json({
                success: false,
                message: 'Campos obrigatórios: cpf, name, amount, dueDate, invoiceId'
            });
        }
    
        try {
            const { execSync } = require('child_process');
            const scriptPath = paymentGeneratorScriptPath;
            const cmd = `python "${scriptPath}" --cpf "${cpf}" --name "${name}" --amount ${amount} --duedate "${dueDate}" --invoiceid "${invoiceId}" --json`;
            const output = execSync(cmd, { encoding: 'utf-8', timeout: 15000 });
            const result = JSON.parse(output);
    
            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Erro ao gerar códigos de pagamento:', error.message);
            // Fallback: gerar inline sem Python (para ambientes sem Python instalado)
            const fallbackResult = generatePaymentCodesFallback(cpf, name, amount, dueDate, invoiceId);
            res.json({ success: true, data: fallbackResult, fallback: true });
        }
    };
    
    const boleto = async (req, res) => {
        const { cpf, invoiceId } = req.params;
        
        const user = await usersRepo.findByCpf(cpf);
        if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        
        const invoice = await invoiceRepo.findById({ cpf, invoiceId });
        if (!invoice) return res.status(404).json({ success: false, message: 'Fatura não encontrada' });
        
        const name = user.full_name;
        const amount = parseFloat(invoice.valor_total);
        // Sem fallback numerico aqui: gerar boleto com um valor inventado e a fatura
        // real vier vazia significa cobrar o cliente por um valor errado. Erro explicito
        // e melhor que um boleto silenciosamente incorreto.
        if (!invoice.valor_total || Number.isNaN(amount) || amount <= 0) {
            return res.status(422).json({ success: false, message: 'Fatura sem valor_total válido — não é possível gerar boleto.' });
        }
        const dueDate = normalizeDueDate(invoice.due_date, null);
        if (!dueDate) {
            return res.status(422).json({ success: false, message: 'Fatura sem due_date válido — não é possível gerar boleto.' });
        }

        let boletoData;
        let usedFallback = false;
        try {
            const { execSync } = require('child_process');
            const scriptPath = paymentGeneratorScriptPath;
            const cmd = `python "${scriptPath}" --cpf "${cpf}" --name "${name}" --amount ${amount} --duedate "${dueDate}" --invoiceid "${invoiceId}" --json`;
            const output = execSync(cmd, { encoding: 'utf-8', timeout: 15000 });
            const result = JSON.parse(output);
            boletoData = result.boleto;
        } catch (error) {
            usedFallback = true;
            console.error('[boleto] Gerador Python indisponível, usando fallback JS:', error.message);
            const fallbackResult = generatePaymentCodesFallback(cpf, name, amount, dueDate, invoiceId);
            boletoData = fallbackResult.boleto;
        }

        // Postar no telegram da massa
        if (boletoData) {
            telegramService.send('boleto_request', { cpf, text: `📄 <b>Boleto gerado para pagamento</b>\n\n<b>Valor:</b> R$ ${amount.toFixed(2)}\n<b>Vencimento:</b> ${dueDate}\n<b>Linha Digitável:</b>\n<code>${boletoData.linhaDigitavel}</code>` }).catch(() => {});
        }

        res.json({ success: true, data: boletoData, fallback: usedFallback });
    };
    
    const pix = async (req, res) => {
        const { cpf, invoiceId } = req.params;
        
        const user = await usersRepo.findByCpf(cpf);
        if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        
        const invoice = await invoiceRepo.findById({ cpf, invoiceId });
        if (!invoice) return res.status(404).json({ success: false, message: 'Fatura não encontrada' });
        
        const name = user.full_name;
        const amount = req.body.amount ? parseFloat(req.body.amount) : parseFloat(invoice.valor_total || 0);
        const dueDate = normalizeDueDate(invoice.due_date, toDateOnly(new Date()));
        
        let pixData;
        let usedFallback = false;
        try {
            const { execSync } = require('child_process');
            const scriptPath = paymentGeneratorScriptPath;
            const cmd = `python "${scriptPath}" --cpf "${cpf}" --name "${name}" --amount ${amount} --duedate "${dueDate}" --invoiceid "${invoiceId}" --json`;
            const output = execSync(cmd, { encoding: 'utf-8', timeout: 15000 });
            const result = JSON.parse(output);
            pixData = result.pix;
        } catch (error) {
            usedFallback = true;
            console.error('[pix] Gerador Python indisponível, usando fallback JS:', error.message);
            const fallbackResult = generatePaymentCodesFallback(cpf, name, amount, dueDate, invoiceId);
            pixData = fallbackResult.pix;
        }

        // Postar no telegram da massa
        if (pixData) {
            telegramService.send('qrcode_request', { cpf, text: `🔑 <b>PIX Copia e Cola gerado</b>\n\n<b>Valor:</b> R$ ${amount.toFixed(2)}\n<b>Código PIX:</b>\n<code>${pixData.payload}</code>` }).catch(() => {});
        }

        res.json({ success: true, data: pixData, fallback: usedFallback });
    };
    
    const invoiceStatus = async (req, res) => {
        const cpf = req.user.cpf;
    
        const configRows = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('billing_config')} WHERE id = 1`);
        const cfg = configRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3, is_active: true };
    
        const userRows = await dbService.executeQuery(`
            SELECT credit_card_invoice_due_date, credit_card_available_limit, credit_card_total_limit,
                   COALESCE(account_status,'adimplente') AS account_status,
                   COALESCE(days_overdue, 0) AS days_overdue
            FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'
        `);
        if (!userRows.length) return res.status(404).json({ success: false, message: 'Conta não encontrada.' });
        const u = userRows[0];
    
        const cycle = computeCurrentCycle(cfg);
        const invoiceAmount = Math.max(0,
            parseFloat(u.credit_card_total_limit || 5000) - parseFloat(u.credit_card_available_limit || 0)
        );
    
        // Mesma regra do pagamento (pay soma TODAS as billing_charges pending do CPF,
        // sem filtro de ref — ver totalDueComplete no fluxo de quitação): a ref era o
        // ciclo corrente (instável, gira a cada execução) e o quote de encargos aparecia
        // MENOR que o débito real, divergindo do pay e do enrich (closedInvoiceCharges).
        const pendingCharges = await dbService.executeQuery(`
            SELECT charge_type, amount FROM ${dbService.fq('billing_charges')}
            WHERE cpf = '${cpf}' AND status = 'pending'
        `);
        const pendingTotal = pendingCharges.reduce((s, c) => s + parseFloat(c.amount), 0);
    
        res.json({
            success: true,
            invoice: {
                ref: cycle.invoiceRef,
                status: cycle.cycleStatus,           // aberta | fechada | vencida | inadimplente
                accountStatus: u.account_status,
                daysOverdue: u.days_overdue,
                closeDate: cycle.closeDate,
                dueDate: u.credit_card_invoice_due_date || cycle.dueDate,
                invoiceAmount: Math.round(invoiceAmount * 100) / 100,
                pendingCharges: Math.round(pendingTotal * 100) / 100,
                charges: pendingCharges,
                isActive: cfg.is_active
            }
        });
    };
    
    const installmentOptions = async (req, res) => {
        const { cpf } = req.user;
        const closedDebt = await getClosedInvoiceDebt(cpf);
        if (!closedDebt || closedDebt.owed <= 0) {
            return res.status(400).json({ success: false, message: 'Nenhuma fatura fechada para parcelar.' });
        }
        const user = await usersRepo.findByCpf(cpf);
        const diaVencimento = (user && user.credit_card_due_day) || 10;
        const dataLimitePagamento = new Date(closedDebt.invoice.due_date);
        const vencimentoProximoCorte = computeNextInvoiceDueDate(diaVencimento, dataLimitePagamento);
        const saldoAbertoAnterior = parseFloat(closedDebt.invoice.saldo_anterior || 0);

        // Preview com o mesmo motor (7,95% a.m., datas reais) que /cards/invoice/parcel vai
        // cobrar de fato — antes usava Price simplificado (~15,39% a.m.) e divergia do cobrado.
        const options = [];
        for (let n = 2; n <= 12; n++) {
            const result = calcularParcelamentoFatura({
                valorFatura: closedDebt.owed,
                saldoAbertoAnterior,
                taxaMensal: 0.0795,
                prazo: n,
                tipoEntrada: TIPOS_ENTRADA.SEM_ENTRADA,
                dataLimitePagamento,
                vencimentoProximoCorte,
                diaVencimento,
            });
            options.push({
                installments: n,
                installmentValue: result.valorParcela,
                totalAmount: result.totalAPagar,
                iof: result.iofTotal,
                juros: result.totalJuros,
                monthlyRate: 0.0795,
            });
        }
        res.json({ success: true, amount: closedDebt.owed, options });
    };
    
    const parcel = async (req, res) => {
        const { cpf, installments, pin } = req.body || {};
        if (!cpf || cpf.length !== 11 || !Number.isInteger(installments) || installments < 2 || installments > 12 || !pin || pin.length !== 4) {
            return res.status(400).json({ success: false, message: 'Payload invalido.' });
        }
        if (req.user.cpf !== cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });
    
        const user = await usersRepo.findByCpf(cpf);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    
        const { esc } = repoContext;
    
        // Mesma base de /cards/invoice/pay e /cards/invoice/installment-options: valor devido
        // da fatura FECHADA não paga (não a soma de INVOICE_INSTALLMENT, que é vazia quando a
        // fatura vem de compras à vista no crédito).
        const closedDebt = await getClosedInvoiceDebt(cpf);
    
        let cutoff = closedDebt
            ? new Date(closedDebt.invoice.due_date)
            : (user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : new Date());
        if (isNaN(cutoff.getTime())) cutoff = new Date();
        cutoff.setUTCHours(23, 59, 59, 999);
        const cutoffIso = cutoff.toISOString();
    
        let principal;
        if (closedDebt) {
            principal = closedDebt.owed;
        } else {
            // Legado (sem registro em invoices): soma das parcelas vencidas
            const dueRows = await dbService.executeQuery(`
                SELECT amount FROM ${dbService.fq('transactions')}
                WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND date <= ${esc(cutoffIso)}
            `);
            principal = dueRows.reduce((acc, r) => acc + Math.abs(parseFloat(r.amount || 0)), 0);
        }
        if (principal <= 0) {
            return res.status(400).json({ success: false, message: 'Nenhuma fatura fechada para parcelar.' });
        }

        // Motor real de PF (7,95% a.m., datas reais) só quando há fatura fechada de
        // verdade pra ancorar as datas/saldo herdado; o caminho legado (sem registro em
        // invoices) mantém o Price simplificado por não ter essa base.
        const diaVencimento = user.credit_card_due_day || 10;
        const pfParams = closedDebt ? {
            saldoAbertoAnterior: parseFloat(closedDebt.invoice.saldo_anterior || 0),
            dataLimitePagamento: cutoff,
            vencimentoProximoCorte: computeNextInvoiceDueDate(diaVencimento, cutoff),
            diaVencimento,
        } : null;

        // O saldo antigo é refinanciado no novo plano: remove as parcelas/valor vencido
        // que estão sendo substituídas pelas novas parcelas com encargos.
        await dbService.executeQuery(`
            DELETE FROM ${dbService.fq('transactions')}
            WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND date <= ${esc(cutoffIso)}
        `);
    
        // Restaura limite e avança vencimento — equivalente a uma quitação integral da fatura fechada
        const availableLimit = parseFloat(user.credit_card_available_limit || 0);
        const totalLimit = parseFloat(user.credit_card_total_limit || 0);
        const restoredLimit = Math.min(totalLimit, availableLimit + principal);
        const currentInvDue = user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : new Date();
        const nextInvDue = new Date(currentInvDue);
        nextInvDue.setMonth(currentInvDue.getMonth() + 1);
        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')}
            SET credit_card_available_limit = ${restoredLimit.toFixed(2)},
                credit_card_is_blocked = false,
                credit_card_invoice_due_date = '${nextInvDue.toISOString()}'
            WHERE cpf = '${cpf}'
        `);
    
        // Fatura fechada quitada via refinanciamento: a quitação é derivada de
        // transactions.invoice_id (próxima fatura registra o pagamento com o vínculo).
        // Sem escrever em invoices, basta reavaliar o status do usuário.
        if (closedDebt) {
            await refreshAccountStatus(cpf);
        }
    
        const plan = await cardRepo.createInstallments({ cpf, amount: principal, installments, pf: pfParams });

        // tbl_pf: registro do contrato de Parcelamento de Fatura (histórico/auditoria —
        // hoje nada persiste os valores calculados, só as parcelas soltas em transactions).
        // Só grava quando passou pelo motor real (pfParams truthy); o caminho legado (sem
        // fatura fechada de verdade) fica de fora por não ter base de dados confiável.
        if (pfParams) {
            try {
                await dbService.executeQuery(`
                    CREATE TABLE IF NOT EXISTS ${dbService.fq('tbl_pf')} (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        cpf VARCHAR(11) NOT NULL,
                        invoice_id VARCHAR(255),
                        plan_id VARCHAR(255),
                        valor_fatura NUMERIC(12,2) NOT NULL,
                        saldo_aberto_anterior NUMERIC(12,2) NOT NULL DEFAULT 0,
                        taxa_mensal NUMERIC(6,4) NOT NULL,
                        prazo INTEGER NOT NULL,
                        tipo_entrada VARCHAR(50) NOT NULL,
                        nova_entrada NUMERIC(12,2) NOT NULL DEFAULT 0,
                        valor_parcela NUMERIC(12,2) NOT NULL,
                        saldo_financiado NUMERIC(12,2) NOT NULL,
                        iof_total NUMERIC(12,2) NOT NULL,
                        iof_adicional NUMERIC(12,2) NOT NULL,
                        cet_anual NUMERIC(10,6) NOT NULL,
                        data_contratacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                await dbService.executeQuery(`
                    INSERT INTO ${dbService.fq('tbl_pf')}
                        (cpf, invoice_id, plan_id, valor_fatura, saldo_aberto_anterior, taxa_mensal, prazo,
                         tipo_entrada, nova_entrada, valor_parcela, saldo_financiado, iof_total, iof_adicional, cet_anual)
                    VALUES (
                        ${esc(cpf)}, ${esc(closedDebt ? closedDebt.invoice.id : null)}, ${esc(plan.planId)},
                        ${principal}, ${pfParams.saldoAbertoAnterior}, 0.0795, ${installments},
                        ${esc(TIPOS_ENTRADA.SEM_ENTRADA)}, 0,
                        ${plan.installmentValue}, ${plan.saldoFinanciado}, ${plan.iof}, ${plan.iofAdicional}, ${plan.cetAnual}
                    )
                `);
            } catch (tblPfErr) {
                console.warn(`[Parcel] Falha ao registrar ${cpf} em tbl_pf:`, tblPfErr.message);
            }
        }

        await notificationsRepo.addNotification({
            cpf,
            title: 'Fatura parcelada',
            message: [
                '💵 <b>COMPROVANTE DE PARCELAMENTO DE FATURA</b>',
                '',
                `<b>Cliente</b>    ${user.full_name}`,
                `<b>CPF</b>        <code>${telegramService.formatCpf(cpf)}</code>`,
                '',
                `<b>Financiado</b> <code>R$ ${brl(principal)}</code>`,
                `<b>Parcelas</b>   ${installments}x de <code>R$ ${brl(plan.installmentValue)}</code>`,
                `<b>Total</b>      <code>R$ ${brl(plan.totalAmount)}</code>`,
                `<b>1ª parcela</b> ${plan.firstDueDate ? diaBR(plan.firstDueDate) : 'Próxima fatura'}`,
                `<b>Contratado</b> ${dataBR(nowDb())}`,
                '',
                '<b>Status</b>     CONTRATADO ✅'
            ].join('\n'),
            actionUrl: '/dashboard'
        });
    
        res.json({
            success: true,
            message: 'Parcelamento realizado com sucesso.',
            receipt: {
                amount: principal,
                installments,
                installmentValue: plan.installmentValue,
                totalAmount: plan.totalAmount,
                iof: plan.iof,
                juros: plan.juros,
                firstDueDate: plan.firstDueDate,
                transactionId: plan.planId
            }
        });
    };
    
    // Renegociação (velvet-skipping-dream.md): saída pra quem está bloqueado (8-90d) ou
    // na lista negra (90+). Reaproveita a mesma infra de `parcel` (cardRepo.createInstallments),
    // mas parcela a dívida TOTAL — fechada + ciclo aberto (consumo de limite) + encargos
    // pendentes — não só a fatura fechada. Ao contratar, tira o usuário do estado ruim por
    // completo: zera is_blacklisted, credit_card_is_blocked, days_overdue, account_status.
    const renegotiate = async (req, res) => {
        const { cpf, installments, pin } = req.body || {};
        if (!cpf || cpf.length !== 11 || !Number.isInteger(installments) || installments < 2 || installments > 12 || !pin || pin.length !== 4) {
            return res.status(400).json({ success: false, message: 'Payload invalido.' });
        }
        if (req.user.cpf !== cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });

        const user = await usersRepo.findByCpf(cpf);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

        const { esc } = repoContext;
        const round2 = n => Math.round(n * 100) / 100;

        // Consumo total do limite = fechada não paga + ciclo aberto ainda não faturado
        // (o mesmo cálculo de invoiceAmount em invoiceStatus). Encargos pendentes somam à parte.
        const totalLimit = parseFloat(user.credit_card_total_limit || 0);
        const availableLimit = parseFloat(user.credit_card_available_limit || 0);
        const consumedLimit = Math.max(0, round2(totalLimit - availableLimit));

        const chargesRows = await dbService.executeQuery(`
            SELECT COALESCE(SUM(CAST(amount AS DECIMAL(15,2))), 0) AS total
            FROM ${dbService.fq('billing_charges')}
            WHERE cpf = ${esc(cpf)} AND status = 'pending'
        `);
        const pendingChargesTotal = round2(parseFloat(chargesRows[0]?.total || 0));

        const totalDebt = round2(consumedLimit + pendingChargesTotal);
        if (totalDebt <= 0) {
            return res.status(400).json({ success: false, message: 'Nenhuma dívida para renegociar.' });
        }

        const nowIso = nowDb();
        const cutoff = new Date();
        cutoff.setUTCHours(23, 59, 59, 999);
        const cutoffIso = cutoff.toISOString();

        // Consolida: remove parcelas legadas (substituídas pelo novo plano) e quita os
        // encargos pendentes — a dívida inteira migra pro plano novo.
        await dbService.executeQuery(`
            DELETE FROM ${dbService.fq('transactions')}
            WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND date <= ${esc(cutoffIso)}
        `);
        if (pendingChargesTotal > 0) {
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('billing_charges')}
                SET status = 'paid'
                WHERE cpf = ${esc(cpf)} AND status = 'pending'
            `);
        }

        const currentInvDue = user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : new Date();
        const nextInvDue = new Date(currentInvDue);
        nextInvDue.setMonth(currentInvDue.getMonth() + 1);

        // Limite volta ao total (a dívida inteira, fechada + aberta, foi refinanciada) e o
        // usuário sai do estado ruim por completo — mesmo shape do pagamento total.
        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')}
            SET credit_card_available_limit = ${totalLimit.toFixed(2)},
                credit_card_is_blocked = false,
                is_blacklisted = false,
                account_status = 'adimplente',
                days_overdue = 0,
                overdue_status = 'EM_DIA',
                credit_card_invoice_due_date = '${nextInvDue.toISOString()}',
                updated_at = CURRENT_TIMESTAMP
            WHERE cpf = ${esc(cpf)}
        `);

        const plan = await cardRepo.createInstallments({ cpf, amount: totalDebt, installments });

        await notificationsRepo.addNotification({
            cpf,
            title: 'Dívida renegociada',
            message: [
                '💵 <b>COMPROVANTE DE RENEGOCIAÇÃO DE DÍVIDA</b>',
                '',
                `<b>Cliente</b>    ${user.full_name}`,
                `<b>CPF</b>        <code>${telegramService.formatCpf(cpf)}</code>`,
                '',
                `<b>Financiado</b> <code>R$ ${brl(totalDebt)}</code>`,
                `<b>Parcelas</b>   ${installments}x de <code>R$ ${brl(plan.installmentValue)}</code>`,
                `<b>Total</b>      <code>R$ ${brl(plan.totalAmount)}</code>`,
                `<b>1ª parcela</b> ${plan.firstDueDate ? diaBR(plan.firstDueDate) : 'Próxima fatura'}`,
                `<b>Contratado</b> ${dataBR(nowIso)}`,
                '',
                '<b>Status</b>     CONTA REGULARIZADA ✅'
            ].join('\n'),
            actionUrl: '/dashboard'
        });

        res.json({
            success: true,
            message: 'Dívida renegociada com sucesso. Conta regularizada.',
            receipt: {
                amount: totalDebt,
                installments,
                installmentValue: plan.installmentValue,
                totalAmount: plan.totalAmount,
                iof: plan.iof,
                juros: plan.juros,
                firstDueDate: plan.firstDueDate,
                transactionId: plan.planId
            }
        });
    };

    // Pós-resposta do pagamento TOTAL (fechada ou aberta): notificação, comprovante e
    // SSE. Fire-and-forget com .catch() — a resposta já foi enviada.
    function notifyTotalPayment({ cpf, user, payAmount, cutoffIso }) {
        notificationsRepo.addNotification({
            cpf,
            title: 'Pagamento de fatura',
            message: [
                '💵 <b>COMPROVANTE DE PAGAMENTO INTEGRAL</b>',
                '',
                `<b>Cliente</b>    ${user.full_name}`,
                `<b>CPF</b>        <code>${telegramService.formatCpf(cpf)}</code>`,
                '',
                `<b>Valor pago</b> <code>R$ ${brl(payAmount)}</code>`,
                `<b>Vencimento</b> ${diaBR(cutoffIso)}`,
                `<b>Pago em</b>    ${dataBR(nowDb())}`,
                '',
                '<b>Status</b>     QUITADO ✅',
                '',
                '<blockquote>Limite de crédito reestabelecido e conta regularizada com sucesso.</blockquote>'
            ].join('\n'),
            actionUrl: '/dashboard'
        }).catch((erro) => console.error('[pay] notificação total falhou (ignorado):', erro && erro.message));
        Promise.resolve(sendPaymentReceipt(cpf, user, {
            valorPago: payAmount,
            tipo: 'TOTAL',
            saldoRestante: 0,
            dataPagamento: nowDb(),
            vencimento: cutoffIso,
            nota: 'Limite de crédito reestabelecido e conta regularizada com sucesso.'
        })).catch((erro) => console.error('[pay] comprovante total falhou (ignorado):', erro && erro.message));
        try {
            const sse = require('../../services/sseService');
            sse.sendToClient(cpf, 'payment.completed', {
                cpf,
                amount: payAmount,
                type: 'full',
                timestamp: new Date().toISOString(),
            });
        } catch (_sseErr) { /* SSE é fire-and-forget */ }
    }

    // Pagamento da fatura ABERTA (§25): quita os encargos pendentes se cobrir todos; o
    // resto é ANTECIPAÇÃO — fica sem invoice_id até o invoiceEngine vinculá-lo à fatura
    // que fecha. NÃO apaga INVOICE_INSTALLMENT nem avança plano: a fatura fecha com as
    // compras/parcelas do ciclo e a antecipação vinculada as quita pela cascata.
    async function payOpenCycle({ cpf, user, payAmount, pendingChargesTotal, cutoffIso, res }) {
        const { esc } = repoContext;
        const plan = planOpenCyclePayment({ payAmount, pendingChargesTotal });
        await persistPaymentDistribution({
            cpf,
            invoices: [],
            payAmount,
            dateIso: nowDb(),
            description: 'Pagamento fatura',
            appliedToCharges: plan.appliedToCharges
        });
        await usersRepo.updateBalance(cpf, (parseFloat(user.balance || 0) - payAmount).toFixed(2));
        if (plan.markChargesPaid) {
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('billing_charges')}
                SET status = 'paid'
                WHERE cpf = ${esc(cpf)} AND status = 'pending'
            `);
        }
        const totalLimit = parseFloat(user.credit_card_total_limit || 0);
        const availableLimit = parseFloat(user.credit_card_available_limit || 0);
        const restoredLimit = Math.min(totalLimit, availableLimit + plan.anticipation);
        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')}
            SET credit_card_available_limit = ${restoredLimit.toFixed(2)}
            WHERE cpf = ${esc(cpf)}
        `);
        res.json({ success: true, message: 'Fatura paga com sucesso.', anticipation: plan.anticipation, appliedToCharges: plan.appliedToCharges });
        notifyTotalPayment({ cpf, user, payAmount, cutoffIso });
    }

    const pay = async (req, res) => {
        const { cpf, pin, amount } = req.body || {};
        if (!cpf || cpf.length !== 11 || !pin || pin.length !== 4) {
            return res.status(400).json({ success: false, message: 'Payload invalido.' });
        }
        if (req.user.cpf !== cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });
    
        const user = await usersRepo.findByCpf(cpf);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    
        const { esc } = repoContext;
    
        // Valor devido = fatura FECHADA e ainda não paga (tabela invoices), não a soma de
        // linhas INVOICE_INSTALLMENT: compras à vista no crédito (SHOP_CREDIT) não geram
        // parcelas, então a soma seria 0 mesmo com a fatura devendo. O corte continua
        // ancorado no vencimento da fatura FECHADA (não no credit_card_invoice_due_date do
        // usuário, que rola para ciclos futuros a cada fechamento) para não varrer e apagar
        // parcelas de ciclos ainda não faturados.
        const closedDebt = await getClosedInvoiceDebt(cpf);
    
        let cutoff = closedDebt
            ? new Date(closedDebt.invoice.due_date)
            : (user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : new Date());
        if (isNaN(cutoff.getTime())) cutoff = new Date();
        cutoff.setUTCHours(23, 59, 59, 999);
        const cutoffIso = cutoff.toISOString();
    
        let totalDue;
        let openCycleDue = null;
        if (closedDebt) {
            totalDue = closedDebt.owed;
        } else {
            // Sem fatura FECHADA com dívida: o cliente está pagando a fatura ABERTA (§25).
            // O devido é o MESMO total da tela (enrich: compras do ciclo + parcelas
            // projetadas + encargos herdados − antecipações já feitas). A soma antiga de
            // INVOICE_INSTALLMENT lançadas ignorava compras à vista e parcelas projetadas,
            // e o que o cliente pagava a mais sumia (805/777/2025, 2026-09).
            const _openUser = normalizeUser(user);
            await enrichUserCreditCardData(_openUser, cpf);
            openCycleDue = Math.round(parseFloat(_openUser.creditCard?.currentInvoiceTotal || 0) * 100) / 100;
            totalDue = openCycleDue;
        }
        if (totalDue <= 0) {
            return res.status(400).json({ success: false, message: 'Nenhuma fatura em aberto para pagamento.' });
        }

        const balance = parseFloat(user.balance || 0);
        const minPayment = Math.max(totalDue * 0.10, 10);

        // Obter o total de encargos pendentes no banco
        const chargesRows = await dbService.executeQuery(`
            SELECT COALESCE(SUM(CAST(amount AS DECIMAL(15,2))), 0) AS total
            FROM ${dbService.fq('billing_charges')}
            WHERE cpf = '${cpf}' AND status = 'pending'
        `);
        const pendingChargesTotal = parseFloat(chargesRows[0]?.total || 0);
        // Fatura aberta: currentInvoiceTotal já inclui os encargos herdados.
        const totalDueComplete = closedDebt
            ? Math.round((totalDue + pendingChargesTotal) * 100) / 100
            : openCycleDue;

        // NÃO capar ao total devido: pagamento acima do devido é aceito e o excedente
        // vira saldo credor (closedInvoiceResidual negativo) — bug reportado: pagar
        // 5623.68 registrava só 3870.86.
        const requestedAmount = typeof amount === 'number' && amount > 0 ? amount : totalDueComplete;
        const payAmount = requestedAmount;

        // ── Guarda de idempotência ────────────────────────────────────────────
        // Quando a resposta se perde no caminho (API reiniciando, proxy do Vite
        // devolvendo erro, conexão caindo), o usuário vê o modal de PIN ainda
        // aberto com uma mensagem de falha e clica Confirmar de novo — mas o
        // débito do primeiro envio JÁ foi persistido. Sem esta guarda, cobra 2×
        // (caso real observado: limite subiu +1000 = 2 × 500).
        // Chave natural cpf+valor+janela curta: não exige coluna nova nem que o
        // front mande idempotency key. Trade-off assumido: dois pagamentos
        // legítimos de valor idêntico em menos de 90s são tratados como reenvio —
        // para pagamento de fatura, esse é o lado seguro do erro.
        // A janela de tempo é comparada em JS, NÃO em SQL: a coluna `date` é
        // `timestamp without time zone` e a comparação com now()/ISO faz o Postgres
        // converter fuso implicitamente, descartando linhas válidas (o mesmo erro
        // derrubou uma query de diagnóstico nesta investigação).
        const IDEMPOTENCY_WINDOW_MS = 90000;
        const candidatosIdem = await dbService.executeQuery(`
            SELECT id, date FROM ${dbService.fq('transactions')}
            WHERE cpf = ${esc(cpf)}
              AND type = 'INVOICE_PAYMENT'
              AND ABS(CAST(amount AS DECIMAL(15,2)) + ${payAmount.toFixed(2)}) < 0.02
            ORDER BY date DESC LIMIT 1
        `);
        const pagamentoRecenteIgual = candidatosIdem.filter(r => {
            const quando = new Date(r.date).getTime();
            return Number.isFinite(quando) && (Date.now() - quando) < IDEMPOTENCY_WINDOW_MS;
        });
        if (pagamentoRecenteIgual.length > 0) {
            console.warn(`[pay][idempotencia] CPF ${cpf}: pagamento de R$ ${payAmount.toFixed(2)} já registrado há instantes (tx ${pagamentoRecenteIgual[0].id}) — reenvio ignorado, NÃO cobrando de novo.`);
            const freshRowIdem = await usersRepo.findByCpf(cpf);
            const freshUserIdem = normalizeUser(freshRowIdem);
            await enrichUserCreditCardData(freshUserIdem, cpf);
            return res.json({
                success: true,
                idempotent: true,
                message: 'Pagamento já processado.',
                amountPaid: payAmount,
                user: freshUserIdem,
            });
        }

        // Valor mínimo é apenas sugestão de UI — o usuário pode pagar menos, mais, ou o total.
        // Pagar abaixo do mínimo mantém saldo devedor e encargos via fluxo de pagamento parcial abaixo.
        if (balance < payAmount) return res.status(400).json({ success: false, message: 'Saldo insuficiente.' });

        if (!closedDebt) {
            return payOpenCycle({ cpf, user, payAmount, pendingChargesTotal, cutoffIso, res });
        }

        const availableLimit = parseFloat(user.credit_card_available_limit || 0);
        const totalLimit = parseFloat(user.credit_card_total_limit || 0);
        const principalToPay = Math.min(payAmount, totalDue);
        const chargesToPay = Math.max(0, payAmount - principalToPay);

        if (payAmount < totalDue - 0.01) {
            // Classificação do pagamento (regra de negócio do ciclo de vida da fatura):
            //  - MÍNIMO  = >= 10% do devido (do mínimo até < total): o contador de dias de
            //    atraso ZERA e a conta volta a "em dia" (adimplente, dias 0 e assim fica),
            //    MAS os encargos CONTINUAM acumulando sobre o saldo residual até o total.
            //  - PARCIAL = abaixo do mínimo (< 10%): segue inadimplente, os dias de atraso
            //    continuam contando e os encargos continuam acumulando.
            //  - TOTAL   = >= devido (vai para o branch abaixo): PARA os encargos e os dias.
            const isMinimo = payAmount >= minPayment - 0.05;
            const payDescription = isMinimo
                ? 'Pagamento minimo de fatura'
                : 'Pagamento parcial de fatura';
            // Pagamento parcial: registrar SEM deletar parcelas. Persiste UMA transação
            // com o valor pago (igual ao comprovante); a quitação de cada fatura é
            // DERIVADA por cascata na leitura (getClosedInvoiceDebt → planDistribution),
            // nunca escrita na FECHADA (imutável).
            const nowIso = nowDb();
            await persistPaymentDistribution({
                cpf,
                invoices: closedDebt?.invoices || [],
                payAmount,
                dateIso: nowIso,
                description: payDescription
            });
            await usersRepo.updateBalance(cpf, (balance - payAmount).toFixed(2));
            const restoredLimit = Math.min(totalLimit, availableLimit + payAmount);
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('users')}
                SET credit_card_available_limit = ${restoredLimit.toFixed(2)}
                WHERE cpf = '${cpf}'
            `);
            // A quitação é derivada de transactions.invoice_id (getClosedInvoiceDebt):
            // a fatura FECHADA não recebe escrita. Só o status do usuário é reavaliado.
            await refreshAccountStatus(cpf);
            const remaining = totalDue - payAmount;
            // — MÍNIMO (>= 10%): regulariza a conta (dias = 0, adimplente) mantendo os
            // encargos acumulando. O motor diário (runBillingValidation) reconhece a
            // fatura com pagamento >= 10% do total e continua os incrementos de
            // juros/IOF sobre o residual SEM re-marcar inadimplente. PARCIAL (< 10%):
            // nada é alterado aqui — segue inadimplente e os dias continuam contando.
            // A multa 2% NÃO é re-inserida aqui (cobrança única por débito; o motor
            // diário segue os juros/IOF sobre o novo residual).
            if (isMinimo) {
                await dbService.executeQuery(`
                    UPDATE ${dbService.fq('users')}
                    SET account_status = 'adimplente', days_overdue = 0, overdue_status = 'EM_DIA', updated_at = CURRENT_TIMESTAMP
                    WHERE cpf = '${cpf}'
                `);
            }
            // ── Notificação específica para ABAIXO do mínimo crítico ──
            // Se pagou MENOS de 10% do total, é ABAIXO (crítico — alerta no admin).
            // Se pagou entre 10% e < 100%, é mínimo (multa/juros mora estacionados).
            const isPaymentAbaixo = payAmount < minPayment;
            const notifTitle = isPaymentAbaixo
                ? '⚠️ Pagamento abaixo do mínimo crítico'
                : 'Pagamento mínimo de fatura ✅';
            const notifMessage = [
                isPaymentAbaixo
                    ? '💵 <b>COMPROVANTE DE PAGAMENTO PARCIAL (ABAIXO DO MÍNIMO)</b>'
                    : '💵 <b>COMPROVANTE DE PAGAMENTO PARCIAL (MÍNIMO)</b>',
                '',
                `<b>Cliente</b>    ${user.full_name}`,
                `<b>CPF</b>        <code>${telegramService.formatCpf(cpf)}</code>`,
                '',
                `<b>Valor pago</b> <code>R$ ${brl(payAmount)}</code>`,
                `<b>Saldo</b>      <code>R$ ${brl(remaining)}</code>`,
                `<b>Vencimento</b> ${diaBR(cutoffIso)}`,
                `<b>Pago em</b>    ${dataBR(nowIso)}`,
                '',
                isPaymentAbaixo
                    ? '<b>Status</b>     ABAIXO DO MÍNIMO CRÍTICO ⚠️'
                    : '<b>Status</b>     MÍNIMO PAGO ✅',
                '',
                isPaymentAbaixo
                    ? '<blockquote>Pagamento abaixo do mínimo: segue inadimplente, os dias de atraso continuam contando e os encargos continuam incidindo sobre o saldo devedor restante.</blockquote>'
                    : '<blockquote>Pagamento mínimo registrado: dias de atraso zerados, mas os encargos continuam acumulando sobre o saldo residual até o pagamento total.</blockquote>'
            ].join('\n');
            // Responde JÁ — o pagamento (persistPaymentDistribution/updateBalance/limite/
            // status acima) está gravado e é tudo que o cliente precisa saber. O que falta
            // abaixo (notificação, comprovante, SSE) não bloqueia mais a resposta: nenhum
            // dos 4 call-sites do front (WEB: Dashboard/CardDashboard/InvoicesAllureView/
            // InvoicesView; MOBILE: mesmos 4) depende de `user` vir aqui — todos já refazem
            // getUserByCpf() após sucesso, com fallback pro `user` desta resposta só se
            // esse refetch falhar. Isso tira o enrichUserCreditCardData (825 linhas,
            // múltiplas queries) do caminho síncrono: era o gargalo real por trás do
            // ECONNRESET pós-PIN com pagamento já efetivado — o proxy do Vite corta a
            // conexão em 30s e o enrich, sob carga de dados de teste acumulados, passava
            // disso (2026-09-22).
            res.json({ success: true, message: 'Pagamento parcial realizado.', amountPaid: payAmount, totalDue, remainingBalance: remaining });

            // .catch() obrigatório em cada uma: uma rejeição aqui viraria unhandledRejection
            // e (sem handler) derrubaria o processo — mas agora a resposta já foi enviada,
            // então o pior caso é só perder a notificação/comprovante, não mais ECONNRESET.
            notificationsRepo.addNotification({
                cpf,
                title: notifTitle,
                message: notifMessage,
                // actionUrl sempre /dashboard para notificações do usuário final.
                // Admin vê as ABAIXO via GET /admin/notifications/abaixo (rota dedicada).
                actionUrl: '/dashboard'
            }).catch((erro) => console.error('[pay] notificação parcial falhou (ignorado):', erro && erro.message));
            // Comprovante PDF no tópico da massa (pagamento mínimo/parcial) — processo
            // interno (Telegram/PDF); sendPaymentReceipt já engole os próprios erros
            // (try/catch interno), nunca rejeita.
            Promise.resolve(sendPaymentReceipt(cpf, user, {
                valorPago: payAmount,
                tipo: isMinimo ? 'MINIMO' : 'PARCIAL',
                saldoRestante: remaining,
                dataPagamento: nowIso,
                vencimento: cutoffIso,
                nota: isPaymentAbaixo
                    ? 'Pagamento abaixo do mínimo. Segue inadimplente, dias de atraso continuam contando e encargos continuam incidindo sobre o saldo devedor restante.'
                    : 'Pagamento mínimo registrado. Dias de atraso zerados, mas os encargos continuam acumulando sobre o saldo residual até o pagamento total.'
            })).catch((erro) => console.error('[pay] comprovante parcial falhou (ignorado):', erro && erro.message));
            // SSE: notificar frontend em tempo real (best-effort)
            try {
                const sse = require('../../services/sseService');
                sse.sendToClient(cpf, 'payment.completed', {
                    cpf,
                    amount: payAmount,
                    totalDue,
                    remainingBalance: remaining,
                    type: 'partial',
                    timestamp: new Date().toISOString(),
                });
            } catch (_sseErr) { /* SSE é fire-and-forget */ }
            return;
        }
    
        // Pagamento total: registrar o valor REALMENTE pago (payAmount, não o devido),
        // vinculado à fatura fechada mais recente; limpar parcelas do ciclo, restaurar limite.
        // O excedente sobre o principal vira saldo credor e abate a fatura ABERTA
        // (docs/REGRAS-NEGOCIO-FATURA.md §19.3) — não pode ser capado aqui.
        // PERSISTE UMA ÚNICA transação com o valor TOTAL pago (igual ao comprovante: o
        // usuário pagou uma vez, o extrato mostra UM lançamento). A distribuição entre as
        // faturas em aberto é DERIVADA na leitura por cascata (planDistribution, da mais
        // antiga para a mais nova) em getClosedInvoiceDebt — não persistida como N txs.
        // Antes o valor inteiro ia num único vínculo para `oldest`, deixando a 2ª fatura
        // sem pagamento quando havia mais de uma em aberto (bug 805.357.576-54 e
        // 381.600.813-59). O excedente sobre a soma vira saldo credor na última fatura (§19.3).
        const pagouEncargos = payAmount >= totalDueComplete - 0.01;
        await persistPaymentDistribution({
            cpf,
            invoices: closedDebt?.invoices || [],
            payAmount,
            dateIso: nowDb(),
            description: 'Pagamento fatura',
            // Encargos pagos junto do principal: sem isto a cascata contava esses
            // reais como principal e sobrava saldo credor fantasma (§25).
            appliedToCharges: pagouEncargos ? pendingChargesTotal : 0
        });
        // Limpa as parcelas legadas do ciclo (mesma ação do antigo payDueInstallments)
        await dbService.executeQuery(`
            DELETE FROM ${dbService.fq('transactions')}
            WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND date <= ${esc(cutoffIso)}
        `);
        await usersRepo.updateBalance(cpf, (balance - payAmount).toFixed(2));
        const restoredLimit = Math.min(totalLimit, availableLimit + principalToPay);
        // NÃO avançar credit_card_invoice_due_date aqui — o motor de faturamento (invoiceEngine)
        // o faz naturalmente no fechamento do ciclo. Avançar manualmente desloca as janelas de
        // cálculo do enrichUserCreditCardData (close = due-7d, prevClose = close-1m), fazendo
        // com que transações do ciclo atual caiam FORA da janela "aberta", sumindo do extrato
        // e reduzindo currentInvoice incorretamente.
        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')}
            SET credit_card_available_limit = ${restoredLimit.toFixed(2)},
                credit_card_is_blocked = false
            WHERE cpf = '${cpf}'
        `);

        // Quitação registrada pelos invoice_id na distribuição acima. A fatura
        // FECHADA não é tocada: a leitura em getClosedInvoiceDebt derivará o saldado
        // do SUM de payments.
        if (closedDebt) {
            await refreshAccountStatus(cpf);
        }
        // — PAGAMENTO TOTAL: PARA os encargos e os dias de atraso.
        // Só marca as billing_charges pending como 'paid' se o valor pago COBRIU os
        // encargos (payAmount >= totalDueComplete = principal + encargos). Caso
        // contrário (pagou o principal, mas não os encargos — ex.: 118.796.467-06
        // pagou R$ 1.651,69 e ficaram R$ 66,79 de 3 dias de atraso), as charges
        // permanecem 'pending' e são HERDADAS pela fatura aberta (regra do ciclo de
        // vida): marcá-las como pagas sem tê-las recebido "perdoava" dívida real e
        // zerava a herança que a fatura aberta deve exibir.
        // As colunas congeladas das faturas fechadas (análise mensal) permanecem
        // intactas (imutáveis pela trigger da migration 005).
        if (pagouEncargos) {
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('billing_charges')}
                SET status = 'paid'
                WHERE cpf = '${cpf}' AND status = 'pending'
            `);
        } else {
            // Encargos herdados: permanecem pending e migram para a fatura ABERTA
            // (enrichUserCreditCardData -> closedInvoiceCharges -> currentInvoiceTotal).
            console.log(`[pay] ${cpf} pagou R$ ${payAmount.toFixed(2)} (principal), deixando R$ ${(totalDueComplete - payAmount).toFixed(2)} de encargos pending para a fatura aberta.`);
        }
        // Responde JÁ — mesmo raciocínio do branch parcial acima (ver comentário lá):
        // enrichUserCreditCardData sai do caminho síncrono, front sempre refaz
        // getUserByCpf() após sucesso, nenhum call-site depende de `user` aqui.
        res.json({ success: true, message: 'Fatura paga com sucesso.' });

        notifyTotalPayment({ cpf, user, payAmount, cutoffIso });
    };
    
    const summary = async (req, res) => {
        const { type } = req.params;
        const { cpf } = req.user;
        const { esc } = repoContext;
    
        const configRows = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('billing_config')} WHERE id = 1`);
        const cfg = configRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3 };
        const cycle = computeCurrentCycle(cfg);
    
        const fmtDateSafe = (d) => {
            if (!d) return '15/jul./2026';
            let dt = d;
            if (!(dt instanceof Date)) {
                const str = toDateOnly(d);
                const parts = str.split('-');
                if (parts.length === 3) {
                    dt = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
                } else {
                    dt = new Date(d);
                }
            }
            if (isNaN(dt.getTime())) return '15/jul./2026';
            const day = String(dt.getUTCDate()).padStart(2, '0');
            const months = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
            return `${day}/${months[dt.getUTCMonth()]}/${dt.getUTCFullYear()}`;
        };
    
        if (type === 'fechada') {
            // FONTE ÚNICA: mesmo bloco canônico de enrichUserCreditCardData que alimenta
            // o painel admin e a tela de fatura. Resumo do cliente e admin devem mostrar
            // EXATAMENTE os mesmos números — qualquer divergência aqui é bug.
            const userRowFull = await usersRepo.findByCpf(cpf);
            if (!userRowFull) {
                return res.json({ success: true, summary: null });
            }
            const tempUser = normalizeUser(userRowFull);
            await enrichUserCreditCardData(tempUser, cpf);
            const canon = tempUser.creditCard || {};
    
            const isPaid = !!canon.closedInvoiceIsPaid;
            // Regra da fatura FECHADA no resumo do cliente WEB:
            //   - Valor total e mínimo: SEMPRE mostra (igual admin) — usa o valor ORIGINAL
            //     da fatura fechada (_closedInvoiceValorTotal), mesmo após pagamento.
            //   - Encargos (multa, juros, IOF): ZERADOS no resumo do cliente.
            //     São HERDADOS pela fatura ABERTA (já inclusos em currentInvoiceTotal).
            //     Admin mantém como memória informativa para auditoria.
            const closedVal = canon._closedInvoiceValorTotal ?? canon.closedInvoiceAmount ?? canon.closedInvoice ?? 0;
            const multa = 0;
            const jurosRem = 0;
            const jurosMora = 0;
            const iof = 0;
    
            // Postgres provider pode retornar TIMESTAMP como Date object ou string ISO.
            // Ambos os formatos precisam funcionar — converter pra Date primeiro.
            const _closedRaw = canon.closedInvoiceDueDate || canon.invoiceDueDate || '2026-07-15';
            const _closedDate = _closedRaw instanceof Date ? _closedRaw : new Date(String(_closedRaw));
            const year = _closedDate.getUTCFullYear();
            const month = _closedDate.getUTCMonth();
            const day = _closedDate.getUTCDate();
    
            const closedDueDateObj = new Date(Date.UTC(year, month, day));
            const closedCloseDateObj = new Date(closedDueDateObj);
            closedCloseDateObj.setUTCDate(closedCloseDateObj.getUTCDate() - 7);
    
            return res.json({
                success: true,
                summary: {
                    saldoAnterior: 0.00,
                    jurosRemuneratorios: jurosRem,
                    iof,
                    jurosMora,
                    multa,
                    totalDespesas: closedVal,
                    totalPagamentos: isPaid ? closedVal : 0,
                    totalCreditos: 0.00,
                    saldoFinal: closedVal,
                    pagamentoMinimo: Math.round(Math.max(closedVal * 0.10, 10.00) * 100) / 100,
                    dataVencimento: fmtDateSafe(closedDueDateObj),
                    melhorDataCompra: fmtDateSafe(closedCloseDateObj),
                    daysOverdue: canon.daysOverdue || 0
                }
            });
        } else {
            // Fatura ABERTA: TUDO vem do bloco canônico de enrichUserCreditCardData.
            // Este endpoint recalculava por conta própria (saldo anterior sem descontar
            // valor_pago, daysOverdue com piso chumbado de 9, encargos de billing_charges) e
            // por isso divergia do painel admin e da tela de fatura. Sem recálculo local aqui:
            // se o bloco canônico tiver um buraco, ele aparece igual nas três telas.
            const userRowFull = await usersRepo.findByCpf(cpf);
            if (!userRowFull) {
                return res.json({ success: true, summary: null });
            }
            console.log('[DEBUG /credit/invoices/summary/aberta] userRowFull:', JSON.stringify(userRowFull, null, 2));
            const tempUser = normalizeUser(userRowFull);
            await enrichUserCreditCardData(tempUser, cpf);
            console.log('[DEBUG /credit/invoices/summary/aberta] enrichUserCreditCardData result:', JSON.stringify(tempUser.creditCard, null, 2));
            const canon = tempUser.creditCard || {};
    
            const openPurchases = canon.currentInvoice || 0;
            // saldoAnterior = VALOR ORIGINAL da fatura fechada (nunca muda)
            const saldoAnterior = canon.closedInvoice || 0;
            // closedInvoiceResidual = saldo ainda devido após pagamento parcial
            const closedInvoiceResidual = canon.closedInvoiceResidual ?? 0;
            const charges = canon.closedInvoiceCharges || { multa: 0, jurosMora: 0, jurosRemuneratorios: 0, iof: 0, totalEncargos: 0 };
            const iof = charges.iof;
            const multa = charges.multa;
            const jurosRem = charges.jurosRemuneratorios;
            const jurosMora = charges.jurosMora;
            const daysOverdue = canon.daysOverdue || 0;
            const totalEncargos = charges.totalEncargos;
            const saldoFinal = canon.currentInvoiceTotal;
            const pagamentoMinimo = canon.currentInvoiceMinimo;
    
            // Resumo da fatura ABERTA usa o MESMO vencimento que o admin painel mostra:
            // credit_card_invoice_due_date direto. Postgres pode retornar TIMESTAMP como
            // Date ou string ISO — normalizar para Date antes de extrair componentes.
            const _openRaw = userRowFull?.credit_card_invoice_due_date || '2026-07-15';
            const _openDate = _openRaw instanceof Date ? _openRaw : new Date(String(_openRaw));
            const year = _openDate.getUTCFullYear();
            const month = _openDate.getUTCMonth();
            const day = _openDate.getUTCDate();
    
            const openDueDateObj = new Date(Date.UTC(year, month, day));
            const openCloseDateObj = new Date(openDueDateObj);
            openCloseDateObj.setUTCDate(openCloseDateObj.getUTCDate() - 7);
    
            return res.json({
                success: true,
                summary: {
                    saldoAnterior,
                    closedInvoiceResidual,
                    jurosRemuneratorios: jurosRem,
                    iof,
                    jurosMora,
                    multa,
                    daysOverdue,
                    totalDespesas: openPurchases,
                    totalPagamentos: canon.paymentsTotal || 0.00,
                    totalCreditos: canon.creditoExcedente || 0.00,
                    saldoFinal,
                    pagamentoMinimo,
                    dataVencimento: fmtDateSafe(openDueDateObj),
                    melhorDataCompra: fmtDateSafe(openCloseDateObj)
                }
            });
        }
    };
    
    const history = async (req, res) => {
        const { cpf } = req.user;
        const { esc } = repoContext;
        const configRows = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('billing_config')} WHERE id = 1`);
        const cfg = configRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3 };
        const cycle = computeCurrentCycle(cfg);
        const closeDay = parseInt(cfg.close_day) || 20;
    
        // Valor da fatura aberta = soma das compras do ciclo corrente (mesma regra do
        // endpoint /summary/aberta). Não usar total_limit - available_limit: o limite
        // bloqueado inclui saldo de fatura fechada e encargos, que não pertencem à aberta.
        const _histCardTx = await dbService.executeQuery(`
            SELECT amount, type, date FROM ${dbService.fq('transactions')}
            WHERE cpf = ${esc(cpf)} AND type IN ('SHOP_CREDIT', 'CREDIT', 'INVOICE_INSTALLMENT')
              AND (status IS NULL OR status <> 'cancelled')
        `);
        const _histPrevCloseMs = new Date(cycle.closeDate).setMonth(cycle.closeDate.getMonth() - 1);
        const openAmount = _histCardTx.filter(tx => {
            const txDate = new Date(tx.date).getTime();
            return txDate > _histPrevCloseMs && txDate <= cycle.dueDate.getTime();
        }).reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount || 0)), 0);
    
        const closed = await dbService.executeQuery(`
            SELECT * FROM ${dbService.fq('invoices')}
            WHERE cpf = ${esc(cpf)} AND status = 'FECHADA'
            ORDER BY due_date DESC
        `);
    
        const history = [];
    
        // Fatura aberta (ciclo corrente) — usando close_day da billing_config
        history.push({
            month: cycle.dueDate.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', ''),
            amount: openAmount,
            status: 'Fatura aberta',
            period: `${new Date(new Date(cycle.closeDate).setMonth(cycle.closeDate.getMonth() - 1)).toLocaleDateString('pt-BR')} a ${cycle.closeDate.toLocaleDateString('pt-BR')}`
        });
    
        for (const inv of closed) {
            const iof = parseFloat(inv.valor_iof || 0);
            const multa = parseFloat(inv.valor_multa || 0);
            const jurosRem = parseFloat(inv.valor_juros_remuneratorios || 0);
            const jurosMora = parseFloat(inv.valor_juros_mora || 0);
            const saldoAnterior = parseFloat(inv.saldo_anterior || 0);
            const purchases = parseFloat(inv.valor_total || 0);
            const total = purchases + iof + multa + jurosRem + jurosMora + saldoAnterior;
    
            const due = new Date(inv.due_date);
            // Data de corte usa o close_day configurado, não uma heurística de dueDate - 7 dias
            const closeDate = new Date(due);
            closeDate.setMonth(closeDate.getMonth() - 1);
            closeDate.setDate(closeDay);
            const prevCloseDate = new Date(closeDate);
            prevCloseDate.setMonth(prevCloseDate.getMonth() - 1);
    
            history.push({
                month: due.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', ''),
                amount: total,
                status: inv.data_pagamento ? `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Esta fatura',
                period: `${prevCloseDate.toLocaleDateString('pt-BR')} a ${closeDate.toLocaleDateString('pt-BR')}`
            });
        }
    
        res.json({ success: true, history });
    };
    
    const open = async (req, res) => {
        const cpf = req.user.cpf;
        const user = await usersRepo.findByCpf(cpf);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    
        // Calcular fatura aberta
        let invoiceDueDate = user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : null;
        
        if (!invoiceDueDate) {
            const configRows = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('billing_config')} WHERE id = 1`);
            const cfg = configRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3 };
            const cycle = computeCurrentCycle(cfg);
            invoiceDueDate = cycle.dueDate;
        }
        
        let openInvoiceAmount = 0;
        if (invoiceDueDate) {
            const openTransactions = await dbService.executeQuery(`
                SELECT amount
                FROM ${dbService.fq('transactions')}
                WHERE cpf = '${cpf}'
                  AND type IN ('SHOP_CREDIT', 'CREDIT', 'INVOICE_INSTALLMENT')
                  AND date <= '${invoiceDueDate.toISOString()}'
                  AND (status IS NULL OR status <> 'cancelled')
            `);
            openInvoiceAmount = openTransactions.reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount || 0)), 0);
        }
    
        const availableLimit = parseFloat(user.credit_card_available_limit || 0);
        const totalLimit = parseFloat(user.credit_card_total_limit || 0);
        const usedLimit = totalLimit - availableLimit;
    
        res.json({
            success: true,
            invoice: {
                amount: openInvoiceAmount,
                dueDate: invoiceDueDate ? invoiceDueDate.toISOString() : null,
                availableLimit,
                totalLimit,
                usedLimit
            }
        });
    };
    
    const anticipate = async (req, res) => {
        const { cpf, transactionIds, pin } = req.body || {};
        if (!cpf || cpf.length !== 11 || !Array.isArray(transactionIds) || !transactionIds.length || !pin || pin.length !== 4) {
            return res.status(400).json({ success: false, message: 'Payload invalido.' });
        }
        if (req.user.cpf !== cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });

        // Busca o usuário ANTES de qualquer efeito colateral: o handler abaixo usa
        // user.full_name na notificação, e sem esta busca a rota lançava
        // ReferenceError depois de já ter antecipado as parcelas no banco —
        // a operação era gravada mas o cliente recebia erro.
        const user = await usersRepo.findByCpf(cpf);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

        await cardRepo.anticipateInstallments({ cpf, transactionIds });
        auditLog(req, 'card_anticipate', 'info', { count: transactionIds.length });
        await notificationsRepo.addNotification({
            cpf,
            title: 'Antecipação de parcelas',
            message: [
                '💵 <b>COMPROVANTE DE ANTECIPAÇÃO DE PARCELAS</b>',
                '',
                `<b>Cliente</b>    ${user.full_name}`,
                `<b>CPF</b>        <code>${telegramService.formatCpf(cpf)}</code>`,
                '',
                `<b>Parcelas</b>   ${transactionIds.length} antecipada(s)`,
                `<b>Processado</b> ${dataBR(nowDb())}`,
                '',
                '<b>Status</b>     PROCESSADO ✅',
                '',
                '<blockquote>O abatimento e recálculo do limite serão consolidados na fatura corrente.</blockquote>'
            ].join('\n'),
            actionUrl: '/dashboard'
        });
        res.json({ success: true, message: 'Parcelas antecipadas com sucesso' });
    };

    return {
        generatePaymentCodes,
        boleto,
        pix,
        invoiceStatus,
        installmentOptions,
        parcel,
        renegotiate,
        pay,
        summary,
        history,
        open,
        anticipate,
        helpers: { getClosedInvoiceDebt, distributePaymentAmongInvoices, refreshAccountStatus, generatePaymentCodesFallback },
    };
};
