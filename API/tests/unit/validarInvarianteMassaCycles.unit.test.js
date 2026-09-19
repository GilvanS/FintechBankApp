// API/tests/unit/validarInvarianteMassaCycles.unit.test.js
const { validarInvarianteMassa } = require('../../repositories/usersRepo');

test('3 ciclos (2 inadimplente + 1 adimplente): invariante bate com 2 fechadas não pagas', async () => {
    const db = { executeQuery: jest.fn(async () => [{ total: '2' }]), fq: (t) => `"fintech"."${t}"` };
    const result = await validarInvarianteMassa(db, '12345678900', ['inadimplente', 'inadimplente', 'adimplente']);
    expect(result.ok).toBe(true);
});

test('cycles com 1 inadimplente mas banco mostra 0 fechadas não pagas: invariante falha', async () => {
    const db = { executeQuery: jest.fn(async () => [{ total: '0' }]), fq: (t) => `"fintech"."${t}"` };
    const result = await validarInvarianteMassa(db, '12345678900', ['inadimplente']);
    expect(result.ok).toBe(false);
});

test('retrocompatibilidade: string accountStatus = inadimplente e 1 fechada não paga', async () => {
    const db = { executeQuery: jest.fn(async () => [{ total: '1' }]), fq: (t) => `"fintech"."${t}"` };
    const result = await validarInvarianteMassa(db, '12345678900', 'inadimplente');
    expect(result.ok).toBe(true);
});

test('retrocompatibilidade: string accountStatus = adimplente e 0 fechadas não pagas', async () => {
    const db = { executeQuery: jest.fn(async () => [{ total: '0' }]), fq: (t) => `"fintech"."${t}"` };
    const result = await validarInvarianteMassa(db, '12345678900', 'adimplente');
    expect(result.ok).toBe(true);
});
