const { extrairJson } = require('../../src/controllers/adminScriptsController');

describe('extrairJson (saída --json dos scripts do Admin)', () => {
    test('ignora o log do PostgresProvider antes do JSON (caso uti_massa.cjs)', () => {
        const saida = [
            "🏭 DatabaseFactory: Inicializando provedor 'postgres'...",
            '🔵 [PostgresProvider] Executando Query: SELECT { nada } FROM x',
            '{',
            '  "modo": "dry-run",',
            '  "resumo": { "curadas": 0 },',
            '  "relatorio": [',
            '    { "cpf": "123" }',
            '  ]',
            '}',
            '',
        ].join('\n');

        expect(extrairJson(saida)).toEqual({ modo: 'dry-run', resumo: { curadas: 0 }, relatorio: [{ cpf: '123' }] });
    });

    test('JSON puro continua funcionando', () => {
        expect(extrairJson('{"ok":true}')).toEqual({ ok: true });
    });

    test('sem JSON válido devolve o log cru', () => {
        expect(extrairJson('só log\n{ quebrado')).toEqual({ log: 'só log\n{ quebrado' });
    });
});
