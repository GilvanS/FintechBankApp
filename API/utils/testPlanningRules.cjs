/**
 * testPlanningRules.cjs — pré-requisito de cada cenário de TBL_CENARIOS pra
 * validar se a massa escolhida serve. Hardcoded de propósito: só 17 cenários
 * hoje, motor genérico seria over-engineering (YAGNI).
 */
// fatura_fechada é o valor ORIGINAL imutável (não zera quando paga — ver
// tblDeMassasExport.cjs) — "serve pra pagar do zero" exige status_fatura_fechada
// EXATAMENTE 'VIGENTE' (fechada existe e nunca recebeu pagamento), não só
// "!== PAGO_TOTAL". Caso real 71040451128 (2026-09-20): massa com um Mínimo já
// pago passou pela checagem antiga (só excluía PAGA=quitada) e o Total pago
// depois cobrou o valor ORIGINAL de novo por cima do que já tinha sido pago —
// R$187,63 de excedente. Qualquer pagamento anterior (parcial, mínimo ou total)
// invalida a massa pra um cenário que espera pagar do zero.
const fechadaIntocada = (massa) =>
    Number(massa.fatura_fechada) > 0 && massa.status_fatura_fechada === 'VIGENTE';

const REGRAS_POR_CENARIO = {
    // CT03.1-3.5 pagam TODOS a fatura fechada (total/mínimo/parcial/menor/maior que o
    // mínimo) — todos exigem a mesma pré-condição: fechada existente e intocada.
    'CT03.1': fechadaIntocada,
    'CT03.2': fechadaIntocada,
    'CT03.3': fechadaIntocada,
    'CT03.4': fechadaIntocada,
    'CT03.5': fechadaIntocada,
};

function validarMassaParaCenario(idCenario, massa) {
    const regra = REGRAS_POR_CENARIO[idCenario];
    if (!regra) {
        return { valido: true, motivo: null };
    }
    const valido = regra(massa);
    return {
        valido,
        motivo: valido ? null : `Essa massa não atende ao pré-requisito do cenário ${idCenario}.`,
    };
}

module.exports = { REGRAS_POR_CENARIO, validarMassaParaCenario };
