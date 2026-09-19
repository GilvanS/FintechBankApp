/**
 * testPlanningRules.cjs — pré-requisito de cada cenário de TBL_CENARIOS pra
 * validar se a massa escolhida serve. Hardcoded de propósito: só 17 cenários
 * hoje, motor genérico seria over-engineering (YAGNI).
 */
// fatura_fechada é o valor ORIGINAL imutável (não zera quando paga — ver
// tblDeMassasExport.cjs) — "ainda deve a fechada" é status_fatura_fechada !== 'PAGA',
// não o valor. Sem essa checagem, massa já quitada voltaria a parecer elegível pros
// cenários que exigem pagar uma fatura fechada.
const aindaDeveFechada = (massa) =>
    Number(massa.fatura_fechada) > 0 && massa.status_fatura_fechada !== 'PAGA';

const REGRAS_POR_CENARIO = {
    'CT03.1': (massa) => Number(massa.fatura_aberta) > 0,
    'CT03.2': aindaDeveFechada,
    'CT03.3': aindaDeveFechada,
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
