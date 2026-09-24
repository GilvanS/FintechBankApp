#!/usr/bin/env node
/**
 * cura_encargos_apos_total.cjs — remove encargos PENDING cobrados SEM dívida depois de
 * um pagamento TOTAL (Task 4, fix 1/2). Base: auditoriaEncargos.listarEncargosSemDebitoAposTotal
 * (criado depois de um TOTAL ao vivo e sem principal vencido em aberto naquele instante).
 *
 * Três grupos, e SÓ o primeiro é removível:
 *   1. REMOVÍVEL: o que a 8e acusa (continuou contando depois do TOTAL) + multa DUPLA
 *      (a mesma fatura já tinha multa antes — ex.: CPF 42194343806, 21/09 23:54).
 *   2. LISTADO, decisão do usuário: "débito anterior recriado" — encargo de período até
 *      o TOTAL, recriado com created_at novo. Quase todo vem de TOTAL pago DEPOIS do
 *      vencimento pela rota antiga, que pagava só o principal e deixava os encargos do
 *      atraso pending DE PROPÓSITO para herança (regra 2): é dívida real e a cura NÃO
 *      pode perdoá-la. Nunca é apagado, em nenhum modo.
 *   3. LISTADO, estorno manual: encargo PAGO sem dívida (vira devolução ao saldo).
 *
 * Padrão: SIMULA, sem escrever nada (nem o ALTER de garantirColunasQuitacao). --confirm
 * garante as colunas e apaga, por id, só o grupo 1 que continua 'pending'. Nunca toca
 * a FECHADA (imutável).
 *
 * Uso (dentro de API/):
 *   node scripts/cura_encargos_apos_total.cjs                 # simulação, base toda
 *   node scripts/cura_encargos_apos_total.cjs --cpf=12345678901
 *   node scripts/cura_encargos_apos_total.cjs --json          # simulação em JSON
 *   node scripts/cura_encargos_apos_total.cjs --confirm       # aplica (só o grupo 1)
 */
const path = require('path');
// Só como CLI: o teste importa planejar/aplicar sem carregar .env.
if (require.main === module) require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { round2 } = require('../utils/invoiceMath');
const { esc } = require('../repositories/context');
const { listarEncargosSemDebitoAposTotal } = require('../services/auditoriaEncargos');
const { garantirColunasQuitacao } = require('../services/encargosPagamento');

const soma = (rows) => round2(rows.reduce((s, r) => s + parseFloat(r.amount || 0), 0));
const resumo = (rows) => ({
    cpfs: new Set(rows.map((r) => r.cpf)).size,
    faturas: new Set(rows.map((r) => `${r.cpf}|${r.invoiceId || '?'}`)).size,
    encargos: rows.length,
    valor: soma(rows),
});

/** Lista por CPF + fatura (o que a simulação mostra para decisão do usuário). */
function porFatura(rows) {
    const m = new Map();
    for (const r of rows) {
        const k = `${r.cpf}|${r.invoiceId || '?'}`;
        const f = m.get(k) || { cpf: r.cpf, fullName: r.fullName, invoiceId: r.invoiceId || null, charges: [], valor: 0 };
        f.charges.push({ id: r.id, tipo: r.charge_type, valor: round2(parseFloat(r.amount || 0)), status: r.status });
        f.valor = round2(f.valor + parseFloat(r.amount || 0));
        m.set(k, f);
    }
    return [...m.values()];
}

/**
 * Plano da cura. SÓ LEITURA: não chama garantirColunasQuitacao (ALTER) — sem as
 * colunas paid_at/payment_id a leitura falha e é preciso rodar com --confirm.
 */
async function planejarCura(db, { cpf = null } = {}) {
    const porCpf = await listarEncargosSemDebitoAposTotal(db, { cpf, esc, somenteLeitura: true });
    const remover = [];
    const recriadoAnterior = [];
    const pagosSemDivida = [];
    for (const { cpf: c, fullName, encargos } of porCpf) {
        for (const e of encargos) {
            const linha = { ...e, cpf: c, fullName };
            if (e.status !== 'pending') pagosSemDivida.push(linha);
            else if (e.acusa || e.multaDupla) remover.push(linha);
            else recriadoAnterior.push(linha);
        }
    }
    return {
        remover,
        recriadoAnterior,
        pagosSemDivida,
        resumo: {
            remover: resumo(remover),
            continuouContando: resumo(remover.filter((r) => r.acusa)),
            multaDupla: resumo(remover.filter((r) => r.multaDupla && !r.acusa)),
            recriadoAnterior: { ...resumo(recriadoAnterior), acao: 'LISTADO — decisão do usuário (não é apagado)' },
            pagosSemDivida: { ...resumo(pagosSemDivida), acao: 'LISTADO — estorno manual (não é apagado)' },
        },
        listados: {
            recriadoAnterior: porFatura(recriadoAnterior),
            pagosSemDivida: porFatura(pagosSemDivida),
        },
    };
}

/** Apaga, por id, SÓ o grupo removível que AINDA está pending. */
async function aplicarCura(db, plano) {
    const ids = plano.remover.filter((r) => r.acusa || r.multaDupla).map((r) => r.id);
    if (!ids.length) return { apagadas: 0 };
    await garantirColunasQuitacao(db);
    let apagadas = 0;
    for (let i = 0; i < ids.length; i += 200) {
        const lote = ids.slice(i, i + 200);
        const rows = await db.executeQuery(`
            DELETE FROM ${db.fq('billing_charges')}
            WHERE status = 'pending' AND id IN (${lote.map((id) => esc(id)).join(', ')})
            RETURNING id
        `);
        apagadas += (rows || []).length;
    }
    return { apagadas };
}

async function main() {
    const DatabaseFactory = require('../services/database/DatabaseFactory');
    const cpfArg = (process.argv.find((a) => a.startsWith('--cpf=')) || '').slice(6).replace(/\D/g, '');
    const confirm = process.argv.includes('--confirm');
    const json = process.argv.includes('--json');
    const db = DatabaseFactory.createDatabaseService();
    await db.connect();
    try {
        const plano = await planejarCura(db, { cpf: cpfArg.length === 11 ? cpfArg : null });
        const saida = { modo: confirm ? 'APLICADO' : 'SIMULACAO', ...plano.resumo };
        if (confirm) saida.aplicado = await aplicarCura(db, plano);
        if (json) {
            console.log(JSON.stringify({
                ...saida,
                remover: plano.remover.map(({ id, cpf, invoiceId, charge_type, amount, acusa, multaDupla }) => ({ id, cpf, invoiceId, charge_type, amount, acusa, multaDupla })),
                listados: plano.listados,
            }, null, 2));
        } else {
            console.log(`${saida.modo} — encargos pending sem dívida depois do TOTAL`);
            console.log('  REMOVÍVEL (8e + multa dupla):', saida.remover);
            console.log('    continuou contando (8e):', saida.continuouContando);
            console.log('    multa dupla (fora da 8e):', saida.multaDupla);
            console.log('  débito anterior recriado — decisão do usuário, NÃO apagado:', saida.recriadoAnterior);
            for (const f of plano.listados.recriadoAnterior) console.log(`    ${f.cpf} fatura ${f.invoiceId || '?'}: ${f.charges.length} charge(s), R$ ${f.valor.toFixed(2)}`);
            console.log('  PAGOS sem dívida — estorno manual, NÃO tocados:', saida.pagosSemDivida);
            if (saida.aplicado) console.log('  apagadas:', saida.aplicado.apagadas);
        }
    } finally {
        await db.disconnect();
    }
}

if (require.main === module) {
    main().catch((err) => { console.error('❌', err.message); process.exit(1); });
}

module.exports = { planejarCura, aplicarCura };
