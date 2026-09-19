# Gerador de Massa 4.0 — Múltiplos Ciclos de Fatura Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o gerador de massa (Admin) crie históricos de 1 a 6 ciclos de fatura encadeados (adimplente ou inadimplente por ciclo), com transações e encargos coerentes, sem violar a regra de bloqueio de cartão (>=8d atraso) nem o invariante atual de faturas fechadas.

**Architecture:** `seedMassBilling` (API/repositories/usersRepo.js) deixa de assumir 1 ciclo fixo e vira um loop sobre `cycles: Array<'adimplente'|'inadimplente'>`, encadeando `saldo_anterior` entre ciclos inadimplentes consecutivos e usando uma única compra parcelada (10-12x) para simular faturamento recorrente sob cartão bloqueado. `validarInvarianteMassa` passa a contar faturas pagas/não pagas contra a composição real de `cycles`. UI (`MainMassCreatorFlow.tsx`) ganha um seletor de 1-6 ciclos.

**Tech Stack:** Node.js/Express + Postgres (API), React/TypeScript (WEB), Jest (API tests), Vitest (WEB tests).

**Spec:** `.claude/plans/gerador-massa-4.0-ciclos-fatura.plan.md` (spec original desta sessão — decisões de design 1-7, exemplo ASCII, confirmadas com o usuário).

## Global Constraints

- Nenhuma migration nova — reusar `invoices.saldo_anterior/data_pagamento/valor_pago`, `installment_plans`, `transactions` tipo `INVOICE_INSTALLMENT`, `billing_charges` (já existentes).
- `cycles.length` entre 1 e 6.
- Default `cycles: ['inadimplente']` deve reproduzir EXATAMENTE o comportamento atual (não quebrar massas geradas hoje).
- Cartão bloqueado (>=8d atraso, regra já existente em `billingValidation.js`) nunca origina compra nova — sequência inadimplente usa 1 compra parcelada 10-12x feita no 1º ciclo da sequência.
- IOF internacional fixo 6,38% (sem componente diário), separado do IOF doméstico (0,38% fixo + 0,0082%/dia) já usado em `calcIof`.

---

## Task 1: `seedMassBilling` vira loop de N ciclos

**Files:**
- Modify: `API/repositories/usersRepo.js:73-189` (função `seedMassBilling`)
- Test: `API/tests/unit/seedMassBillingCycles.unit.test.js`

**Interfaces:**
- Consumes: `db.executeQuery`, `db.generateUUID`, `db.fq` (já existentes, injeção via `getDb()`); `computeLastPassedDueDate`, `computeNextInvoiceDueDate` de `API/utils/billing.js`.
- Produces: `seedMassBilling(db, cpf, { cycles: Array<'adimplente'|'inadimplente'>, overdueAmountBase, creditLimit, dueDay })` — assinatura nova, substitui `{accountStatus, daysOverdue, overdueAmount}`. Tasks 2 e 4 dependem dessa assinatura.

- [x] **Step 1: Escrever teste que falha — 2 ciclos inadimplentes encadeiam saldo_anterior**

```javascript
// API/tests/unit/seedMassBillingCycles.unit.test.js
const { seedMassBilling } = require('../../repositories/usersRepo');

function makeFakeDb() {
    const invoices = [];
    const transactions = [];
    const charges = [];
    return {
        executeQuery: jest.fn(async (sql) => {
            if (sql.includes('INSERT INTO fintech.invoices')) invoices.push(sql);
            if (sql.includes('INSERT INTO fintech.transactions')) transactions.push(sql);
            if (sql.includes('INSERT INTO fintech.billing_charges')) charges.push(sql);
            if (sql.includes('INSERT INTO fintech.installment_plans')) invoices.push(sql);
            return [];
        }),
        generateUUID: () => `uuid-${Math.random().toString(36).slice(2)}`,
        fq: (t) => `fintech.${t}`,
        _invoices: invoices,
        _transactions: transactions,
        _charges: charges,
    };
}

test('2 ciclos inadimplentes: 2ª fatura carrega saldo_anterior da 1ª', async () => {
    const db = makeFakeDb();
    await seedMassBilling(db, '12345678900', {
        cycles: ['inadimplente', 'inadimplente'],
        overdueAmountBase: 1200,
        creditLimit: 5000,
        dueDay: 15,
    });

    const invoiceInserts = db._invoices.filter(s => s.includes('INSERT INTO fintech.invoices'));
    expect(invoiceInserts).toHaveLength(2);
    expect(invoiceInserts[0]).toMatch(/,\s*0(\.00)?\s*,/);
    expect(invoiceInserts[1]).not.toMatch(invoiceInserts[0].match(/,\s*0(\.00)?\s*,/)?.[0] || 'NEVER_MATCH');
});

test('1 ciclo adimplente: nenhuma fatura FECHADA não paga (comportamento atual preservado)', async () => {
    const db = makeFakeDb();
    await seedMassBilling(db, '12345678900', {
        cycles: ['adimplente'],
        overdueAmountBase: 0,
        creditLimit: 5000,
        dueDay: 15,
    });
    const invoiceInserts = db._invoices.filter(s => s.includes('INSERT INTO fintech.invoices'));
    for (const ins of invoiceInserts) {
        expect(ins).not.toMatch(/data_pagamento[\s\S]*NULL/);
    }
});

test('sequência inadimplente usa 1 única compra parcelada, sem compra nova nos ciclos seguintes', async () => {
    const db = makeFakeDb();
    await seedMassBilling(db, '12345678900', {
        cycles: ['inadimplente', 'inadimplente', 'inadimplente'],
        overdueAmountBase: 1800,
        creditLimit: 5000,
        dueDay: 15,
    });
    const newPurchases = db._transactions.filter(s => s.includes("1/1") || s.includes('installments'));
    expect(newPurchases.length).toBeLessThanOrEqual(1);
});
```

- [x] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd API && npx jest tests/unit/seedMassBillingCycles.unit.test.js`
Expected: FAIL — `seedMassBilling` ainda espera `{accountStatus, daysOverdue, overdueAmount}`, não `{cycles}`.

- [x] **Step 3: Implementar o loop de N ciclos**

```javascript
// API/repositories/usersRepo.js — substituir a função seedMassBilling inteira
async function seedMassBilling(db, cpf, { cycles, overdueAmountBase, creditLimit, dueDay }) {
    const genId = () => (db.generateUUID ? db.generateUUID() : `tx-${cpf}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    const pickMerchantName = () => MASS_MERCHANTS[Math.floor(Math.random() * MASS_MERCHANTS.length)];
    const insertPurchase = async (amount, description, dateIso, type = 'SHOP_CREDIT', installments = null) => {
        const id = genId();
        await db.executeQuery(`
            INSERT INTO ${db.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date)
            VALUES (${esc(id)}, ${esc(cpf)}, ${esc(type)}, ${esc((-Math.abs(amount)).toFixed(2))}, ${esc(installments ? `${description} (${installments})` : description)}, NULL, NULL, NULL, ${esc(dateIso)})
        `);
        return { id, amount: Math.abs(amount), merchant: description, date: dateIso, type };
    };

    const now = new Date();
    now.setHours(12, 0, 0, 0);

    const cycleDueDates = cycles.map((_, idx) => {
        const ref = new Date(now);
        ref.setMonth(ref.getMonth() - (cycles.length - 1 - idx));
        return dueDay ? computeLastPassedDueDate(Number(dueDay), ref) : ref;
    });

    let saldoAnteriorAcumulado = 0;
    let installmentValue = 0;
    let installmentIndex = 0;
    let totalInstallments = 0;
    let sequenceStartDueDate = null; // data da 1ª fatura da sequência inadimplente ATUAL — days_overdue final usa esta, não a do último ciclo (decisão de design #5 do spec)

    for (let i = 0; i < cycles.length; i++) {
        const status = cycles[i];
        const dueDate = cycleDueDates[i];
        const isLast = i === cycles.length - 1;

        if (status === 'inadimplente') {
            const isFirstOfSequence = i === 0 || cycles[i - 1] !== 'inadimplente';

            if (isFirstOfSequence) {
                sequenceStartDueDate = dueDate;
                totalInstallments = 10 + Math.floor(Math.random() * 3);
                const principalTotal = round2(Number(overdueAmountBase));
                installmentValue = round2(principalTotal / totalInstallments);
                installmentIndex = 1;

                const purchaseDate = new Date(dueDate);
                purchaseDate.setDate(purchaseDate.getDate() - (20 + Math.floor(Math.random() * 5)));
                await insertPurchase(principalTotal, pickMerchantName(), purchaseDate.toISOString(), 'INVOICE_INSTALLMENT', `1/${totalInstallments}`);

                const planId = genId();
                await db.executeQuery(`
                    INSERT INTO ${db.fq('installment_plans')}
                    (id, cpf, description, total_amount, installments, installment_amount, remaining_balance, remaining_installments)
                    VALUES (${esc(planId)}, ${esc(cpf)}, ${esc(pickMerchantName())}, ${principalTotal.toFixed(2)}, ${totalInstallments}, ${installmentValue.toFixed(2)}, ${principalTotal.toFixed(2)}, ${totalInstallments})
                `);
                saldoAnteriorAcumulado = 0;
            } else {
                installmentIndex++;
                const txDate = new Date(dueDate);
                txDate.setDate(txDate.getDate() - (20 + Math.floor(Math.random() * 5)));
                await insertPurchase(installmentValue, pickMerchantName(), txDate.toISOString(), 'INVOICE_INSTALLMENT', `${installmentIndex}/${totalInstallments}`);
            }

            const principal = installmentValue;
            const daysOverdue = Math.max(1, Math.round((now.getTime() - dueDate.getTime()) / 86400000));

            const multa = round2(principal * 0.02);
            const jurosMora = round2(principal * 0.000333 * daysOverdue);
            const jurosRem = round2(principal * 0.00513 * daysOverdue);
            const iofAdicional = round2(principal * 0.0038);
            const iofDiario = round2(principal * 0.000082 * daysOverdue);
            const iof = round2(iofAdicional + iofDiario);

            const invoiceId = genId();
            const nowIso = nowDb();
            await db.executeQuery(`
                INSERT INTO ${db.fq('invoices')}
                (id, cpf, status, due_date, valor_total, created_at, updated_at, data_pagamento, dias_atraso, saldo_anterior, valor_multa, valor_juros_mora, valor_juros_remuneratorios, valor_iof)
                VALUES (${esc(invoiceId)}, ${esc(cpf)}, 'FECHADA', ${esc(dueDate.toISOString())}, ${principal.toFixed(2)}, ${esc(nowIso)}, ${esc(nowIso)}, NULL, ${daysOverdue}, ${saldoAnteriorAcumulado.toFixed(2)}, ${multa}, ${jurosMora}, ${jurosRem}, ${iof})
            `);

            const ref = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
            for (const [type, amount] of [['multa', multa], ['juros_mora', jurosMora], ['juros_remuneratorios', jurosRem], ['iof', iof]]) {
                await db.executeQuery(`
                    INSERT INTO ${db.fq('billing_charges')}
                    (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount, created_at, status)
                    VALUES (${esc(genId())}, ${esc(cpf)}, ${esc(ref)}, ${esc(type)}, ${amount}, ${daysOverdue}, ${principal.toFixed(2)}, ${esc(nowIso)}, 'pending')
                `);
            }

            saldoAnteriorAcumulado = round2(saldoAnteriorAcumulado + principal);

            if (isLast) {
                // days_overdue final = dias desde a fatura MAIS ANTIGA não paga da
                // sequência ativa (decisão de design #5), não do ciclo mais recente.
                const daysOverdueFinal = Math.max(1, Math.round((now.getTime() - sequenceStartDueDate.getTime()) / 86400000));
                await db.executeQuery(`
                    UPDATE ${db.fq('users')}
                    SET account_status = 'inadimplente', days_overdue = ${daysOverdueFinal},
                        overdue_status = ${esc(overdueStatusFor('inadimplente', daysOverdueFinal))},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE cpf = ${esc(cpf)}
                `);
            }
        } else {
            saldoAnteriorAcumulado = 0;
            const parts = splitAmount(round2(400 + Math.random() * 600), 3);
            let totalGasto = 0;
            for (const amt of parts) {
                const txDate = new Date(dueDate);
                txDate.setDate(txDate.getDate() - (5 + Math.floor(Math.random() * 15)));
                await insertPurchase(amt, pickMerchantName(), txDate.toISOString());
                totalGasto += amt;
            }
            const invoiceId = genId();
            const nowIso = nowDb();
            await db.executeQuery(`
                INSERT INTO ${db.fq('invoices')}
                (id, cpf, status, due_date, valor_total, created_at, updated_at, data_pagamento, valor_pago, dias_atraso, saldo_anterior, valor_multa, valor_juros_mora, valor_juros_remuneratorios, valor_iof)
                VALUES (${esc(invoiceId)}, ${esc(cpf)}, 'FECHADA', ${esc(dueDate.toISOString())}, ${totalGasto.toFixed(2)}, ${esc(nowIso)}, ${esc(nowIso)}, ${esc(dueDate.toISOString())}, ${totalGasto.toFixed(2)}, 0, 0, 0, 0, 0, 0)
            `);
            await db.executeQuery(`
                INSERT INTO ${db.fq('transactions')}
                (id, cpf, type, amount, description, from_user, to_user, to_key, date)
                VALUES (${esc(genId())}, ${esc(cpf)}, 'INVOICE_PAYMENT', ${totalGasto.toFixed(2)}, 'Pagamento fatura', NULL, NULL, NULL, ${esc(dueDate.toISOString())})
            `);
            if (isLast) {
                await db.executeQuery(`
                    UPDATE ${db.fq('users')}
                    SET account_status = 'adimplente', days_overdue = 0, overdue_status = 'EM_DIA', updated_at = CURRENT_TIMESTAMP
                    WHERE cpf = ${esc(cpf)}
                `);
            }
        }

        if (isLast && status === 'adimplente') {
            const openParts = splitAmount(round2(300 + Math.random() * 500), 3);
            for (const amt of openParts) {
                const txDate = new Date();
                txDate.setDate(txDate.getDate() - Math.floor(Math.random() * 6));
                await insertPurchase(amt, pickMerchantName(), txDate.toISOString());
            }
        }
    }
}
```

- [x] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd API && npx jest tests/unit/seedMassBillingCycles.unit.test.js`
Expected: PASS (3/3)

- [x] **Step 5: Commit**

```bash
git add API/repositories/usersRepo.js API/tests/unit/seedMassBillingCycles.unit.test.js
git commit -m "feat(massa): seedMassBilling aceita N ciclos encadeados de fatura"
```

---

## Task 2: Relaxar `validarInvarianteMassa` pra N ciclos

**Files:**
- Modify: `API/repositories/usersRepo.js:206-230` (função `validarInvarianteMassa`)
- Test: `API/tests/unit/validarInvarianteMassaCycles.unit.test.js`

**Interfaces:**
- Consumes: nenhuma nova (mesma `db.executeQuery`).
- Produces: `validarInvarianteMassa(db, cpf, cycles: Array<'adimplente'|'inadimplente'>)` — troca o 3º parâmetro de `accountStatus` (string) pra `cycles` (array).

- [x] **Step 1: Escrever teste que falha**

```javascript
// API/tests/unit/validarInvarianteMassaCycles.unit.test.js
const { validarInvarianteMassa } = require('../../repositories/usersRepo');

test('3 ciclos (2 inadimplente + 1 adimplente): invariante bate com 2 fechadas não pagas', async () => {
    const db = { executeQuery: jest.fn(async () => [{ total: '2' }]) };
    const result = await validarInvarianteMassa(db, '12345678900', ['inadimplente', 'inadimplente', 'adimplente']);
    expect(result.ok).toBe(true);
});

test('cycles com 1 inadimplente mas banco mostra 0 fechadas não pagas: invariante falha', async () => {
    const db = { executeQuery: jest.fn(async () => [{ total: '0' }]) };
    const result = await validarInvarianteMassa(db, '12345678900', ['inadimplente']);
    expect(result.ok).toBe(false);
});
```

- [x] **Step 2: Rodar e confirmar falha**

Run: `cd API && npx jest tests/unit/validarInvarianteMassaCycles.unit.test.js`
Expected: FAIL — assinatura atual espera `accountStatus` string, compara `=== 1`/`=== 0` fixo.

- [x] **Step 3: Implementar**

```javascript
// API/repositories/usersRepo.js — substituir validarInvarianteMassa
async function validarInvarianteMassa(db, cpf, cycles) {
    const rows = await db.executeQuery(`
        SELECT COUNT(*) AS total FROM ${db.fq('invoices')}
        WHERE cpf = ${esc(cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
    `);
    const fechadasNaoPagas = parseInt(rows[0]?.total || 0, 10);
    const esperadas = cycles.filter(c => c === 'inadimplente').length;

    let ok = true;
    let motivo = null;
    if (fechadasNaoPagas !== esperadas) {
        ok = false;
        motivo = `massa com cycles=[${cycles.join(',')}] deveria ter ${esperadas} fatura(s) FECHADA não paga(s), tem ${fechadasNaoPagas}`;
    }

    if (!ok) {
        console.error(`❌ [validarInvarianteMassa] CPF ${cpf}: ${motivo}`);
    }
    return { ok, motivo };
}
```

- [x] **Step 4: Rodar e confirmar pass**

Run: `cd API && npx jest tests/unit/validarInvarianteMassaCycles.unit.test.js`
Expected: PASS (2/2)

- [x] **Step 5: Commit**

```bash
git add API/repositories/usersRepo.js API/tests/unit/validarInvarianteMassaCycles.unit.test.js
git commit -m "feat(massa): validarInvarianteMassa aceita composição de N ciclos"
```

---

## Task 3: Merchants nacional/internacional + IOF diferenciado

**Files:**
- Modify: `API/repositories/usersRepo.js:14` (constante `MASS_MERCHANTS`) e função `seedMassBilling` (Task 1)
- Test: `API/tests/unit/massMerchantsInternacional.unit.test.js`

**Interfaces:**
- Consumes: nenhuma.
- Produces: `MASS_MERCHANTS_NACIONAL: string[]`, `MASS_MERCHANTS_INTERNACIONAL: string[]`, `calcIofInternacional(amount): number` — Task 1's `insertPurchase`/cálculo de encargos passa a somar `iofExtra` quando o merchant sorteado for internacional.

- [x] **Step 1: Escrever teste que falha**

```javascript
// API/tests/unit/massMerchantsInternacional.unit.test.js
const { MASS_MERCHANTS_NACIONAL, MASS_MERCHANTS_INTERNACIONAL, calcIofInternacional } = require('../../repositories/usersRepo');

test('listas de merchant nacional e internacional existem e não se sobrepõem', () => {
    expect(MASS_MERCHANTS_NACIONAL.length).toBeGreaterThan(0);
    expect(MASS_MERCHANTS_INTERNACIONAL).toEqual(expect.arrayContaining(['Shopee', 'Amazon.com', 'Temu']));
    const overlap = MASS_MERCHANTS_NACIONAL.filter(m => MASS_MERCHANTS_INTERNACIONAL.includes(m));
    expect(overlap).toHaveLength(0);
});

test('calcIofInternacional aplica 6,38% fixo, sem componente diário', () => {
    expect(calcIofInternacional(1000)).toBe(63.8);
    expect(calcIofInternacional(1000)).toBe(calcIofInternacional(1000));
});
```

- [x] **Step 2: Rodar e confirmar falha**

Run: `cd API && npx jest tests/unit/massMerchantsInternacional.unit.test.js`
Expected: FAIL — `MASS_MERCHANTS_NACIONAL`/`MASS_MERCHANTS_INTERNACIONAL`/`calcIofInternacional` não existem ainda (só `MASS_MERCHANTS`).

- [x] **Step 3: Implementar**

```javascript
// API/repositories/usersRepo.js — substituir a constante MASS_MERCHANTS
const MASS_MERCHANTS_NACIONAL = ['iFood', 'Amazon BR', 'Posto Shell', 'Farmacia Pague Menos', 'Netflix', 'Uber', 'Magazine Luiza', 'Zara', 'Mercado Livre', 'Spotify'];
const MASS_MERCHANTS_INTERNACIONAL = ['Shopee', 'Amazon.com', 'Temu', 'AliExpress', 'Shein'];
const MASS_MERCHANTS = MASS_MERCHANTS_NACIONAL; // mantém compat com código que ainda usa o nome antigo
const IOF_INTERNACIONAL_RATE = 0.0638;

function calcIofInternacional(amount) {
    return round2(Number(amount) * IOF_INTERNACIONAL_RATE);
}

function pickMerchant() {
    const internacional = Math.random() < 0.3;
    const lista = internacional ? MASS_MERCHANTS_INTERNACIONAL : MASS_MERCHANTS_NACIONAL;
    return { nome: lista[Math.floor(Math.random() * lista.length)], internacional };
}
```

Em `seedMassBilling` (Task 1), no bloco de cálculo de encargos de cada ciclo inadimplente, somar IOF extra quando a compra parcelada original for de merchant internacional:

```javascript
// No trecho que cria a compra parcelada (isFirstOfSequence), guardar se é internacional:
const merchant = pickMerchant();
const isInternacional = merchant.internacional;
// ... usar merchant.nome no lugar de pickMerchantName() nessa compra

// No cálculo de encargos de CADA parcela dessa sequência:
const iofExtra = isInternacional ? calcIofInternacional(principal) : 0;
const iofTotalCiclo = round2(iof + iofExtra);
// usar iofTotalCiclo (não `iof`) no INSERT de invoices.valor_iof e no billing_charges tipo 'iof'
```

- [x] **Step 4: Rodar e confirmar pass**

Run: `cd API && npx jest tests/unit/massMerchantsInternacional.unit.test.js`
Expected: PASS (2/2)

- [x] **Step 5: Commit**

```bash
git add API/repositories/usersRepo.js API/tests/unit/massMerchantsInternacional.unit.test.js
git commit -m "feat(massa): merchants nacional/internacional com IOF de câmbio 6,38%"
```

---

## Task 4: Payload/UI — número de ciclos no gerador

**Files:**
- Modify: `WEB/utils/massGenerator.ts` (payload builder)
- Modify: `WEB/components/Admin/MainMassCreatorFlow.tsx` (seletor de ciclos)
- Modify: `API/repositories/usersRepo.js:343-483` (função `createMassUser` — repassar `cycles` pro `seedMassBilling`/`validarInvarianteMassa`)
- Test: `WEB/tests/massGeneratorCycles.test.tsx`

**Interfaces:**
- Consumes: `seedMassBilling` (Task 1), `validarInvarianteMassa` (Task 2).
- Produces: payload de `createMassUser` ganha campo `cycles: Array<'adimplente'|'inadimplente'>` (1-6 posições) no lugar de `accountStatus` isolado.

- [x] **Step 1: Escrever teste que falha (WEB)**

```typescript
// WEB/tests/massGeneratorCycles.test.tsx
import { describe, it, expect } from 'vitest';
import { buildMassPayload } from '../utils/massGenerator';

describe('buildMassPayload — ciclos', () => {
    it('default continua 1 ciclo (comportamento atual preservado)', () => {
        const payload = buildMassPayload({});
        expect(payload.cycles).toHaveLength(1);
    });

    it('aceita até 6 ciclos configurados manualmente', () => {
        const payload = buildMassPayload({ cycles: ['inadimplente', 'inadimplente', 'adimplente', 'inadimplente', 'adimplente', 'adimplente'] });
        expect(payload.cycles).toHaveLength(6);
    });

    it('rejeita mais de 6 ciclos', () => {
        expect(() => buildMassPayload({ cycles: new Array(7).fill('adimplente') })).toThrow();
    });
});
```

- [x] **Step 2: Rodar e confirmar falha**

Run: `cd WEB && npx vitest run tests/massGeneratorCycles.test.tsx`
Expected: FAIL — `buildMassPayload` não aceita/valida `cycles` ainda.

- [x] **Step 3: Implementar (WEB payload + validação)**

```typescript
// WEB/utils/massGenerator.ts — adicionar ao builder existente
export type CycleStatus = 'adimplente' | 'inadimplente';

export function buildMassPayload(input: { cycles?: CycleStatus[] } & Record<string, unknown>) {
    const cycles = input.cycles && input.cycles.length > 0 ? input.cycles : (['inadimplente'] as CycleStatus[]);
    if (cycles.length > 6) {
        throw new Error('Máximo de 6 ciclos de fatura por massa.');
    }
    return { ...input, cycles };
}
```

UI (`MainMassCreatorFlow.tsx`): adicionar um seletor de 1-6 pro número de ciclos, e por ciclo um toggle adimplente/inadimplente (reaproveitar o mesmo componente de toggle binário já usado no plano 2.0, repetido N vezes conforme o número escolhido). Segue o padrão visual já existente no arquivo (componentes em PascalCase, sem `any` explícito — `WEB/CLAUDE.md`).

Backend (`createMassUser`, `usersRepo.js:343-483`): trocar a chamada a `seedMassBilling`/`validarInvarianteMassa` de `{accountStatus, daysOverdue, overdueAmount}` pra `{cycles, overdueAmountBase}` / `(db, cpf, cycles)`.

- [x] **Step 4: Rodar e confirmar pass**

Run: `cd WEB && npx vitest run tests/massGeneratorCycles.test.tsx`
Expected: PASS (3/3)

- [x] **Step 5: Commit**

```bash
git add WEB/utils/massGenerator.ts WEB/components/Admin/MainMassCreatorFlow.tsx API/repositories/usersRepo.js WEB/tests/massGeneratorCycles.test.tsx
git commit -m "feat(massa): UI e payload de 1-6 ciclos no gerador de massa"
```

---

## Task 5: Validação cruzada com o motor PF/PA (ponta a ponta)

**Files:**
- Test: `API/tests/integration/geradorMassaCiclosPfPa.integration.test.js`

**Interfaces:**
- Consumes: `seedMassBilling` (Task 1), `calcularParcelamentoFatura`/`checarElegibilidadePA` (`API/services/installmentCalcEngine.js`, já validados nesta sessão).
- Produces: nada novo — só confirma que a saída de uma ponta alimenta a outra corretamente.

- [x] **Step 1: Escrever teste de integração que falha**

```javascript
// API/tests/integration/geradorMassaCiclosPfPa.integration.test.js
const { seedMassBilling } = require('../../repositories/usersRepo');
const { calcularParcelamentoFatura, TIPOS_ENTRADA } = require('../../services/installmentCalcEngine');
const { getDb } = require('../../repositories/context');

test('massa com 3 ciclos (2 inadimplente + 1 pago no meio) gera saldo_anterior != 0 só quando há encadeamento real', async () => {
    const db = getDb();
    const cpf = '99999000011';
    await seedMassBilling(db, cpf, { cycles: ['inadimplente', 'adimplente', 'inadimplente'], overdueAmountBase: 1500, creditLimit: 5000, dueDay: 10 });

    const invs = await db.executeQuery(`SELECT due_date, valor_total, saldo_anterior FROM fintech.invoices WHERE cpf='${cpf}' AND status='FECHADA' AND data_pagamento IS NULL ORDER BY due_date ASC`);
    expect(invs).toHaveLength(2);
    expect(Number(invs[0].saldo_anterior)).toBe(0);
    expect(Number(invs[1].saldo_anterior)).toBe(0);

    const result = calcularParcelamentoFatura({
        valorFatura: Number(invs[1].valor_total),
        saldoAbertoAnterior: Number(invs[1].saldo_anterior),
        taxaMensal: 0.0795,
        prazo: 6,
        tipoEntrada: TIPOS_ENTRADA.SEM_ENTRADA,
        dataLimitePagamento: new Date(invs[1].due_date),
        vencimentoProximoCorte: new Date(new Date(invs[1].due_date).setMonth(new Date(invs[1].due_date).getMonth() + 1)),
        diaVencimento: 10,
    });
    expect(result.valorParcela).toBeGreaterThan(0);
    expect(result.iofAdicional).toBeGreaterThanOrEqual(0);
});
```

- [x] **Step 2: Rodar e confirmar falha**

Run: `cd API && npx jest tests/integration/geradorMassaCiclosPfPa.integration.test.js`
Expected: FAIL até Tasks 1-4 estarem implementadas (depende de `seedMassBilling` com `cycles`).

- [x] **Step 3: (sem novo código — este teste só passa depois das Tasks 1-4 completas)**

- [x] **Step 4: Rodar e confirmar pass**

Run: `cd API && npx jest tests/integration/geradorMassaCiclosPfPa.integration.test.js`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add API/tests/integration/geradorMassaCiclosPfPa.integration.test.js
git commit -m "test(massa): valida ponta a ponta gerador multi-ciclo x motor PF/PA"
```
