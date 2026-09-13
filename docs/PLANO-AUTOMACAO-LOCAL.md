# Plano de Instrumentação para Testes de Automação — Localhost

> Gerado em: 2026-06-17
> Objetivo: Tornar o WEB (localhost:3000 + API:3001) um alvo de qualidade para treinamento de automação com Selenium, Cypress e Playwright.
> GitHub Pages (mock/demo) → já está bom. Não alterar.

---

## Contexto

O site já tem excelente instrumentação em Login e PreLoginDashboard (todos os locators: `data-testid`, `data-cy`, `data-playwright`, `id`, `name`, `aria-label`, `className test-*`).

Problema: **80 de 96 componentes (83%) não têm nenhum seletor estável**.
Consequência: automações quebram com qualquer mudança de layout, XPath frágil, impossível manter.

---

## Score Atual (foco em automação)

| Fluxo | Score |
|-------|-------|
| Login + erros de validação | 10/10 🟢 |
| Cadastro (SignUp) | 8/10 🟢 |
| Tela de entrada (PreLogin) | 10/10 🟢 |
| PIX (parcial — sidebar, confirmação) | 6/10 🟡 |
| Marketplace + Compra | 2/10 🔴 |
| Navegação interna (BottomNavBar) | 1/10 🔴 |
| Extrato | 1/10 🔴 |
| Perfil | 1/10 🔴 |
| Usuários de teste | 8/10 🟢 |
| Reset de estado entre testes | 3/10 🔴 |
| **Score geral** | **4.5/10** 🔴 |

---

## Usuários de Teste Disponíveis

| CPF | Senha | Perfil | Cenário |
|-----|-------|--------|---------|
| `11111111111` | `1234` | Admin | Admin, R$10.000, role admin |
| `22222222222` | `123` | Beatriz | R$2.580, fatura normal, contatos PIX |
| `33333333333` | `123` | Daniel | R$1.500, fatura vencida (não bloqueado) |
| `44444444444` | `123` | Fernanda | R$800, cartão bloqueado |

---

## Issues — Ordem de Execução

```
#19  ──► #20  ──► #21  ──► #22  ──► #23
Nav      PIX    Compra   Perfil   API Reset
```

---

## Issues Criadas

| # | Issue | Labels | Link |
|---|-------|--------|------|
| #19 | Navegação: BottomNavBar + Dashboard | `automacao` `critico` | https://github.com/GilvanS/FintechBankApp/issues/19 |
| #20 | PIX: TransferForm + Statement | `automacao` `alta` | https://github.com/GilvanS/FintechBankApp/issues/20 |
| #21 | Compra: Marketplace → Checkout | `automacao` `alta` | https://github.com/GilvanS/FintechBankApp/issues/21 |
| #22 | Perfil: Profile + EditProfile | `automacao` `media` | https://github.com/GilvanS/FintechBankApp/issues/22 |
| #23 | API: Seed + /api/test/reset | `automacao` `api` `alta` | https://github.com/GilvanS/FintechBankApp/issues/23 |

---

### Issue #19 — Navegação: BottomNavBar + Dashboard
**Labels:** `automacao`, `critico`
**Fase:** 1 (desbloqueador — pré-requisito de tudo)

Sem locators na BottomNavBar, nenhum teste consegue navegar após o login. O Dashboard é o container do app logado e também não tem identificadores.

**Componentes:**
- `WEB/components/BottomNavBar.tsx` — 4 botões (Início, Cartões, Shop, Perfil)
- `WEB/components/Dashboard.tsx` — container + view state atual

**Locators a adicionar:**
```
BottomNavBar:
  nav#bottom-nav [data-testid="bottom-nav"]
  button#btn-nav-home [data-testid="nav-home"] [name="nav-home"]
  button#btn-nav-cards [data-testid="nav-cards"] [name="nav-cards"]
  button#btn-nav-shop [data-testid="nav-shop"] [name="nav-shop"]
  button#btn-nav-profile [data-testid="nav-profile"] [name="nav-profile"]

Dashboard:
  div#dashboard [data-testid="dashboard"] [data-cy="dashboard"]
  div#dashboard-content [data-testid="dashboard-content"]
  [data-current-view="{view}"]  ← atributo dinâmico para saber a tela ativa
```

**Skills/Agentes Claude:**
```bash
/sparc:coder    # Implementar as mudanças
/verify         # Verificar que app abre e BottomNavBar funciona
/code-review medium  # Revisar antes de commit
```

---

### Issue #20 — PIX: TransferForm + Statement
**Labels:** `automacao`, `alta`
**Fase:** 2 (após #19)

O fluxo PIX já tem Pix.tsx, PixSidebar, PixConfirmation, PixSuccessModal instrumentados. Falta o formulário de transferência e o extrato.

**Componentes:**
- `WEB/components/TransferForm.tsx` — formulário de envio PIX
- `WEB/components/Statement.tsx` — lista de transações
- `WEB/components/StatementPaginated.tsx` — versão paginada

**Locators a adicionar:**
```
TransferForm:
  form#pix-transfer-form [data-testid="pix-transfer-form"]
  input#pix-key-input [data-testid="pix-key-input"] [name="pix-key"]
  input#pix-amount-input [data-testid="pix-amount-input"] [name="pix-amount"]
  button#btn-pix-submit [data-testid="pix-submit-button"]
  [data-testid="pix-transfer-error"] — mensagem de erro

Statement:
  div#statement [data-testid="statement"]
  div#statement-list [data-testid="statement-list"]
  div.statement-item [data-testid="statement-item-{id}"]
  span[data-testid="statement-item-amount"]
  span[data-testid="statement-item-type"]
  span[data-testid="statement-item-date"]
```

**Skills/Agentes Claude:**
```bash
/sparc:coder    # Implementar locators
/verify         # Testar fluxo PIX end-to-end
```

---

### Issue #21 — Compra: Marketplace → Checkout completo
**Labels:** `automacao`, `alta`
**Fase:** 3 (após #19)

O fluxo de compra é o cenário E2E mais rico: navegar produtos → adicionar ao carrinho → escolher pagamento → confirmar com senha → recibo.

**Componentes (5 sem instrumentation):**
- `WEB/components/Marketplace.tsx` — grid de produtos
- `WEB/components/ShoppingCart.tsx` — carrinho lateral
- `WEB/components/PaymentMethods.tsx` — débito / crédito / parcelas
- `WEB/components/PurchaseModal.tsx` — confirmação de compra
- `WEB/components/PurchaseConfirmation.tsx` — recibo final
- `WEB/components/InstallmentModal.tsx` — seleção de parcelas

**Locators principais:**
```
Marketplace:
  div#marketplace [data-testid="marketplace"]
  div#product-grid [data-testid="product-grid"]
  div[data-testid="product-card-{id}"]
  button[data-testid="product-add-to-cart-{id}"]
  button#btn-open-cart [data-testid="open-cart-button"]

ShoppingCart:
  div#shopping-cart [data-testid="shopping-cart"]
  div[data-testid="cart-item-{id}"]
  span[data-testid="cart-total"]
  button#btn-checkout [data-testid="checkout-button"]
  button#btn-remove-item-{id} [data-testid="remove-item-{id}"]

PaymentMethods:
  div#payment-methods [data-testid="payment-methods"]
  button[data-testid="payment-debit"] [name="payment-debit"]
  button[data-testid="payment-credit"] [name="payment-credit"]
  button[data-testid="payment-installment"] [name="payment-installment"]

PurchaseModal:
  div#purchase-modal [data-testid="purchase-modal"]
  button#btn-confirm-purchase [data-testid="confirm-purchase"]
  button#btn-cancel-purchase [data-testid="cancel-purchase"]

InstallmentModal:
  div#installment-modal [data-testid="installment-modal"]
  button[data-testid="installment-option-{n}"]
  button#btn-confirm-installment [data-testid="confirm-installment"]

PurchaseConfirmation:
  div#purchase-confirmation [data-testid="purchase-confirmation"]
  span[data-testid="purchase-confirmation-amount"]
  button#btn-close-confirmation [data-testid="close-confirmation"]
```

**Skills/Agentes Claude:**
```bash
/sparc:coder        # Implementar (6 componentes)
/code-review high   # Revisar — fluxo crítico
/verify             # Fazer uma compra end-to-end
/run                # Abrir app e testar manualmente
```

---

### Issue #22 — Perfil: Profile + EditProfile
**Labels:** `automacao`, `media`
**Fase:** 4 (após #19)

Cenário de edição de dados pessoais — fluxo independente de compra e PIX.

**Componentes:**
- `WEB/components/Profile.tsx`
- `WEB/components/EditProfile.tsx`
- `WEB/components/MyData.tsx`
- `WEB/components/Settings.tsx`

**Locators:**
```
Profile:
  div#profile [data-testid="profile"]
  span[data-testid="profile-name"]
  span[data-testid="profile-email"]
  span[data-testid="profile-cpf"]
  button#btn-edit-profile [data-testid="edit-profile-button"]

EditProfile:
  form#edit-profile-form [data-testid="edit-profile-form"]
  input#edit-fullname [data-testid="edit-input-fullname"] [name="fullname"]
  input#edit-email [data-testid="edit-input-email"] [name="email"]
  button#btn-save-profile [data-testid="save-profile-button"]
  [data-testid="edit-profile-success"] — mensagem de sucesso
  [data-testid="edit-profile-error"]   — mensagem de erro
```

**Skills/Agentes Claude:**
```bash
/sparc:coder   # Implementar
/verify        # Editar perfil e confirmar persistência
```

---

### Issue #23 — API: Seed de Usuários de Teste + Endpoint de Reset
**Labels:** `automacao`, `api`, `alta`
**Fase:** 5 (paralelo a #21 e #22)

Testes E2E que rodam contra a API real precisam que os usuários existam no PostgreSQL e de um mecanismo para limpar estado entre runs.

**Tasks:**
- [ ] Criar `API/scripts/seed-test-users.js` com os 4 usuários de teste (CPFs: 11111111111, 22222222222, 33333333333, 44444444444)
- [ ] Adicionar `"seed:test": "node scripts/seed-test-users.js"` no `API/package.json`
- [ ] Criar `POST /api/test/reset` (apenas em `NODE_ENV !== 'production'`) — reseta saldo, transações e cartão dos usuários de teste
- [ ] Documentar no `API/CLAUDE.md` os endpoints de teste
- [ ] Garantir que seed roda automaticamente no CI antes dos testes

**Endpoint de reset:**
```javascript
// POST /api/test/reset
// Body: { cpf?: string }  // omit para resetar todos os 4
// Response: { success: true, reset: ['11111111111', ...] }
// Bloqueado em NODE_ENV=production
```

**Skills/Agentes Claude:**
```bash
/sparc:coder        # Implementar seed + endpoint
/security-review    # Garantir que endpoint não vaza em produção
/code-review medium # Revisar antes de commit
/verify             # Testar reset → login → saldo zerado
```

---

## Mapa de Skills Claude Code por Issue

| Issue | Skill Principal | Quando Usar |
|-------|----------------|-------------|
| #19 | `/sparc:coder` | Implementar locators no BottomNavBar + Dashboard |
| #20 | `/sparc:coder` + `/verify` | Implementar + validar fluxo PIX end-to-end |
| #21 | `/sparc:coder` + `/run` + `/verify` | 6 componentes + testar compra no browser |
| #22 | `/sparc:coder` + `/verify` | Implementar + editar perfil e confirmar |
| #23 | `/sparc:coder` + `/security-review` | Seed + endpoint de reset seguro |
| Todos | `/code-review` | Antes de cada commit |

## Agentes Claude para Execução em Paralelo

```javascript
// Para executar #19 e #23 em paralelo (são independentes):
Agent({ name: "coder-nav",    prompt: "Instrumentar BottomNavBar e Dashboard (Issue #19)" })
Agent({ name: "coder-api",    prompt: "Criar seed e endpoint /api/test/reset (Issue #23)" })

// Após #19 concluído, em paralelo:
Agent({ name: "coder-pix",    prompt: "Instrumentar TransferForm e Statement (Issue #20)" })
Agent({ name: "coder-shop",   prompt: "Instrumentar fluxo de compra completo (Issue #21)" })
Agent({ name: "coder-profile",prompt: "Instrumentar Profile e EditProfile (Issue #22)" })
```

---

## Score Esperado Após Conclusão

| Fluxo | Antes | Depois |
|-------|-------|--------|
| Navegação interna | 1/10 🔴 | 9/10 🟢 |
| PIX completo | 6/10 🟡 | 9/10 🟢 |
| Marketplace + Compra | 2/10 🔴 | 9/10 🟢 |
| Extrato | 1/10 🔴 | 9/10 🟢 |
| Perfil | 1/10 🔴 | 9/10 🟢 |
| Reset de estado | 3/10 🔴 | 9/10 🟢 |
| **Score geral** | **4.5/10** | **8.5/10** 🟢 |

---

## Convenção de Locators (padrão do projeto)

Todo elemento interativo deve ter:
```html
id="{page}-{element}"
name="{element}"
data-testid="{page}-{element}"
data-cy="{page}-{element}"
data-playwright="{page}-{element}"
class="... test-{element}"
```

Elementos de erro/sucesso:
```html
data-testid="{page}-{field}-error"   role="alert"   aria-live="polite"
data-testid="{page}-success-message" role="status"  aria-live="polite"
```

Ver `LOCATORS_GUIDE.md` para referência completa.
