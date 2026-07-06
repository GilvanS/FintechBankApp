# SPEC — Cartões: Backend Real + Integração Frontend

**Data:** 2026-07-05 · **Branch:** `feature/mobile-web-redesign`
**Complementa:** `2026-07-05-gestao-cartoes-fisico-virtual-e-status.md` (porte da new-base) — este spec registra a evolução para **backend real** feita pelo usuário e o que falta integrar.

---

## 1. O QUE JÁ FOI FEITO

### 1.1 Motor de Faturas (backend — API/)
- **`API/services/invoiceEngine.js` (novo)**: varre usuários; corte = `invoiceDueDate − 7 dias`; ao passar do corte cria registro em `invoices` (status FECHADA) e avança `credit_card_invoice_due_date` +1 mês.
- **Cron** interno diário à meia-noite (`node-cron`, `0 0 * * *`) em `API/index.cjs`.
- **Endpoints admin**: `PUT /admin/invoices/:cpf/due-date` (body `{ invoiceDueDate: ISO }`) e `POST /admin/invoices/engine/force-cycle` (body `{ cpf }`).
- `/users/me`: fatura aberta/fechada e cutoff agora **dinâmicos** por usuário (removida a lógica estática de `billing_config`).

### 1.2 Ciclo de vida do cartão físico (backend)
- **Colunas novas em `users`**: `card_cvv` (últimos 3 dígitos do CPF), `card_expiry` (criação +5 anos, ex.: `07/31`), `card_delivery_status` (default `manufacturing`), `card_is_activated` (default false), `profile_message`.
- **Esteira automática por tempo** (`normalizeUser` usa `created_at`): <1h `manufacturing` → 1-2h `shipping` → >2h `delivered` → ativado = `unlocked`.
- **`POST /api/cards/physical/activate`**: valida `cvv`+`expiry` contra o banco; seta `card_is_activated=true` e **gera o cartão real** na tabela `fintech.cards`.
- **`PUT /api/cards/physical/test-delivery-status`**: avança etapa manualmente (testes).
- **Regras de compra**: débito em conta passa sempre; crédito/cartão físico exige `card_is_activated=true` (shop/checkout + endpoints admin).
- **Migração**: 30 usuários com `delivered` + CVV/validade preenchidos.

### 1.3 Tabela `fintech.cards` + endpoints
- Campos: `card_number` (formatado), `card_number_raw`, `card_type` (physical/virtual), `card_brand`, `bin` (**5981012** Mastercard + Luhn), `expiry`, `expiry_short`, `cvv`, `pin` (**9898** mock p/ todos), `is_activated`, `is_blocked`, `nickname`, `created_at`.
- **`GET /api/cards/my-cards`** (Bearer): retorna `{ success, cards: [{ id, number, numberMasked, type, brand, expiry, expiryShort, cvv, pin, isActivated, isBlocked, nickname, createdAt }] }`.
- **`POST /api/cards/virtual/generate`**: gera cartão virtual (CVV próprio aleatório).

### 1.4 Frontend WEB já refatorado
- `CardsView.tsx`: esteira usa `creditCard.deliveryStatus`/`isActivated` do backend (**sem localStorage** p/ físico); chama `/api/cards/physical/activate` e `/api/cards/physical/test-delivery-status` com Bearer `authToken` (bug `volt_token` corrigido; prefixo `/api` corrigido).
- `Profile.tsx`: exibe `profileMessage` ("Cartão de Crédito em Produção").
- `types.ts`: `CreditCard.deliveryStatus?/isActivated?`; `User.profileMessage?/createdAt?`.
- `CardDashboard.tsx`: shell (header + pagamento real PIN+backend) → renderiza `CardsView`.
- `CardDeliveryTracking.tsx`: timeline SVG (4 fases) portada da new-base.
- `global.css`: isenções `.stories-dark`/`.credit-card-shell`/`.exempt-brutalist`.

### 1.5 Credenciais de teste (pgdb)
- **Senha padrão das massas: `12345678`** (reset em 30 usuários). Exceção: Wade `12464865954` → `admin999`.
- ⚠️ **VERIFICAR**: `11111111111` (Gilvan) deve permanecer `admin999` (regra do projeto — nunca alterar). O reset pode tê-la sobrescrito para `12345678`.
- Ativação: CVV = últimos 3 dígitos do CPF; Validade = criação +5 anos (ex.: Wade CVV `954`, `07/31`). PIN: `9898`.

---

## 2. TAREFA ATUAL (em execução)

**Conectar `GET /api/cards/my-cards` na tela de Cartões — número SEMPRE truncado.**
- `services/api.ts` (+ stub no `mockApi.ts`): `getMyCards()` via `apiCall`.
- `CardsView.tsx`: busca cartões no mount e re-busca após ativação; face do cartão físico exibe `numberMasked` da API (fallback: últimos 4 do `creditCard.number`); validade = `expiryShort`; CVV revelável pelo olho (número **não** — truncado sempre).

## 3. BACKLOG (próximas features, em ordem sugerida)

1. ~~**Revelar número completo**~~ ✅ **FEITO (2026-07-06, commit 7e2bd47b)**: olho abre PasswordModal → PIN do cartão (mock `9898`, validado contra `apiCard.pin`) → revela número+CVV por 20s e re-trunca; PIN errado mantém o modal com aviso.
2. ~~**Cartões virtuais via API**~~ ✅ **FEITO (2026-07-06, commit 1f48cd3a)**: novos endpoints `PUT /api/cards/:id/toggle-block` e `DELETE /api/cards/:id` (só virtual, escopo por cpf); CardsView deriva virtuais de `my-cards`, cria via `generate` (só apelido — backend não tem tipos 24h/data), fim do `localStorage volt_virtual_cards`.
3. ~~**Hint desatualizado no form de desbloqueio**~~ ✅ **FEITO (commit 1f48cd3a)**: hint agora aponta CVV=últimos 3 dígitos do CPF + validade da mensagem do Perfil.
4. **Fase 2 MOBILE**: espelhar CardsView/CardDeliveryTracking/CardDashboard + isenções CSS em `variables.css` (MOBILE é Ionic/Capacitor — cópia 1:1, sem RN).
5. **Porte pendente da new-base**: HomeView (status SVG + stories-dark) e PixView (auto-categorização **mockada** — decisão: sem backend).
6. **Findings do react-review pendentes no `CardDeliveryTracking`**: `default` no switch (CRITICAL — valor sujo de status), stepper `<div onClick>` → `<button>` (a11y), `aria-hidden` em SVGs. (Foram aplicados e depois o arquivo foi substituído pela versão da base; sanitização hoje é feita pelo CardsView via `isDeliveryStatus`.)
7. **Open questions do usuário**: PIN de 4 dígitos na ativação além de CVV/validade? `profile_message` no Perfil (atual) ou na aba Cartões?

## 4. COMO TESTAR (resumo)
- Login massa: senha `12345678` (Wade/Gilvan: `admin999`). API `:3001`, WEB `:3000` ou `:3004`, MOBILE `:3002`.
- Fatura: `PUT /admin/invoices/11111111111/due-date` → `POST /admin/invoices/engine/force-cycle` → conferir telas de fatura.
- Cartão: tela Cartões → avançar esteira (botão de teste) → `delivered` → desbloquear com CVV=fim do CPF + validade da `profileMessage` → número truncado aparece na face do cartão.
