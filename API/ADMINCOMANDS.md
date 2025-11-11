# Comandos de Administrador (API)

Este guia lista tudo que um ADMIN pode fazer na API, como obter o token JWT e executar operações administrativas. Todos os exemplos usam curl (Windows).

## Pré-requisitos

- Autenticação JWT ativa.
- Usuário admin padrão:
  - CPF: `99999999999`
  - Senha: `admin999`
- Sempre inclua o cabeçalho `Authorization: Bearer {TOKEN_ADMIN}` nas chamadas abaixo.
- Base URL padrão: `http://localhost:3001/api/v1`

## Obter Token (Login)

```bash
curl -X POST "http://localhost:3001/api/v1/auth/login" ^
 -H "Content-Type: application/json" ^
 -d "{\"cpf\":\"99999999999\",\"password\":\"admin999\"}"
```

Resposta esperada:
- `200` com `token` JWT no corpo. Use esse token nas chamadas de admin.

---

## Usuários (Admin)

- Listar todos os usuários

```bash
curl -X GET "http://localhost:3001/api/v1/admin/users" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}"
```

- Consultar um usuário específico

```bash
curl -X GET "http://localhost:3001/api/v1/admin/users/12345678901" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}"
```

- Fazer depósito na conta do usuário

```bash
curl -X POST "http://localhost:3001/api/v1/admin/users/12345678901/deposit" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}" ^
 -H "Content-Type: application/json" ^
 -d "{\"amount\":250.00}"
```

- Bloquear cartão do usuário

```bash
curl -X POST "http://localhost:3001/api/v1/admin/users/12345678901/block" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}"
```

- Desbloquear cartão do usuário

```bash
curl -X POST "http://localhost:3001/api/v1/admin/users/12345678901/unblock" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}"
```

- Atualizar limite diário PIX

```bash
curl -X PUT "http://localhost:3001/api/v1/admin/users/12345678901/pix-limit" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}" ^
 -H "Content-Type: application/json" ^
 -d "{\"newLimit\":5000}"
```

- Sinalizar solicitação de reset de senha

```bash
curl -X POST "http://localhost:3001/api/v1/admin/users/12345678901/reset-password" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}"
```

- Gerar senha temporária

```bash
curl -X POST "http://localhost:3001/api/v1/admin/users/12345678901/generate-temp-password" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}"
```

- Atualizar detalhes do cartão (vencimento, limites, pontos)

```bash
curl -X POST "http://localhost:3001/api/v1/admin/users/12345678901/card-details" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}" ^
 -H "Content-Type: application/json" ^
 -d "{\"invoiceDueDate\":\"2025-11-30T03:00:00.000Z\",\"availableLimit\":1800,\"totalLimit\":2000,\"pointsBalance\":1500}"
```

---

## Solicitações de Aumento de Limite PIX

- Listar solicitações

```bash
curl -X GET "http://localhost:3001/api/v1/admin/requests/limit" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}"
```

- Aprovar solicitação de um CPF

```bash
curl -X POST "http://localhost:3001/api/v1/admin/requests/limit/12345678901/approve" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}"
```

- Negar solicitação de um CPF (com motivo opcional)

```bash
curl -X POST "http://localhost:3001/api/v1/admin/requests/limit/12345678901/deny" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}" ^
 -H "Content-Type: application/json" ^
 -d "{\"reason\":\"historico insuficiente\"}"
```

---

## Solicitações de Reset de Senha

- Listar pedidos de reset pendentes

```bash
curl -X GET "http://localhost:3001/api/v1/admin/requests/password" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}"
```

- Aprovar pedido de reset (gera senha temporária e notifica)

```bash
curl -X POST "http://localhost:3001/api/v1/admin/requests/password/12345678901/approve" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}"
```

- Negar pedido de reset

```bash
curl -X POST "http://localhost:3001/api/v1/admin/requests/password/12345678901/deny" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}"
```

---

## Resetar Base (manter apenas o admin)

- Limpar todos os dados de usuários não-admin e recriar admin (`99999999999`)

```bash
curl -X POST "http://localhost:3001/api/v1/admin/reset/users" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}"
```

Resposta: `200` com `message: "Base resetada. Apenas admin mantido."`

---

## Faturas (Admin) — Alteração de Status

Status disponíveis: `FECHADA`, `ABERTA`, `FECHADA_COM_ATRASO`, `BLOQUEADA`.

- Alterar status da fatura de um cliente

```bash
curl -X POST "http://localhost:3001/api/v1/admin/invoices/12345678901/inv-2025-11/status" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}" ^
 -H "Content-Type: application/json" ^
 -d "{\"status\":\"BLOQUEADA\"}"
```

Regras:
- Somente ADMIN.
- Valida usuário e fatura.
- Não permite `FECHADA -> ABERTA` se existirem parcelas (`INVOICE_INSTALLMENT`) registradas.
- `BLOQUEADA` reflete bloqueio de cartão (`credit_card_is_blocked = true`).
- `ABERTA` reflete desbloqueio (`credit_card_is_blocked = false`).
- Frontend recebe `invoiceStatus` atualizado via `/users/me` e `/users/:cpf`.

---

## Dicas de Teste

- Sempre faça login com o admin para obter o `token`.
- Crie o(s) usuário(s) e provoque estados de fatura via compras parceladas (crédito) e endpoints de cartão:
  - `POST /cards/invoice/parcel`
  - `POST /cards/invoice/pay`
  - `POST /cards/invoice/anticipate`
- Depois de mudar o status de fatura, verifique:
  - `GET /users/{cpf}` — campos `invoiceStatus` e `isBlocked`.
  - UI de cartão/fatura no frontend.

---

## Compras no Cartão (Admin)

- Inserir compra na fatura ABERTA parcelada

```bash
curl -X POST "http://localhost:3001/api/v1/admin/users/12345678901/card/purchase/open" ^
 -H "Authorization: Bearer %ADMIN_TOKEN%" ^
 -H "Content-Type: application/json" ^
 -d "{\"amount\":199.90,\"description\":\"Compra teste fatura aberta\",\"installments\":6}"
```

- Inserir compra na fatura FECHADA parcelada (1a parcela vence agora)

```bash
curl -X POST "http://localhost:3001/api/v1/admin/users/12345678901/card/purchase/closed" ^
 -H "Authorization: Bearer {TOKEN_ADMIN}" ^
 -H "Content-Type: application/json" ^
 -d "{\"amount\":120.00,\"description\":\"Compra teste fatura fechada\",\"installments\":3}"
```

## Inserir compra em fatura ABERTA (Admin)
- A vista (1 parcela; desconto 10%; sem gerar parcelas):
```bash
curl -X POST "http://localhost:8080/admin/users/12345678901/card/purchase/open" -H "Authorization: Bearer %ADMIN_TOKEN%" -H "Content-Type: application/json" -d "{\"amount\": 500.00, \"description\": \"Compra vista\", \"installments\": 1}"
```
- Parcelado sem juros (2..12 parcelas):
```bash
curl -X POST "http://localhost:8080/admin/users/12345678901/card/purchase/open" -H "Authorization: Bearer %ADMIN_TOKEN%" -H "Content-Type: application/json" -d "{\"amount\": 1200.00, \"description\": \"Notebook\", \"installments\": 12}"
```
- Parcelado com juros (13..24; interestRate 1%..7%):
```bash
curl -X POST "http://localhost:8080/admin/users/12345678901/card/purchase/open" -H "Authorization: Bearer %ADMIN_TOKEN%" -H "Content-Type: application/json" -d "{\"amount\": 2000.00, \"description\": \"TV 75\", \"installments\": 18, \"interestRate\": 0.05}"
```

## Inserir compra em fatura FECHADA (Admin)
- A vista (1 parcela; desconto 10%; 1 negativa vencendo agora):
```bash
curl -X POST "http://localhost:8080/admin/users/12345678901/card/purchase/closed" -H "Authorization: Bearer %ADMIN_TOKEN%" -H "Content-Type: application/json" -d "{\"amount\": 300.00, \"description\": \"Ajuste vista\", \"installments\": 1}"
```
- Parcelado sem juros (2..12; 1a parcela agora, demais mensais):
```bash
curl -X POST "http://localhost:8080/admin/users/12345678901/card/purchase/closed" -H "Authorization: Bearer %ADMIN_TOKEN%" -H "Content-Type: application/json" -d "{\"amount\": 900.00, \"description\": \"Ajuste parcelado\", \"installments\": 6}"
```
- Parcelado com juros (13..24; interestRate obrigatorio):
```bash
curl -X POST "http://localhost:8080/admin/users/12345678901/card/purchase/closed" -H "Authorization: Bearer %ADMIN_TOKEN%" -H "Content-Type: application/json" -d "{\"amount\": 2400.00, \"description\": \"Ajuste parcelado juros\", \"installments\": 20, \"interestRate\": 0.07}"
```

Observações:
- Fatura aberta registra `CREDIT` e será exibida nas transações correntes do cartão.
- Fatura fechada registra `INVOICE_INSTALLMENT` (valor negativo) e será somada em `/cards/invoice/pay` como parcelas pendentes; após pagar, o total é debitado do saldo e removido dos `INVOICE_INSTALLMENT`.