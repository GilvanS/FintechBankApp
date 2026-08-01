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
    const {
        databricksService,
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
    const { computeInvoiceGross, planDistribution } = require('../../utils/invoiceMath');

    // ── Helpers da fatura fechada (movidos verbatim do index.cjs) ────────────
    async function distributePaymentAmongInvoices(cpf, payAmount) {
        const { esc } = repoContext;
        const rows = await fetchUnpaidClosedInvoices(cpf);
        const plan = planDistribution(rows, payAmount);
    
        for (const inv of plan.invoices) {
            if (inv.appliedAmount <= 0) continue;
            await databricksService.executeQuery(`
                UPDATE ${databricksService.fq('invoices')}
                SET valor_pago = ${inv.newValorPago.toFixed(2)},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${esc(inv.id)} AND cpf = ${esc(cpf)}
            `);
        }
    
        return plan;
    }

    // Marca data_pagamento em cada fatura FECHADA cujo valor_pago já cobre o valor bruto.
    // Por invoice, não em bloco: um pagamento que quita só a fatura mais antiga não pode
    // carimbar como paga a fatura seguinte, que continua devendo.
    // Quando não sobra nenhuma fechada em aberto, o usuário volta a adimplente.
    async function markFullyPaidInvoices(cpf, paidAtIso) {
        const { esc } = repoContext;
        const rows = await fetchUnpaidClosedInvoices(cpf);
        const settled = [];
        let stillOpen = 0;
    
        for (const inv of rows) {
            // Usa valor_total (sem encargos) como target de quitação, igual ao
            // planDistribution e computeInvoicePaidInfo — encargos não são pagos,
            // são herdados pela fatura aberta.
            const target = Math.round(parseFloat(inv.valor_total || 0) * 100) / 100;
            const pago = parseFloat(inv.valor_pago || 0);
            if (pago >= target - 0.005) {
                await databricksService.executeQuery(`
                    UPDATE ${databricksService.fq('invoices')}
                    SET data_pagamento = ${esc(paidAtIso)}, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ${esc(inv.id)} AND cpf = ${esc(cpf)}
                `);
                settled.push(inv.id);
            } else {
                stillOpen++;
            }
        }
    
        if (settled.length > 0 && stillOpen === 0) {
            await databricksService.executeQuery(`
                UPDATE ${databricksService.fq('users')}
                SET account_status = 'adimplente', days_overdue = 0, updated_at = CURRENT_TIMESTAMP
                WHERE cpf = ${esc(cpf)}
            `);
        }
    
        return { settled, stillOpen };
    }

    // Quitação da fatura FECHADA (pagamento total, parcial ou refinanciamento via
    // parcelamento): distribui o valor REALMENTE pago entre as faturas em aberto — da mais
    // antiga para a mais recente — e só então marca as que ficaram quitadas.
    //
    // Antes usava Number.MAX_SAFE_INTEGER, o que zerava a dívida de todas as faturas ainda
    // que o débito cobrado tivesse sido só o da fatura mais recente.
    async function settleClosedInvoices(cpf, paidAtIso, payAmount) {
        if (!(typeof payAmount === 'number') || !(payAmount > 0)) {
            throw new Error('settleClosedInvoices: payAmount deve ser um número positivo');
        }
        const distribution = await distributePaymentAmongInvoices(cpf, payAmount);
        const marked = await markFullyPaidInvoices(cpf, paidAtIso);
        return { ...distribution, ...marked };
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
    async function getClosedInvoiceDebt(cpf) {
        const { esc } = repoContext;
        const rows = await databricksService.executeQuery(`
            SELECT id, due_date, created_at, valor_total, saldo_anterior, valor_iof,
                   valor_multa, valor_juros_remuneratorios, valor_juros_mora,
                   COALESCE(valor_pago, 0) AS valor_pago
            FROM ${databricksService.fq('invoices')}
            WHERE cpf = ${esc(cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
            ORDER BY due_date ASC
        `);
        if (!rows.length) return null;
    
        const round2 = n => Math.round(n * 100) / 100;
        const invoices = rows.map(row => {
            // owed = valor_total - valor_pago (NÃO inclui encargos: multa, juros, IOF).
            // Encargos são calculados separadamente em enrichUserCreditCardData para exibição
            // (closedInvoiceCharges). Incluí-los no valor devido faz o pagamento "total"
            // cobrar mais que a fatura — ex: R$ 4.284,94 em vez de R$ 3.870,86.
            const gross = round2(computeInvoiceGross(row));
            const residual = round2(parseFloat(row.valor_total || 0) - parseFloat(row.valor_pago || 0));
            return { ...row, gross, owed: Math.max(0, residual) };
        });
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
        const FEBRABAN_BASE = new Date(1997, 9, 7); // 07/10/1997
        const dueObj = new Date(dueDate + 'T00:00:00');
        const factor = Math.floor((dueObj - FEBRABAN_BASE) / (1000 * 60 * 60 * 24));
        const factorStr = String(factor).padStart(4, '0');
        const amountCents = Math.round(amount * 100);
        const amountStr = String(amountCents).padStart(10, '0');
        const hash = crypto.createHash('md5').update(invoiceId).digest('hex');
        const freeDigits = hash.replace(/[^0-9]/g, '').padEnd(25, '0').slice(0, 25);
    
        // Mod11
        function mod11(digits) {
            const weights = [2, 3, 4, 5, 6, 7, 8, 9];
            let total = 0;
            for (let i = digits.length - 1, w = 0; i >= 0; i--, w++) {
                total += parseInt(digits[i]) * weights[w % weights.length];
            }
            const r = total % 11;
            const dv = 11 - r;
            return (dv === 0 || dv === 10 || dv === 11) ? 1 : dv;
        }
    
        // Mod10
        function mod10(digits) {
            const weights = [2, 1];
            let total = 0;
            for (let i = digits.length - 1, w = 0; i >= 0; i--, w++) {
                const product = parseInt(digits[i]) * weights[w % 2];
                total += Math.floor(product / 10) + (product % 10);
            }
            const r = total % 10;
            return r === 0 ? 0 : 10 - r;
        }
    
        const barcodeNoDv = `598${9}${factorStr}${amountStr}${freeDigits}`;
        const dv = mod11(barcodeNoDv);
        const barcode = `5989${dv}${factorStr}${amountStr}${freeDigits}`;
    
        // Linha digitavel
        const f1raw = barcode.slice(0, 4) + barcode.slice(19, 24);
        const dv1 = mod10(f1raw);
        const f1 = `${f1raw.slice(0, 5)}.${f1raw.slice(5)}${dv1}`;
        const f2raw = barcode.slice(24, 34);
        const dv2 = mod10(f2raw);
        const f2 = `${f2raw.slice(0, 5)}.${f2raw.slice(5)}${dv2}`;
        const f3raw = barcode.slice(34, 44);
        const dv3 = mod10(f3raw);
        const f3 = `${f3raw.slice(0, 5)}.${f3raw.slice(5)}${dv3}`;
        const f4 = barcode[4];
        const f5 = barcode.slice(5, 19);
        const linhaDigitavel = `${f1} ${f2} ${f3} ${f4} ${f5}`;
    
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
                barcode, linhaDigitavel, linhaDigitavelRaw: linhaDigitavel.replace(/[. ]/g, ''),
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
        const { cpf, name, amount, dueDate, invoiceId } = req.body;
    
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
        const amount = parseFloat(invoice.valor_total || 3870.86);
        const dueDate = invoice.due_date ? String(invoice.due_date).split('T')[0] : '2026-07-15';
        
        try {
            const { execSync } = require('child_process');
            const scriptPath = paymentGeneratorScriptPath;
            const cmd = `python "${scriptPath}" --cpf "${cpf}" --name "${name}" --amount ${amount} --duedate "${dueDate}" --invoiceid "${invoiceId}" --json`;
            const output = execSync(cmd, { encoding: 'utf-8', timeout: 15000 });
            const result = JSON.parse(output);
            res.json({ success: true, data: result.boleto });
        } catch (error) {
            const fallbackResult = generatePaymentCodesFallback(cpf, name, amount, dueDate, invoiceId);
            res.json({ success: true, data: fallbackResult.boleto, fallback: true });
        }
    };
    
    const pix = async (req, res) => {
        const { cpf, invoiceId } = req.params;
        
        const user = await usersRepo.findByCpf(cpf);
        if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        
        const invoice = await invoiceRepo.findById({ cpf, invoiceId });
        if (!invoice) return res.status(404).json({ success: false, message: 'Fatura não encontrada' });
        
        const name = user.full_name;
        const amount = req.body.amount ? parseFloat(req.body.amount) : parseFloat(invoice.valor_total || 0);
        const dueDate = invoice.due_date ? String(invoice.due_date).split('T')[0] : new Date().toISOString().split('T')[0];
        
        try {
            const { execSync } = require('child_process');
            const scriptPath = paymentGeneratorScriptPath;
            const cmd = `python "${scriptPath}" --cpf "${cpf}" --name "${name}" --amount ${amount} --duedate "${dueDate}" --invoiceid "${invoiceId}" --json`;
            const output = execSync(cmd, { encoding: 'utf-8', timeout: 15000 });
            const result = JSON.parse(output);
            res.json({ success: true, data: result.pix });
        } catch (error) {
            const fallbackResult = generatePaymentCodesFallback(cpf, name, amount, dueDate, invoiceId);
            res.json({ success: true, data: fallbackResult.pix, fallback: true });
        }
    };
    
    const invoiceStatus = async (req, res) => {
        const cpf = req.user.cpf;
    
        const configRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`);
        const cfg = configRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3, is_active: true };
    
        const userRows = await databricksService.executeQuery(`
            SELECT credit_card_invoice_due_date, credit_card_available_limit, credit_card_total_limit,
                   COALESCE(account_status,'adimplente') AS account_status,
                   COALESCE(days_overdue, 0) AS days_overdue
            FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'
        `);
        if (!userRows.length) return res.status(404).json({ success: false, message: 'Conta não encontrada.' });
        const u = userRows[0];
    
        const cycle = computeCurrentCycle(cfg);
        const invoiceAmount = Math.max(0,
            parseFloat(u.credit_card_total_limit || 5000) - parseFloat(u.credit_card_available_limit || 0)
        );
    
        const pendingCharges = await databricksService.executeQuery(`
            SELECT charge_type, amount FROM ${databricksService.fq('billing_charges')}
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
            const dueRows = await databricksService.executeQuery(`
                SELECT amount FROM ${databricksService.fq('transactions')}
                WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND date <= ${esc(cutoffIso)}
            `);
            principal = dueRows.reduce((acc, r) => acc + Math.abs(parseFloat(r.amount || 0)), 0);
        }
        if (principal <= 0) {
            return res.status(400).json({ success: false, message: 'Nenhuma fatura fechada para parcelar.' });
        }
    
        // O saldo antigo é refinanciado no novo plano: remove as parcelas/valor vencido
        // que estão sendo substituídas pelas novas parcelas com encargos.
        await databricksService.executeQuery(`
            DELETE FROM ${databricksService.fq('transactions')}
            WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND date <= ${esc(cutoffIso)}
        `);
    
        // Restaura limite e avança vencimento — equivalente a uma quitação integral da fatura fechada
        const availableLimit = parseFloat(user.credit_card_available_limit || 0);
        const totalLimit = parseFloat(user.credit_card_total_limit || 0);
        const restoredLimit = Math.min(totalLimit, availableLimit + principal);
        const currentInvDue = user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : new Date();
        const nextInvDue = new Date(currentInvDue);
        nextInvDue.setMonth(currentInvDue.getMonth() + 1);
        await databricksService.executeQuery(`
            UPDATE ${databricksService.fq('users')}
            SET credit_card_available_limit = ${restoredLimit.toFixed(2)},
                credit_card_is_blocked = false,
                credit_card_invoice_due_date = '${nextInvDue.toISOString()}'
            WHERE cpf = '${cpf}'
        `);
    
        // Fatura fechada quitada via refinanciamento: sem isso, a fatura continuaria "não paga"
        // e o valor refinanciado seria cobrado de novo em /cards/invoice/pay.
        // O valor refinanciado é exatamente `principal` (= closedDebt.owed), então é ele que
        // é distribuído entre as faturas em aberto.
        if (closedDebt) {
            await settleClosedInvoices(cpf, new Date().toISOString(), principal);
        }
    
        const plan = await cardRepo.createInstallments({ cpf, amount: principal, installments });
    
        await notificationsRepo.addNotification({
            cpf,
            title: 'Fatura parcelada',
            message: `Fatura de R$ ${principal.toFixed(2)} parcelada em ${installments}x de R$ ${plan.installmentValue.toFixed(2)}.`,
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
            const dueRows = await databricksService.executeQuery(`
                SELECT amount FROM ${databricksService.fq('transactions')}
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
        const requestedAmount = typeof amount === 'number' && amount > 0 ? amount : totalDue;
        const payAmount = Math.min(requestedAmount, totalDue);
    
        // Valor mínimo é apenas sugestão de UI — o usuário pode pagar menos, mais, ou o total.
        // Pagar abaixo do mínimo mantém saldo devedor e encargos via fluxo de pagamento parcial abaixo.
        if (balance < payAmount) return res.status(400).json({ success: false, message: 'Saldo insuficiente.' });
    
        const availableLimit = parseFloat(user.credit_card_available_limit || 0);
        const totalLimit = parseFloat(user.credit_card_total_limit || 0);
    
        if (payAmount < totalDue - 0.01) {
            // Se o valor pago é EXATAMENTE o mínimo (margem de centavos), é MÍNIMO.
            // Qualquer outro valor (abaixo do mínimo, ou entre mínimo e total) é PARCIAL.
            const isExactMin = Math.abs(payAmount - minPayment) <= 0.05 || Math.abs(payAmount - effectiveMin) <= 0.05;
            const payDescription = isExactMin
                ? 'Pagamento minimo de fatura'
                : 'Pagamento parcial de fatura';
            // Pagamento parcial: registrar sem deletar parcelas
            const nowIso = new Date().toISOString();
            const payId = databricksService.generateUUID();
            await databricksService.executeQuery(`
                INSERT INTO ${databricksService.fq('transactions')}
                (id, cpf, type, amount, description, from_user, to_user, to_key, date)
                VALUES (${esc(payId)}, ${esc(cpf)}, 'INVOICE_PAYMENT', ${esc((-payAmount).toFixed(2))}, ${esc(payDescription)}, NULL, NULL, NULL, ${esc(nowIso)})
            `);
            await usersRepo.updateBalance(cpf, (balance - payAmount).toFixed(2));
            const restoredLimit = Math.min(totalLimit, availableLimit + payAmount);
            await databricksService.executeQuery(`
                UPDATE ${databricksService.fq('users')}
                SET credit_card_available_limit = ${restoredLimit.toFixed(2)}
                WHERE cpf = '${cpf}'
            `);
            // Distribui entre as faturas (mais antiga primeiro) e carimba data_pagamento nas
            // que o pagamento parcial tiver quitado — um parcial pode zerar a fatura antiga
            // mesmo sem cobrir a dívida consolidada.
            await settleClosedInvoices(cpf, nowIso, payAmount);
            const remaining = totalDue - payAmount;
            const daysOverdue = parseInt(user.days_overdue || 0);
            const billingCfgForRef = (await databricksService.executeQuery(
                `SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`
            ))[0] || { close_day: 20, due_day: 10, grace_period_days: 3 };
            const { invoiceRef } = computeCurrentCycle(billingCfgForRef);
            const { multa, juros } = calcCharges(remaining, daysOverdue);
            if (multa > 0 || juros > 0) {
                const chargeBase = databricksService.generateUUID();
                await databricksService.executeQuery(`
                    INSERT INTO ${databricksService.fq('billing_charges')}
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
            const notifMessage = isPaymentAbaixo
                ? `Apenas R$ ${payAmount.toFixed(2)} pagos (${(payAmount / totalDue * 100).toFixed(0)}% do total). Mínimo necessário: R$ ${minPayment.toFixed(2)}. Saldo residual: R$ ${remaining.toFixed(2)}. Encargos TOTAIS continuam sobre o saldo!`
                : `R$ ${payAmount.toFixed(2)} pagos (mínimo). Multa e juros de mora ESTACIONADOS! Juros remuneratórios continuam sobre o saldo devedor de R$ ${remaining.toFixed(2)}.`;
            await notificationsRepo.addNotification({
                cpf,
                title: notifTitle,
                message: notifMessage,
                // actionUrl sempre /dashboard para notificações do usuário final.
                // Admin vê as ABAIXO via GET /admin/notifications/abaixo (rota dedicada).
                actionUrl: '/dashboard'
            });
            return res.json({ success: true, message: 'Pagamento parcial realizado.', amountPaid: payAmount, totalDue, remainingBalance: remaining, charges: { multa, juros } });
        }
    
        // Pagamento total: registrar pagamento pelo valor devido da fatura, limpar parcelas
        // do ciclo fechado, restaurar limite, avançar vencimento
        const result = await cardRepo.payDueInstallments({ cpf, cutoffIso, amount: totalDue });
        await usersRepo.updateBalance(cpf, (balance - result.totalDue).toFixed(2));
        const restoredLimit = Math.min(totalLimit, availableLimit + result.totalDue);
        // NÃO avançar credit_card_invoice_due_date aqui — o motor de faturamento (invoiceEngine)
        // o faz naturalmente no fechamento do ciclo. Avançar manualmente desloca as janelas de
        // cálculo do enrichUserCreditCardData (close = due-7d, prevClose = close-1m), fazendo
        // com que transações do ciclo atual caiam FORA da janela "aberta", sumindo do extrato
        // e reduzindo currentInvoice incorretamente.
        await databricksService.executeQuery(`
            UPDATE ${databricksService.fq('users')}
            SET credit_card_available_limit = ${restoredLimit.toFixed(2)},
                credit_card_is_blocked = false
            WHERE cpf = '${cpf}'
        `);
        // Sem marcar data_pagamento a fatura seguiria "não paga" e poderia ser cobrada de novo.
        // Distribui o valor efetivamente cobrado (totalDue = dívida consolidada), nunca mais
        // que isso: quitar faturas sem ter recebido por elas é perda de receita.
        if (closedDebt) {
            await settleClosedInvoices(cpf, new Date().toISOString(), result.totalDue || totalDue);
        }
        await notificationsRepo.addNotification({
            cpf,
            title: 'Pagamento de fatura',
            message: 'Fatura paga com sucesso. Limite restaurado e novo vencimento definido.',
            actionUrl: '/dashboard'
        });
        res.json({ success: true, message: 'Fatura paga com sucesso.' });
    };
    
    const summary = async (req, res) => {
        const { type } = req.params;
        const { cpf } = req.user;
        const { esc } = repoContext;
    
        const configRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`);
        const cfg = configRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3 };
        const cycle = computeCurrentCycle(cfg);
    
        const fmtDateSafe = (d) => {
            if (!d) return '15/jul./2026';
            let dt = d;
            if (!(dt instanceof Date)) {
                const str = String(d).split('T')[0];
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
                    totalPagamentos: 0.00,
                    totalCreditos: 0.00,
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
        const configRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`);
        const cfg = configRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3 };
        const cycle = computeCurrentCycle(cfg);
        const closeDay = parseInt(cfg.close_day) || 20;
    
        // Valor da fatura aberta = soma das compras do ciclo corrente (mesma regra do
        // endpoint /summary/aberta). Não usar total_limit - available_limit: o limite
        // bloqueado inclui saldo de fatura fechada e encargos, que não pertencem à aberta.
        const _histCardTx = await databricksService.executeQuery(`
            SELECT amount, type, date FROM ${databricksService.fq('transactions')}
            WHERE cpf = ${esc(cpf)} AND type IN ('SHOP_CREDIT', 'CREDIT', 'INVOICE_INSTALLMENT')
              AND (status IS NULL OR status <> 'cancelled')
        `);
        const _histPrevCloseMs = new Date(cycle.closeDate).setMonth(cycle.closeDate.getMonth() - 1);
        const openAmount = _histCardTx.filter(tx => {
            const txDate = new Date(tx.date).getTime();
            return txDate > _histPrevCloseMs && txDate <= cycle.dueDate.getTime();
        }).reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount || 0)), 0);
    
        const closed = await databricksService.executeQuery(`
            SELECT * FROM ${databricksService.fq('invoices')}
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
            const configRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`);
            const cfg = configRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3 };
            const cycle = computeCurrentCycle(cfg);
            invoiceDueDate = cycle.dueDate;
        }
        
        let openInvoiceAmount = 0;
        if (invoiceDueDate) {
            const openTransactions = await databricksService.executeQuery(`
                SELECT amount
                FROM ${databricksService.fq('transactions')}
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
        helpers: { getClosedInvoiceDebt, distributePaymentAmongInvoices, markFullyPaidInvoices, settleClosedInvoices, generatePaymentCodesFallback },
    };
};
