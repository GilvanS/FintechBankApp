# Planejamento de Testes (Admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova tela no painel Admin do FintechBankApp que cruza os cenários de teste (aba `TBL_CENARIOS`) com o catálogo de massas de teste (aba `tbl_de_massas`) do arquivo `A:\Workspace\poc-fintech-playwright\data\MassaDados.xlsx`, valida se a massa escolhida atende ao pré-requisito do cenário (aviso não-bloqueante) e grava a atribuição de volta na aba `TBL_CENARIOS` ao clicar em Salvar.

**Architecture:** Backend Node/Express expõe `GET /admin/test-planning` (lê as duas abas via SheetJS) e `POST /admin/test-planning/save` (reabre o workbook inteiro, atualiza só a linha do cenário em `TBL_CENARIOS`, regrava o arquivo — as outras 6 abas nunca são tocadas). Frontend React consome os dois endpoints numa tela de 2 colunas dentro do `AdminAllureView`.

**Tech Stack:** Node.js + Express (API), `xlsx` (SheetJS, dependência nova), React 19 + TypeScript + Tailwind (WEB), Jest (testes de unidade do backend).

**Spec:** `F:\GITHUB\FintechBankApp\docs\superpowers\specs\2026-09-12-test-planning-admin-panel-design.md`

## Global Constraints

- Caminho do arquivo é fixo no código, nunca vindo do cliente: `A:\Workspace\poc-fintech-playwright\data\MassaDados.xlsx`.
- Escrita no xlsx SEMPRE relê o workbook inteiro antes de mutar — nunca assume estado em memória entre requisições (o arquivo pode ter sido editado manualmente no Excel entre um GET e o POST seguinte).
- Erro de arquivo travado no Excel (`EBUSY`/`EPERM`) retorna HTTP 503 com mensagem legível, nunca 500 cru.
- Regras de validação por cenário ficam num objeto hardcoded (`REGRAS_POR_CENARIO`) — sem motor genérico (só 17 cenários hoje, YAGNI).
- Aviso de "massa não atende ao cenário" nunca bloqueia o botão Salvar (decisão confirmada com o usuário).
- Nenhuma dependência frontend nova — grupos colapsáveis são feitos com `useState` simples, sem `@headlessui/react` (não é dependência do projeto hoje).

---

## Task 1: Utilitário de leitura/escrita do xlsx (`testPlanningXlsx.cjs`)

**Files:**
- Create: `API/utils/testPlanningXlsx.cjs`
- Test: `API/tests/unit/testPlanningXlsx.test.js`
- Modify: `API/package.json` (adiciona dependência `xlsx`)

**Interfaces:**
- Consumes: pacote npm `xlsx` (SheetJS) — `XLSX.readFile(path)`, `XLSX.utils.sheet_to_json(sheet)`, `XLSX.utils.json_to_sheet(rows)`, `XLSX.writeFile(workbook, path)`.
- Produces (usado pela Task 3):
  - `readPlanningData(): { cenarios: object[], massas: object[] }`
  - `saveCenarioAssignment(idCenario: string, campos: object): object` (retorna a linha atualizada; lança erro se `idCenario` não existir em `TBL_CENARIOS`, ou erro nativo do Node com `.code` `ENOENT`/`EBUSY`/`EPERM` se o arquivo não existir ou estiver travado)
  - `XLSX_PATH: string`, `CENARIOS_SHEET: string`, `MASSAS_SHEET: string` (constantes exportadas)

- [ ] **Step 1: Instalar a dependência `xlsx`**

Run: `cd API && npm install xlsx@^0.18.5`

Expected: `API/package.json` ganha `"xlsx": "^0.18.5"` em `dependencies`, `package-lock.json` atualizado.

- [ ] **Step 2: Escrever o teste que falha (leitura)**

Crie `API/tests/unit/testPlanningXlsx.test.js`:

```js
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
```

- [ ] **Step 2b: Rodar o teste e confirmar que falha (módulo ainda não existe)**

Run: `cd API && npx jest tests/unit/testPlanningXlsx.test.js`
Expected: FAIL com `Cannot find module '../../utils/testPlanningXlsx.cjs'`

- [ ] **Step 3: Implementar `API/utils/testPlanningXlsx.cjs`**

```js
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
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd API && npx jest tests/unit/testPlanningXlsx.test.js`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
cd F:/GITHUB/FintechBankApp
git add API/utils/testPlanningXlsx.cjs API/tests/unit/testPlanningXlsx.test.js API/package.json API/package-lock.json
git commit -m "feat(admin): utilitário de leitura/escrita do MassaDados.xlsx para planejamento de testes"
```

---

## Task 2: Regras de validação por cenário (`testPlanningRules.cjs`)

**Files:**
- Create: `API/utils/testPlanningRules.cjs`
- Test: `API/tests/unit/testPlanningRules.test.js`

**Interfaces:**
- Consumes: nenhuma dependência externa.
- Produces (usado pela Task 3 e replicado no frontend na Task 6):
  - `REGRAS_POR_CENARIO: Record<string, (massa: object) => boolean>`
  - `validarMassaParaCenario(idCenario: string, massa: object): { valido: boolean, motivo: string | null }`

- [ ] **Step 1: Escrever o teste que falha**

Crie `API/tests/unit/testPlanningRules.test.js`:

```js
const { validarMassaParaCenario } = require('../../utils/testPlanningRules.cjs');

describe('validarMassaParaCenario', () => {
    test('CT03.2 exige fatura_fechada > 0 — massa sem dívida fechada é inválida', () => {
        const massa = { fatura_fechada: 0, fatura_aberta: 0 };
        const resultado = validarMassaParaCenario('CT03.2', massa);
        expect(resultado.valido).toBe(false);
        expect(resultado.motivo).toMatch(/CT03\.2/);
    });

    test('CT03.2 com fatura_fechada > 0 é válida', () => {
        const massa = { fatura_fechada: 159.13, fatura_aberta: 833.25 };
        const resultado = validarMassaParaCenario('CT03.2', massa);
        expect(resultado.valido).toBe(true);
        expect(resultado.motivo).toBeNull();
    });

    test('CT03.1 exige fatura_aberta > 0', () => {
        expect(validarMassaParaCenario('CT03.1', { fatura_aberta: 0, fatura_fechada: 100 }).valido).toBe(false);
        expect(validarMassaParaCenario('CT03.1', { fatura_aberta: 50, fatura_fechada: 0 }).valido).toBe(true);
    });

    test('cenário sem regra definida (ex: cadastrar) é sempre válido', () => {
        const resultado = validarMassaParaCenario('cadastrar', {});
        expect(resultado.valido).toBe(true);
        expect(resultado.motivo).toBeNull();
    });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd API && npx jest tests/unit/testPlanningRules.test.js`
Expected: FAIL com `Cannot find module '../../utils/testPlanningRules.cjs'`

- [ ] **Step 3: Implementar `API/utils/testPlanningRules.cjs`**

```js
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
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd API && npx jest tests/unit/testPlanningRules.test.js`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
cd F:/GITHUB/FintechBankApp
git add API/utils/testPlanningRules.cjs API/tests/unit/testPlanningRules.test.js
git commit -m "feat(admin): regras de validação de massa por cenário de teste"
```

---

## Task 3: Controller (`testPlanningController.js`)

**Files:**
- Create: `API/src/controllers/testPlanningController.js`
- Test: `API/tests/unit/testPlanningController.test.js`

**Interfaces:**
- Consumes:
  - `readPlanningData()`, `saveCenarioAssignment(idCenario, campos)` da Task 1 (`../../utils/testPlanningXlsx.cjs`)
  - `deps.auditLog(req, action, level, meta)` — mesmo padrão usado em `adminScriptsController.js`
- Produces (usado pela Task 4):
  - `createTestPlanningController(deps: { auditLog }): { getPlanningData, saveAssignment }` — ambos `async (req, res) => void`, mesma assinatura Express de `adminScriptsController.js`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `API/tests/unit/testPlanningController.test.js`:

```js
jest.mock('../../utils/testPlanningXlsx.cjs');
const { readPlanningData, saveCenarioAssignment } = require('../../utils/testPlanningXlsx.cjs');
const createTestPlanningController = require('../../src/controllers/testPlanningController');

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('testPlanningController', () => {
    let controller;
    let auditLog;

    beforeEach(() => {
        auditLog = jest.fn();
        controller = createTestPlanningController({ auditLog });
        jest.clearAllMocks();
    });

    test('getPlanningData devolve cenarios e massas com success:true', async () => {
        readPlanningData.mockReturnValue({
            cenarios: [{ ID_CENARIO: 'CT03.2' }],
            massas: [{ id_massa: '0001' }],
        });
        const req = {};
        const res = mockRes();

        await controller.getPlanningData(req, res);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { cenarios: [{ ID_CENARIO: 'CT03.2' }], massas: [{ id_massa: '0001' }] },
        });
    });

    test('getPlanningData devolve 404 se o xlsx não existe (ENOENT)', async () => {
        const erro = new Error('arquivo não encontrado');
        erro.code = 'ENOENT';
        readPlanningData.mockImplementation(() => { throw erro; });
        const res = mockRes();

        await controller.getPlanningData({}, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('saveAssignment retorna 400 se idCenario ou massa.cpf faltarem', async () => {
        const req = { body: { idCenario: 'CT03.2' } };
        const res = mockRes();

        await controller.saveAssignment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(saveCenarioAssignment).not.toHaveBeenCalled();
    });

    test('saveAssignment mapeia os campos e chama saveCenarioAssignment', async () => {
        saveCenarioAssignment.mockReturnValue({ ID_CENARIO: 'CT03.2', CPF: '26700822386' });
        const req = {
            body: {
                idCenario: 'CT03.2',
                massa: {
                    idMassa: '0045',
                    cpf: '26700822386',
                    saldoConta: 4678.70,
                    faturaFechada: 4582.06,
                    faturaAberta: 5900.02,
                    diasAtraso: 12,
                    pin: '9898',
                },
            },
        };
        const res = mockRes();

        await controller.saveAssignment(req, res);

        expect(saveCenarioAssignment).toHaveBeenCalledWith('CT03.2', {
            ID_MASSA: '0045',
            CPF: '26700822386',
            saldo_conta: 4678.70,
            fatura_fechada: 4582.06,
            fatura_aberta: 5900.02,
            dias_atraso: 12,
            PIN: '9898',
        });
        expect(auditLog).toHaveBeenCalledWith(req, 'admin_test_planning_save', 'info', { idCenario: 'CT03.2', cpf: '26700822386' });
        expect(res.json).toHaveBeenCalledWith({ success: true, data: { ID_CENARIO: 'CT03.2', CPF: '26700822386' } });
    });

    test('saveAssignment retorna 503 se o xlsx estiver travado no Excel (EBUSY)', async () => {
        const erro = new Error('resource busy or locked');
        erro.code = 'EBUSY';
        saveCenarioAssignment.mockImplementation(() => { throw erro; });
        const req = { body: { idCenario: 'CT03.2', massa: { cpf: '26700822386' } } };
        const res = mockRes();

        await controller.saveAssignment(req, res);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: expect.stringMatching(/Excel/) }));
    });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd API && npx jest tests/unit/testPlanningController.test.js`
Expected: FAIL com `Cannot find module '../../src/controllers/testPlanningController'`

- [ ] **Step 3: Implementar `API/src/controllers/testPlanningController.js`**

```js
/**
 * testPlanningController.js — handlers de GET/POST do Planejamento de Testes
 * (cruza TBL_CENARIOS x tbl_de_massas de MassaDados.xlsx).
 */
const { readPlanningData, saveCenarioAssignment } = require('../../utils/testPlanningXlsx.cjs');

module.exports = function createTestPlanningController(deps) {
    const { auditLog } = deps;

    const getPlanningData = async (req, res) => {
        try {
            const { cenarios, massas } = readPlanningData();
            res.json({ success: true, data: { cenarios, massas } });
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({
                    success: false,
                    message: 'MassaDados.xlsx não encontrado. Verifique se o repo poc-fintech-playwright está no caminho esperado.',
                });
            }
            res.status(500).json({ success: false, message: 'Erro ao ler MassaDados.xlsx: ' + err.message });
        }
    };

    const saveAssignment = async (req, res) => {
        const { idCenario, massa } = req.body || {};
        if (!idCenario || !massa || !massa.cpf) {
            return res.status(400).json({ success: false, message: 'idCenario e massa (com cpf) são obrigatórios.' });
        }
        const campos = {
            ID_MASSA: massa.idMassa,
            CPF: massa.cpf,
            saldo_conta: massa.saldoConta,
            fatura_fechada: massa.faturaFechada,
            fatura_aberta: massa.faturaAberta,
            dias_atraso: massa.diasAtraso,
            PIN: massa.pin,
        };
        try {
            const linhaAtualizada = saveCenarioAssignment(idCenario, campos);
            auditLog(req, 'admin_test_planning_save', 'info', { idCenario, cpf: massa.cpf });
            res.json({ success: true, data: linhaAtualizada });
        } catch (err) {
            if (err.code === 'EBUSY' || err.code === 'EPERM') {
                return res.status(503).json({
                    success: false,
                    message: 'MassaDados.xlsx está aberto no Excel. Feche o arquivo e tente novamente.',
                });
            }
            res.status(500).json({ success: false, message: 'Erro ao salvar em TBL_CENARIOS: ' + err.message });
        }
    };

    return { getPlanningData, saveAssignment };
};
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd API && npx jest tests/unit/testPlanningController.test.js`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
cd F:/GITHUB/FintechBankApp
git add API/src/controllers/testPlanningController.js API/tests/unit/testPlanningController.test.js
git commit -m "feat(admin): controller do Planejamento de Testes (GET/POST)"
```

---

## Task 4: Rotas e wiring em `index.cjs`

**Files:**
- Create: `API/src/routes/admin/testPlanning.routes.js`
- Modify: `API/index.cjs:203` (bloco de requires das rotas admin) e `API/index.cjs:2861` (bloco de instanciação/registro das rotas admin de scripts)

**Interfaces:**
- Consumes: `createTestPlanningController` (Task 3), `{ apiRouter, bearerAuth, authenticateAdmin, asyncHandler }` (já existentes em `index.cjs`, mesmas variáveis usadas por `registerAdminScriptsRoutes`).
- Produces: rotas HTTP `GET /api/admin/test-planning` e `POST /api/admin/test-planning/save`, ambas atrás de `bearerAuth() + authenticateAdmin` — consumidas pela Task 5 (frontend).

- [ ] **Step 1: Criar `API/src/routes/admin/testPlanning.routes.js`**

```js
/**
 * admin/testPlanning.routes.js — Registro das rotas ADMIN de "Planejamento de
 * Testes" (cruza TBL_CENARIOS x tbl_de_massas do MassaDados.xlsx).
 *
 * Mesmo padrão de auth de admin/scripts.routes.js.
 */
module.exports = function registerTestPlanningRoutes({ apiRouter, bearerAuth, authenticateAdmin, asyncHandler, controller }) {
    apiRouter.get('/admin/test-planning', bearerAuth(), authenticateAdmin, asyncHandler(controller.getPlanningData));
    apiRouter.post('/admin/test-planning/save', bearerAuth(), authenticateAdmin, asyncHandler(controller.saveAssignment));
};
```

- [ ] **Step 2: Ler o trecho atual de `index.cjs` ao redor da linha 203**

Run: `grep -n "registerAdminScriptsRoutes = require" F:/GITHUB/FintechBankApp/API/index.cjs`

Expected: mostra a linha `const registerAdminScriptsRoutes = require('./src/routes/admin/scripts.routes');` (linha 203 no momento em que este plano foi escrito — confirme o número exato antes de editar, arquivos mudam).

- [ ] **Step 3: Adicionar o require logo após essa linha**

Usando Edit (old_string exato encontrado no Step 2), adicione imediatamente depois:

```js
const registerAdminScriptsRoutes = require('./src/routes/admin/scripts.routes');
const registerTestPlanningRoutes = require('./src/routes/admin/testPlanning.routes');
```

- [ ] **Step 4: Adicionar o `require` do controller junto dos outros controllers**

Localize (Grep) a linha `const createAdminScriptsController = require(...)` (o controller correspondente, procure por `require.*adminScriptsController` em `index.cjs`) e adicione logo abaixo:

```js
const createTestPlanningController = require('./src/controllers/testPlanningController');
```

- [ ] **Step 5: Instanciar e registrar a rota logo após o bloco de `registerAdminScriptsRoutes`**

Localize o trecho (visto neste plano, próximo da linha 2861):

```js
const adminScriptsController = createAdminScriptsController({
    dbService,
    repoContext,
    cardEngine,
    auditLog,
});
registerAdminScriptsRoutes({ apiRouter, bearerAuth, authenticateAdmin, asyncHandler, controller: adminScriptsController });
```

Adicione logo depois:

```js
// --- Rotas de Admin: planejamento de testes (cruza TBL_CENARIOS x tbl_de_massas) ---
const testPlanningController = createTestPlanningController({ auditLog });
registerTestPlanningRoutes({ apiRouter, bearerAuth, authenticateAdmin, asyncHandler, controller: testPlanningController });
```

- [ ] **Step 6: Subir a API e confirmar que não quebrou (smoke test manual)**

Run: `cd API && npm run dev` (aguarde o log `Servidor rodando na porta 3001` ou equivalente, sem stack trace de erro).
Expected: servidor sobe limpo. Pare com Ctrl+C.

- [ ] **Step 7: Testar as rotas manualmente com curl/PowerShell (precisa de token admin válido)**

Run (PowerShell, ajuste a senha se for diferente):
```powershell
$login = Invoke-RestMethod -Uri http://localhost:3001/api/auth/login -Method Post -ContentType 'application/json' -Body '{"cpf":"99999999999","password":"admin999"}'
Invoke-RestMethod -Uri http://localhost:3001/api/admin/test-planning -Headers @{ Authorization = "Bearer $($login.token)" }
```
Expected: JSON com `success: true` e `data.cenarios`/`data.massas` preenchidos (17 e ~258 linhas respectivamente).

- [ ] **Step 8: Commit**

```bash
cd F:/GITHUB/FintechBankApp
git add API/src/routes/admin/testPlanning.routes.js API/index.cjs
git commit -m "feat(admin): registra rotas GET/POST de planejamento de testes em index.cjs"
```

---

## Task 5: Cliente HTTP no frontend (`WEB/services/api.ts`)

**Files:**
- Modify: `WEB/services/api.ts` (adicionar ao final do arquivo, mesmo padrão de `adminExportMassasCsv`)

**Interfaces:**
- Consumes: `apiCall<T>(path, options)` — helper já existente em `api.ts`, usado por todas as outras funções `admin*`.
- Produces (usado pela Task 6):
  - `interface TestPlanningCenario { SEQ?: number; ID_CENARIO: string; NOME?: string; FEATURE?: string; ID_MASSA?: string; CPF?: string; SENHA?: string; saldo_conta?: number; fatura_fechada?: number; fatura_aberta?: number; dias_atraso?: number; PIN?: string | number; }`
  - `interface TestPlanningMassa { id_massa: string; cpf: string; status: string; saldo_conta: number; fatura_fechada: number; fatura_aberta: number; dias_atraso: number; nome_completo?: string; }`
  - `getTestPlanningData(): Promise<{ success: boolean; data?: { cenarios: TestPlanningCenario[]; massas: TestPlanningMassa[] }; message?: string }>`
  - `saveTestPlanningAssignment(idCenario: string, massa: { idMassa: string; cpf: string; saldoConta: number; faturaFechada: number; faturaAberta: number; diasAtraso: number; pin: string }): Promise<{ success: boolean; data?: TestPlanningCenario; message?: string }>`

- [ ] **Step 1: Adicionar as interfaces e funções ao final de `WEB/services/api.ts`**

```ts
export interface TestPlanningCenario {
    SEQ?: number;
    ID_CENARIO: string;
    NOME?: string;
    FEATURE?: string;
    ID_MASSA?: string;
    CPF?: string;
    SENHA?: string;
    saldo_conta?: number;
    fatura_fechada?: number;
    fatura_aberta?: number;
    dias_atraso?: number;
    PIN?: string | number;
}

export interface TestPlanningMassa {
    id_massa: string;
    cpf: string;
    status: string;
    saldo_conta: number;
    fatura_fechada: number;
    fatura_aberta: number;
    dias_atraso: number;
    nome_completo?: string;
}

export const getTestPlanningData = async (): Promise<{
    success: boolean;
    data?: { cenarios: TestPlanningCenario[]; massas: TestPlanningMassa[] };
    message?: string;
}> => {
    try {
        return await apiCall('/admin/test-planning', { method: 'GET' });
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao carregar planejamento de testes.' };
    }
};

export const saveTestPlanningAssignment = async (
    idCenario: string,
    massa: { idMassa: string; cpf: string; saldoConta: number; faturaFechada: number; faturaAberta: number; diasAtraso: number; pin: string }
): Promise<{ success: boolean; data?: TestPlanningCenario; message?: string }> => {
    try {
        return await apiCall('/admin/test-planning/save', {
            method: 'POST',
            body: JSON.stringify({ idCenario, massa }),
        });
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao salvar planejamento de testes.' };
    }
};
```

- [ ] **Step 2: Verificar tipos com o compilador**

Run: `cd WEB && npx tsc --noEmit`
Expected: sem erros novos relacionados a `api.ts`.

- [ ] **Step 3: Commit**

```bash
cd F:/GITHUB/FintechBankApp
git add WEB/services/api.ts
git commit -m "feat(admin): funções de API do frontend para planejamento de testes"
```

---

## Task 6: Componente `TestPlanningSection.tsx`

**Files:**
- Create: `WEB/components/Admin/TestPlanningSection.tsx`

**Interfaces:**
- Consumes:
  - `getTestPlanningData`, `saveTestPlanningAssignment`, `TestPlanningCenario`, `TestPlanningMassa` (Task 5, de `../../services/api`)
  - `useAppState()` de `../../contexts/AppStateContext` (padrão `theme`/`isMidnight` usado em `ScriptsMassasSection.tsx`)
  - `useToast, ToastContainer` de `../Toast` (mesmo padrão já usado em `InvoicesAllureView.tsx`)
- Produces: `export default TestPlanningSection: React.FC` — consumido pela Task 7 (`AdminAllureView.tsx`).

- [ ] **Step 1: Criar o componente**

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, AlertCircle, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { useToast, ToastContainer } from '../Toast';
import {
    getTestPlanningData,
    saveTestPlanningAssignment,
    type TestPlanningCenario,
    type TestPlanningMassa,
} from '../../services/api';

// Mesmas regras de API/utils/testPlanningRules.cjs, replicadas aqui só pra
// feedback visual imediato no cliente — a validação de verdade (o que é
// persistido) sempre roda de novo no backend antes de salvar.
const REGRAS_POR_CENARIO: Record<string, (massa: TestPlanningMassa) => boolean> = {
    'CT03.1': (massa) => Number(massa.fatura_aberta) > 0,
    'CT03.2': (massa) => Number(massa.fatura_fechada) > 0,
    'CT03.3': (massa) => Number(massa.fatura_fechada) > 0,
};

function validarMassaParaCenario(idCenario: string, massa: TestPlanningMassa): { valido: boolean; motivo: string | null } {
    const regra = REGRAS_POR_CENARIO[idCenario];
    if (!regra) return { valido: true, motivo: null };
    const valido = regra(massa);
    return { valido, motivo: valido ? null : `Essa massa não atende ao pré-requisito do cenário ${idCenario}.` };
}

const formatBRL = (value: number | undefined): string => (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TestPlanningSection: React.FC = () => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const { toast, showSuccess, showError, hide } = useToast();

    const [loading, setLoading] = useState(true);
    const [cenarios, setCenarios] = useState<TestPlanningCenario[]>([]);
    const [massas, setMassas] = useState<TestPlanningMassa[]>([]);
    const [cenarioSelecionado, setCenarioSelecionado] = useState<string | null>(null);
    const [massaSelecionada, setMassaSelecionada] = useState<TestPlanningMassa | null>(null);
    const [salvando, setSalvando] = useState(false);

    const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'adimplente' | 'inadimplente'>('TODOS');
    const [filtroFaturaFechada, setFiltroFaturaFechada] = useState(false);
    const [filtroFaturaAberta, setFiltroFaturaAberta] = useState(false);
    const [busca, setBusca] = useState('');
    const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({ adimplente: true, inadimplente: true });

    useEffect(() => {
        carregarDados();
    }, []);

    const carregarDados = async () => {
        setLoading(true);
        const res = await getTestPlanningData();
        if (res.success && res.data) {
            setCenarios(res.data.cenarios);
            setMassas(res.data.massas);
        } else {
            showError(res.message || 'Erro ao carregar planejamento de testes.');
        }
        setLoading(false);
    };

    const massasFiltradas = useMemo(() => {
        return massas.filter((massa) => {
            if (filtroStatus !== 'TODOS' && massa.status !== filtroStatus) return false;
            if (filtroFaturaFechada && !(Number(massa.fatura_fechada) > 0)) return false;
            if (filtroFaturaAberta && !(Number(massa.fatura_aberta) > 0)) return false;
            if (busca.trim() && !massa.cpf.includes(busca.trim())) return false;
            return true;
        });
    }, [massas, filtroStatus, filtroFaturaFechada, filtroFaturaAberta, busca]);

    const massasPorGrupo = useMemo(() => {
        const grupos: Record<string, TestPlanningMassa[]> = {};
        massasFiltradas.forEach((massa) => {
            const chave = massa.status || 'sem_status';
            if (!grupos[chave]) grupos[chave] = [];
            grupos[chave].push(massa);
        });
        return grupos;
    }, [massasFiltradas]);

    const validacao = cenarioSelecionado && massaSelecionada
        ? validarMassaParaCenario(cenarioSelecionado, massaSelecionada)
        : null;

    const limparFiltros = () => {
        setFiltroStatus('TODOS');
        setFiltroFaturaFechada(false);
        setFiltroFaturaAberta(false);
        setBusca('');
    };

    const toggleGrupo = (chave: string) => {
        setGruposAbertos((prev) => ({ ...prev, [chave]: !prev[chave] }));
    };

    const handleSalvar = async () => {
        if (!cenarioSelecionado || !massaSelecionada) return;
        setSalvando(true);
        const res = await saveTestPlanningAssignment(cenarioSelecionado, {
            idMassa: massaSelecionada.id_massa,
            cpf: massaSelecionada.cpf,
            saldoConta: massaSelecionada.saldo_conta,
            faturaFechada: massaSelecionada.fatura_fechada,
            faturaAberta: massaSelecionada.fatura_aberta,
            diasAtraso: massaSelecionada.dias_atraso,
            pin: String((massaSelecionada as any).PIN ?? '9898'),
        });
        if (res.success) {
            showSuccess(`Cenário ${cenarioSelecionado} atualizado com a massa ${massaSelecionada.cpf}.`);
            await carregarDados();
        } else {
            showError(res.message || 'Erro ao salvar no xlsx.');
        }
        setSalvando(false);
    };

    const cardClass = isMidnight ? 'bg-[#1a1a1a] border border-white/10 text-white' : 'bg-white border-2 border-black text-black';
    const chipClass = isMidnight ? 'bg-volt-green/20 text-volt-green border border-volt-green/40' : 'bg-black text-volt-yellow';

    if (loading) {
        return <div className="p-6 text-sm font-bold opacity-70">Carregando planejamento de testes...</div>;
    }

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center gap-2">
                <ClipboardList size={20} />
                <h2 className="text-lg font-black">Planejamento de Testes</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
                {/* Coluna esquerda: cenários */}
                <div className={`rounded-xl p-3 ${cardClass}`}>
                    <p className="text-xs font-black uppercase opacity-60 mb-2">Cenários (TBL_CENARIOS)</p>
                    <div className="flex flex-col gap-1 max-h-[65vh] overflow-y-auto">
                        {cenarios.map((cenario) => {
                            const ativo = cenarioSelecionado === cenario.ID_CENARIO;
                            return (
                                <button
                                    key={cenario.ID_CENARIO}
                                    onClick={() => setCenarioSelecionado(cenario.ID_CENARIO)}
                                    className={`text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                        ativo ? chipClass : isMidnight ? 'hover:bg-white/5' : 'hover:bg-black/5'
                                    }`}
                                >
                                    <div>{cenario.ID_CENARIO} — {cenario.NOME || cenario.FEATURE}</div>
                                    <div className="text-[10px] opacity-60 mt-0.5">
                                        Vinculado hoje: CPF {cenario.CPF || '—'}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Coluna direita: catálogo de massas */}
                <div className={`rounded-xl p-3 ${cardClass}`}>
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                        {filtroStatus !== 'TODOS' && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center gap-1">
                                {filtroStatus} <X size={10} className="cursor-pointer" onClick={() => setFiltroStatus('TODOS')} />
                            </span>
                        )}
                        {filtroFaturaFechada && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center gap-1">
                                fatura_fechada&gt;0 <X size={10} className="cursor-pointer" onClick={() => setFiltroFaturaFechada(false)} />
                            </span>
                        )}
                        {filtroFaturaAberta && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center gap-1">
                                fatura_aberta&gt;0 <X size={10} className="cursor-pointer" onClick={() => setFiltroFaturaAberta(false)} />
                            </span>
                        )}
                        {(filtroStatus !== 'TODOS' || filtroFaturaFechada || filtroFaturaAberta || busca) && (
                            <button onClick={limparFiltros} className="text-[10px] font-bold underline opacity-60">
                                Limpar tudo
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <select
                            value={filtroStatus}
                            onChange={(e) => setFiltroStatus(e.target.value as any)}
                            className={`text-xs font-bold rounded-lg px-2 py-1.5 border ${isMidnight ? 'bg-black border-white/20' : 'bg-white border-black/20'}`}
                        >
                            <option value="TODOS">Status: TODOS</option>
                            <option value="adimplente">adimplente</option>
                            <option value="inadimplente">inadimplente</option>
                        </select>
                        <label className="text-xs font-bold flex items-center gap-1">
                            <input type="checkbox" checked={filtroFaturaFechada} onChange={(e) => setFiltroFaturaFechada(e.target.checked)} />
                            fatura_fechada&gt;0
                        </label>
                        <label className="text-xs font-bold flex items-center gap-1">
                            <input type="checkbox" checked={filtroFaturaAberta} onChange={(e) => setFiltroFaturaAberta(e.target.checked)} />
                            fatura_aberta&gt;0
                        </label>
                        <div className="relative flex-1 min-w-[140px]">
                            <Search size={12} className="absolute left-2 top-2 opacity-50" />
                            <input
                                type="text"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar CPF..."
                                className={`w-full pl-6 pr-2 py-1.5 rounded-lg text-xs border ${isMidnight ? 'bg-black border-white/20' : 'bg-white border-black/20'}`}
                            />
                        </div>
                    </div>

                    <div className="max-h-[45vh] overflow-y-auto flex flex-col gap-2">
                        {Object.entries(massasPorGrupo).map(([chave, lista]) => (
                            <div key={chave}>
                                <button
                                    onClick={() => toggleGrupo(chave)}
                                    className="w-full flex items-center gap-2 text-xs font-black uppercase py-1.5"
                                >
                                    {gruposAbertos[chave] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    {chave} ({lista.length})
                                </button>
                                {gruposAbertos[chave] && (
                                    <div className="flex flex-col gap-1 pl-4">
                                        {lista.map((massa) => (
                                            <button
                                                key={massa.id_massa}
                                                onClick={() => setMassaSelecionada(massa)}
                                                className={`text-left px-3 py-2 rounded-lg text-xs transition-all ${
                                                    massaSelecionada?.id_massa === massa.id_massa
                                                        ? chipClass
                                                        : isMidnight ? 'hover:bg-white/5' : 'hover:bg-black/5'
                                                }`}
                                            >
                                                {massa.id_massa} · {massa.cpf} · saldo {formatBRL(massa.saldo_conta)} · fatura fechada {formatBRL(massa.fatura_fechada)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {cenarioSelecionado && massaSelecionada && (
                        <div className={`mt-4 p-3 rounded-lg border ${isMidnight ? 'border-white/10' : 'border-black/10'}`}>
                            <p className="text-xs font-black mb-1">
                                Massa selecionada: {massaSelecionada.id_massa} / CPF {massaSelecionada.cpf}
                            </p>
                            <p className="text-[11px] opacity-70 mb-2">
                                saldo {formatBRL(massaSelecionada.saldo_conta)} · fatura fechada {formatBRL(massaSelecionada.fatura_fechada)} · fatura aberta {formatBRL(massaSelecionada.fatura_aberta)}
                            </p>
                            {validacao && !validacao.valido && (
                                <p className="text-[11px] flex items-center gap-1.5 text-gray-400 mb-2">
                                    <AlertCircle size={13} /> {validacao.motivo}
                                </p>
                            )}
                            <button
                                onClick={handleSalvar}
                                disabled={salvando}
                                className={`w-full py-2.5 rounded-lg text-xs font-black uppercase ${isMidnight ? 'bg-volt-green text-black' : 'bg-black text-volt-yellow'} disabled:opacity-50`}
                            >
                                {salvando ? 'Salvando...' : 'Salvar no xlsx'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default TestPlanningSection;
```

- [ ] **Step 2: Type-check**

Run: `cd WEB && npx tsc --noEmit`
Expected: sem erros novos em `TestPlanningSection.tsx`.

- [ ] **Step 3: Commit**

```bash
cd F:/GITHUB/FintechBankApp
git add WEB/components/Admin/TestPlanningSection.tsx
git commit -m "feat(admin): componente TestPlanningSection (UI de planejamento de testes)"
```

---

## Task 7: Wiring no `AdminAllureView.tsx`

**Files:**
- Modify: `WEB/components/Admin/AdminAllureView.tsx:2` (import de ícone), `:19` (import do componente), `:26` (union type), `:28-40` (array `SECTIONS`), `:158-159` (switch de render)

**Interfaces:**
- Consumes: `TestPlanningSection` (Task 6, default export de `./TestPlanningSection`)
- Produces: item de menu "Planejamento de Testes" navegável no admin.

- [ ] **Step 1: Adicionar o import do ícone `ClipboardList`**

Modifique a linha 2 (import de ícones do `lucide-react`), adicionando `ClipboardList` à lista:

```tsx
import { Shield, Users, CreditCard, Receipt, FileText, LogIn, RefreshCw, Repeat, Send, ShieldCheck, Activity, Timer, Palette, Moon, Sun, Sparkles, X, Wrench, ClipboardList } from 'lucide-react';
```

- [ ] **Step 2: Importar o componente**

Adicione logo após a linha `import ScriptsMassasSection from './ScriptsMassasSection';`:

```tsx
import TestPlanningSection from './TestPlanningSection';
```

- [ ] **Step 3: Adicionar a chave no union type**

Modifique a linha:
```tsx
type AdminSectionKey = 'users' | 'requests' | 'billing' | 'recurring' | 'cards' | 'mass-creator' | 'audit' | 'vitrine' | 'telegram' | 'scripts' | 'legacy';
```
para:
```tsx
type AdminSectionKey = 'users' | 'requests' | 'billing' | 'recurring' | 'cards' | 'mass-creator' | 'audit' | 'vitrine' | 'telegram' | 'scripts' | 'test-planning' | 'legacy';
```

- [ ] **Step 4: Adicionar a entrada em `SECTIONS`**

Adicione logo após a linha do `scripts`, antes de `legacy`:

```tsx
    { key: 'scripts', label: 'Scripts & Massas', icon: Wrench, group: 'Auditoria & Sistema' },
    { key: 'test-planning', label: 'Planejamento de Testes', icon: ClipboardList, group: 'Testes' },
    { key: 'legacy', label: 'Painel Legado', icon: Shield, group: 'Legado' },
```

- [ ] **Step 5: Adicionar o case no switch de render**

Adicione logo após o case `'scripts'`:

```tsx
            case 'scripts':
                return <ScriptsMassasSection />;
            case 'test-planning':
                return <TestPlanningSection />;
```

- [ ] **Step 6: Type-check**

Run: `cd WEB && npx tsc --noEmit`
Expected: sem erros novos em `AdminAllureView.tsx`.

- [ ] **Step 7: Commit**

```bash
cd F:/GITHUB/FintechBankApp
git add WEB/components/Admin/AdminAllureView.tsx
git commit -m "feat(admin): registra item de menu Planejamento de Testes no AdminAllureView"
```

---

## Task 8: Verificação manual end-to-end no browser

**Files:** nenhum (só verificação, sem código novo).

**Interfaces:** N/A — este task só confirma que as Tasks 1-7 funcionam juntas.

- [ ] **Step 1: Subir API e WEB**

Run: `cd API && npm run dev` (porta 3001) e, em outro terminal, `cd WEB && npm run dev` (porta 3000/próxima livre).
Expected: ambos sobem sem erro.

- [ ] **Step 2: Login como admin e abrir a tela nova**

No browser (Chrome real ou Playwright MCP): login com CPF/senha admin (`99999999999` / `admin999`, per memória do projeto), navegar até Admin → menu "Planejamento de Testes".
Expected: tela carrega, coluna esquerda mostra 17 cenários, coluna direita mostra ~258 massas agrupadas por status.

- [ ] **Step 3: Selecionar CT03.2 e uma massa sem fatura fechada**

Clique em CT03.2, depois numa massa com `fatura_fechada = 0`.
Expected: aparece o aviso "Essa massa não atende ao pré-requisito do cenário CT03.2." com ícone, e o botão "Salvar no xlsx" continua clicável (não desabilitado).

- [ ] **Step 4: Selecionar uma massa válida e salvar**

Selecione uma massa com `fatura_fechada > 0`, confirme que o aviso some, clique "Salvar no xlsx".
Expected: toast de sucesso, sem erro no console do browser (`read_console_messages`).

- [ ] **Step 5: Confirmar no arquivo que só TBL_CENARIOS mudou**

Run (Node, fora do commit — só verificação):
```bash
node -e "
const XLSX = require('A:/Workspace/poc-fintech-playwright/node_modules/xlsx');
const wb = XLSX.readFile('A:\\\\Workspace\\\\poc-fintech-playwright\\\\data\\\\MassaDados.xlsx');
const linha = XLSX.utils.sheet_to_json(wb.Sheets['TBL_CENARIOS']).find(r => r.ID_CENARIO === 'CT03.2');
console.log(JSON.stringify(linha, null, 2));
"
```
Expected: `CPF`, `saldo_conta`, `fatura_fechada`, `fatura_aberta`, `dias_atraso`, `PIN` da linha `CT03.2` batem com a massa escolhida no Step 4.

- [ ] **Step 6: Rodar o teste Playwright do cenário afetado, confirmar que passa com a nova massa**

Run: `cd A:/Workspace/poc-fintech-playwright && npm run test:ct03`
Expected: `1 passed` (mesma validação de ponta a ponta feita manualmente antes nesta sessão).

- [ ] **Step 7: Rodar a suíte de unidade do backend inteira, garantir que nada quebrou**

Run: `cd API && npm test`
Expected: todos os testes passam, incluindo os 3 arquivos novos das Tasks 1-3.
