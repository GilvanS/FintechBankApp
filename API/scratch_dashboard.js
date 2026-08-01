require('dotenv').config();
const DatabaseFactory = require('./services/database/DatabaseFactory');

async function run() {
    const db = DatabaseFactory.createDatabaseService();
    try {
        await db.connect();
        const overdueInvoices = await db.executeQuery(`SELECT * FROM fintech.invoices WHERE status = 'FECHADA' AND data_pagamento IS NULL`);
        console.log("All Overdue Invoices:", JSON.stringify(overdueInvoices, null, 2));



        const combinedList = [];

        (allUsersResult || []).forEach(u => {
            const closedDebt = (overdueInvoices || []).find(inv => inv.cpf === u.cpf);
            const existing = combinedList.find(m => m.cpf === u.cpf);
            
            if (existing) {
                existing.full_name = u.full_name || existing.full_name;
                if (u.days_overdue !== undefined && u.days_overdue !== null) {
                    existing.days_overdue = u.days_overdue;
                }
                if (closedDebt) {
                    existing.closed_invoice_amount = parseFloat(closedDebt.valor_total || existing.closed_invoice_amount);
                    existing.due_date = closedDebt.due_date ? String(closedDebt.due_date).split('T')[0] : existing.due_date;
                    existing.db_fees = {
                        multa: parseFloat(closedDebt.valor_multa || 0),
                        jurosMora: parseFloat(closedDebt.valor_juros_mora || 0),
                        jurosRem: parseFloat(closedDebt.valor_juros_remuneratorios || 0),
                        iof: parseFloat(closedDebt.valor_iof || 0),
                        saldoAnterior: parseFloat(closedDebt.saldo_anterior || 0)
                    };
                }
            } else if (closedDebt) {
                combinedList.push({
                    cpf: u.cpf,
                    full_name: u.full_name || 'Usuário DB',
                    account_status: 'inadimplente',
                    closed_invoice_amount: parseFloat(closedDebt.valor_total || 0),
                    days_overdue: u.days_overdue || 9,
                    due_date: closedDebt.due_date ? String(closedDebt.due_date).split('T')[0] : '2026-07-15',
                    db_fees: {
                        multa: parseFloat(closedDebt.valor_multa || 0),
                        jurosMora: parseFloat(closedDebt.valor_juros_mora || 0),
                        jurosRem: parseFloat(closedDebt.valor_juros_remuneratorios || 0),
                        iof: parseFloat(closedDebt.valor_iof || 0),
                        saldoAnterior: parseFloat(closedDebt.saldo_anterior || 0)
                    }
                });
            }
        });

        const overdueList = combinedList.map(u => {
            const closedVal = u.closed_invoice_amount || 0;
            const daysOverdue = u.days_overdue || 9;
            const dueDate = u.due_date || '2026-07-15';

            let multa, jurosMora, jurosRem, iof, saldoAnterior;

            if (u.db_fees && (u.db_fees.multa || u.db_fees.jurosMora || u.db_fees.jurosRem || u.db_fees.iof || u.db_fees.saldoAnterior)) {
                multa = u.db_fees.multa;
                jurosMora = u.db_fees.jurosMora;
                jurosRem = u.db_fees.jurosRem;
                iof = u.db_fees.iof;
                saldoAnterior = u.db_fees.saldoAnterior;
            } else {
                multa = Math.round(closedVal * 0.02 * 100) / 100;
                jurosMora = Math.round(closedVal * 0.000333 * daysOverdue * 100) / 100;
                jurosRem = Math.round(closedVal * 0.00513 * daysOverdue * 100) / 100;
                const iofFixo = Math.round(closedVal * 0.0038 * 100) / 100;
                const iofDiario = Math.round(closedVal * 0.000082 * daysOverdue * 100) / 100;
                iof = Math.round((iofFixo + iofDiario) * 100) / 100;
                saldoAnterior = 0;
            }

            const totalEncargos = Math.round((multa + jurosMora + jurosRem + iof) * 100) / 100;
            const totalQuitacao = Math.round((closedVal + totalEncargos + saldoAnterior) * 100) / 100;

            return {
                cpf: u.cpf,
                fullName: u.full_name,
                accountStatus: 'inadimplente',
                faturaFechada: closedVal,
                daysOverdue,
                dueDate,
                encargos: {
                    multa,
                    jurosMora,
                    jurosRemuneratorios: jurosRem,
                    iof,
                    totalEncargos
                },
                totalQuitacao
            };
        });

        console.log("Filtered user 77777777777:", JSON.stringify(overdueList.filter(u => u.cpf === '77777777777'), null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await db.disconnect();
    }
}
run();
