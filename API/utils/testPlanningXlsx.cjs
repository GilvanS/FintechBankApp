/**
 * testPlanningXlsx.cjs — leitura/escrita das abas TBL_CENARIOS e tbl_de_massas
 * de A:\Workspace\poc-fintech-playwright\data\MassaDados.xlsx.
 *
 * saveCenarioAssignment SEMPRE relê o workbook inteiro do disco antes de mutar
 * (o arquivo pode ter sido editado manualmente no Excel entre requisições) e
 * regrava o workbook inteiro — só a aba TBL_CENARIOS é substituída em memória,
 * as outras 6 abas permanecem o MESMO objeto original, nunca recriadas.
 */
const XLSX = require('xlsx');

const XLSX_PATH = 'A:\\Workspace\\poc-fintech-playwright\\data\\MassaDados.xlsx';
const CENARIOS_SHEET = 'TBL_CENARIOS';
const MASSAS_SHEET = 'tbl_de_massas';

function readPlanningData() {
    const workbook = XLSX.readFile(XLSX_PATH);
    const cenarios = XLSX.utils.sheet_to_json(workbook.Sheets[CENARIOS_SHEET]);
    const massas = XLSX.utils.sheet_to_json(workbook.Sheets[MASSAS_SHEET]);
    return { cenarios, massas };
}

function saveCenarioAssignment(idCenario, campos) {
    const workbook = XLSX.readFile(XLSX_PATH);
    const linhas = XLSX.utils.sheet_to_json(workbook.Sheets[CENARIOS_SHEET]);
    const indice = linhas.findIndex((linha) => String(linha.ID_CENARIO) === String(idCenario));
    if (indice === -1) {
        throw new Error(`Cenário "${idCenario}" não encontrado em TBL_CENARIOS.`);
    }
    linhas[indice] = { ...linhas[indice], ...campos };
    workbook.Sheets[CENARIOS_SHEET] = XLSX.utils.json_to_sheet(linhas);
    XLSX.writeFile(workbook, XLSX_PATH);
    return linhas[indice];
}

module.exports = { readPlanningData, saveCenarioAssignment, XLSX_PATH, CENARIOS_SHEET, MASSAS_SHEET };
