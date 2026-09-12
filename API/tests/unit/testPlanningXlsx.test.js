const path = require('path');
const XLSX = require('xlsx');

jest.mock('xlsx');

const testPlanningXlsx = require('../../utils/testPlanningXlsx.cjs');

describe('testPlanningXlsx', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('readPlanningData lê as abas TBL_CENARIOS e tbl_de_massas e devolve como arrays', () => {
        const cenariosSheet = { '!ref': 'A1:B2' };
        const massasSheet = { '!ref': 'A1:B2' };
        const fakeWorkbook = {
            Sheets: {
                TBL_CENARIOS: cenariosSheet,
                tbl_de_massas: massasSheet,
            },
        };
        XLSX.readFile.mockReturnValue(fakeWorkbook);
        XLSX.utils.sheet_to_json.mockImplementation((sheet) => {
            if (sheet === cenariosSheet) return [{ ID_CENARIO: 'CT03.2', CPF: '11111111111' }];
            if (sheet === massasSheet) return [{ id_massa: '0001', cpf: '11111111111', status: 'inadimplente' }];
            return [];
        });

        const result = testPlanningXlsx.readPlanningData();

        expect(XLSX.readFile).toHaveBeenCalledWith(testPlanningXlsx.XLSX_PATH);
        expect(result.cenarios).toEqual([{ ID_CENARIO: 'CT03.2', CPF: '11111111111' }]);
        expect(result.massas).toEqual([{ id_massa: '0001', cpf: '11111111111', status: 'inadimplente' }]);
    });

    test('saveCenarioAssignment atualiza só a linha do cenário e regrava o workbook inteiro', () => {
        const linhaOriginal = { ID_CENARIO: 'CT03.2', CPF: '00000000000', saldo_conta: 10 };
        const outraAba = { '!ref': 'A1:B1' };
        const fakeWorkbook = {
            Sheets: {
                TBL_CENARIOS: { '!ref': 'A1:B2' },
                tbl_de_massas: outraAba,
            },
        };
        XLSX.readFile.mockReturnValue(fakeWorkbook);
        XLSX.utils.sheet_to_json.mockReturnValue([linhaOriginal]);
        XLSX.utils.json_to_sheet.mockReturnValue({ '!ref': 'NOVA' });

        const campos = { CPF: '11111111111', saldo_conta: 4678.70 };
        const linhaAtualizada = testPlanningXlsx.saveCenarioAssignment('CT03.2', campos);

        expect(linhaAtualizada).toEqual({ ID_CENARIO: 'CT03.2', CPF: '11111111111', saldo_conta: 4678.70 });
        // A aba de massas não pode ser recriada — continua sendo o MESMO objeto.
        expect(fakeWorkbook.Sheets.tbl_de_massas).toBe(outraAba);
        expect(XLSX.writeFile).toHaveBeenCalledWith(fakeWorkbook, testPlanningXlsx.XLSX_PATH);
    });

    test('saveCenarioAssignment lança erro claro se o ID_CENARIO não existe', () => {
        XLSX.readFile.mockReturnValue({ Sheets: { TBL_CENARIOS: {}, tbl_de_massas: {} } });
        XLSX.utils.sheet_to_json.mockReturnValue([{ ID_CENARIO: 'CT01.1' }]);

        expect(() => testPlanningXlsx.saveCenarioAssignment('CT99.9', {})).toThrow(/CT99\.9/);
    });
});
