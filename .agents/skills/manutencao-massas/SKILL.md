---
name: manutencao-massas
description: >-
  Runbook de manutenção de massas financeiras do FintechBank. Use quando a
  auditoria (run_audit_consistency_report.js) acusar discrepância/anomalia em
  massa (CPF), ou quando o usuário relatar erro em fatura de massa — pagamento
  dividido em 2+ lançamentos, encargos criados após quitação, fatura quitada
  herdando dias de atraso, fatura aberta zerada após pagamento, dias de atraso
  errados, saldo credor perdido. Siga o diagnóstico e a correção abaixo antes de
  alterar qualquer dado. NUNCA edite fatura FECHADA (imutável) — a quitação é
  derivada por cascata na leitura.
---

# Manutenção de Massas Financeiras

Runbook de correção para massas com estado financeiro inconsistente. Este
documento é a fonte de verdade para o motor/cron/agente corrigir a massa quando
o problema acontecer — os scripts de correção pontual ficam em `scripts/manutencao/`
(gitignorado; consulte-os conforme o caso).

## 1. Diagnóstico (sempre primeiro)

Rode a auditoria oficial e localize o CPF:

```bash
cd API
node scripts/run_audit_consistency_report.js --csv
```

O relatório aponta: **discrepâncias** (dias de atraso × esperado por fatura) e
**anomalias estruturais** (pagamento dividido, encargo pós-quitação). Inspecione
a massa em detalhe:

```bash
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const cpf = process.argv[1] || '80535757654';
  const g = await p.query(\`SELECT id, status, due_date, valor_total, valor_pago, dias_atraso, data_pagamento FROM fintech.invoices WHERE cpf='\${cpf}' ORDER BY due_date\`);
  console.table(g.rows);
  const t = await p.query(\`SELECT date, amount, description, invoice_id FROM fintech.transactions WHERE cpf='\${cpf}' ORDER BY date\`);
  console.table(t.rows);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
\` 80535757654
```

Verifique: quantas faturas fechadas não pagas, o total pago (soma dos
`INVOICE_PAYMENT`), e se há 2+ transações de pagamento no mesmo instante
(pagamento dividido).

### 1b. Confirmar a entrega no Telegram (log persistente)

Comprovantes/avisos vão ao tópico da massa no Telegram. O histórico de envios é
**durável** na tabela `fintech.telegram_message_log` (o Telegram não expõe API
para ler o histórico de tópicos — cada envio do `telegramService` grava 1 linha
por destino: `cpf`/`pagamentos`/`general`). Para verificar se a massa recebeu a
mensagem:

```bash
cd API
# Verifica envio de PDFs (fatura fechada/aberta) no tópico e lista os últimos
# envios persistidos da massa — respostas autoritativas da Bot API (message_id)
node scripts/verify_topic_733.cjs --cpf 80535757654 --topic 1415

# Ou consulte direto a tabela
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const { rows } = await p.query(\`SELECT category, destination, message_type, message_id, ok, error, created_at
      FROM fintech.telegram_message_log WHERE cpf='\${process.argv[1]}' ORDER BY created_at DESC, id DESC LIMIT 10\`);
  for (const r of rows) console.log(r.created_at, '|', r.category, '->', r.destination, '('+r.message_type+')', r.ok ? 'OK msg#'+r.message_id : 'ERRO '+(r.error||''));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
\` 80535757654
```

No painel admin WEB (Telegram → Histórico de Envios) ou via API:
`GET /admin/telegram/log?cpf=&category=&destination=&limit=` mostra o mesmo
histórico, com `ok:true/false` e o `message_id` quando entregue. `ok:false` +
`error` = envio falhou (tópico ausente, bot sem permissão) — não é problema da
massa, é de canal.

## 2. Regra de negócio canônica (fonte da verdade)

- **Pagamento = UMA transação** `INVOICE_PAYMENT` com o valor total (igual ao
  comprovante). NUNCA dividir em N transações por fatura.
- **Distribuição por cascata** (`planDistribution`, em `API/utils/billing`):
  da fatura mais antiga para a mais nova, excedente = saldo credor (residual
  negativo).
- **Encargos estopam** quando a dívida das faturas FECHADAS é coberta pelo
  pagamento → `dias_atraso = 0` e sem geração de novos encargos.
- **Fatura aberta NÃO zera**: continua somando compras + encargos restantes.
- **Fatura FECHADA é imutável** — nunca escrever `data_pagamento`/`valor_pago`
  nela; a quitação é derivada na leitura.

## 3. Correção

### 3a. Sincronizar dias de atraso (drift pré-existente)

```bash
cd API
node scripts/sync_dias_atraso.cjs            # dry-run
node scripts/sync_dias_atraso.cjs --confirm  # aplica
```

### 3b. Juntar pagamento dividido em 1 transação

Se o extrato mostra 2+ `INVOICE_PAYMENT` no mesmo instante (o usuário pagou uma
vez), consolide em 1 transação com o valor total. O script de referência está em
`scripts/manutencao/` — procure por `fix_massa_1tx` ou reaplique o padrão:
somar os `ABS(amount)`, manter a descrição/origem, remover as extras e ancorar o
`invoice_id` na fatura mais recente em aberto (a que ancora o comprovante).

### 3c. Remover encargos criados APÓS a quitação

O motor diário pode ter inserido `billing_charges` `pending` em fatura já paga
(se rodou com código pré-cascata). Identifique: `created_at > data do último
INVOICE_PAYMENT` e fatura quitada pela cascata. Delete apenas essas linhas
(encargos ANTERIORES ao pagamento são legítimos — NÃO remover).

### 3d. Recalcular encargos de massa específica

Para recalcular charges de uma massa, use os scripts em `scripts/manutencao/`
(`recompute_charges_*.cjs`, `freeze_encargos_*.cjs`, `cleanup_duplicate_charges.cjs`).
Leia o cabeçalho do script antes de executar — todos têm modo dry-run.

## 4. Validação pós-correção

```bash
cd API
node scripts/run_audit_consistency_report.js --csv   # 0 discrepâncias / 0 anomalias
node scripts/sync_dias_atraso.cjs --confirm
npm test -- --silent                                  # suíte completa (662 testes)
```

Confirme na massa corrigida: `account_status = 'adimplente'` (se quitada),
`days_overdue = 0`, `overdue_status = 'EM_DIA'`, faturas com `dias_atraso = 0`
e a fatura aberta com valor correto (compras + encargos restantes). Se a massa
relatou comprovante não entregue, rode `verify_topic_733.cjs --cpf <cpf>` e
confirme `ok:true` + `message_id` no `telegram_message_log` (ver §1b).

## 5. Referências

| Componente | Papel |
|---|---|
| `API/utils/billing` → `planDistribution` | Distribuição por cascata (fonte da verdade) |
| `API/index.cjs` → `runBillingValidation` / `syncInvoiceDiasAtraso` | Motor diário com cascata |
| `API/src/controllers/invoiceController.js` → `persistPaymentDistribution` | Grava 1 tx de pagamento |
| `API/scripts/audit_helpers.cjs` | Regras da auditoria (cascata + âncoras) |
| `API/scripts/sync_dias_atraso.cjs` | Sync oficial de `dias_atraso` (com cascata) |
| `API/scripts/run_audit_consistency_report.js` | Relatório diário + varredura de anomalias |
| `API/repositories/usersRepo.js` → `overdueStatusFor` | Tier `overdue_status` (EM_DIA / 7D / 15D / 30D) |
| `API/repositories/telegramMessageLogRepo.js` | Log persistente de envios (tabela `telegram_message_log`) |
| `API/scripts/verify_topic_733.cjs` | Verifica PDFs no tópico + lista envios persistidos (`--cpf`/`--topic`) |
| `GET /admin/telegram/log` | Rota admin do histórico (cpf/category/destination/limit) |
| `scripts/manutencao/` | Scripts one-off de correção pontual (gitignorado) |
