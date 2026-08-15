/**
 * audit_massas_encargos.cjs — READ-ONLY
 *
 * Audita TODAS as massas e detecta faturas FECHADA não pagas VENCIDAS com
 * encargos calculados (billing_charges pending) mas NÃO congelados nas colunas
 * da fatura (valor_multa + valor_juros_mora + valor_juros_remuneratorios +
 * valor_iof = 0). Gera resumo consolidado.
 *
 * Uso: node scripts/audit_massas_encargos.cjs [--cpf=XXXX] [--detalhe]
 */
require('dotenv').config();
const PostgresProvider = require('../services/database/PostgresProvider');

const FILTER_CPF = (process.argv.find(a => a.startsWith('--cpf=')) || '').replace('--cpf=', '').replace(/\D/g, '') || null;
const DETALHE = process.argv.includes('--detalhe');
const fmtCpf = (c) => (c ? `${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6,9)}-${c.slice(9)}` : c);
const fmt2 = (n) => (n === null || n === undefined ? '—' : Number(n).toFixed(2));

async function main() {
    const config = {
        schema: process.env.DB_SCHEMA || 'fintech',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'pwd123',
        database: process.env.DB_NAME || 'fintechbank'
    };
    const db = new PostgresProvider(config);
    await db.connect();
    const q = (sql) => db.executeQuery(sql);

    try {
        const where = FILTER_CPF ? `WHERE u.cpf = '${FILTER_CPF}'` : '';
        const users = await q(`
            SELECT u.cpf, u.full_name, u.account_status, u.days_overdue, u.overdue_status, u.created_at
            FROM ${config.schema}.users u
            ${where}
            ORDER BY u.created_at ASC
        `);

        const problemas = [];   // { cpf, nome, idxFatura, venc, total, sumPending }
        const okComFatura = [];
        const hoje = new Date();

        for (const u of users) {
            const invs = await q(`
                SELECT id, status, due_date, valor_total, valor_pago, data_pagamento,
                       valor_multa, valor_juros_mora, valor_juros_remuneratorios, valor_iof,
                       dias_atraso, created_at
                FROM ${config.schema}.invoices
                WHERE cpf = '${u.cpf}'
                ORDER BY due_date ASC
            `);
            if (!invs.length) continue;

            const charges = await q(`
                SELECT invoice_reference, charge_type, SUM(amount) AS total, status
                FROM ${config.schema}.billing_charges
                WHERE cpf = '${u.cpf}'
                GROUP BY invoice_reference, charge_type, status
            `);
            const pendingByRef = {};
            for (const c of charges) {
                if (c.status === 'pending') {
                    pendingByRef[c.invoice_reference] = (pendingByRef[c.invoice_reference] || 0) + parseFloat(c.total || 0);
                }
            }

            let idx = 0;
            let algumaFaturaComEncargoCongelado = false;
            for (const inv of invs) {
                idx++;
                const totalEnc = (parseFloat(inv.valor_multa || 0) + parseFloat(inv.valor_juros_mora || 0)
                    + parseFloat(inv.valor_juros_remuneratorios || 0) + parseFloat(inv.valor_iof || 0));
                if (totalEnc > 0.005) algumaFaturaComEncargoCongelado = true;

                const isFechadaNaoPaga = inv.status === 'FECHADA' && !inv.data_pagamento;
                const due = new Date(inv.due_date);
                const isOverdue = due < hoje;
                const temDivida = parseFloat(inv.valor_total || 0) > 0.005;
                const ref = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`;
                const sumPending = pendingByRef[ref] || 0;

                if (isFechadaNaoPaga && isOverdue && temDivida && totalEnc <= 0.005 && sumPending > 0.005) {
                    problemas.push({ cpf: u.cpf, nome: u.full_name, idxFatura: idx, venc: String(inv.due_date).slice(0,10), total: parseFloat(inv.valor_total), sumPending });
                }
            }

            // Classifica a massa: problema na fatura 2+, problema na fatura 1 (âncora), ou OK
            const probsDesta = problemas.filter(p => p.cpf === u.cpf);
            if (probsDesta.length) {
                continue; // já registrado
            }
            okComFatura.push({ cpf: u.cpf, nome: u.full_name, nInvs: invs.length, algumaFaturaComEncargoCongelado });
        }

        console.log(`\n📊 MASSAS COM FATURA FECHADA NÃO PAGA VENCIDA SEM ENCARGOS CONGELADOS (mas com billing_charges pending): ${problemas.length}`);
        const porCategoria = {};
        for (const p of problemas) {
            const key = p.idxFatura === 1 ? 'fatura #1 (âncora)' : `fatura #${p.idxFatura}`;
            porCategoria[key] = (porCategoria[key] || 0) + 1;
        }
        console.log('   Por categoria: ' + Object.entries(porCategoria).map(([k, v]) => `${k}: ${v}`).join(' | '));

        const cpfsAfetados = [...new Set(problemas.map(p => p.cpf))];
        console.log(`\n🔴 CPFs AFETADOS (${cpfsAfetados.length}):`);
        for (const cpf of cpfsAfetados) {
            const ps = problemas.filter(p => p.cpf === cpf);
            const det = ps.map(p => `fat#${p.idxFatura} venc=${p.venc} total=${fmt2(p.total)} pending=${fmt2(p.sumPending)}`).join('; ');
            const nome = ps[0].nome;
            console.log(`   ${fmtCpf(cpf)} | ${nome} | ${det}`);
        }

        console.log(`\n🟢 Massas com fatura fechada SEM o problema: ${okComFatura.length}`);
        const comCongelamento = okComFatura.filter(o => o.algumaFaturaComEncargoCongelado);
        const semNenhumCongelado = okComFatura.filter(o => !o.algumaFaturaComEncargoCongelado);
        console.log(`   com encargos congelados em ≥1 fatura: ${comCongelamento.length}`);
        console.log(`   sem NENHUM encargo congelado (mas sem pending, ex: adimplente/futura): ${semNenhumCongelado.length}`);

        if (DETALHE && problemas.length) {
            console.log('\n--- DETALHE ---');
            for (const p of problemas) {
                console.log(`${fmtCpf(p.cpf)} | ${p.nome} | fat#${p.idxFatura} | venc=${p.venc} | total=${fmt2(p.total)} | pending=${fmt2(p.sumPending)}`);
            }
        }
    } catch (e) {
        console.error('ERRO:', e);
        process.exit(1);
    } finally {
        await db.disconnect();
        process.exit(0);
    }
}

main();
