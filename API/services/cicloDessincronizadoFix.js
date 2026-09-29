/**
 * services/cicloDessincronizadoFix.js
 *
 * Detecta e cura massas com o vencimento do usuário (users.credit_card_invoice_due_date)
 * ADIANTADO em relação às faturas fechadas: o invoiceEngine só fecha um ciclo quando
 * now > corte(vencimento ATUAL). Se o vencimento já pulou um mês sem que exista a FECHADA
 * daquele ciclo (ex.: massa regenerada por curarMassaParcelas/seedMassBilling depois do
 * cron ter rolado o vencimento — o DELETE apaga a FECHADA nova, mas o users.* fica para
 * frente), o motor nunca enxerga o ciclo perdido. Efeito visível: a fatura aberta do Web
 * junta dois ciclos (compras + parcela futura contadas 2x) e diverge do CSV/limite.
 *
 * Invariante: due_atual == computeNextInvoiceDueDate(dueDay, última FECHADA.due_date), a
 * mesma regra de rolagem do invoiceEngine.
 *
 * Cura: recua o vencimento para o esperado e deixa o próprio invoiceEngine fechar o(s)
 * ciclo(s) (mesma lógica de freeze de encargos, saldo anterior e rolagem de planos).
 */
const { computeNextInvoiceDueDate, INVOICE_CUTOFF_DAYS } = require('../utils/billing');
const { runEngine } = require('./invoiceEngine');
const { esc } = require('../repositories/context');

// Acima disso a cura automática não age: gap grande é histórico incompleto de verdade
// (massa antiga/sem lastro), que pede regeneração da massa, não recuo de vencimento.
const MAX_CICLOS_AUTO = 3;

const round2 = (n) => Math.round(n * 100) / 100;

function corteDe(dueDate) {
    const d = new Date(dueDate);
    d.setDate(d.getDate() - INVOICE_CUTOFF_DAYS);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}

function mesesEntre(a, b) {
    return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/**
 * Avalia UM usuário. `ultimaFechada`/`dueAtual` são Date-parseáveis.
 * Retorna null quando está em dia com a invariante.
 */
function avaliarUsuario({ dueDay, dueAtual, ultimaFechada }) {
    if (!dueAtual || !ultimaFechada) return null;
    const atual = new Date(dueAtual);
    const ultima = new Date(ultimaFechada);
    if (isNaN(atual.getTime()) || isNaN(ultima.getTime())) return null;

    const esperado = computeNextInvoiceDueDate(Number(dueDay) || 15, ultima);
    const ciclosPulados = mesesEntre(esperado, atual);
    if (ciclosPulados < 1) return null;
    return { esperado, ciclosPulados };
}

/** Soma das compras que o motor consolidaria no ciclo perdido (mesma regra do invoiceEngine). */
async function comprasNaoFaturadas(db, cpf, ultimaFechada, esperado) {
    const rows = await db.executeQuery(`
        SELECT t.amount
        FROM ${db.fq('transactions')} t
        WHERE t.cpf = ${esc(cpf)}
          AND t.type IN ('SHOP_CREDIT','CREDIT','INVOICE_INSTALLMENT')
          AND (t.status IS NULL OR t.status <> 'cancelled')
          AND t.date > ${esc(corteDe(ultimaFechada).toISOString())}
          AND t.date <= ${esc(corteDe(esperado).toISOString())}
          AND NOT EXISTS (
              SELECT 1 FROM ${db.fq('installment_plans')} p WHERE p.purchase_tx_id = t.id
          )
    `);
    return round2((rows || []).reduce((s, r) => s + Math.abs(parseFloat(r.amount || 0)), 0));
}

/**
 * Lista as massas dessincronizadas. Só reporta quem TEM compras no ciclo perdido: sem
 * elas o vencimento adiantado é legítimo (PF/PA/Reneg avançam o vencimento ao refinanciar
 * a dívida, e apagam as parcelas do período).
 */
async function detectarCiclosDessincronizados(db, { cpfFilter = null, limit = 200 } = {}) {
    const filtro = cpfFilter ? ` AND u.cpf = ${esc(String(cpfFilter).replace(/\D/g, ''))}` : '';
    const rows = await db.executeQuery(`
        SELECT u.cpf, u.full_name, u.credit_card_due_day AS due_day,
               u.credit_card_invoice_due_date AS due_atual,
               (SELECT MAX(i.due_date) FROM ${db.fq('invoices')} i
                 WHERE i.cpf = u.cpf AND i.status = 'FECHADA') AS ultima_fechada
        FROM ${db.fq('users')} u
        WHERE u.credit_card_invoice_due_date IS NOT NULL
          AND COALESCE(u.is_blacklisted, false) = false
          AND u.role IN ('customer', 'user')${filtro}
    `);

    const encontrados = [];
    for (const r of rows || []) {
        const av = avaliarUsuario({ dueDay: r.due_day, dueAtual: r.due_atual, ultimaFechada: r.ultima_fechada });
        if (!av) continue;
        const valorNaoFaturado = await comprasNaoFaturadas(db, r.cpf, r.ultima_fechada, av.esperado);
        if (valorNaoFaturado <= 0.005) continue;
        encontrados.push({
            cpf: r.cpf,
            name: r.full_name,
            dueAtual: new Date(r.due_atual).toISOString(),
            dueEsperado: av.esperado.toISOString(),
            ultimaFechada: new Date(r.ultima_fechada).toISOString(),
            ciclosPulados: av.ciclosPulados,
            valorNaoFaturado,
            curavelAuto: av.ciclosPulados <= MAX_CICLOS_AUTO,
        });
        if (encontrados.length >= limit) break;
    }
    return encontrados;
}

/** Recua o vencimento e roda o motor até a massa alcançar o vencimento original. */
async function curarCicloDessincronizado(db, { cpfFilter = null, dryRun = false, limit = 200 } = {}) {
    const candidatos = await detectarCiclosDessincronizados(db, { cpfFilter, limit });
    if (dryRun) {
        return { dryRun: true, totalFound: candidatos.length, cpfs: candidatos };
    }

    const cured = [];
    const skipped = [];
    const errors = [];
    for (const c of candidatos) {
        if (!c.curavelAuto) {
            skipped.push({ cpf: c.cpf, motivo: `${c.ciclosPulados} ciclos pulados (> ${MAX_CICLOS_AUTO}): regenerar a massa` });
            continue;
        }
        try {
            const dueOriginal = c.dueAtual;
            await db.executeQuery(`
                UPDATE ${db.fq('users')}
                SET credit_card_invoice_due_date = ${esc(c.dueEsperado)}, updated_at = CURRENT_TIMESTAMP
                WHERE cpf = ${esc(c.cpf)}
            `);

            // O motor fecha 1 ciclo por execução; repete até o vencimento voltar ao original
            // (ou ao primeiro ainda dentro do prazo — o motor para sozinho antes do corte).
            let execucoes = 0;
            for (; execucoes < c.ciclosPulados + 1; execucoes++) {
                const r = await runEngine(c.cpf);
                if (r.falhas > 0) throw new Error(`invoiceEngine falhou: ${r.errors[0]?.mensagem || 'erro'}`);
                if (r.processed === 0) break;
            }
            cured.push({ cpf: c.cpf, name: c.name, ciclosFechados: execucoes, de: dueOriginal, para: c.dueEsperado });
        } catch (err) {
            errors.push({ cpf: c.cpf, error: err.message });
        }
    }
    return { totalFound: candidatos.length, totalCured: cured.length, skipped, errorsCount: errors.length, cured, errors };
}

module.exports = {
    MAX_CICLOS_AUTO,
    avaliarUsuario,
    detectarCiclosDessincronizados,
    curarCicloDessincronizado,
};
