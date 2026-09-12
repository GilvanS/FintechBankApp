/**
 * testPlanningRules.cjs — pré-requisito de cada cenário de TBL_CENARIOS pra
 * validar se a massa escolhida serve. Hardcoded de propósito: só 17 cenários
 * hoje, motor genérico seria over-engineering (YAGNI).
 */
const REGRAS_POR_CENARIO = {
    'CT03.1': (massa) => Number(massa.fatura_aberta) > 0,
    'CT03.2': (massa) => Number(massa.fatura_fechada) > 0,
    'CT03.3': (massa) => Number(massa.fatura_fechada) > 0,
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
