# Spec: Billing (Faturamento)

**Arquivo de implementação:** `API/utils/billing.js`, `API/index.cjs`
**Issue:** #35
**Status:** Implementado

## Regras de Negócio

### Ciclo de fatura (`computeCurrentCycle`)

Configurado via `billing_config` (tabela singleton `id=1`):

| Parâmetro | Tipo | Default | Restrição |
|-----------|------|---------|-----------|
| `close_day` | int | 20 | 1–28 |
| `due_day` | int | 10 | 1–28 |
| `grace_period_days` | int | 3 | 0–30 |
| `is_active` | bool | true | — |

**Diagrama de estados** (ex: close_day=20, due_day=10, grace=3):

```
Dia 1–9   → aberta       (fatura aceita lançamentos)
Dia 10    → vencida      (due_day: vencimento ciclo anterior)
Dia 11–13 → vencida      (dentro da carência)
Dia 14–19 → inadimplente (carência esgotada)
Dia 20–31 → fechada      (novo ciclo fechado, aguarda pagamento)
```

**Caso especial:** quando `due_day < today.day < close_day`, a verificação é do ciclo *anterior* (mês corrente, não próximo mês).

### Encargos (`calcCharges`)

- Multa: **2% flat** sobre o valor da fatura
- Juros: **0.0333%/dia** (≈1%/mês)
- Arredondamento: 2 casas decimais

```js
multa = invoiceAmount * 0.02
juros = invoiceAmount * 0.000333 * daysOverdue
total = multa + juros
```

### Status da conta (`account_status`)

| Status | Condição |
|--------|----------|
| `adimplente` | Default, em dia |
| `inadimplente` | Fatura vencida além da carência |
| `suspenso` | Bloqueio manual pelo admin |

## Endpoints

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/admin/billing/config` | admin | Ver parâmetros |
| PUT | `/admin/billing/config` | admin | Alterar close_day, due_day, grace, is_active |
| GET | `/admin/billing/accounts-status` | admin | Listar status de todas as contas |
| POST | `/admin/billing/run-cycle` | admin | Executar validação manual de todas as contas |
| GET | `/admin/billing/account/:cpf/status` | admin | Status billing de uma conta |
| GET | `/billing/invoice-status` | user | Status da fatura do usuário autenticado |

## Idempotência

`run-cycle` verifica existência de `billing_charges` com `(cpf, invoice_reference, status='pending')` antes de inserir — chamadas repetidas no mesmo ciclo não duplicam encargos.

## Exposição em `/users/me`

```json
{
  "accountStatus": "adimplente | inadimplente | suspenso",
  "daysOverdue": 0,
  "pendingCharges": 0.00,
  "billingCycle": {
    "ref": "2026-06",
    "status": "aberta | fechada | vencida | inadimplente",
    "closeDate": "2026-06-20T00:00:00.000Z",
    "dueDate": "2026-07-10T00:00:00.000Z",
    "isActive": true
  }
}
```

## Tabelas

```sql
-- billing_config (singleton)
CREATE TABLE billing_config (
  id INT PRIMARY KEY DEFAULT 1,
  close_day INT DEFAULT 20,
  due_day INT DEFAULT 10,
  grace_period_days INT DEFAULT 3,
  is_active BOOLEAN DEFAULT TRUE
);

-- billing_charges (por usuário por ciclo)
CREATE TABLE billing_charges (
  id SERIAL PRIMARY KEY,
  cpf VARCHAR(11),
  invoice_reference VARCHAR(7),  -- 'YYYY-MM'
  charge_type VARCHAR(20),       -- 'multa' | 'juros'
  amount DECIMAL(10,2),
  days_overdue INT,
  invoice_amount DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(10) DEFAULT 'pending'
);
```

## Testes

`API/tests/billing.test.js` — 40 testes, 5 suites:
1. `computeCurrentCycle` — todos os estados do ciclo
2. `calcCharges` — multa, juros, arredondamento
3. `PUT /admin/billing/config` — validação de bounds
4. `POST run-cycle` — idempotência, transições
5. `GET /billing/invoice-status` — formato da resposta
