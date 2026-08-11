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

    const { computeCurrentCycle, calcCharges, buildInstallmentOptions } = require('../../utils/billing');

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
    const { computeInvoiceGross, planDistribution } = require('../../utils/invoiceMath');

    // ── Comprovante de pagamento em PDF (evento de pagamento → tópico da massa) ──
    // Projeto de estudo para automação: todo pagamento de fatura (total, mínimo ou
    // parcial) gera um comprovante PDF e envia ao tópico Telegram da massa.
    async function sendPaymentReceipt(cpf, user, data) {
        try {
            const { generatePaymentReceiptPDF } = require('../../services/invoicePdfService');
            const cardFinal = String((user && (user.card_number || user.cardNumber)) || '').replace(/\D/g, '').slice(-4);
            const pdfData = {
                nome: (user && user.full_name) || '',
                cpf,
                cpfFormatado: telegramService.formatCpf(cpf),
                cartaoFinal: cardFinal || '—',
                valorPago: data.valorPago,
                tipo: data.tipo, // TOTAL | MINIMO | PARCIAL
                saldoRestante: data.saldoRestante,
                dataPagamento: data.dataPagamento || new Date().toISOString(),
                formaPagamento: 'Saldo em conta',
                vencimento: data.vencimento || null,
                autenticacao: data.autenticacao || `FB-${Date.now().toString(36).toUpperCase()}`,
                nota: data.nota || '',
            };
            // Toggle payment_receipt no painel admin decide se o comprovante vai ao Telegram (gate via categoria).
            const buffer = await generatePaymentReceiptPDF(pdfData);
            await telegramService.sendDocument(cpf, buffer, `comprovante_${cpf}.pdf`, 'payment_receipt');
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
    // quitação de cada fatura é derivada de transactions.invoice_id em
    // getClosedInvoiceDebt, nunca carimbada dentro da fatura FECHADA (imutável).
    // Quando não sobra nenhuma fechada devendo, o usuário volta a adimplente.
    async function refreshAccountStatus(cpf) {
        const { esc } = repoContext;
        const debt = await getClosedInvoiceDebt(cpf);
        const stillOpen = debt ? debt.invoices.length : 0;

        if (stillOpen === 0) {
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('users')}
                SET account_status = 'adimplente', days_overdue = 0, updated_at = CURRENT_TIMESTAMP
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
    // Quanto já foi pago de cada fatura FECHADA, derivado de transactions.invoice_id.
    // Fonte da verdade para pagamentos feitos APÓS a migration 005: a fatura fechada é
    // imutável, então o pago não pode ser lido de dentro dela.
    async function fetchPaidByInvoice(cpf) {
        const { esc } = repoContext;
        const rows = await dbService.executeQuery(`
            SELECT invoice_id, COALESCE(SUM(ABS(CAST(amount AS DECIMAL(15,2)))), 0) AS pago
            FROM ${dbService.fq('transactions')}
            WHERE cpf = ${esc(cpf)} AND type = 'INVOICE_PAYMENT' AND invoice_id IS NOT NULL
            GROUP BY invoice_id
        `);
        const map = new Map();
        for (const r of rows) map.set(r.invoice_id, parseFloat(r.pago || 0));
        return map;
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

        const paidByInvoice = await fetchPaidByInvoice(cpf);
        const round2 = n => Math.round(n * 100) / 100;
        const invoices = rows.map(row => {
            // owed = valor_total - pago (NÃO inclui encargos: multa, juros, IOF).
            // Encargos são calculados separadamente em enrichUserCreditCardData para exibição
            // (closedInvoiceCharges). Incluí-los no valor devido faz o pagamento "total"
            // cobrar mais que a fatura — ex: R$ 4.284,94 em vez de R$ 3.870,86.
            //
            // HÍBRIDO: pagamentos vinculados (invoice_id) são a fonte da verdade. Faturas
            // anteriores à migration 005 não têm vínculo — para essas, o valor_pago
            // congelado no fechamento segue valendo. Ler o campo não fere a imutabilidade;
            // escrever nele, sim.
            const gross = round2(computeInvoiceGross(row));
            const pagoVinculado = paidByInvoice.get(row.id);
            const pago = pagoVinculado !== undefined
                ? pagoVinculado
                : parseFloat(row.valor_pago || 0);
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
    
        const pendingCharges = await dbService.executeQuery(`
            SELECT charge_type, amount FROM ${dbService.fq('billing_charges')}
            WHERE cpf = '${cpf}' AND invoice_reference = '${cycle.invoiceRef}' AND status = 'pending'
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
        res.json({ success: true, amount: closedDebt.owed, options: buildInstallmentOptions(closedDebt.owed) });
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
    
        const plan = await cardRepo.createInstallments({ cpf, amount: principal, installments });
    
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
        if (closedDebt) {
            totalDue = closedDebt.owed;
        } else {
            // Legado (sem registro em invoices): soma das parcelas vencidas
            const dueRows = await dbService.executeQuery(`
                SELECT amount FROM ${dbService.fq('transactions')}
                WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND date <= ${esc(cutoffIso)}
            `);
            totalDue = dueRows.reduce((acc, r) => acc + Math.abs(parseFloat(r.amount || 0)), 0);
        }
        if (totalDue <= 0) {
            return res.status(400).json({ success: false, message: 'Nenhuma fatura em aberto para pagamento.' });
        }
    
        const balance = parseFloat(user.balance || 0);
        const minPayment = Math.max(totalDue * 0.10, 10);
        const effectiveMin = balance > 0 ? Math.min(balance, minPayment) : minPayment;

        // Obter o total de encargos pendentes no banco
        const chargesRows = await dbService.executeQuery(`
            SELECT COALESCE(SUM(CAST(amount AS DECIMAL(15,2))), 0) AS total
            FROM ${dbService.fq('billing_charges')}
            WHERE cpf = '${cpf}' AND status = 'pending'
        `);
        const pendingChargesTotal = parseFloat(chargesRows[0]?.total || 0);
        const totalDueComplete = Math.round((totalDue + pendingChargesTotal) * 100) / 100;

        // NÃO capar ao total devido: pagamento acima do devido é aceito e o excedente
        // vira saldo credor (closedInvoiceResidual negativo) — bug reportado: pagar
        // 5623.68 registrava só 3870.86.
        const requestedAmount = typeof amount === 'number' && amount > 0 ? amount : totalDueComplete;
        const payAmount = requestedAmount;

        // Valor mínimo é apenas sugestão de UI — o usuário pode pagar menos, mais, ou o total.
        // Pagar abaixo do mínimo mantém saldo devedor e encargos via fluxo de pagamento parcial abaixo.
        if (balance < payAmount) return res.status(400).json({ success: false, message: 'Saldo insuficiente.' });

        const availableLimit = parseFloat(user.credit_card_available_limit || 0);
        const totalLimit = parseFloat(user.credit_card_total_limit || 0);
        const principalToPay = Math.min(payAmount, totalDue);
        const chargesToPay = Math.max(0, payAmount - principalToPay);

        if (payAmount < totalDue - 0.01) {
            // Se o valor pago é EXATAMENTE o mínimo (margem de centavos), é MÍNIMO.
            // Qualquer outro valor (abaixo do mínimo, ou entre mínimo e total) é PARCIAL.
            const isExactMin = Math.abs(payAmount - minPayment) <= 0.05 || Math.abs(payAmount - effectiveMin) <= 0.05;
            const payDescription = isExactMin
                ? 'Pagamento minimo de fatura'
                : 'Pagamento parcial de fatura';
            // Pagamento parcial: registrar sem deletar parcelas
            const nowIso = nowDb();
            const payId = dbService.generateUUID();
            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('transactions')}
                (id, cpf, type, amount, description, from_user, to_user, to_key, date, invoice_id)
                VALUES (${esc(payId)}, ${esc(cpf)}, 'INVOICE_PAYMENT', ${esc((-payAmount).toFixed(2))}, ${esc(payDescription)}, NULL, NULL, NULL, ${esc(nowIso)}, ${esc(closedDebt?.oldest?.id || null)})
            `);
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
            const daysOverdue = parseInt(user.days_overdue || 0);
            const billingCfgForRef = (await dbService.executeQuery(
                `SELECT * FROM ${dbService.fq('billing_config')} WHERE id = 1`
            ))[0] || { close_day: 20, due_day: 10, grace_period_days: 3 };
            const { invoiceRef } = computeCurrentCycle(billingCfgForRef);
            const { multa, juros } = calcCharges(remaining, daysOverdue);
            if (multa > 0 || juros > 0) {
                const chargeBase = dbService.generateUUID();
                await dbService.executeQuery(`
                    INSERT INTO ${dbService.fq('billing_charges')}
                    (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount)
                    VALUES
                    ('${chargeBase}_m', ${esc(cpf)}, ${esc(invoiceRef)}, 'multa', ${multa}, ${daysOverdue}, ${remaining.toFixed(2)}),
                    ('${chargeBase}_j', ${esc(cpf)}, ${esc(invoiceRef)}, 'juros_mora', ${juros}, ${daysOverdue}, ${remaining.toFixed(2)})
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
                    ? '<blockquote>Encargos adicionais de atraso (multa e juros) continuam incidindo sobre o saldo devedor restante.</blockquote>'
                    : '<blockquote>Multa e juros de mora estão estacionados. Juros remuneratórios continuam a incidir sobre o saldo devedor restante.</blockquote>'
            ].join('\n');
            await notificationsRepo.addNotification({
                cpf,
                title: notifTitle,
                message: notifMessage,
                // actionUrl sempre /dashboard para notificações do usuário final.
                // Admin vê as ABAIXO via GET /admin/notifications/abaixo (rota dedicada).
                actionUrl: '/dashboard'
            });
            // Comprovante PDF no tópico da massa (pagamento mínimo/parcial)
            await sendPaymentReceipt(cpf, user, {
                valorPago: payAmount,
                tipo: isExactMin ? 'MINIMO' : 'PARCIAL',
                saldoRestante: remaining,
                dataPagamento: nowIso,
                vencimento: cutoffIso,
                nota: isPaymentAbaixo
                    ? 'Pagamento abaixo do mínimo crítico. Encargos adicionais de atraso continuam incidindo sobre o saldo devedor restante.'
                    : 'Multa e juros de mora estão estacionados. Juros remuneratórios continuam a incidir sobre o saldo devedor restante.'
            });
            return res.json({ success: true, message: 'Pagamento parcial realizado.', amountPaid: payAmount, totalDue, remainingBalance: remaining, charges: { multa, juros } });
        }
    
        // Pagamento total: registrar o valor REALMENTE pago (payAmount, não o devido),
        // vinculado à fatura fechada mais recente; limpar parcelas do ciclo, restaurar limite.
        // O excedente sobre o principal vira saldo credor e abate a fatura ABERTA
        // (docs/REGRAS-NEGOCIO-FATURA.md §19.3) — não pode ser capado aqui.
        const result = await cardRepo.payDueInstallments({
            cpf,
            cutoffIso,
            amount: payAmount,
            paymentDateIso: nowDb(),
            // `oldest` (mais antiga), nao `invoice` (mais recente): a divida amortiza da
            // fatura mais velha para a mais nova, e e a mais antiga que ancora atraso e
            // encargos. O pagamento PARCIAL ja usava oldest (linha ~636) — o total usava
            // invoice, vinculando a fatura errada quando havia mais de uma em aberto.
            invoiceId: closedDebt?.oldest?.id || null
        });
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

        // Quitação registrada pelo invoice_id no payDueInstallments acima. A fatura
        // FECHADA não é tocada: a leitura em getClosedInvoiceDebt derivará o saldado
        // do SUM de payments.
        if (closedDebt) {
            await refreshAccountStatus(cpf);
        }
        await notificationsRepo.addNotification({
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
        });
        // Comprovante PDF no tópico da massa (pagamento total)
        await sendPaymentReceipt(cpf, user, {
            valorPago: payAmount,
            tipo: 'TOTAL',
            saldoRestante: 0,
            dataPagamento: nowDb(),
            vencimento: cutoffIso,
            nota: 'Limite de crédito reestabelecido e conta regularizada com sucesso.'
        });
        res.json({ success: true, message: 'Fatura paga com sucesso.' });
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
        pay,
        summary,
        history,
        open,
        anticipate,
        helpers: { getClosedInvoiceDebt, distributePaymentAmongInvoices, refreshAccountStatus, generatePaymentCodesFallback },
    };
};
