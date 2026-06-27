# Plano de Migração — new-base-fintechbank → WEB

> **Base**: `WEB/new-base-fintechbank/` torna-se o novo `WEB/`
> **Adaptação**: infraestrutura do WEB antigo (auth, router, API) é portada PARA DENTRO da nova base
> **Data**: 27/06/2026

---

## Princípio Fundamental

```
new-base-fintechbank/ = NOVA FUNDAÇÃO (UI, design system, componentes)
WEB/ antigo          = FORNECE infraestrutura (auth, routing, API, mock, types)
```

O WEB antigo NÃO é a base. O `new-base-fintechbank` é a base.
A infraestrutura do WEB antigo (auth, router, API, mock) se adapta para dentro dele.

---

## O que sai do WEB antigo e vai para a nova base

| Item | Arquivo(s) de origem | Destino na nova base |
|------|----------------------|----------------------|
| Auth system | `context/AuthContext.tsx`, `ProtectedRoute.tsx` | `src/context/` |
| Rotas | `App.tsx` (routes), `index.tsx` (BrowserRouter) | envolver o App.tsx da nova base |
| Login/SignUp/Reset | `components/Login.tsx`, `SignUp.tsx`, `ResetPassword.tsx` | `src/components/auth/` |
| API real | `services/api.ts` | `src/services/api.ts` |
| Mock API | `services/mockApi.ts` | `src/services/mockApi.ts` |
| Mock data | `data/mockData.ts` | `src/data/mockData.ts` |
| Formatadores | `utils/formatters.ts` | `src/utils/formatters.ts` |
| Types de domínio | `types.ts` | mesclar com os types da nova base |
| Vite config | `vite.config.ts` (GitHub Pages base, alias mock) | mesclar |
| Testes | `tests/` | `src/tests/` |

## O que fica de fora (único item removido)

| Item | Motivo |
|------|--------|
| `AiAssistantModal.tsx` | Depende exclusivamente de LLM/Gemini |

---

## Ordem de Execução

```
TASK 0  → API: novos endpoints + Swagger           (P0 — backend primeiro)
TASK 1  → Tailwind v4: resolver conflito/migrar    (P0 — bloqueador de UI)
TASK 13 → Auth + Router + PreLoginDashboard        (P0 — fundação da app)
TASK 2  → Navbar: conectar ao React Router         (P1)
TASK 10 → Header: substituir dados hardcoded       (P1)
TASK 3  → HomeView: substituir dados hardcoded     (P1)
TASK 11 → Modais globais: conectar à API           (P2)
TASK 12 → Toast + Notificações: conectar           (P2)
TASK 4  → CardsView: dados reais do banco          (P3)
TASK 5  → StatementView: dados reais + exportação  (P3)
TASK 6  → InvoiceView: dados reais                 (P3)
TASK 7  → LimitView: dados reais + validação       (P4)
TASK 8  → ShopView: dados reais + fix alert()      (P4)
TASK 9  → ProfileView: dados reais + auth          (P4)
```

---

## TASK 0 — Atualização da API e Swagger (P0)

**Arquivo**: `API/index.cjs`

### POST /api/pix/categorize — substitui Gemini
```json
Body:     { "description": "string", "userId": "string" }
Response: { "category": "refeicao", "confidence": 92, "reason": "Palavra-chave: ifood" }
Lógica:
  1. Dicionário de keywords por categoria (alta confiança)
  2. Histórico de transações do usuário no banco (confiança média)
  3. Fallback: { category: "outros", confidence: 30 }
```

### GET /api/financial-health/:userId — substitui FinancialHealthModal AI
```json
Response: { "score": 78, "creditScore": 650, "suggestions": [], "risks": [] }
Lógica: calcula a partir de transactions + creditCard no banco
```

### CRUD /api/recurring-bills/:userId
```
GET    /api/recurring-bills/:userId
POST   /api/recurring-bills/:userId
PUT    /api/recurring-bills/:userId/:billId
DELETE /api/recurring-bills/:userId/:billId
```

### POST /api/statement/export
```json
Body:     { "userId": "string", "format": "pdf|csv", "filter": "all|filtered", "transactions": [] }
Response: arquivo para download
```

### Swagger
- Documentar todos os novos endpoints
- Atualizar schemas com campos `category`, `confidence`

---

## TASK 1 — Tailwind v4: resolver conflito (P0)

**Problema**: nova base usa v4 (`@import "tailwindcss"` + `@theme {}`). WEB antigo usa v3.

**Recomendação**: manter v4 (já funciona na nova base — não regredir).

### O que fazer
- Manter `src/index.css` da nova base com `@theme {}` intacto
- Remover referência ao `tailwind.config.js` do WEB antigo
- Verificar tokens do WEB antigo que não existem na nova base e adicionar ao `@theme {}`
- Atualizar `vite.config.ts` para usar `@tailwindcss/vite` plugin (v4)

---

## TASK 13 — Auth + Router + PreLoginDashboard (P0)

**Base**: `WEB/new-base-fintechbank/src/App.tsx` (nova fundação)

### 1. Instalar React Router DOM
```bash
npm install react-router-dom
```

### 2. index.tsx — wrapping com BrowserRouter
```tsx
import { BrowserRouter } from 'react-router-dom';
root.render(<BrowserRouter><App /></BrowserRouter>);
```

### 3. Adicionar AuthContext
Copiar `context/AuthContext.tsx` do WEB antigo → `src/context/AuthContext.tsx`.
Adaptar interface `User` para coincidir com os types da nova base.

### 4. App.tsx — adicionar rotas ao topo do App atual
```tsx
// O conteúdo atual do App.tsx da nova base vira <DashboardApp />
<AuthContext.Provider value={...}>
  <Routes>
    <Route path="/"               element={<PreLoginDashboard />} />
    <Route path="/login"          element={<Login />} />
    <Route path="/signup"         element={<SignUp />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/dashboard"      element={<ProtectedRoute><DashboardApp /></ProtectedRoute>} />
  </Routes>
</AuthContext.Provider>
```

### 5. Login/SignUp/ResetPassword
Copiar do WEB antigo e estilizar com tokens da nova base (`.btn-primary`, `.modal-card`).

### 6. Fix encoding UTF-8 na nova base
Corrigir `TerÃ§a-feira` → `Terça-feira` e similares no App.tsx.

### 7. Fix dados hardcoded na nova base
Substituir `name: 'GILVAN SILVA'`, `email: 'gillvanjs@gmail.com'` por `useAuth()`.

### 8. Vite config
Mesclar configurações do WEB antigo:
- `base: '/FintechBankApp/'` (GitHub Pages)
- Alias `./services/api` → mockApi quando `VITE_USE_MOCK_API=true`

---

## TASK 2 — Navbar (P1)

Navbar.tsx JÁ EXISTE na nova base com pill flutuante + animação.
**Trabalho**: substituir o state interno de `currentView` por `useNavigate()` do React Router.

---

## TASK 10 — Header + Central Hub (P1)

Header.tsx JÁ EXISTE na nova base (1089 linhas).
**Trabalho**:
- Substituir `userProfile` hardcoded por `useAuth()`
- Conectar drawers analíticos a `api.getTransactions()` e `GET /api/financial-health`
- Conectar Central Hub drag-and-drop ao localStorage (já funciona, só persistir)

---

## TASK 3 — HomeView (P1)

HomeView.tsx JÁ EXISTE na nova base (6125 linhas).
**Trabalho**: substituir todos os dados hardcoded por chamadas à API:
- `balance` → `api.getUser(userId).balance`
- `transactions` → `api.getTransactions(userId)`
- `creditCard` → `api.getCreditCard(userId)`
- Contas recorrentes → `GET /api/recurring-bills/:userId`
- Stories → persistência em localStorage

---

## TASK 11 — Modais Globais: conectar à API (P2)

### PixModal
Substituir chamada Gemini por `POST /api/pix/categorize`.

### DepositModal
`onDepositComplete` → `api.deposit(userId, amount)`.

### BiometricModal
`onSuccess` → validar token de sessão da API existente.

### FinancialHealthModal
Buscar de `GET /api/financial-health/:userId`.

### RecurringBillModal
CRUD via `/api/recurring-bills/:userId`.

### ❌ AiAssistantModal — removido

---

## TASK 12 — Toast + Notificações (P2)

Toast e notificações JÁ EXISTEM na nova base.
**Trabalho**: `checkRecurringBillNotifications()` deve usar dados da API real.

---

## TASK 4 — CardsView (P3)

JÁ EXISTE. **Trabalho**: `api.getCreditCard(userId)` + `api.payCreditCardInvoice()`.

---

## TASK 5 — StatementView (P3)

JÁ EXISTE. **Trabalho**: `api.getTransactions(userId)` + `POST /api/statement/export`.

---

## TASK 6 — InvoiceView (P3)

JÁ EXISTE. **Trabalho**: `api.getCreditCard(userId)` para invoiceAmount e datas.

---

## TASK 7 — LimitView Wizard (P4)

JÁ EXISTE. **Trabalho**: limite real do usuário + zerar PIN pré-preenchido + corrigir cores hardcoded.

---

## TASK 8 — ShopView (P4)

JÁ EXISTE. **Trabalho**: substituir `alert()` por Toast + conectar VoltPet a `POST /api/recurring-bills`.

---

## TASK 9 — ProfileView (P4)

JÁ EXISTE. **Trabalho**: `useAuth()` em vez de dados hardcoded + persistir tema + Smart Alerts no banco.
