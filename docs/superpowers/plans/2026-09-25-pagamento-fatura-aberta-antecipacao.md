# Pagamento com fatura ABERTA = antecipação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um pagamento feito quando não há fatura FECHADA com dívida passa a ter UMA regra só (antecipação), aplicada igual por `pay()`, `enrichUserCreditCardData`, `invoiceEngine` e o CSV da planilha de controle — sem crédito fantasma e sem cobrança em dobro.

**Architecture:** Nova coluna `transactions.applied_to_charges` guarda quanto de cada `INVOICE_PAYMENT` foi para encargos (`billing_charges`). "Pago de principal" passa a ser `|amount| − applied_to_charges` em todo lugar (helper SQL único). No ramo sem fatura fechada com dívida, `pay()` quita os encargos pendentes (se cobrir todos) e registra o resto como antecipação (`invoice_id NULL`, `applied_to_charges NOT NULL`), sem apagar parcelas. O `enrich` abate a antecipação na fatura aberta (e para de somar pagamento sem vínculo no resíduo das fechadas). No fechamento, o `invoiceEngine` vincula a antecipação à fatura recém-fechada, e a cascata que já existe (`planDistribution`) resolve.

**Tech Stack:** Node.js/Express (CommonJS), PostgreSQL (pgdb no WSL docker-ce, schema `fintech`), Knex (só migrations), Jest (projetos `unit` e `integration`).

**Spec:** Esta conversa, decisões do usuário em 2026-09-25: regra = **Antecipação**; registro = **coluna nova** (`applied_to_charges`), mantendo 1 pagamento = 1 lançamento no extrato; a coluna também entra no CSV da planilha de controle **como ÚLTIMA coluna**, sem mexer na posição das existentes.

## Contexto (o bug, com evidência)

Pagamento sem fatura FECHADA com dívida cai no ramo "legado" de `invoiceController.pay` (`API/src/controllers/invoiceController.js:792-799`): cobra só as `INVOICE_INSTALLMENT` já lançadas, apaga essas linhas, marca os encargos como `paid` e grava o `INVOICE_PAYMENT` com `invoice_id NULL` (`:111-115`). Depois disso:

| Quem | Como trata o pagamento sem vínculo | Efeito |
|---|---|---|
| `enrichUserCreditCardData` (`API/index.cjs:1166`) | `max(pago vinculado, paymentsTotal da janela)` e `paymentsTotal` soma TUDO | crédito fantasma: 805 mostra aberta R$ 0 (real ~R$ 92); 777 mostra R$ 0 (real R$ 191,52) |
| `fetchPaidByInvoice` (`invoiceController.js:153-161`) | ignora (`invoice_id IS NOT NULL`) | cobra de novo: 20250513611 pagou R$ 4.985,33 em 09/08 e de novo em 12/09 |
| `invoiceEngine` (`API/services/invoiceEngine.js:128-142`) | ignora pagamentos ao fechar | fatura fecha cheia, mesmo já antecipada |

Bug correlato, corrigido pela mesma coluna: pagamento TOTAL de fechada que também quita encargos grava o valor cheio vinculado. A cascata conta a parte dos encargos como principal e sobra saldo credor fantasma igual aos encargos.

## Global Constraints

- Fatura FECHADA é imutável (trigger da migration 006). **Nunca** fazer `UPDATE` em `fintech.invoices` com status FECHADA.
- Encargos (`billing_charges`) só viram `paid` quando o pagamento cobre **todos** os pendentes (regra atual, `invoiceController.js:1053`), com tolerância de R$ 0,01.
- 1 pagamento = 1 transação `INVOICE_PAYMENT` no extrato (feedback 805/381). Não dividir em N linhas.
- Linhas antigas ficam com `applied_to_charges = NULL` e são tratadas como 0. **Nada de backfill.** Pagamento órfão legado (NULL + sem vínculo) **não** é vinculado nem vira crédito.
- CSV da planilha de controle (`API/utils/tblDeMassasExport.cjs`): colunas existentes mantêm nome e posição; a nova (`tbl_pago_encargos`) é a **última**.
- Comparação de datas contra colunas `timestamp without time zone` em JS, não em SQL com `now()` (ver `invoiceController.js:832-835`).
- Arquivos novos < 500 linhas. Comentários em português, no estilo do arquivo.
- **Fora de escopo** (planos separados, com aprovação por massa): correção de dados das massas 80535757654 / 77766655544 / 20250513611; os 10 planos "Parcelamento fatura" duplicados da 777; legitimidade dos encargos criados em 22/09 na 805; reescrita do `massa805Lifecycle.unit.test.js`.

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `API/migrations/009_transactions_applied_to_charges.js` | Criar | coluna `applied_to_charges DECIMAL(15,2) NULL` |
| `API/utils/invoiceMath.js` | Modificar | `paidPrincipalSql(alias)`: fragmento SQL único do "pago de principal" |
| `API/services/openCyclePayment.js` | Criar | `planOpenCyclePayment()`: função pura que divide o pagamento em encargos e antecipação |
| `API/src/controllers/invoiceController.js` | Modificar | grava `applied_to_charges`; ramo `payOpenCycle`; extrai `notifyTotalPayment` |
| `API/index.cjs` (enrich) | Modificar | resíduo só com pago vinculado; antecipações abatem a aberta; `creditoExcedente` coerente |
| `API/services/invoiceEngine.js` | Modificar | vincula antecipações à fatura que fecha |
| `API/utils/tblDeMassasExport.cjs` | Modificar | paridade com o enrich + coluna final `tbl_pago_encargos` |
| `API/services/invoiceImmutabilityHealth.js` | Modificar | `PAYMENT_SEM_INVOICE_ID` não acusa antecipação legítima em aberto |
| Somas de "pago" (lista na Task 2) | Modificar | usar `paidPrincipalSql` |
| `docs/REGRAS-NEGOCIO-FATURA.md` | Modificar | nova §25 |
| `API/tests/unit/invoiceMath.unit.test.js` | Modificar | teste do helper |
| `API/tests/unit/openCyclePayment.unit.test.js` | Criar | testes da função pura |
| `API/tests/unit/tblDeMassasExport.unit.test.js` | Criar | ordem das colunas e regra do `pagos_totais` |
| `API/tests/unit/invoiceImmutabilityHealth.unit.test.js` | Modificar | novo filtro |
| `API/tests/integration/pagamentoFaturaAberta.integration.test.js` | Criar | cenários A, B, C, D e L contra o Postgres real |

**Onde rodar:** comandos a partir de `API/` do checkout onde a branch está (worktree sem `node_modules` → `npm ci` antes). Postgres e Redis precisam estar no ar (`wsl -e docker start pgdb redis`).

---

### Task 0: Baseline

**Files:** nenhum.

- [ ] **Step 1: Registrar o baseline da suíte unit**

Run: `npx jest --selectProjects unit`
Expected: 61/62 suites passando; a única falha conhecida é `massa805Lifecycle.unit.test.js:74` (dado real da massa 805 mudou, fora de escopo). Anotar o número exato de testes para comparar no fim.

- [ ] **Step 2: Snapshot dos pagamentos sem vínculo (só leitura)**

```bash
echo "SELECT id, cpf, date, amount FROM fintech.transactions WHERE type='INVOICE_PAYMENT' AND invoice_id IS NULL ORDER BY date;" | wsl -e docker exec -i pgdb psql -U postgres -d fintechbank
```
Expected: 4 linhas (20250513611, 99999999999, 77766655544, 80535757654). Depois da migration elas ficam com `applied_to_charges = NULL` e **não** podem ser vinculadas por nada deste plano.

---

### Task 1: Coluna `applied_to_charges` + helper `paidPrincipalSql`

**Files:**
- Create: `API/migrations/009_transactions_applied_to_charges.js`
- Modify: `API/utils/invoiceMath.js` (nova função + export em `module.exports`, linha ~277)
- Test: `API/tests/unit/invoiceMath.unit.test.js`

**Interfaces:**
- Produces: `paidPrincipalSql(alias?: string): string`, exportada de `utils/invoiceMath.js`. Retorna `(ABS(CAST(<p>amount AS DECIMAL(15,2))) - COALESCE(<p>applied_to_charges, 0))`, com `<p>` = `alias.` ou vazio.
- Produces: coluna `fintech.transactions.applied_to_charges DECIMAL(15,2) NULL`.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `API/tests/unit/invoiceMath.unit.test.js`:

```js
describe('paidPrincipalSql — pago de PRINCIPAL de um INVOICE_PAYMENT', () => {
    const { paidPrincipalSql } = require('../../utils/invoiceMath');

    test('sem alias: |amount| menos a parte que foi para encargos (NULL = 0)', () => {
        expect(paidPrincipalSql()).toBe('(ABS(CAST(amount AS DECIMAL(15,2))) - COALESCE(applied_to_charges, 0))');
    });

    test('com alias: prefixa as duas colunas', () => {
        expect(paidPrincipalSql('t')).toBe('(ABS(CAST(t.amount AS DECIMAL(15,2))) - COALESCE(t.applied_to_charges, 0))');
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest tests/unit/invoiceMath.unit.test.js -t paidPrincipalSql`
Expected: FAIL com `paidPrincipalSql is not a function`.

- [ ] **Step 3: Implementar o helper**

Em `API/utils/invoiceMath.js`, antes de `module.exports`:

```js
/**
 * Fragmento SQL do valor de um INVOICE_PAYMENT que abateu PRINCIPAL de fatura.
 * Pagamento que também quitou encargos (billing_charges) grava essa parte em
 * transactions.applied_to_charges — somar o amount cheio contaria o mesmo dinheiro
 * de novo como principal e geraria saldo credor fantasma (805/777, 2026-09).
 * Linhas anteriores à migration 009 têm NULL = 0 (comportamento antigo preservado).
 */
function paidPrincipalSql(alias = '') {
    const p = alias ? `${alias}.` : '';
    return `(ABS(CAST(${p}amount AS DECIMAL(15,2))) - COALESCE(${p}applied_to_charges, 0))`;
}
```

E incluir `paidPrincipalSql,` no objeto de `module.exports`.

- [ ] **Step 4: Criar a migration**

`API/migrations/009_transactions_applied_to_charges.js`:

```js
// Migration: quanto de cada pagamento foi para encargos (billing_charges).
//
// Um INVOICE_PAYMENT pode quitar encargos E principal de uma vez. Sem separar as
// duas partes, toda soma de "pago" contava os encargos como principal: a cascata
// (planDistribution) sobrava saldo credor fantasma e o pagamento com a fatura
// ABERTA não tinha como ser vinculado depois sem contar o dinheiro duas vezes.
//
// Nullable de propósito: NULL = linha anterior a esta regra (tratada como 0 e
// NUNCA vinculada pelo invoiceEngine). Linha da regra nova sempre grava um número
// (0 quando nada foi para encargos). Ver docs/REGRAS-NEGOCIO-FATURA.md §25.
exports.up = async function(knex) {
    const schema = process.env.DB_SCHEMA || 'fintech';
    const has = await knex.schema.withSchema(schema).hasColumn('transactions', 'applied_to_charges');
    if (!has) {
        await knex.schema.withSchema(schema).alterTable('transactions', (t) => {
            t.decimal('applied_to_charges', 15, 2).nullable();
        });
    }
};

exports.down = async function(knex) {
    const schema = process.env.DB_SCHEMA || 'fintech';
    const has = await knex.schema.withSchema(schema).hasColumn('transactions', 'applied_to_charges');
    if (has) {
        await knex.schema.withSchema(schema).alterTable('transactions', (t) => {
            t.dropColumn('applied_to_charges');
        });
    }
};
```

- [ ] **Step 5: Aplicar no banco de dev e conferir**

Primeiro `npm run migrate:status`: se houver migration pendente além da 009, **parar e perguntar ao usuário** (o `migrate:latest` aplicaria todas no pgdb compartilhado).
Run: `npm run migrate`
Depois:
```bash
echo "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='fintech' AND table_name='transactions' AND column_name='applied_to_charges';" | wsl -e docker exec -i pgdb psql -U postgres -d fintechbank
```
Expected: `applied_to_charges | numeric | YES`.

- [ ] **Step 6: Rodar o teste e ver passar**

Run: `npx jest tests/unit/invoiceMath.unit.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add API/migrations/009_transactions_applied_to_charges.js API/utils/invoiceMath.js API/tests/unit/invoiceMath.unit.test.js
git commit -m "feat(api): coluna applied_to_charges e helper paidPrincipalSql"
```

---

### Task 2: Toda soma de "pago" usa `paidPrincipalSql`

**Files (Modify):** trocar a expressão de soma **só** onde a query soma `INVOICE_PAYMENT` (com ou sem `INVOICE_ANTICIPATION`) como pago/quitação de fatura:
- `API/src/controllers/invoiceController.js:156` (`fetchPaidByInvoice`)
- `API/index.cjs:557` (cascata do enrich), `:4644`, `:4650`, `:5113`, `:5119`, `:6717`, `:7258`, `:7287`, `:7298`, `:7369`
- `API/services/billingValidation.js:129`, `:135`, `:758`, `:764`
- `API/services/saldoAnterior.js:58`, `:84`
- `API/services/invoiceImmutabilityHealth.js:96`, `:105`, `:127`, `:140`
- `API/services/discrepanciasAudit.js:54`
- `API/services/dailyAudit.js` (bloco perto da linha 298), `API/src/controllers/adminUsersController.js:283`, `API/scripts/audit_helpers.cjs`, `API/scripts/sync_dias_atraso.cjs`: abrir cada um, achar a soma de `INVOICE_PAYMENT` e aplicar a mesma troca.

**NÃO trocar:** `src/routes/pix.routes.js:215` e `index.cjs:2738` (PIX); `invoiceController.js:841` (idempotência compara o valor cheio); `index.cjs:1135` (`paymentsTotal` só de exibição, tratado na Task 5); `discrepanciasAudit.js:48` (soma de REFUND); inserts do `cardRepo`.

**Interfaces:**
- Consumes: `paidPrincipalSql` (Task 1).

- [ ] **Step 1: Aplicar as trocas mecânicas**

Em cada arquivo, importar no topo, se ainda não houver:
```js
const { paidPrincipalSql } = require('<caminho relativo>/utils/invoiceMath');
```
(em `index.cjs`: `require('./utils/invoiceMath')`; em `src/controllers/*`: `require('../../utils/invoiceMath')`; em `services/*`: `require('../utils/invoiceMath')`; em `scripts/*`: `require('../utils/invoiceMath')`).

Padrões de troca:
```text
SUM(ABS(CAST(amount AS DECIMAL(15,2))))        ->  SUM(${paidPrincipalSql()})
SUM(ABS(CAST(t.amount AS DECIMAL(15,2))))      ->  SUM(${paidPrincipalSql('t')})
SUM(ABS(amount))                               ->  SUM(${paidPrincipalSql()})
ABS(CAST(t.amount AS DECIMAL(15,2))) AS coverage ->  ${paidPrincipalSql('t')} AS coverage
ABS(CAST(amount AS DECIMAL(15,2))) AS valor    ->  ${paidPrincipalSql()} AS valor
```
Exemplo concreto (`invoiceController.js:155-159`):
```js
        const rows = await dbService.executeQuery(`
            SELECT COALESCE(SUM(${paidPrincipalSql()}), 0) AS total
            FROM ${dbService.fq('transactions')}
            WHERE cpf = ${esc(cpf)} AND type = 'INVOICE_PAYMENT' AND invoice_id IS NOT NULL
        `);
```

- [ ] **Step 2: Conferir com grep que não sobrou soma de pagamento sem o helper**

Run: `git grep -n "ABS(CAST(\(t\.\)\?amount" -- API ":!API/tests" ":!API/coverage"`
Expected: sobram só os itens da lista "NÃO trocar" e linhas que não somam `INVOICE_PAYMENT`. Revisar cada sobra.

- [ ] **Step 3: Rodar a suíte unit**

Run: `npx jest --selectProjects unit`
Expected: mesmo resultado do baseline (Task 0). Se um teste falhar só porque compara o **texto literal** do SQL (ex.: `syncDiasAtraso.unit.test.js` → `ANCHOR_SQL`), atualizar a asserção para o novo fragmento, sem mudar o que ela verifica. Linhas antigas têm `applied_to_charges` NULL = 0, então nenhum valor numérico pode mudar.

- [ ] **Step 4: Commit**

```bash
git add -A API
git commit -m "refactor(api): somas de pagamento usam paidPrincipalSql (desconta encargos)"
```

---

### Task 3: Função pura `planOpenCyclePayment`

**Files:**
- Create: `API/services/openCyclePayment.js`
- Test: `API/tests/unit/openCyclePayment.unit.test.js`

**Interfaces:**
- Produces: `planOpenCyclePayment({ payAmount: number, pendingChargesTotal: number }) => { appliedToCharges: number, anticipation: number, markChargesPaid: boolean }`.

- [ ] **Step 1: Escrever os testes que falham**

```js
const { planOpenCyclePayment } = require('../../services/openCyclePayment');

describe('planOpenCyclePayment — pagamento com a fatura ABERTA (§25)', () => {
    test('caso 805: 3.329,46 com 929,46 de encargos → quita encargos e antecipa 2.400', () => {
        expect(planOpenCyclePayment({ payAmount: 3329.46, pendingChargesTotal: 929.46 }))
            .toEqual({ appliedToCharges: 929.46, anticipation: 2400, markChargesPaid: true });
    });

    test('não cobre todos os encargos → nada vai para encargos, tudo é antecipação', () => {
        expect(planOpenCyclePayment({ payAmount: 30, pendingChargesTotal: 50 }))
            .toEqual({ appliedToCharges: 0, anticipation: 30, markChargesPaid: false });
    });

    test('sem encargos pendentes → tudo é antecipação', () => {
        expect(planOpenCyclePayment({ payAmount: 550, pendingChargesTotal: 0 }))
            .toEqual({ appliedToCharges: 0, anticipation: 550, markChargesPaid: false });
    });

    test('paga exatamente os encargos → antecipação zero', () => {
        expect(planOpenCyclePayment({ payAmount: 50, pendingChargesTotal: 50 }))
            .toEqual({ appliedToCharges: 50, anticipation: 0, markChargesPaid: true });
    });

    test('tolerância de R$ 0,01 (mesma do pay): 49,99 quita 50,00 de encargos', () => {
        expect(planOpenCyclePayment({ payAmount: 49.99, pendingChargesTotal: 50 }))
            .toEqual({ appliedToCharges: 49.99, anticipation: 0, markChargesPaid: true });
    });

    test('entradas inválidas/negativas viram 0', () => {
        expect(planOpenCyclePayment({ payAmount: -10, pendingChargesTotal: undefined }))
            .toEqual({ appliedToCharges: 0, anticipation: 0, markChargesPaid: false });
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest tests/unit/openCyclePayment.unit.test.js`
Expected: FAIL com `Cannot find module '../../services/openCyclePayment'`.

- [ ] **Step 3: Implementar**

`API/services/openCyclePayment.js`:

```js
// Pagamento feito quando NÃO há fatura FECHADA com dívida — o cliente está pagando a
// fatura ABERTA (docs/REGRAS-NEGOCIO-FATURA.md §25). Regra única:
//  1. quita os encargos pendentes (billing_charges) — só se cobrir TODOS, com a mesma
//     tolerância de R$ 0,01 do pagamento total (invoiceController.pay);
//  2. o resto é ANTECIPAÇÃO da fatura que vai fechar: fica sem invoice_id até o
//     invoiceEngine vinculá-la à fatura recém-fechada.
// Função pura: o chamador grava appliedToCharges em transactions.applied_to_charges.
const round2 = (n) => Math.round(n * 100) / 100;

function planOpenCyclePayment({ payAmount, pendingChargesTotal }) {
    const pay = round2(Math.max(0, Number(payAmount) || 0));
    const charges = round2(Math.max(0, Number(pendingChargesTotal) || 0));
    const markChargesPaid = charges > 0 && pay >= charges - 0.01;
    const appliedToCharges = markChargesPaid ? Math.min(charges, pay) : 0;
    return { appliedToCharges, anticipation: round2(pay - appliedToCharges), markChargesPaid };
}

module.exports = { planOpenCyclePayment };
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest tests/unit/openCyclePayment.unit.test.js`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add API/services/openCyclePayment.js API/tests/unit/openCyclePayment.unit.test.js
git commit -m "feat(api): planOpenCyclePayment divide pagamento da fatura aberta"
```

---

### Task 4: `pay()` — grava `applied_to_charges` e ramo da fatura aberta

**Files:**
- Modify: `API/src/controllers/invoiceController.js` (`persistPaymentDistribution` :102-118; `pay` :762-1111)
- Test: `API/tests/integration/pagamentoFaturaAberta.integration.test.js` (criar)

**Interfaces:**
- Consumes: `planOpenCyclePayment` (Task 3); `paidPrincipalSql` (Task 1, já aplicado em `fetchPaidByInvoice` na Task 2).
- Produces: `persistPaymentDistribution({ cpf, invoices, payAmount, dateIso, description, appliedToCharges = 0 })`; resposta do ramo aberto `{ success: true, message: 'Fatura paga com sucesso.', anticipation, appliedToCharges }`; helper interno `notifyTotalPayment({ cpf, user, payAmount, cutoffIso })`.

- [ ] **Step 1: Criar o arquivo de teste de integração (cenários A, B, C no nível do banco)**

`API/tests/integration/pagamentoFaturaAberta.integration.test.js`:

```js
require('dotenv').config();
process.env.NODE_ENV = 'test';
process.env.PORT = '3993';

// Regra §25 (2026-09-25): pagamento com a fatura ABERTA = antecipação. Casos reais que
// motivaram: 805.357.576-54 e 777.666.555-44 (crédito fantasma na aberta) e
// 202.505.136-11 (pagou a mesma fatura duas vezes). CPFs 9999999998x são sintéticos.
const createInvoiceController = require('../../src/controllers/invoiceController');

const DIA = 86400000;
const iso = (ms) => new Date(ms).toISOString();

describe('Pagamento com fatura ABERTA = antecipação (§25)', () => {
    let db;
    let controller;
    let indexMod;
    const CPF = { A: '99999999981', B: '99999999982', C: '99999999983', D: '99999999984', L: '99999999985' };

    async function limpar(cpf) {
        for (const t of ['transactions', 'billing_charges', 'invoices', 'installment_plans', 'users']) {
            await db.executeQuery(`DELETE FROM fintech.${t} WHERE cpf = '${cpf}'`);
        }
    }
    async function criarUsuario(cpf, { dueInDays, status = 'adimplente', diasAtraso = 0 }) {
        const due = new Date(Date.now() + dueInDays * DIA);
        await db.executeQuery(`
            INSERT INTO fintech.users (id, cpf, full_name, email, password_hash, balance,
                credit_card_available_limit, credit_card_total_limit, account_status, days_overdue,
                credit_card_due_day, credit_card_invoice_due_date, role)
            VALUES ('test-ant-${cpf}', '${cpf}', 'Antecipacao ${cpf}', 'ant${cpf}@integration.com', 'pwd123', 10000.00,
                4500.00, 5000.00, '${status}', ${diasAtraso}, ${due.getDate()}, '${iso(due.getTime())}', 'customer')
        `);
    }
    async function compra(cpf, valor, diasAtras) {
        await db.executeQuery(`
            INSERT INTO fintech.transactions (id, cpf, type, amount, description, date)
            VALUES ('tx-${cpf}-${diasAtras}', '${cpf}', 'SHOP_CREDIT', -${valor.toFixed(2)}, 'Compra teste', '${iso(Date.now() - diasAtras * DIA)}')
        `);
    }
    async function encargo(cpf, valor) {
        await db.executeQuery(`
            INSERT INTO fintech.billing_charges (id, cpf, invoice_reference, charge_type, amount, status)
            VALUES ('bc-${cpf}', '${cpf}', '2026-09', 'multa', ${valor.toFixed(2)}, 'pending')
        `);
    }
    async function fechada(cpf, id, valor, venceuHaDias) {
        await db.executeQuery(`
            INSERT INTO fintech.invoices (id, cpf, status, valor_total, valor_pago, due_date)
            VALUES ('${id}', '${cpf}', 'FECHADA', ${valor.toFixed(2)}, 0.00, '${iso(Date.now() - venceuHaDias * DIA)}')
        `);
    }
    const novaRes = () => ({ status: jest.fn(function () { return this; }), json: jest.fn() });
    async function pagar(cpf, amount) {
        const res = novaRes();
        const body = { cpf, pin: '1234' };
        if (amount != null) body.amount = amount;
        await controller.pay({ user: { cpf }, body }, res);
        return res;
    }
    async function enrich(cpf) {
        const u = indexMod.normalizeUser(await indexMod.usersRepo.findByCpf(cpf));
        await indexMod.enrichUserCreditCardData(u, cpf);
        return u.creditCard;
    }
    const pagamentos = (cpf) => db.executeQuery(`
        SELECT amount, invoice_id, applied_to_charges FROM fintech.transactions
        WHERE cpf = '${cpf}' AND type = 'INVOICE_PAYMENT' ORDER BY date
    `);
    const encargosPendentes = async (cpf) => parseInt((await db.executeQuery(
        `SELECT COUNT(*)::int AS n FROM fintech.billing_charges WHERE cpf = '${cpf}' AND status = 'pending'`
    ))[0].n, 10);

    beforeAll(async () => {
        indexMod = require('../../index.cjs');
        await indexMod.bootstrap();
        db = require('../../repositories/context').getDb();
        if (!db) throw new Error('Banco não inicializado após bootstrap do módulo.');
        for (const cpf of Object.values(CPF)) await limpar(cpf);

        controller = createInvoiceController({
            dbService: db,
            repoContext: { esc: require('../../repositories/context').esc },
            cardRepo: require('../../repositories/cardRepo'),
            usersRepo: indexMod.usersRepo,
            fetchUnpaidClosedInvoices: indexMod.fetchUnpaidClosedInvoices,
            notificationsRepo: require('../../repositories/notificationsRepo'),
            invoiceRepo: require('../../repositories/invoiceRepo'),
            enrichUserCreditCardData: indexMod.enrichUserCreditCardData,
            normalizeUser: indexMod.normalizeUser,
            paymentGeneratorScriptPath: 'placeholder'
        });
    }, 60000);

    afterAll(async () => {
        for (const cpf of Object.values(CPF)) await limpar(cpf);
    });

    it('A: paga encargos + antecipa o resto, sem apagar nada do ciclo', async () => {
        await criarUsuario(CPF.A, { dueInDays: 25 });
        await compra(CPF.A, 500, 1);
        await encargo(CPF.A, 50);
        // Pré-condição: a compra está na janela da fatura aberta.
        expect((await enrich(CPF.A)).currentInvoiceTotal).toBeCloseTo(550, 2);

        const res = await pagar(CPF.A, 550);
        expect(res.json.mock.calls[0][0].success).toBe(true);

        const [tx] = await pagamentos(CPF.A);
        expect(parseFloat(tx.amount)).toBe(-550);
        expect(tx.invoice_id).toBeNull();
        expect(parseFloat(tx.applied_to_charges)).toBe(50);
        expect(await encargosPendentes(CPF.A)).toBe(0);

        const [u] = await db.executeQuery(`SELECT balance, credit_card_available_limit FROM fintech.users WHERE cpf = '${CPF.A}'`);
        expect(parseFloat(u.balance)).toBe(9450);
        expect(parseFloat(u.credit_card_available_limit)).toBe(5000); // 4500 + 500 antecipados
        const compras = await db.executeQuery(`SELECT id FROM fintech.transactions WHERE cpf = '${CPF.A}' AND type = 'SHOP_CREDIT'`);
        expect(compras).toHaveLength(1);
    }, 30000);

    it('B: abaixo dos encargos → encargos ficam pendentes, tudo é antecipação', async () => {
        await criarUsuario(CPF.B, { dueInDays: 25 });
        await compra(CPF.B, 500, 1);
        await encargo(CPF.B, 50);

        const res = await pagar(CPF.B, 30);
        expect(res.json.mock.calls[0][0].success).toBe(true);

        const [tx] = await pagamentos(CPF.B);
        expect(tx.invoice_id).toBeNull();
        expect(parseFloat(tx.applied_to_charges)).toBe(0);
        expect(await encargosPendentes(CPF.B)).toBe(1);
    }, 30000);

    it('C: pagamento total de FECHADA grava a parte dos encargos', async () => {
        await criarUsuario(CPF.C, { dueInDays: 20, status: 'inadimplente', diasAtraso: 10 });
        await fechada(CPF.C, 'inv-ant-C', 1000, 10);
        await encargo(CPF.C, 50);

        const res = await pagar(CPF.C); // sem amount = principal + encargos = 1050
        expect(res.json.mock.calls[0][0].success).toBe(true);

        const [tx] = await pagamentos(CPF.C);
        expect(parseFloat(tx.amount)).toBe(-1050);
        expect(tx.invoice_id).toBe('inv-ant-C');
        expect(parseFloat(tx.applied_to_charges)).toBe(50);
    }, 30000);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest tests/integration/pagamentoFaturaAberta.integration.test.js`
Expected: A e B FAIL, porque o ramo legado responde 400 "Nenhuma fatura em aberto" (soma de `INVOICE_INSTALLMENT` = 0). C FAIL em `applied_to_charges`, que chega `null`.

- [ ] **Step 3: `persistPaymentDistribution` grava `applied_to_charges`**

Em `invoiceController.js:102-118`, trocar a assinatura e o INSERT:

```js
    async function persistPaymentDistribution({ cpf, invoices, payAmount, dateIso, description, appliedToCharges = 0 }) {
        const { esc } = repoContext;
        const round2 = n => Math.round(n * 100) / 100;
        const payId = dbService.generateUUID();
        const amount = round2(payAmount);
        if (amount <= 0.005) return [];
        // Vínculo na fatura MAIS RECENTE em aberto (a que ancora o comprovante).
        // A quitação das demais é derivada por cascata na leitura — o invoice_id
        // aqui é apenas a âncora do lançamento no extrato.
        // applied_to_charges: parte deste pagamento que quitou billing_charges. Sempre
        // gravado (0 quando nada) — NULL fica reservado às linhas anteriores à §25.
        const anchor = invoices[invoices.length - 1] || null;
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date, invoice_id, applied_to_charges)
            VALUES (${esc(payId)}, ${esc(cpf)}, 'INVOICE_PAYMENT', ${esc((-amount).toFixed(2))}, ${esc(description)}, NULL, NULL, NULL, ${esc(dateIso)}, ${anchor ? esc(anchor.id) : 'NULL'}, ${round2(appliedToCharges).toFixed(2)})
        `);
        return [{ invoiceId: anchor ? anchor.id : null, amount }];
    }
```

- [ ] **Step 4: Devido da fatura aberta vem do enrich (substitui o ramo legado :789-799 e :814)**

```js
        let totalDue;
        let openCycleDue = null;
        if (closedDebt) {
            totalDue = closedDebt.owed;
        } else {
            // Sem fatura FECHADA com dívida: o cliente está pagando a fatura ABERTA (§25).
            // O devido é o MESMO total da tela (enrich: compras do ciclo + parcelas
            // projetadas + encargos herdados − antecipações já feitas). A soma antiga de
            // INVOICE_INSTALLMENT lançadas ignorava compras à vista e parcelas projetadas,
            // e o que o cliente pagava a mais sumia (805/777/2025, 2026-09).
            const _openUser = normalizeUser(user);
            await enrichUserCreditCardData(_openUser, cpf);
            openCycleDue = Math.round(parseFloat(_openUser.creditCard?.currentInvoiceTotal || 0) * 100) / 100;
            totalDue = openCycleDue;
        }
```

E na linha `const totalDueComplete = ...` (:814):

```js
        // Fatura aberta: currentInvoiceTotal já inclui os encargos herdados.
        const totalDueComplete = closedDebt
            ? Math.round((totalDue + pendingChargesTotal) * 100) / 100
            : openCycleDue;
```

- [ ] **Step 5: Desviar para `payOpenCycle` logo depois da checagem de saldo (:864)**

```js
        if (balance < payAmount) return res.status(400).json({ success: false, message: 'Saldo insuficiente.' });

        if (!closedDebt) {
            return payOpenCycle({ cpf, user, payAmount, pendingChargesTotal, cutoffIso, res });
        }
```

- [ ] **Step 6: Extrair `notifyTotalPayment` e criar `payOpenCycle`**

No topo do arquivo, junto dos outros `require`:
```js
const { planOpenCyclePayment } = require('../../services/openCyclePayment');
```

Dentro da factory, antes de `const pay = async`, adicionar os dois helpers. `notifyTotalPayment` recebe o corpo **exato** das linhas 1070-1110 atuais (notificação + comprovante + SSE):

```js
    // Pós-resposta do pagamento TOTAL (fechada ou aberta): notificação, comprovante e
    // SSE. Fire-and-forget com .catch() — a resposta já foi enviada.
    function notifyTotalPayment({ cpf, user, payAmount, cutoffIso }) {
        notificationsRepo.addNotification({
            cpf,
            title: 'Pagamento de fatura',
            message: [
                '💵 <b>COMPROVANTE DE PAGAMENTO INTEGRAL</b>',
                '',
                `<b>Cliente</b>    ${user.full_name}`,
                `<b>CPF</b>        <code>${telegramService.formatCpf(cpf)}</code>`,
                '',
                `<b>Valor pago</b> <code>R$ ${brl(payAmount)}</code>`,
                `<b>Vencimento</b> ${diaBR(cutoffIso)}`,
                `<b>Pago em</b>    ${dataBR(nowDb())}`,
                '',
                '<b>Status</b>     QUITADO ✅',
                '',
                '<blockquote>Limite de crédito reestabelecido e conta regularizada com sucesso.</blockquote>'
            ].join('\n'),
            actionUrl: '/dashboard'
        }).catch((erro) => console.error('[pay] notificação total falhou (ignorado):', erro && erro.message));
        Promise.resolve(sendPaymentReceipt(cpf, user, {
            valorPago: payAmount,
            tipo: 'TOTAL',
            saldoRestante: 0,
            dataPagamento: nowDb(),
            vencimento: cutoffIso,
            nota: 'Limite de crédito reestabelecido e conta regularizada com sucesso.'
        })).catch((erro) => console.error('[pay] comprovante total falhou (ignorado):', erro && erro.message));
        try {
            const sse = require('../../services/sseService');
            sse.sendToClient(cpf, 'payment.completed', {
                cpf,
                amount: payAmount,
                type: 'full',
                timestamp: new Date().toISOString(),
            });
        } catch (_sseErr) { /* SSE é fire-and-forget */ }
    }

    // Pagamento da fatura ABERTA (§25): quita os encargos pendentes se cobrir todos; o
    // resto é ANTECIPAÇÃO — fica sem invoice_id até o invoiceEngine vinculá-lo à fatura
    // que fecha. NÃO apaga INVOICE_INSTALLMENT nem avança plano: a fatura fecha com as
    // compras/parcelas do ciclo e a antecipação vinculada as quita pela cascata.
    async function payOpenCycle({ cpf, user, payAmount, pendingChargesTotal, cutoffIso, res }) {
        const { esc } = repoContext;
        const plan = planOpenCyclePayment({ payAmount, pendingChargesTotal });
        await persistPaymentDistribution({
            cpf,
            invoices: [],
            payAmount,
            dateIso: nowDb(),
            description: 'Pagamento fatura',
            appliedToCharges: plan.appliedToCharges
        });
        await usersRepo.updateBalance(cpf, (parseFloat(user.balance || 0) - payAmount).toFixed(2));
        if (plan.markChargesPaid) {
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('billing_charges')}
                SET status = 'paid'
                WHERE cpf = ${esc(cpf)} AND status = 'pending'
            `);
        }
        const totalLimit = parseFloat(user.credit_card_total_limit || 0);
        const availableLimit = parseFloat(user.credit_card_available_limit || 0);
        const restoredLimit = Math.min(totalLimit, availableLimit + plan.anticipation);
        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')}
            SET credit_card_available_limit = ${restoredLimit.toFixed(2)}
            WHERE cpf = ${esc(cpf)}
        `);
        res.json({ success: true, message: 'Fatura paga com sucesso.', anticipation: plan.anticipation, appliedToCharges: plan.appliedToCharges });
        notifyTotalPayment({ cpf, user, payAmount, cutoffIso });
    }
```

No ramo TOTAL, trocar o bloco pós-resposta (:1070-1110) por:
```js
        notifyTotalPayment({ cpf, user, payAmount, cutoffIso });
```

- [ ] **Step 7: Ramo TOTAL de FECHADA grava a parte dos encargos**

Mover o cálculo de `pagouEncargos` para **antes** de `persistPaymentDistribution` (:1011) e passar a parte:

```js
        const pagouEncargos = payAmount >= totalDueComplete - 0.01;
        await persistPaymentDistribution({
            cpf,
            invoices: closedDebt?.invoices || [],
            payAmount,
            dateIso: nowDb(),
            description: 'Pagamento fatura',
            // Encargos pagos junto do principal: sem isto a cascata contava esses
            // reais como principal e sobrava saldo credor fantasma (§25).
            appliedToCharges: pagouEncargos ? pendingChargesTotal : 0
        });
```
Remover a declaração duplicada `const pagouEncargos = ...` que ficava em :1053; o `if (pagouEncargos)` que marca `paid` continua igual. No ramo PARCIAL/MÍNIMO (:888) nada muda: o default `appliedToCharges = 0` vale.

- [ ] **Step 8: Rodar e ver passar**

Run: `npx jest tests/integration/pagamentoFaturaAberta.integration.test.js`
Expected: PASS (A, B, C).

Também: `npx jest tests/integration/invoicePaymentIdempotencia.integration.test.js tests/integration/invoicePaymentCompleto.integration.test.js`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add API/src/controllers/invoiceController.js API/tests/integration/pagamentoFaturaAberta.integration.test.js
git commit -m "fix(api): pagamento com fatura aberta vira antecipação e grava applied_to_charges"
```

---

### Task 5: Enrich — resíduo só com pago vinculado, antecipação abate a aberta

**Files:**
- Modify: `API/index.cjs` (`enrichUserCreditCardData`: :1111-1177 e :1281-1292)
- Test: `API/tests/integration/pagamentoFaturaAberta.integration.test.js` (acrescentar)

**Interfaces:**
- Consumes: `paidPrincipalSql` (Task 1); linhas gravadas pela Task 4.
- Produces: `creditCard.antecipacoesFaturaAberta: number` (novo); `currentInvoiceTotal`, `currentInvoiceMinimo` e `creditoExcedente` com a regra da §25.

- [ ] **Step 1: Acrescentar os testes que falham (dentro do `describe`, depois do cenário C)**

```js
    it('A (enrich): antecipação abate a aberta — total 0, sem saldo credor', async () => {
        const cc = await enrich(CPF.A);
        expect(cc.antecipacoesFaturaAberta).toBeCloseTo(500, 2);
        expect(cc.currentInvoiceTotal).toBeCloseTo(0, 2);
        expect(cc.creditoExcedente).toBeCloseTo(0, 2);
        expect(cc.closedInvoiceResidual).toBeCloseTo(0, 2);
    }, 30000);

    it('B (enrich): aberta = compras + encargos pendentes − antecipação', async () => {
        const cc = await enrich(CPF.B);
        expect(cc.currentInvoiceTotal).toBeCloseTo(520, 2); // 500 + 50 − 30
    }, 30000);

    it('C (enrich): encargos pagos junto NÃO viram saldo credor', async () => {
        const cc = await enrich(CPF.C);
        expect(cc.closedInvoiceResidual).toBeCloseTo(0, 2); // antes: −50
        expect(cc.currentInvoiceTotal).toBeCloseTo(0, 2);
    }, 30000);

    it('L: pagamento órfão LEGADO (applied_to_charges NULL) não vira crédito', async () => {
        await criarUsuario(CPF.L, { dueInDays: 25 });
        await fechada(CPF.L, 'inv-ant-L', 1000, 40);
        await db.executeQuery(`
            INSERT INTO fintech.transactions (id, cpf, type, amount, description, date, invoice_id)
            VALUES ('tx-L-pago', '${CPF.L}', 'INVOICE_PAYMENT', -1000.00, 'Pagamento fatura', '${iso(Date.now() - 35 * DIA)}', 'inv-ant-L'),
                   ('tx-L-orfao', '${CPF.L}', 'INVOICE_PAYMENT', -300.00, 'Pagamento fatura', '${iso(Date.now() - 2 * DIA)}', NULL)
        `);
        await compra(CPF.L, 200, 1);

        const cc = await enrich(CPF.L);
        expect(cc.closedInvoiceResidual).toBeCloseTo(0, 2);
        expect(cc.antecipacoesFaturaAberta).toBeCloseTo(0, 2);
        expect(cc.currentInvoiceTotal).toBeCloseTo(200, 2); // antes: 0 (órfão virava crédito)
    }, 30000);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest tests/integration/pagamentoFaturaAberta.integration.test.js -t enrich`
Expected: FAIL em `antecipacoesFaturaAberta` (undefined), em B (550 em vez de 520) e em L (0 em vez de 200).

- [ ] **Step 3: Resíduo das fechadas só com pago vinculado (:1161-1177)**

Trocar o bloco `_originalPrincipal ... if (paymentsTotal > 0) { ... }` por:

```js
    // Só pagamento VINCULADO (invoice_id) quita fatura fechada — mesma regra do
    // getClosedInvoiceDebt/fetchPaidByInvoice. A antiga "rede de segurança"
    // max(valor_pago, paymentsTotal da janela) somava pagamento sem vínculo e
    // INVOICE_ANTICIPATION como se tivessem pago a fechada: crédito fantasma
    // (805/777, 2026-09). Antecipação da regra §25 abate a ABERTA, logo abaixo.
    const _originalPrincipal = parseFloat(normalized.creditCard._closedInvoiceValorTotal || 0);
    const _dbValorPago = parseFloat(normalized.creditCard._closedInvoiceValorPago || 0);
    const _residualPrincipal = _originalPrincipal - _dbValorPago;
    // Saldo credor (pagou além do principal, vinculado) = residual NEGATIVO
    normalized.creditCard.closedInvoiceResidual = Math.round(_residualPrincipal * 100) / 100;
```

- [ ] **Step 4: Remover a fórmula antiga do `creditoExcedente` (:1111-1150) e somar as antecipações**

Manter só a query de `paymentsTotal` (exibição) e acrescentar a de antecipações:

```js
    // —— Pagamentos do ciclo (exibição) e antecipações da fatura aberta (§25) ——
    let paymentsTotal = 0;
    let antecipacoesAberta = 0;
    try {
        const paymentsCycle = await dbService.executeQuery(`
            SELECT COALESCE(SUM(ABS(amount)), 0) AS total
            FROM ${dbService.fq('transactions')}
            WHERE cpf = '${cpf}'
              AND type IN ('INVOICE_PAYMENT', 'INVOICE_ANTICIPATION')
              AND date > '${new Date(_prevCloseMs).toISOString()}'
              AND date <= '${new Date(maxDueTime).toISOString()}'
        `);
        paymentsTotal = parseFloat(paymentsCycle[0]?.total || 0);

        // Antecipação = pagamento da regra §25 (applied_to_charges NOT NULL) ainda sem
        // vínculo: pertence ao ciclo que ainda não fechou (o invoiceEngine vincula no
        // fechamento). Órfão legado (NULL) fica de fora — o fluxo antigo já o consumiu.
        const antRows = await dbService.executeQuery(`
            SELECT COALESCE(SUM(${paidPrincipalSql()}), 0) AS total
            FROM ${dbService.fq('transactions')}
            WHERE cpf = '${cpf}' AND type = 'INVOICE_PAYMENT'
              AND invoice_id IS NULL AND applied_to_charges IS NOT NULL
        `);
        antecipacoesAberta = parseFloat(antRows[0]?.total || 0);
    } catch (err) {
        console.warn('Erro ao calcular pagamentos/antecipações do ciclo:', err.message);
    }
    normalized.creditCard.paymentsTotal = paymentsTotal;
    normalized.creditCard.antecipacoesFaturaAberta = round2(antecipacoesAberta);
```
(`paidPrincipalSql` já foi importado em `index.cjs` na Task 2.) Conferir com `git grep -n "creditoExcedente" -- API/index.cjs` que não sobra leitura da variável antiga.

- [ ] **Step 5: Total da aberta, mínimo e crédito excedente (:1281-1292)**

```js
        const _openPurchases = normalized.creditCard.currentInvoice || 0;
        const _closedPrincipalResidual = normalized.creditCard.closedInvoiceResidual || 0;
        const _encargosHerdados = _summary.totalEncargos || 0;
        // Antecipações (§25) abatem a aberta; o que passar do total vira saldo credor.
        const _antecipacoes = normalized.creditCard.antecipacoesFaturaAberta || 0;
        const _rawOpen = _openPurchases + _closedPrincipalResidual + _encargosHerdados - _antecipacoes;
        normalized.creditCard.currentInvoiceTotal = round2(Math.max(0, _rawOpen));
        // Mínimo consolidado: 10% das compras + 100% do residual + 100% dos encargos − antecipações
        normalized.creditCard.currentInvoiceMinimo = round2(Math.max(0, _openPurchases * 0.10 + _closedPrincipalResidual + _encargosHerdados - _antecipacoes));
        normalized.creditCard.creditoExcedente = round2(Math.max(0, -_rawOpen));
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx jest tests/integration/pagamentoFaturaAberta.integration.test.js`
Expected: PASS (A, B, C, A-enrich, B-enrich, C-enrich, L).
Run: `npx jest --selectProjects unit`
Expected: igual ao baseline.

- [ ] **Step 7: Commit**

```bash
git add API/index.cjs API/tests/integration/pagamentoFaturaAberta.integration.test.js
git commit -m "fix(api): enrich abate antecipação na aberta e para de somar pagamento sem vínculo"
```

---

### Task 6: `invoiceEngine` vincula a antecipação à fatura que fecha

**Files:**
- Modify: `API/services/invoiceEngine.js` (logo depois do `INSERT INTO invoices`, :234-237)
- Test: `API/tests/integration/pagamentoFaturaAberta.integration.test.js` (acrescentar)

**Interfaces:**
- Consumes: linhas da Task 4 (`invoice_id NULL`, `applied_to_charges NOT NULL`).
- Produces: `transactions.invoice_id` = id da fatura recém-fechada.

- [ ] **Step 1: Acrescentar o teste que falha (caso 20250513611)**

```js
    it('D: antecipação é vinculada no fechamento — a fatura NÃO é cobrada de novo', async () => {
        // Vence em 2 dias → corte (vencimento − 5 dias) já passou: o engine fecha agora.
        await criarUsuario(CPF.D, { dueInDays: 2 });
        await compra(CPF.D, 500, 4);
        expect((await enrich(CPF.D)).currentInvoiceTotal).toBeCloseTo(500, 2); // pré-condição

        expect((await pagar(CPF.D, 500)).json.mock.calls[0][0].success).toBe(true);

        await require('../../services/invoiceEngine').runEngine(CPF.D);

        const inv = await db.executeQuery(`SELECT id, valor_total FROM fintech.invoices WHERE cpf = '${CPF.D}' AND status = 'FECHADA'`);
        expect(inv).toHaveLength(1);
        expect(parseFloat(inv[0].valor_total)).toBe(500);
        const [tx] = await pagamentos(CPF.D);
        expect(tx.invoice_id).toBe(inv[0].id);

        // Antes da §25 isto cobrava os 500 de novo (pagamento em dobro).
        const res2 = await pagar(CPF.D);
        expect(res2.status).toHaveBeenCalledWith(400);
        expect((await pagamentos(CPF.D))).toHaveLength(1);
    }, 60000);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest tests/integration/pagamentoFaturaAberta.integration.test.js -t "D:"`
Expected: FAIL em `tx.invoice_id` (null).

- [ ] **Step 3: Vincular no fechamento**

Em `invoiceEngine.js`, logo depois do `INSERT INTO ${db.fq('invoices')} ...` (:234-237):

```js
        // Antecipações (pagamento feito com a fatura ABERTA, §25) passam a quitar a
        // fatura que acabou de fechar. Sem o vínculo, getClosedInvoiceDebt cobrava a
        // fatura cheia e o cliente pagava 2× (caso 20250513611, 2026-09). Só linhas da
        // regra nova (applied_to_charges NOT NULL): o órfão legado já foi consumido pelo
        // fluxo antigo e vinculá-lo criaria crédito fantasma. INVOICE_ANTICIPATION fica
        // de fora — ela já apagou as parcelas que antecipou (cardRepo.anticipateInstallments).
        await db.executeQuery(`
          UPDATE ${db.fq('transactions')}
          SET invoice_id = ${esc(invoiceId)}
          WHERE cpf = ${esc(user.cpf)} AND type = 'INVOICE_PAYMENT'
            AND invoice_id IS NULL AND applied_to_charges IS NOT NULL
        `);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest tests/integration/pagamentoFaturaAberta.integration.test.js`
Expected: PASS (todos). Também: `npx jest tests/integration/engineIdempotency.integration.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add API/services/invoiceEngine.js API/tests/integration/pagamentoFaturaAberta.integration.test.js
git commit -m "fix(api): invoiceEngine vincula antecipação à fatura que fecha"
```

---

### Task 7: CSV da planilha de controle — paridade + coluna final `tbl_pago_encargos`

**Files:**
- Modify: `API/utils/tblDeMassasExport.cjs` (`buildQuery`, :43-279)
- Test: `API/tests/unit/tblDeMassasExport.unit.test.js` (criar); `API/tests/integration/pagamentoFaturaAberta.integration.test.js` (acrescentar)

**Interfaces:**
- Consumes: coluna `applied_to_charges` (Task 1); regra do enrich (Task 5).
- Produces: coluna CSV `tbl_pago_encargos` = soma de `applied_to_charges` dos `INVOICE_PAYMENT` da massa (0 se nenhum). **Última coluna**; as 40 existentes não mudam de nome nem posição.

- [ ] **Step 1: Escrever o teste unit que falha**

`API/tests/unit/tblDeMassasExport.unit.test.js`:

```js
const { buildQuery } = require('../../utils/tblDeMassasExport.cjs');

// Ordem exata que a planilha de controle espera hoje. Coluna nova SEMPRE no fim —
// inserir no meio desloca o carregamento da planilha (pedido do usuário, 2026-09-25).
const COLUNAS_EXISTENTES = [
    'id_massa', 'cpf', 'dia_vencimento', 'nome_completo', 'saldo_conta', 'limite_utilizado',
    'limite_disponivel', 'fatura_fechada', 'fatura_aberta', 'status_fatura_fechada', 'dias_atraso', 'status',
    'cartao_fisico_numero', 'cartao_fisico_cvv', 'cartao_virtual_numero', 'cartao_virtual_cvv', '"data_criação"',
    'tbl_ven', 'tbl_corte', 'tbl_schema',
    'tbl_pf_valor_parcela', 'tbl_pf_saldo_financiado', 'tbl_pf_iof_total', 'tbl_pf_iof_adicional', 'tbl_pf_cet_anual',
    'tbl_pf_prazo', 'tbl_pf_data_contratacao',
    'tbl_pa_valor_pagamento', 'tbl_pa_minimo', 'tbl_pa_piso', 'tbl_pa_valor_parcela', 'tbl_pa_saldo_financiado',
    'tbl_pa_iof_total', 'tbl_pa_cet_anual', 'tbl_pa_data_contratacao',
    'tbl_reneg', 'tbl_pf_elegivel', 'tbl_pf_valor_ativacao_automatica', 'tbl_cemiterio_teste', 'tbl_cemiterio_teste_motivo',
];

function colunasDoSelectFinal(sql) {
    const m = sql.match(/\)\s*SELECT([\s\S]*?)FROM todas_massas/);
    if (!m) throw new Error('SELECT final não encontrado no buildQuery');
    return m[1].split(',').map((s) => s.trim());
}

describe('tblDeMassasExport.buildQuery — contrato de colunas do CSV', () => {
    test('colunas existentes mantêm ordem e tbl_pago_encargos é a ÚLTIMA', () => {
        const cols = colunasDoSelectFinal(buildQuery());
        expect(cols.slice(0, COLUNAS_EXISTENTES.length)).toEqual(COLUNAS_EXISTENTES);
        expect(cols).toHaveLength(COLUNAS_EXISTENTES.length + 1);
        expect(cols[cols.length - 1]).toBe('tbl_pago_encargos');
    });

    test('pagos_totais só conta pagamento vinculado e desconta a parte dos encargos (§25)', () => {
        const sql = buildQuery();
        expect(sql).toMatch(/WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NOT NULL/);
        expect(sql).toContain('COALESCE(applied_to_charges, 0)');
        expect(sql).toMatch(/invoice_id IS NULL AND applied_to_charges IS NOT NULL/);
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest tests/unit/tblDeMassasExport.unit.test.js`
Expected: FAIL (40 colunas; última `tbl_cemiterio_teste_motivo`).

- [ ] **Step 3: Alterar `buildQuery`**

(a) Trocar o CTE `pagos_totais` (:45-50) e acrescentar dois CTEs logo depois dele:

```sql
WITH pagos_totais AS (
    -- Só o que abateu PRINCIPAL de fatura FECHADA: pagamento vinculado (invoice_id) e
    -- sem a parte que foi para encargos (applied_to_charges). Mesma regra do enrich
    -- (docs/REGRAS-NEGOCIO-FATURA.md §25) — somar pagamento sem vínculo e encargos
    -- gerava saldo credor fantasma (805/777, 2026-09).
    SELECT cpf,
           SUM(ABS(amount) - COALESCE(applied_to_charges, 0)) AS total_pago,
           MAX(date) AS ultimo_pagamento
    FROM fintech.transactions
    WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NOT NULL
    GROUP BY cpf
),
antecipacoes AS (
    -- Pagamento feito com a fatura ABERTA (§25) ainda não vinculado pelo invoiceEngine:
    -- abate a fatura aberta. Órfão legado (applied_to_charges NULL) fica de fora.
    SELECT cpf, SUM(ABS(amount) - COALESCE(applied_to_charges, 0)) AS total
    FROM fintech.transactions
    WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NULL AND applied_to_charges IS NOT NULL
    GROUP BY cpf
),
pago_encargos AS (
    -- tbl_pago_encargos: quanto dos pagamentos da massa foi para encargos (billing_charges).
    SELECT cpf, SUM(applied_to_charges) AS total
    FROM fintech.transactions
    WHERE type = 'INVOICE_PAYMENT' AND applied_to_charges IS NOT NULL
    GROUP BY cpf
),
```

(b) Em `todas_massas`, trocar a linha de `fatura_aberta` (:207):

```sql
        GREATEST(0, COALESCE(cc.total, 0) + COALESCE(fc.residual_total_fechadas, 0) + COALESCE(eh.total, 0) - COALESCE(an.total, 0)) AS fatura_aberta,
```

(c) Em `todas_massas`, logo depois de `ARRAY_TO_STRING(ct.tipos_anomalia, ', ') AS tbl_cemiterio_teste_motivo,` (:256):

```sql
        -- tbl_pago_encargos: SEMPRE a última coluna do CSV (a planilha de controle
        -- carrega por posição — coluna nova vai no fim, nunca no meio).
        COALESCE(pe.total, 0)                                        AS tbl_pago_encargos,
```

(d) Nos `LEFT JOIN` de `todas_massas` (depois de `LEFT JOIN cemiterio_teste ct ...`, :267):

```sql
    LEFT JOIN antecipacoes      an ON an.cpf = u.cpf
    LEFT JOIN pago_encargos     pe ON pe.cpf = u.cpf
```

(e) No SELECT final (:275), acrescentar ao fim da lista:

```sql
       tbl_reneg, tbl_pf_elegivel, tbl_pf_valor_ativacao_automatica, tbl_cemiterio_teste, tbl_cemiterio_teste_motivo,
       tbl_pago_encargos
```

- [ ] **Step 4: Rodar o unit e ver passar**

Run: `npx jest tests/unit/tblDeMassasExport.unit.test.js`
Expected: PASS.

- [ ] **Step 5: Paridade CSV × enrich no banco real (acrescentar ao integration)**

```js
    it('CSV: fatura_aberta bate com o enrich e tbl_pago_encargos é a última coluna', async () => {
        const { buildQuery } = require('../../utils/tblDeMassasExport.cjs');
        for (const cpf of [CPF.A, CPF.B, CPF.L]) {
            const [row] = await db.executeQuery(buildQuery({ cpf }));
            const cc = await enrich(cpf);
            expect(parseFloat(row.fatura_aberta)).toBeCloseTo(cc.currentInvoiceTotal, 2);
            expect(Object.keys(row).pop()).toBe('tbl_pago_encargos');
        }
        const [rowA] = await db.executeQuery(buildQuery({ cpf: CPF.A }));
        expect(parseFloat(rowA.tbl_pago_encargos)).toBe(50);
    }, 30000);
```

Run: `npx jest tests/integration/pagamentoFaturaAberta.integration.test.js -t CSV`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add API/utils/tblDeMassasExport.cjs API/tests/unit/tblDeMassasExport.unit.test.js API/tests/integration/pagamentoFaturaAberta.integration.test.js
git commit -m "feat(api): CSV de massas com paridade da §25 e coluna final tbl_pago_encargos"
```

---

### Task 8: Health check não acusa antecipação legítima

**Files:**
- Modify: `API/services/invoiceImmutabilityHealth.js` (query de órfãos, :66-79)
- Test: `API/tests/unit/invoiceImmutabilityHealth.unit.test.js`

**Interfaces:**
- Consumes: `applied_to_charges` (Task 1).

- [ ] **Step 1: Escrever o teste que falha (acrescentar ao `describe` existente)**

```js
  test('PAYMENT_SEM_INVOICE_ID ignora antecipação da §25 ainda dentro do prazo de vínculo', async () => {
    const queries = [];
    mockDbService = {
      executeQuery: jest.fn().mockImplementation((sql) => {
        queries.push(sql);
        if (sql.includes("name LIKE '%005%'")) return Promise.resolve([{ created_at: '2026-08-01T00:00:00.000Z' }]);
        return Promise.resolve([]);
      }),
      fq: jest.fn(t => `fintech.${t}`)
    };

    await runInvoiceImmutabilityHealth(mockDbService, mockAuditLog);

    const orfaos = queries.find(q => q.includes('t.invoice_id IS NULL'));
    expect(orfaos).toContain('t.applied_to_charges IS NULL OR t.date <');
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest tests/unit/invoiceImmutabilityHealth.unit.test.js`
Expected: FAIL no novo teste.

- [ ] **Step 3: Implementar**

Antes da query de órfãos (perto de :66), calcular o prazo em JS:

```js
        // Antecipação da §25 fica sem invoice_id até o fechamento do ciclo (≤ ~35 dias).
        // Só vira anomalia se passar disso — ou se for órfão legado (applied_to_charges NULL).
        const antecipacaoVencida = new Date(Date.now() - 40 * 86400000).toISOString();
```

E na query, logo depois de `AND t.invoice_id IS NULL` (:74):

```sql
              AND (t.applied_to_charges IS NULL OR t.date < '${antecipacaoVencida}'::timestamptz)
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest tests/unit/invoiceImmutabilityHealth.unit.test.js`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add API/services/invoiceImmutabilityHealth.js API/tests/unit/invoiceImmutabilityHealth.unit.test.js
git commit -m "fix(api): health check não acusa antecipação dentro do prazo de vínculo"
```

---

### Task 9: Documentar a regra e verificar tudo

**Files:**
- Modify: `docs/REGRAS-NEGOCIO-FATURA.md` (nova seção no fim, depois da §24)

- [ ] **Step 1: Escrever a §25**

```markdown
## 25. Pagamento com fatura ABERTA = antecipação

Vale quando o cliente paga e **não há fatura FECHADA com dívida**.

- **Encargos primeiro:** o pagamento quita os `billing_charges` pendentes, só se
  cobrir **todos** (tolerância R$ 0,01). A parte vai para
  `transactions.applied_to_charges`.
- **O resto é antecipação:** fica em UM `INVOICE_PAYMENT` com `invoice_id NULL`
  (1 pagamento = 1 lançamento no extrato). Nada é apagado: parcelas e compras do
  ciclo continuam lá para a fatura fechar com elas.
- **Fatura aberta:** `currentInvoiceTotal = compras + resíduo das fechadas +
  encargos pendentes − antecipações`. O que passar vira `creditoExcedente`.
- **Fechamento:** o `invoiceEngine` vincula a antecipação à fatura recém-fechada;
  a cascata (`planDistribution`, mais antiga primeiro) faz a quitação.
- **Pago de principal**, em qualquer soma, é `|amount| − applied_to_charges`
  (`paidPrincipalSql`, `API/utils/invoiceMath.js`). Pagamento de FECHADA que
  também quita encargos grava a parte dos encargos do mesmo jeito.
- **Legado:** linhas anteriores (`applied_to_charges NULL`) contam como 0 de
  encargos. Pagamento órfão legado não é vinculado nem vira crédito.
- **CSV da planilha de controle:** `fatura_aberta` segue a mesma regra;
  `tbl_pago_encargos` (soma de `applied_to_charges`) é a **última** coluna.
- **Testes:** `API/tests/integration/pagamentoFaturaAberta.integration.test.js`
  (cenários A, B, C, D, L e paridade do CSV).
```

- [ ] **Step 2: Suítes completas**

Run: `npx jest --selectProjects unit`
Expected: baseline da Task 0 + novos testes passando; só a falha conhecida do `massa805Lifecycle`.
Run: `npx jest --selectProjects integration`
Expected: PASS. Se alguma suíte antiga depender do ramo legado (soma de `INVOICE_INSTALLMENT` sem fatura FECHADA), parar e reportar antes de mudar a asserção: é mudança de regra.

- [ ] **Step 3: Conferência só-leitura das 3 massas reais**

Rodar a simulação read-only (script do scratchpad desta sessão, `sim805.cjs`, com as travas de READ ONLY) para 80535757654, 77766655544 e 20250513611. O que se espera:
- 805: `antecipacoesFaturaAberta` 0 e `closedInvoiceResidual` 0. `currentInvoiceTotal` passa a mostrar a dívida real do dado (≈ R$ 1.292,13 = 2/2 projetada + encargos de 22/09). Isso **expõe** o estrago do fluxo antigo, que vai para o plano de correção de dados.
- 777: `currentInvoiceTotal` ≈ R$ 191,52.
- 2025: sem mudança (R$ 269,66).

- [ ] **Step 4: Commit**

```bash
git add docs/REGRAS-NEGOCIO-FATURA.md
git commit -m "docs: §25 pagamento com fatura aberta = antecipação"
```

---

## Depois deste plano (não executar sem aprovação)

1. **Correção de dados**, massa por massa (805, 777, 2025): decidir o destino dos R$ 1.200 da 805 e dos ~R$ 510 não explicados da 777, e se a 2025 recebe estorno de R$ 4.985,33.
2. **777:** investigar os 10 planos "Parcelamento fatura" duplicados.
3. **`massa805Lifecycle.unit.test.js`:** reescrever com fixture própria (hoje depende da massa real).
