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
    // A planilha real de TBL_CENARIOS tem cabeçalhos com espaços acidentais
    // (ex: " saldo_conta " em vez de "saldo_conta"). Escrever direto pela chave
    // limpa criava uma coluna NOVA ao lado da existente a cada save (achado em
    // teste manual real — CT03.2 acumulou 3 colunas duplicadas de um só save).
    // Aqui, casa por nome (trim) contra as chaves que a linha JÁ tem e escreve
    // na chave real — nunca cria coluna nova pra um campo que já existe.
    const linhaOriginal = linhas[indice];
    const chavesExistentesPorTrim = new Map(
        Object.keys(linhaOriginal).map((chave) => [chave.trim(), chave])
    );
    const linhaAtualizada = { ...linhaOriginal };
    for (const [chave, valor] of Object.entries(campos)) {
        const chaveReal = chavesExistentesPorTrim.get(chave.trim()) || chave;
        linhaAtualizada[chaveReal] = valor;
    }
    linhas[indice] = linhaAtualizada;
    workbook.Sheets[CENARIOS_SHEET] = XLSX.utils.json_to_sheet(linhas);
    XLSX.writeFile(workbook, XLSX_PATH);
    return linhas[indice];
}

module.exports = { readPlanningData, saveCenarioAssignment, XLSX_PATH, CENARIOS_SHEET, MASSAS_SHEET };
