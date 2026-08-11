/**
 * Teste Unitário — T7: contrato de forma da massa (Gerador 2.0)
 *
 * Perfil A (inadimplente): exatamente 1 fatura FECHADA não paga.
 * Perfil B (adimplente): 0 faturas FECHADA não pagas.
 * validarInvarianteMassa(db, cpf, accountStatus) recebe o db como parâmetro
 * explícito (não via getDb()), então um mock simples basta — sem jest.mock.
 */
const { validarInvarianteMassa } = require('../../repositories/usersRepo');

function mockDb(total) {
    return {
        fq: (t) => `"fintech"."${t}"`,
        executeQuery: jest.fn().mockResolvedValue([{ total }]),
    };
}

describe('validarInvarianteMassa — contrato de forma da massa (T7)', () => {
    it('perfil A (inadimplente) com exatamente 1 fatura: ok', async () => {
        const r = await validarInvarianteMassa(mockDb(1), '11111111111', 'inadimplente');
        expect(r.ok).toBe(true);
        expect(r.fechadasNaoPagas).toBe(1);
    });

    it('perfil A (inadimplente) com 0 faturas: invalido (sem lastro)', async () => {
        const r = await validarInvarianteMassa(mockDb(0), '11111111111', 'inadimplente');
        expect(r.ok).toBe(false);
        expect(r.motivo).toMatch(/exatamente 1/);
    });

    it('perfil A (inadimplente) com 2 faturas: invalido (o padrao das 39 massas quebradas)', async () => {
        const r = await validarInvarianteMassa(mockDb(2), '11111111111', 'inadimplente');
        expect(r.ok).toBe(false);
        expect(r.fechadasNaoPagas).toBe(2);
    });

    it('perfil B (adimplente) com 0 faturas: ok', async () => {
        const r = await validarInvarianteMassa(mockDb(0), '22222222222', 'adimplente');
        expect(r.ok).toBe(true);
    });

    it('perfil B (adimplente) com 1 fatura: invalido (fatura aberta deve ser on-the-fly, nao persistida)', async () => {
        const r = await validarInvarianteMassa(mockDb(1), '22222222222', 'adimplente');
        expect(r.ok).toBe(false);
        expect(r.motivo).toMatch(/0 faturas/);
    });
});
