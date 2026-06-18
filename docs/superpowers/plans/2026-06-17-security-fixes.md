# Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 8 vulnerabilidades de segurança identificadas na análise do FintechBankApp, eliminando os bloqueadores críticos antes de qualquer deploy.

**Architecture:** Todas as correções são cirúrgicas no arquivo `API/index.cjs` (backend Express) e `WEB/services/api.ts` (frontend React/TypeScript). Nenhuma reestruturação de módulos — apenas fixes nos pontos exatos identificados. Os testes existentes são estendidos para cobrir os novos comportamentos seguros.

**Tech Stack:** Node.js + Express 4, JWT (jsonwebtoken), bcryptjs, express-validator, Jest + Supertest (API), React 19 + TypeScript + Vitest (WEB).

## Global Constraints

- Nunca commitar secrets, credenciais ou arquivos `.env`
- Arquivo `API/index.cjs` — não exceder 3.442 linhas (atual); extrações permitidas
- Nunca usar `--no-verify` em commits
- Rodar `npm test` e verificar que todos os testes passam antes de cada commit
- Comandos de API: executar na pasta `API/`. Comandos de WEB: executar na pasta `WEB/`
- CPF nos endpoints sempre vem de `req.user.cpf` (token JWT), NUNCA do `req.body` ou `req.params` sem verificação de ownership

---

## Arquivo de mudanças

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `API/index.cjs` | Modificar | Remover endpoint fix-password, corrigir CPF spoofing PIX, adicionar auth em pix-daily-limit, escaping SQL, OTP reset |
| `API/tests/middlewares.test.js` | Modificar | Adicionar testes para os novos guards |
| `API/tests/security.test.js` | Criar | Testes específicos das vulnerabilidades corrigidas |
| `WEB/services/api.ts` | Modificar | Remover JWT do localStorage; usar apenas cookie |

---

## Task 1: Remover endpoint `/auth/fix-password` (sem autenticação)

**Files:**
- Modify: `API/index.cjs:719-751`
- Test: `API/tests/security.test.js` (criar)

**Interfaces:**
- Produz: endpoint removido — qualquer chamada a `POST /api/auth/fix-password` retorna 404

- [ ] **Step 1: Criar o arquivo de testes de segurança e escrever o teste que confirma a remoção**

```javascript
// API/tests/security.test.js
process.env.JWT_SECRET = 'test-jwt-secret-for-jest-only';

const request = require('supertest');
// Importar o app sem iniciar o servidor
// Como index.cjs exporta o app via listen, vamos testar via supertest direto
// Para isso, precisamos que index.cjs exporte `app` — se não exportar, testar via HTTP

describe('Security — Endpoints removidos', () => {
    it('POST /auth/fix-password deve retornar 404 (endpoint removido)', async () => {
        const res = await fetch('http://localhost:3001/api/auth/fix-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf: '11111111111', newPassword: 'hacked' }),
        });
        expect(res.status).toBe(404);
    });
});
```

> Nota: Este teste requer a API rodando em `localhost:3001`. Execute `npm run dev` antes de rodar.

- [ ] **Step 2: Localizar o bloco a remover em `API/index.cjs`**

Linhas 719–751. O bloco inteiro começa com:
```
// Rota de emergência para corrigir senha de usuário (sem autenticação, apenas para desenvolvimento)
// ⚠️ REMOVER EM PRODUÇÃO ou adicionar autenticação adequada
apiRouter.post('/auth/fix-password', asyncHandler(async (req, res) => {
```
e termina em:
```
}));
```
(linha 751, após `res.json({ success: true, message: ...newPassword });`)

- [ ] **Step 3: Deletar o bloco completo (linhas 719–751) de `API/index.cjs`**

Substituir o bloco inteiro por nada. O arquivo deve ir direto da linha 718 (`}));` — fim do `/auth/reset-password`) para a linha 752 (`// --- Rotas de Usuário ---`).

- [ ] **Step 4: Rodar os testes existentes para garantir nenhuma regressão**

```bash
cd API && npm test
```

Saída esperada: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add API/index.cjs API/tests/security.test.js
git commit -m "security: remover endpoint /auth/fix-password sem autenticacao"
```

---

## Task 2: Corrigir CPF spoofing em `/pix/transfer`

**Files:**
- Modify: `API/index.cjs` — handler `POST /pix/transfer` (em torno da linha 1837)
- Test: `API/tests/security.test.js`

**Interfaces:**
- Consome: `req.user.cpf` do middleware `bearerAuth()`
- Produz: o campo `cpf` do body é **ignorado** — remetente sempre é `req.user.cpf`

- [ ] **Step 1: Escrever teste de rejeição de spoofing**

Adicionar ao bloco `describe('Security — Endpoints removidos'` em `API/tests/security.test.js`:

```javascript
describe('Security — PIX Transfer CPF spoofing', () => {
    it('ignora cpf do body e usa sempre o cpf do token JWT', async () => {
        // Login com usuário 1 (CPF 11111111111)
        const loginRes = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf: '11111111111', password: '1234' }),
        });
        const { token } = await loginRes.json();

        // Tentar transferir usando CPF de outro usuário no body
        const res = await fetch('http://localhost:3001/api/pix/transfer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                cpf: '22222222222', // CPF de OUTRA conta — deve ser ignorado
                key: '11111111111', // chave pix qualquer existente
                amount: 1,
                description: 'Spoofing test',
            }),
        });
        const data = await res.json();
        // Deve falhar pois a chave destino é o próprio remetente (cpf do token = 11111111111)
        expect(res.status).toBe(400);
        expect(data.message).toMatch(/si mesmo/i);
    });
});
```

- [ ] **Step 2: Localizar a linha do spoofing em `API/index.cjs`**

Procurar por:
```javascript
const senderCpf = fromCpf || req.user.cpf;
```
dentro do handler `apiRouter.post('/pix/transfer', ...)`.

- [ ] **Step 3: Remover o campo `cpf` da desestruturação e fixar `senderCpf`**

**Antes (linha ~1839–1853):**
```javascript
const { cpf: fromCpf, key, amount, description } = req.body || {};
const numericAmount = parseFloat(amount);
// ...validações...
const senderCpf = fromCpf || req.user.cpf;
```

**Depois:**
```javascript
const { key, amount, description } = req.body || {};
const numericAmount = parseFloat(amount);
// ...validações...
const senderCpf = req.user.cpf;
```

- [ ] **Step 4: Rodar os testes**

```bash
cd API && npm test
```

Saída esperada: todos passam.

- [ ] **Step 5: Commit**

```bash
git add API/index.cjs API/tests/security.test.js
git commit -m "security: ignorar cpf do body em /pix/transfer — usar sempre req.user.cpf"
```

---

## Task 3: Corrigir CPF spoofing em `/pix/transfer-credit`

**Files:**
- Modify: `API/index.cjs` — handler `POST /pix/transfer-credit` (em torno da linha 1928)
- Test: `API/tests/security.test.js`

**Interfaces:**
- Produz: `fromCpfBody` ignorado — remetente é sempre `req.user.cpf`

- [ ] **Step 1: Localizar a linha do spoofing**

Procurar por:
```javascript
const senderCpf = fromCpfBody || req.user.cpf;
```
dentro do handler `apiRouter.post('/pix/transfer-credit', ...)`.

- [ ] **Step 2: Remover `fromCpfBody` da desestruturação e fixar `senderCpf`**

**Antes (linha ~1930–1950):**
```javascript
const { fromCpf: fromCpfBody, toKey, key, amount, description, installments, interestRate } = req.body || {};
// ...
const senderCpf = fromCpfBody || req.user.cpf;
```

**Depois:**
```javascript
const { toKey, key, amount, description, installments, interestRate } = req.body || {};
// ...
const senderCpf = req.user.cpf;
```

- [ ] **Step 3: Rodar os testes**

```bash
cd API && npm test
```

- [ ] **Step 4: Commit**

```bash
git add API/index.cjs
git commit -m "security: ignorar fromCpf do body em /pix/transfer-credit — usar req.user.cpf"
```

---

## Task 4: Adicionar guard de ownership em `/user/limits/pix-daily/:cpf`

**Files:**
- Modify: `API/index.cjs` — handler `PUT /user/limits/pix-daily/:cpf` (linha ~1055)
- Test: `API/tests/security.test.js`

**Interfaces:**
- Produz: `403 Acesso negado` se `req.user.cpf !== req.params.cpf && req.user.role !== 'admin'`

- [ ] **Step 1: Escrever teste**

Adicionar em `API/tests/security.test.js`:

```javascript
describe('Security — PUT /user/limits/pix-daily/:cpf ownership', () => {
    it('retorna 403 ao tentar alterar limite de outro usuario', async () => {
        const loginRes = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf: '11111111111', password: '1234' }),
        });
        const { token } = await loginRes.json();

        // Tentar alterar limite de OUTRO usuário
        const res = await fetch('http://localhost:3001/api/user/limits/pix-daily/22222222222', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ newLimit: 0 }),
        });
        expect(res.status).toBe(403);
    });
});
```

- [ ] **Step 2: Localizar o handler em `API/index.cjs`**

Procurar por:
```javascript
apiRouter.put('/user/limits/pix-daily/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
```

- [ ] **Step 3: Adicionar verificação de ownership após `bearerAuth()`**

**Antes:**
```javascript
apiRouter.put('/user/limits/pix-daily/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
    const { newLimit } = req.body;
    const now = new Date().toISOString();
    await databricksService.executeQuery(...);
    res.json({ success: true, message: 'Limite diário de PIX atualizado com sucesso!' });
}));
```

**Depois:**
```javascript
apiRouter.put('/user/limits/pix-daily/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
    if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const { newLimit } = req.body;
    const now = new Date().toISOString();
    await databricksService.executeQuery(...);
    res.json({ success: true, message: 'Limite diário de PIX atualizado com sucesso!' });
}));
```

- [ ] **Step 4: Rodar os testes**

```bash
cd API && npm test
```

- [ ] **Step 5: Commit**

```bash
git add API/index.cjs API/tests/security.test.js
git commit -m "security: adicionar ownership check em PUT /user/limits/pix-daily/:cpf"
```

---

## Task 5: Corrigir SQL injection em `/auth/request-password-reset` e `/auth/reset-password`

**Files:**
- Modify: `API/index.cjs` — linhas ~680–717 (dois handlers)
- Test: `API/tests/security.test.js`

**Interfaces:**
- Consome: função `escapeSQL` já definida dentro do handler `/auth/signup` (linha ~450)
- Produz: `cpf` sempre escapado antes de entrar em qualquer query

> **Importante:** a função `escapeSQL` está definida localmente no handler `/auth/signup`. Para reutilização, extrai-la para o escopo do módulo (antes de todos os handlers).

- [ ] **Step 1: Extrair `escapeSQL` para escopo de módulo**

Localizar em `API/index.cjs` (~linha 450):
```javascript
const escapeSQL = (str) => {
    if (!str) return '';
    return str.replace(/'/g, "''").trim();
};
```

Mover essa definição para **antes do primeiro `apiRouter.get`** (após as importações e configurações, ~linha 210). Remover a cópia local do handler `/auth/signup`.

- [ ] **Step 2: Corrigir `/auth/request-password-reset`**

**Antes (linha ~683):**
```javascript
const users = await databricksService.executeQuery(`SELECT cpf FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'`);
if (users.length > 0) {
    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET password_reset_requested = true, updated_at = current_timestamp() WHERE cpf = '${cpf}'`);
```

**Depois:**
```javascript
const safeCpf = escapeSQL(String(cpf || '').replace(/\D/g, ''));
const users = await databricksService.executeQuery(`SELECT cpf FROM ${databricksService.fq('users')} WHERE cpf = '${safeCpf}'`);
if (users.length > 0) {
    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET password_reset_requested = true, updated_at = current_timestamp() WHERE cpf = '${safeCpf}'`);
```

- [ ] **Step 3: Corrigir `/auth/reset-password`**

**Antes (linha ~695–715):**
```javascript
const rows = await databricksService.executeQuery(`
    SELECT cpf, password_reset_requested FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'
`);
// ...
await databricksService.executeQuery(`
    UPDATE ${databricksService.fq('users')}
    SET password_hash = '${escapedHash}', password_reset_requested = false, ...
    WHERE cpf = '${cpf}'
`);
```

**Depois:**
```javascript
const safeCpf = escapeSQL(String(cpf || '').replace(/\D/g, ''));
const rows = await databricksService.executeQuery(`
    SELECT cpf, password_reset_requested FROM ${databricksService.fq('users')} WHERE cpf = '${safeCpf}'
`);
// ...
await databricksService.executeQuery(`
    UPDATE ${databricksService.fq('users')}
    SET password_hash = '${escapedHash}', password_reset_requested = false, ...
    WHERE cpf = '${safeCpf}'
`);
```

- [ ] **Step 4: Rodar os testes**

```bash
cd API && npm test
```

- [ ] **Step 5: Commit**

```bash
git add API/index.cjs
git commit -m "security: escapar cpf nos handlers de reset de senha (SQL injection)"
```

---

## Task 6: Substituir token de reset previsível por OTP seguro com TTL

**Files:**
- Modify: `API/index.cjs` — handlers `/auth/request-password-reset` e `/auth/reset-password`

**Interfaces:**
- O token passa a ser: `crypto.randomInt(100000, 999999).toString()` (6 dígitos, não-previsível)
- TTL: 15 minutos — armazenado em memória via `Map` (suficiente para projeto de testes; não persistido entre restarts)
- Produz: `resetTokenStore` — `Map<cpf, {token: string, expiresAt: number}>`

> Para um projeto de testes (não produção real), um Map em memória é adequado. Em produção, usar Redis ou coluna no banco.

- [ ] **Step 1: Adicionar `resetTokenStore` após as importações em `API/index.cjs`**

Adicionar após as linhas de `require` (no topo do arquivo, antes dos middlewares):

```javascript
const crypto = require('crypto');
// Store em memória para OTP de reset de senha (15 min TTL)
// Chave: CPF, Valor: { token, expiresAt }
const resetTokenStore = new Map();
```

- [ ] **Step 2: Atualizar `/auth/request-password-reset` para gerar e armazenar OTP**

**Antes:**
```javascript
apiRouter.post('/auth/request-password-reset', asyncHandler(async (req, res) => {
    const { cpf } = req.body;
    const safeCpf = escapeSQL(String(cpf || '').replace(/\D/g, ''));
    const users = await databricksService.executeQuery(`SELECT cpf FROM ${databricksService.fq('users')} WHERE cpf = '${safeCpf}'`);
    if (users.length > 0) {
        await databricksService.executeQuery(`UPDATE ... SET password_reset_requested = true ...`);
        res.json({ success: true, message: 'Instruções para nova senha enviadas ao seu e-mail.' });
    } else {
        res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    }
}));
```

**Depois:**
```javascript
apiRouter.post('/auth/request-password-reset', asyncHandler(async (req, res) => {
    const { cpf } = req.body;
    const safeCpf = escapeSQL(String(cpf || '').replace(/\D/g, ''));
    const users = await databricksService.executeQuery(`SELECT cpf FROM ${databricksService.fq('users')} WHERE cpf = '${safeCpf}'`);
    if (users.length > 0) {
        const otp = crypto.randomInt(100000, 999999).toString();
        resetTokenStore.set(safeCpf, { token: otp, expiresAt: Date.now() + 15 * 60 * 1000 });
        await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET password_reset_requested = true, updated_at = current_timestamp() WHERE cpf = '${safeCpf}'`);
        // Em produção: enviar otp por e-mail. Aqui retornamos no body apenas para testes.
        res.json({ success: true, message: 'Token de redefinição gerado.', devToken: process.env.NODE_ENV !== 'production' ? otp : undefined });
    } else {
        res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    }
}));
```

- [ ] **Step 3: Atualizar `/auth/reset-password` para validar OTP via store**

**Substituir a lógica de validação do token:**

**Antes:**
```javascript
const expectedToken = String(cpf).slice(-4);
if (String(token) !== expectedToken) {
    return res.status(400).json({ success: false, message: 'Token invalido.' });
}
```

**Depois:**
```javascript
const safeCpf = escapeSQL(String(cpf || '').replace(/\D/g, ''));
const stored = resetTokenStore.get(safeCpf);
if (!stored || Date.now() > stored.expiresAt || String(token) !== stored.token) {
    return res.status(400).json({ success: false, message: 'Token invalido ou expirado.' });
}
resetTokenStore.delete(safeCpf); // one-time use
```

- [ ] **Step 4: Atualizar o teste de integração do WEB para usar o `devToken` retornado**

Arquivo: `WEB/tests/api.integration.test.ts`

**Antes (linha ~44):**
```typescript
({ res, data } = await post('/auth/reset-password', { cpf, token: cpf.slice(-4), newPassword: 'nova123' }));
```

**Depois:**
```typescript
// Obter o devToken retornado pelo request-reset (apenas em NODE_ENV !== 'production')
const resetData = data; // data é o resultado do request-reset acima
const devToken = resetData.devToken;
expect(devToken).toBeDefined();
({ res, data } = await post('/auth/reset-password', { cpf, token: devToken, newPassword: 'nova123' }));
```

- [ ] **Step 5: Rodar os testes**

```bash
cd API && npm test
cd ../WEB && npm test
```

Saída esperada: todos passam.

- [ ] **Step 6: Commit**

```bash
git add API/index.cjs WEB/tests/api.integration.test.ts
git commit -m "security: substituir token de reset previsivel por OTP criptografico com TTL 15min"
```

---

## Task 7: Adicionar autenticação em `GET /pix/recipient-info`

**Files:**
- Modify: `API/index.cjs` — handler `GET /pix/recipient-info` (linha ~1709)
- Test: `API/tests/security.test.js`

**Interfaces:**
- Produz: endpoint requer `bearerAuth()` — sem token retorna 401

- [ ] **Step 1: Escrever teste**

Adicionar em `API/tests/security.test.js`:

```javascript
describe('Security — GET /pix/recipient-info requer autenticacao', () => {
    it('retorna 401 sem token', async () => {
        const res = await fetch('http://localhost:3001/api/pix/recipient-info?key=11111111111');
        expect(res.status).toBe(401);
    });
});
```

- [ ] **Step 2: Adicionar `bearerAuth()` ao handler**

**Antes:**
```javascript
apiRouter.get('/pix/recipient-info', asyncHandler(async (req, res) => {
```

**Depois:**
```javascript
apiRouter.get('/pix/recipient-info', bearerAuth(), asyncHandler(async (req, res) => {
```

- [ ] **Step 3: Verificar que o frontend passa o token nessa chamada**

Arquivo: `WEB/services/api.ts`, função `getPixRecipientInfo` (linha ~217).

**Antes:**
```typescript
const result = await apiCall<...>(`/pix/recipient-info?key=...`, {
    method: 'GET',
});
```

**Depois:**
```typescript
const token = localStorage.getItem('authToken');
const result = await apiCall<...>(`/pix/recipient-info?key=...`, {
    method: 'GET',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
});
```

- [ ] **Step 4: Rodar os testes**

```bash
cd API && npm test
```

- [ ] **Step 5: Commit**

```bash
git add API/index.cjs WEB/services/api.ts
git commit -m "security: exigir autenticacao em GET /pix/recipient-info"
```

---

## Task 8: Remover JWT do localStorage — usar somente cookie httpOnly

**Files:**
- Modify: `WEB/services/api.ts` — remover leituras de `localStorage.getItem('authToken')`
- Modify: `WEB/App.tsx` — verificar se o token é salvo no localStorage após login
- Test: `WEB/tests/Login.test.tsx`

**Interfaces:**
- O cookie httpOnly já é enviado automaticamente via `credentials: 'include'` em todas as chamadas `apiCall`
- Produz: `localStorage.getItem('authToken')` retorna `null` — autenticação via cookie exclusivamente

- [ ] **Step 1: Verificar onde o token é salvo no localStorage**

```bash
grep -n "localStorage" WEB/App.tsx WEB/context/AuthContext.tsx WEB/components/Login.tsx
```

Anotar todos os arquivos que fazem `localStorage.setItem('authToken', ...)`.

- [ ] **Step 2: Remover `localStorage.setItem('authToken', ...)` de cada arquivo encontrado**

Para cada arquivo, remover a linha que salva o token. O cookie já é gerenciado automaticamente pelo browser (o backend faz `res.cookie('token', token, { httpOnly: true, ... })`).

- [ ] **Step 3: Remover `localStorage.getItem('authToken')` de `WEB/services/api.ts`**

As funções que buscam o token para passar no header `Authorization` **não precisam mais fazer isso** — o cookie é enviado automaticamente via `credentials: 'include'`. Remover todas as ocorrências do padrão:

```typescript
const token = localStorage.getItem('authToken');
if (!token) return { success: false, message: 'Não autenticado.' };
// ...
headers: { 'Authorization': `Bearer ${token}` },
```

Para cada função, simplesmente remover a leitura do token e o header `Authorization` — o cookie cuida da auth.

Exemplo — `getUserMe` (linha ~74):

**Antes:**
```typescript
export const getUserMe = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };
    const result = await apiCall<...>('/users/me', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    return result;
};
```

**Depois:**
```typescript
export const getUserMe = async () => {
    const result = await apiCall<...>('/users/me', {
        method: 'GET',
    });
    return result;
};
```

Repetir para todas as funções que seguem esse padrão em `api.ts`.

- [ ] **Step 4: Rodar os testes do WEB**

```bash
cd WEB && npm test
```

Saída esperada: todos passam (as chamadas de API passam o cookie automaticamente em ambiente de teste com `credentials: 'include'`).

- [ ] **Step 5: Commit**

```bash
git add WEB/services/api.ts WEB/App.tsx WEB/context/AuthContext.tsx WEB/components/Login.tsx
git commit -m "security: remover JWT do localStorage — autenticar exclusivamente via cookie httpOnly"
```

---

## Checklist de Self-Review

### 1. Cobertura dos problemas identificados

| Problema | Task | Status |
|---|---|---|
| `/auth/fix-password` sem auth | Task 1 | ✅ |
| PIX transfer CPF spoofing | Task 2 | ✅ |
| PIX transfer-credit CPF spoofing | Task 3 | ✅ |
| Token de reset previsível | Task 6 | ✅ |
| `/user/limits/pix-daily/:cpf` sem ownership | Task 4 | ✅ |
| SQL injection request-password-reset | Task 5 | ✅ |
| SQL injection reset-password | Task 5 | ✅ |
| JWT no localStorage | Task 8 | ✅ |
| `/pix/recipient-info` sem auth | Task 7 | ✅ |
| cardTransactions duplicado | Não incluído — refactor puro, sem risco de segurança; fazer em PR separado |

### 2. Ordem de execução recomendada

Tasks 1→2→3 são independentes e podem rodar em qualquer ordem.
Task 4 é independente.
Task 5 deve rodar antes da Task 6 (extrai `escapeSQL` que Task 6 usa).
Task 7 deve rodar após verificar que frontend passa token corretamente.
Task 8 é a última — garante que não há regressão de auth antes de remover localStorage.

### 3. Dependências entre tasks

- Task 6 depende de `escapeSQL` extraído na Task 5 — executar 5 antes de 6
- Task 7 depende de Task 8 estar planejada — verificar `getPixRecipientInfo` em api.ts (Task 7 Step 3) antes de remover localStorage (Task 8)
