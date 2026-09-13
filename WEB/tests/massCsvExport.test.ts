import { describe, it, expect } from 'vitest';
import { generateRandomMassData } from '../utils/massGenerator';
import { gerarCsv, CSV_COLUNAS } from '../utils/massCsvExport';

describe('massCsvExport', () => {
    it('gera CSV com header de 23 colunas e 1 linha por massa criada', () => {
        const emDia = generateRandomMassData('Brasil');
        emDia.overdueState = 'EM_DIA';

        const atraso15d = generateRandomMassData('Estados Unidos');
        atraso15d.overdueState = 'EM_ATRASO_15D';

        const csv = gerarCsv([emDia, atraso15d]);
        const linhas = csv.trim().split('\n');

        expect(linhas).toHaveLength(3); // header + 2 massas
        expect(linhas[0].split(';')).toHaveLength(CSV_COLUNAS.length);
        expect(linhas[0]).toBe(CSV_COLUNAS.join(';'));

        // Amostra real do output, pra inspeção humana (não é assert, é só output de terminal).
        console.log(csv);
    });
});
