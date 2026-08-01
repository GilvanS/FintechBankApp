# SKILL: Regras de Negócio — Fatura e Pagamento do Cartão de Crédito

> Versão compacta para agentes de IA. Consulte `docs/REGRAS-NEGOCIO-FATURA.md` para a referência completa.

---

## ⚠️ Regra Nº 1 — Antes de TUDO

> 🔗 Consulte as [seções 2.1 e 2.2](docs/REGRAS-NEGOCIO-FATURA.md#2-cálculo-do-saldo-devedor) no documento completo para a regra detalhada.

**NUNCA use `computeInvoiceGross()` como valor da fatura fechada!**

```
❌ ERRADO:  _closedInvoiceValorTotal = computeInvoiceGross(inv)   // = R$ 4.284,94
✅ CORRETO: _closedInvoiceValorTotal = inv.valor_total             // = R$ 3.870,86
```

`computeInvoiceGross` = `valor_total + multa + juros_mora + juros_rem + iof` — inclui ENCARGOS CONGELADOS. Usar isso como "total da fatura" causa dupla cobrança.

---

## 1. Estrutura de Dados — Tabela `invoices`

> 🔗 Consulte a [seção 7.1](docs/REGRAS-NEGOCIO-FATURA.md#71-tabela-invoices) no documento completo para a tabela completa com tipos e restrições.

| Coluna | Descrição |
|--------|-----------|
| `valor_total` | **PRINCIPAL** — compras do ciclo (NUNCA inclui encargos) |
| `valor_pago` | Quanto já foi pago desta invoice |
| `data_pagamento` | Timestamp de quando foi totalmente quitada |
| `multa`, `juros_mora`, `juros_remuneratorios`, `iof` | Encargos CONGELADOS no momento do seed/fechamento |
| `saldo_anterior` | Herança de encargos de fatura anterior |

---

## 2. Duas Funções, Dois Propósitos

> 🔗 Consulte a [seção 2.2](docs/REGRAS-NEGOCIO-FATURA.md#22-comparação-computeinvoicegross-vs-computeinvoiceowed) no documento completo para a tabela de usos completa com 11 contextos + diagrama.

| Função | Fórmula | Para que serve |
|:-------|:--------|:--------------|
| `computeInvoiceGross(inv)` | `valor_total + saldo_anterior + iof + multa + juros_mora + juros_rem` | **Filtrar** invoices com saldo > 0; **Auditar** overpayment |
| `computeInvoiceOwed(inv)` | `Math.max(0, valor_total - valor_pago)` | **Saldo devedor**; **Base de encargos**; **Target de quitação** |

**Regra de ouro:**

| Contexto | Use | NUNCA use |
|:---------|:---:|:---------:|
| `closedInvoice` (saldo devedor) | `valor_total - valor_pago` | `computeInvoiceGross` |
| `_closedInvoiceValorTotal` (badge PAGA) | `valor_total` | `computeInvoiceGross` |
| Base de cálculo de encargos | `valor_total - valor_pago` | `computeInvoiceGross` |
| Target de quitação (`planDistribution`) | `valor_total` | `computeInvoiceGross` |
| Filtro `.filter(i => ... > 0)` | `computeInvoiceGross` | `computeInvoiceOwed` |
| Auditoria de overpayment | `computeInvoiceGross` | `computeInvoiceOwed` |

---

## 3. Ciclo da Fatura

> 🔗 Consulte a [seção 1.1](docs/REGRAS-NEGOCIO-FATURA.md#11-datas) no documento completo para detalhes e estados da fatura.

| Evento | Dia | Descrição |
|--------|:---:|-----------|
| Fechamento | 20 | Fatura atual → FECHADA. Novas compras → próximo ciclo |
| Vencimento | 10 | Data limite para pagamento sem encargos |
| Grace Period | +3 dias | Dias úteis após vencimento antes de bloquear cartão |

---

## 4. Tipos de Pagamento

> 🔗 Consulte a [seção 3.1](docs/REGRAS-NEGOCIO-FATURA.md#31-tipos-de-pagamento) no documento completo para o fluxo de pagamento completo + tratamento de erro.

| Tipo | Condição | INSERT description | Merchant no Frontend |
|:-----|:---------|:-------------------|:---------------------|
| **Total** | `amount >= totalDue - 0.01` | (via `cardRepo.payDueInstallments`) | `"Pagamento fatura (Total)"` |
| **Mínimo** | `amount >= 10% de totalDue` | `'Pagamento minimo de fatura'` | `"Pagamento fatura (Mínimo)"` |
| **Parcial** | `amount < 10% de totalDue` | `'Pagamento parcial de fatura'` | `"Pagamento fatura (Parcial)"` |
| **Antecipação** | Parcelamento antecipado | `'Antecipacao de parcelas'` | `"Antecipacao de parcelas"` |

**Código da diferenciação (index.cjs ~4645):**
```javascript
const payDescription = payAmount >= minPayment
    ? 'Pagamento minimo de fatura'
    : 'Pagamento parcial de fatura';
```

---

## 5. Mapeamento PAYMENT (BD → Frontend)

> 🔗 Consulte as [seções 8](docs/REGRAS-NEGOCIO-FATURA.md#8-transação-de-pagamento-invoice_payment) e [6.4](docs/REGRAS-NEGOCIO-FATURA.md#64-transação-de-pagamento-payment-exibição-no-frontend) no documento completo para regras de display e consistência visual.

A transação `INVOICE_PAYMENT` passa por 5 estágios:

```
INSERT → SELECT → .map() → Filtro por janela → Renderização React
```

**Regras críticas do mapeamento:**

1. **PAYMENT aparece na fatura ABERTA** (`openTransactions`), NUNCA na fechada
2. **`currentInvoice` NÃO inclui PAYMENT** — `filter(tx => tx.type !== 'PAYMENT')`
3. **Amount no .map()** é `Math.abs(amount)` — sempre positivo
4. **Ordem dos matches importa:** `'parcial'` é verificado ANTES de `'minimo'`

**Código do mapeamento (index.cjs ~411):**
```javascript
const lowerDesc = (desc || '').toLowerCase();
if (lowerDesc.includes('parcial')) {
    merchant = 'Pagamento fatura (Parcial)';
} else if (lowerDesc.includes('minimo') || lowerDesc.includes('mínimo')) {
    merchant = 'Pagamento fatura (Mínimo)';
} else {
    merchant = 'Pagamento fatura (Total)';
}
```

---

## 6. Encargos — Regra de Herança

> 🔗 Consulte a [seção 4](docs/REGRAS-NEGOCIO-FATURA.md#4-encargos) no documento completo para cenários de herança, regras de exibição e fluxo de pagamento em atraso.

**Encargos da fatura fechada NUNCA aparecem no total da fechada. São HERDADOS pela fatura aberta.**

| Fórmula | Cálculo |
|:--------|:--------|
| Fórmula | Cálculo | Constante |
|:--------|:--------|:----------|
| Multa (2%) | `residual × 0,02` | `MULTA_RATE = 0.02` |
| Juros Mora (0,0333%/dia) | `residual × 0,000333 × dias` | `JUROS_MORA_DAILY = 0.000333` |
| Juros Rem (0,513%/dia) | `residual × 0,00513 × dias` | `JUROS_REM_DAILY = 0.00513` |
| IOF (0,38% fixo + 0,0082%/dia) | `residual × 0,0038 + residual × 0,000082 × dias` | `IOF_ADICIONAL_RATE = 0.0038` + `IOF_DIARIO_DAILY = 0.000082` |

**Base de cálculo = SEMPRE o residual (`valor_total - valor_pago`).** NUNCA o `valor_total` bruto.

**Função consolidada:** `calcAllCharges(principal, days)` → objeto com `{ multa, jurosMora, jurosRemuneratorios, iofAdicional, iofDiario, iof, total }`

> 🔗 Consulte a [Seção 17](docs/REGRAS-NEGOCIO-FATURA.md#17-fórmulas-de-cálculo--invoicemathjs-fonte-única) no documento completo para as 7 funções com exemplos numéricos e tabela de valores de referência para 0 a 60 dias.

---

## 7. Regra do Amount no Frontend

> 🔗 Consulte a [seção 3.3](docs/REGRAS-NEGOCIO-FATURA.md#33-regras-de-amount-no-frontend) no documento completo para exemplos de código corretos e errados.

**O `amount` DEVE ser passado como 3º parâmetro em TODAS as chamadas:**

```typescript
// ✅ CORRETO:
const res = await payCreditCardInvoice(cpf, pin, amountSelecionado);

// ❌ ERRADO (bug já ocorrido):
// const res = await payCreditCardInvoice(cpf, pin);
// → backend assume totalDue, quebra pagamento parcial!
```

---

## 8. Funções que Você PODE Chamar

> 🔗 Consulte as [seções 11](docs/REGRAS-NEGOCIO-FATURA.md#11-função-getclosedinvoicedebt-cálculo-do-saldo-devedor-para-pagamento) e [12](docs/REGRAS-NEGOCIO-FATURA.md#12-função-settleclosedinvoices-distribuição-de-pagamento) no documento completo para código fonte completo de cada função.

| Função | Local | Retorna |
|:-------|:------|:--------|
| `getClosedInvoiceDebt(cpf)` | `index.cjs:4340` | `{ owed, invoices, invoice, oldest }` |
| `settleClosedInvoices(cpf, nowIso, payAmount)` | `index.cjs:4360` | `void` (atualiza BD) |
| `computeInvoiceGross(inv)` | `utils/invoiceMath.js:27` | Number (principal + encargos) |
| `computeInvoiceOwed(inv)` | `utils/invoiceMath.js:39` | Number (só principal - pago) |
| `computeInvoicePaidInfo(inv)` | `utils/invoiceMath.js:110` | `{ isPaid, paidAt }` |
| `planDistribution(rows, amount)` | `utils/invoiceMath.js:62` | `{ applied, remaining, allPaid, invoices }` |

---

## 9. Bugs Já Corrigidos (NÃO REPETIR)

> 🔗 As correções estão documentadas nas seções [2.1](docs/REGRAS-NEGOCIO-FATURA.md#21-regra-fundamental), [3.3](docs/REGRAS-NEGOCIO-FATURA.md#33-regras-de-amount-no-frontend) e [6.4](docs/REGRAS-NEGOCIO-FATURA.md#64-transação-de-pagamento-payment-exibição-no-frontend) do documento completo.

| Bug | O que aconteceu | Correção |
|:----|:---------------|:---------|
| **Double-counting de encargos** | `_closedInvoiceValorTotal` usava `computeInvoiceGross` → R$ 4.284,94 em vez de R$ 3.870,86 | Trocar para `parseFloat(inv.valor_total)` |
| **Amount não passado** | `InvoicesView.tsx` chamava `payCreditCardInvoice(cpf, pin)` sem amount | Adicionar `pendingAmount` como 3º parâmetro |
| **Minimum = Partial** | Ambos usavam `'Pagamento parcial de fatura'` → mostravam `(Parcial)` | Adicionar `payAmount >= minPayment` → `'Pagamento minimo de fatura'` |
| **currentInvoice inflado** | PAYMENT entrava na soma de compras | Adicionar `filter(tx => tx.type !== 'PAYMENT')` |
| **Encargos congelam após pagamento parcial (v2)** | `runBillingValidation` usava `calcAllCharges(residual, days) - existing` → diff negativo → nada inserido | Mudar para incremento DIÁRIO: multa/IOF adicional = one-time; juros/IOF diário = `calc(residual, 1)` sempre. NUNCA comparar total vs existing |
| **Encargos perdidos no pagamento parcial (v1)** | `runBillingValidation` deletava + reinseria encargos, perdendo acumulado | Mudar para acumulação: consultar existente, inserir só delta positivo. NUNCA deletar |

---

## 10. Scripts de Auditoria

> 🔗 Consulte a [seção 9.1](docs/REGRAS-NEGOCIO-FATURA.md#91-scripts-de-auditoria) no documento completo para regras de consistência adicionais.

| Comando | Finalidade |
|:--------|:-----------|
| `node scripts/audit_completo.js` | Double-counting + negative balance |
| `node scripts/audit_completo.js --fix --confirm` | Corrigir automaticamente |
| `npm run audit:all` | Auditoria completa + relatório HTML |

---

## 11. Documentação Completa

Consulte `docs/REGRAS-NEGOCIO-FATURA.md` para:
- Código completo de todas as funções
- Exemplos numéricos detalhados
- Fluxo da tela de pagamento PIX/Boleto
- Jobs agendados e cronograma
- Pipeline de transformação PAYMENT

---

## 12. Troubleshooting — Erros Comuns

> 🔗 Esta seção também está disponível na [Seção 16](docs/REGRAS-NEGOCIO-FATURA.md#16-troubleshooting--erros-comuns) do documento completo, com explicações mais detalhadas.

### 12.1 `EADDRINUSE: address already in use 0.0.0.0:3001`

**Causa:** O servidor API anterior não foi encerrado corretamente.

**Soluções:**
```bash
# 1. Matar o processo na porta 3001 (Windows)
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# 2. Ou usar PowerShell:
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process

# 3. Ou no bash (Git Bash):
curl -X POST http://localhost:3001/api/admin/shutdown  # se o servidor responder
```

**Prevenção:** Sempre usar `Ctrl+C` no terminal do servidor antes de reiniciar, ou matar o processo explicitamente.

---

### 12.2 `Acesso negado (403)` em rotas admin

**Causa:** Token do admin expirado. O token JWT tem tempo de vida limitado.

**Solução:**
```bash
# Obter novo token de admin:
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"cpf":"99999999999","password":"admin999"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4
```

**Prevenção:** A cada nova sessão, obter um token fresco. Se estiver usando uma variável `$ADMIN_TOKEN`, renová-la.

---

### 12.3 `Adjacent JSX elements must be wrapped in an enclosing tag` (Vite/Babel)

**Causa:** O bug clássico de template literal em JSX — uma crase + `>` sem `}` antes em uma className.

```tsx
// ❌ ERRADO: backtick + > sem o } da expressão JSX
<div className={`text-${cor}   ← FALTA o } antes de >
>`}  ← Babel interpreta o > como JSX, não como parte da string

// ✅ CORRETO:
<div className={`text-${cor} ${ativo ? 'font-bold' : ''}`}>
```

**Solução:** Rodar o lint customizado ou verificar visualmente todas as className com template literals.
```bash
node WEB/scripts/lint-no-missing-jsx-brace.cjs
```

**Prevenção:** Manter className em uma única linha sempre que possível. Evitar quebras de linha dentro de crases de className.

---

### 12.4 `Saldo insuficiente` ao pagar fatura

**Causa:** O balance do usuário é menor que o valor solicitado para pagamento.

**Verificação:**
```bash
curl -s http://localhost:3001/api/users/me -H "Authorization: Bearer $TOKEN" |
  python -c "import sys,json; u=json.load(sys.stdin)['user']; print(f'Balance: R\$ {u[\"balance\"]}'); print(f'ClosedInvoice: R\$ {u.get(\"creditCard\",{}).get(\"closedInvoice\")}')"
```

**Solução:** Depositar saldo via admin:
```bash
curl -s -X POST http://localhost:3001/api/admin/deposit \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cpf":"12312312312","amount":5000}'
```

---

### 12.5 `valor_pago > valor_total` (double-counting)

**Causa:** Pagamento foi registrado em TODAS as faturas (multi-invoice) em vez de distribuído proporcionalmente.

**Verificação:**
```bash
node API/scripts/audit_completo.js
```

**Solução:**
```bash
node API/scripts/audit_completo.js --fix --confirm
```

**Prevenção:** A função `settleClosedInvoices` deve usar `planDistribution` para distribuir o valor entre invoices (da mais antiga para a mais recente).

---

### 12.6 `Fatura fechada mostra valor maior que o pago`

**Causa:** `_closedInvoiceValorTotal` está usando `computeInvoiceGross(inv)` em vez de `inv.valor_total`.

**Verificação:**
```bash
curl -s http://localhost:3001/api/users/me -H "Authorization: Bearer $TOKEN" |
  python -c "import sys,json; u=json.load(sys.stdin)['user']['creditCard']; print(f'ValorTotal: R\$ {u.get(\"_closedInvoiceValorTotal\")}'); print(f'ValorPago: R\$ {u.get(\"_closedInvoiceValorPago\")}'); print(f'Gross seria: R\$ {u.get(\"closedInvoice\",0) + u.get(\"daysOverdue\",0)*0.02*3870.86:.2f} (estimado)')"
```

**Correção:** Em `enrichUserCreditCardData`, trocar `computeInvoiceGross(inv)` por `parseFloat(inv.valor_total || 0)`.

---

### 12.7 Erro de Unicode no console Windows (`charmap codec can't encode`)

**Causa:** O terminal Windows (cmd.exe) usa codificação cp1252 que não suporta alguns caracteres Unicode como `→`, `✓`, `⚠️`.

**Solução:**
```bash
# Executar antes de rodar scripts:
chcp 65001  # Muda para UTF-8
```

**Prevenção:** Usar caracteres ASCII puros em scripts (`=>` em vez de `→`, `[OK]` em vez de `✅`) ou usar PowerShell em vez de cmd.exe.

---

### 12.8 `Porta 3000 já em uso` (frontend)

**Causa:** Outra instância do Vite está rodando (possível de sessão anterior).

**Solução:**
```bash
# Matar o processo do Node na porta 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Ou iniciar em outra porta:
npm run dev -- --port 5173
```

---

### 12.9 `Cannot find module '../repositories/dbAdapter'`

**Causa:** O `cronReconciliation.js` depende de um módulo que não existe mais.

**Solução (temporária):** O servidor inicia mesmo com este erro — é apenas o cron de conciliação que falha. Para remover o erro, comentar a linha que importa `cronReconciliation.js` em `index.cjs`.

---

### 12.10 Testes falham com timeout (Vitest no Windows)

**Causa:** O Vitest pode exceder o timeout padrão no Windows devido a I/O mais lento.

**Solução:**
```bash
npm test -- --testTimeout=30000
```

**Prevenção:** Aumentar o timeout no `jest.config.js` ou `vitest.config.js`:
```javascript
module.exports = {
  testTimeout: 30000,  // 30 segundos
};
```

---

### 12.11 Python não encontrado (`python3` vs `python`)

**Causa:** No Windows, o comando é `python`, não `python3`.

**Solução:** Usar `python` em vez de `python3` em todos os scripts e comandos.

**Verificação:**
```bash
python --version  # Deve funcionar no Windows
```

---

### 12.12 `Ripgrep binary not found`

**Causa:** O ripgrep (`rg`) não está instalado no sistema Windows ou o path não está configurado.

**Solução:**
```bash
# Instalar via npm:
npm install -g @microsoft/ripgrep
# Ou configurar variável de ambiente:
set CODEBUFF_RG_PATH=C:\caminho\para\rg.exe
```

**Alternativa:** Usar `grep do Git Bash` ou `findstr` no PowerShell no lugar de comandos ripgrep.

---

## 13. Frontend — Payload e Exibição

> 🔗 Consulte as [seções 5](docs/REGRAS-NEGOCIO-FATURA.md#5-payload-do-frontend) e [6](docs/REGRAS-NEGOCIO-FATURA.md#6-exibição-no-frontend) no documento completo para exemplos de código e regras visuais detalhadas.

**Payload de pagamento:**

```typescript
// ✅ CORRETO: amount como 3º parâmetro
const res = await payCreditCardInvoice(cpf, pin, amountSelecionado);

// ❌ ERRADO: sem amount → backend assume totalDue
// const res = await payCreditCardInvoice(cpf, pin);
```

**Regras de exibição da fatura fechada PAGA:**
- Mostrar valor ORIGINAL com badge verde "✓ PAGA"
- Exibir `closedInvoicePaidAt` (data do pagamento)
- NÃO mostrar botões "Pagar", "PIX", "Boleto"
- Usar `_closedInvoiceValorTotal` (valor_total), NUNCA computeInvoiceGross

**Flags de display:**

| Campo | Uso |
|-------|-----|
| `closedInvoiceIsPaid` | Badge verde PAGA |
| `_closedInvoiceValorTotal` | Valor original preservado |
| `_closedInvoiceValorPago` | Quanto foi pago |
| `closedInvoicePaidAt` | Data do pagamento |
| `closedInvoiceCharges` | Encargos de referência |
| `daysOverdue` | Dias em atraso |

---

## 14. Motor de Validação Diária — runBillingValidation

> 🔗 Consulte a [seção 10](docs/REGRAS-NEGOCIO-FATURA.md#10-motor-de-validação-diária-runbillingvalidation) no documento completo para o fluxo completo com código, cron e rotas da API.

**Função:** `async function runBillingValidation()` em `API/index.cjs:4048`

**O que faz:**
1. Carrega `billing_config` e calcula ciclo atual
2. Busca TODOS os usuários com fatura fechada não paga
3. Para cada um: calcula encargos sobre **residual** (`valor_total - valor_pago`)
4. Atualiza `account_status` e `days_overdue` no banco
5. Sincroniza `dias_atraso` nas invoices

**Fórmulas de encargos (sobre o residual):**

| Encargo | Fórmula |
|---------|---------|
| Multa (2%) | `residual × 0,02` |
| Juros Mora (0,0333%/dia) | `residual × 0,000333 × dias` |
| Juros Rem (0,513%/dia) | `residual × 0,00513 × dias` |
| IOF (0,38% + 0,0082%/dia) | `residual × (0,0038 + 0,000082 × dias)` |

**Rotas:** `POST /admin/billing/validate-all` (admin) | `POST /admin/billing/run-cycle`

### 🚨 REGRA CRÍTICA — Incremento Diário sobre Residual (NUNCA Comparar Total)

> 🔗 Consulte a [Seção 10](docs/REGRAS-NEGOCIO-FATURA.md#10-motor-de-validação-diária-runbillingvalidation) no documento completo para a referência completa do motor de validação.

**O motor NUNCA deleta encargos acumulados. Cada execução ADICIONA o incremento de 1 dia sobre o residual ATUAL. Encargos de multa (2%) e IOF adicional (0,38%) são cobranças ÚNICAS. Juros de mora, juros remuneratórios e IOF diário são incrementos DIÁRIOS.**

#### ⛔ O Problema (target vs existing)

```javascript
// ANTIGO (🐛) — depois de corrigir DELETE+INSERT, ainda usava:
const target = calcAllCharges(residual, daysOverdue);  // total sobre residual
const diff = target - existing;  // target MENOR que existing após pagamento parcial!
if (diff > 0.005) INSERT diff;
// ← diff = NEGATIVO → NUNCA insere nada → encargos CONGELAM
```

**Problema:** `calcAllCharges(1000, 21)` = R$ 146,80, mas existente = R$ 519,81. `diff = -R$ 372,01` → encargos CONGELAM mesmo com residual devedor. O cliente para de acumular juros e o banco para de cobrar. ❌

#### ✅ A Solução — Incremento Diário

Cada tipo de encargo tem um comportamento específico:

| Tipo | Comportamento | Base de Cálculo | Exemplo (Dia 21, residual R$ 1.000) |
|:-----|:--------------|:----------------|:-------------------------------------|
| **Multa (2%)** | 🔒 Única vez | `calcMulta(valorTotal)` original | `3870,86 × 0,02 = R$ 77,42` (insere 1×) |
| **Juros Mora (0,0333%/dia)** | 📈 Diário | `calcJurosMora(residual, 1)` | `1000 × 0,000333 × 1 = R$ 0,33` (sempre insere) |
| **Juros Rem (0,513%/dia)** | 📈 Diário | `calcJurosRem(residual, 1)` | `1000 × 0,00513 × 1 = R$ 5,13` (sempre insere) |
| **IOF Adicional (0,38%)** | 🔒 Única vez | `calcIofAdicional(valorTotal)` original | `3870,86 × 0,0038 = R$ 14,71` (insere 1×) |
| **IOF Diário (0,0082%/dia)** | 📈 Diário | `calcIofDiario(residual, 1)` | `1000 × 0,000082 × 1 = R$ 0,08` (sempre insere) |

**Código atual (`API/index.cjs:4399`):**
```javascript
// ── MULTA: uma única vez sobre o valor_total ORIGINAL ──
if (getExisting('multa') < 0.005) {
    const multa = calcMulta(originalValorTotal);
    INSERT INTO billing_charges (amount = multa);
}

// ── IOF: primeira vez = adicional+diário; subsequente = só diário ──
if (getExisting('iof') < 0.005) {
    const iof = calcIof(originalValorTotal, daysOverdue);  // + diário acumulado
    INSERT INTO billing_charges (amount = iof);
} else {
    const dailyIof = calcIofDiario(residual, 1);  // só 1 dia
    INSERT INTO billing_charges (amount = dailyIof);
}

// ── JUROS MORA + REM: sempre incremento de 1 dia sobre residual ──
const dailyJurosMora = calcJurosMora(residual, 1);
const dailyJurosRem = calcJurosRemuneratorios(residual, 1);
INSERT INTO billing_charges (amount = dailyJurosMora);
INSERT INTO billing_charges (amount = dailyJurosRem);
```

#### Regras

| # | Regra |
|:-:|:------|
| 1 | **NUNCA** use `DELETE` em `billing_charges` com status `pending` |
| 2 | Multa e IOF adicional são **ÚNICAS** — verificar `getExisting()` antes de inserir |
| 3 | Juros mora, juros rem e IOF diário são **INCREMENTOS DIÁRIOS** — sempre inserir `calc(residual, 1)` |
| 4 | `calcAllCharges(residual, daysOverdue)` **NÃO DEVE SER USADO** para comparar vs existing — use o incremento de 1 dia |
| 5 | `calcAllCharges(original, daysOverdue)` é usado APENAS na PRIMEIRA inserção de IOF (que combina Adicional + Diário) |
| 6 | `totalLineCharges` é apenas para logging — o cálculo real usa `SUM(amount)` no banco |
| 7 | Se residual = 0, incrementos diários = 0, nada é inserido — sem custo |

#### Exemplo Numérico (Correto)

```
Dia 1-20: Motor acumulou R$ 519,81 em encargos (R$ 3.870,86 × 20 dias)
Dia 20:   Cliente pagou R$ 2.870,86 → residual = R$ 1.000,00
Dia 21:   Motor roda:
           Multa: já existe (R$ 77,42) → SKIP ✅
           Juros Mora: 1000 × 0,000333 × 1 = R$ 0,33 → INSERT ✅
           Juros Rem:  1000 × 0,00513 × 1 = R$ 5,13 → INSERT ✅
           IOF: já existe → calcIofDiario(1000, 1) = R$ 0,08 → INSERT ✅
           Total hoje: R$ 5,54
           → R$ 519,81 + R$ 5,54 = R$ 525,35 acumulado ✅

Dia 22:   Motor roda:
           Juros Mora: + R$ 0,33
           Juros Rem:  + R$ 5,13
           IOF Diário: + R$ 0,08
           Total hoje: + R$ 5,54
           → R$ 530,89 acumulado ✅

Dia 30 (10 dias após pagamento):
           Acumulado: R$ 519,81 + (10 × R$ 5,54) = R$ 575,21 ✅
           Em vez de... congelado em R$ 519,81 (🐛 antigo)
           Diferença para o banco: R$ 55,40 recuperados! 🎯
```

#### Comportamento Antigo (Histórico)

```
1ª versão (🐛): DELETE + INSERT → perdia encargos acumulados a cada execução
2ª versão (🐛): target vs existing → diff negativo após pagamento parcial → congela
3ª versão (✅): Incremento diário → sempre adiciona 1 dia sobre residual atual
```

---

## 15. Função enrichUserCreditCardData — Montagem do creditCard

> 🔗 Consulte a [seção 13](docs/REGRAS-NEGOCIO-FATURA.md#13-função-enrichusercreditcarddata-montagem-dos-dados-de-cartãofatura) no documento completo para o passo a passo completo e diagrama de fluxo.

**Função:** `async function enrichUserCreditCardData(normalized, cpf)` em `API/index.cjs:155`

### 🎯 FONTE ÚNICA de Encargos: billing_charges

A partir da **correção v3**, `enrichUserCreditCardData` **LÊ** os encargos acumulados da tabela `billing_charges` (INSERTED pelo `runBillingValidation`) em vez de **recalcular** `calcAllCharges(residual, daysOverdue)`. Isso resolve o bug onde após pagamento parcial o residual menor fazia `calcAllCharges` retornar valores menores que o acumulado real.

**Fluxo de leitura de encargos:**
```
1. SELECT charge_type, SUM(amount) FROM billing_charges
   WHERE cpf=X AND status='pending' GROUP BY charge_type
2. Se encontrou E !isPaid → usa valores REAIS:
     multa        = SUM WHERE charge_type='multa'
     jurosMora    = SUM WHERE charge_type='juros_mora'
     jurosRem     = SUM WHERE charge_type='juros_remuneratorios'
     iof          = SUM WHERE charge_type='iof'
     totalEncargos = round2(multa + jurosMora + jurosRem + iof)
3. Fallback (fatura paga ou sem billing_charges):
     buildClosedInvoiceSummary(...)
```

**Etapas de execução:**

```
1. Carregar invoices do banco (invRows)
2. Montar fatura fechada:
   ├── closedInvoice = Σ valor_total (original, imutável)
   ├── closedInvoiceResidual = Σ (valor_total - valor_pago) ← saldo devedor
   └── _closedInvoiceValorTotal / _closedInvoiceValorPago ← badge PAGA
3. Buscar transações (cardRows + pendingInstallments)
4. Mapear transações → formato frontend
5. Filtrar openTransactions (inclui PAYMENT)
6. Calcular currentInvoice (exclui PAYMENT)
7. ⭐ LER encargos do billing_charges (fonte única)
8. Calcular daysOverdue em tempo real
9. Montar currentInvoiceTotal = currentInvoice + residual + encargos
```

**Regras críticas:**
1. `currentInvoice` NUNCA é alterado — permanece = compras do ciclo
2. `closedInvoice` = valor ORIGINAL (imutável), NUNCA gross
3. Encargos somam a `currentInvoiceTotal`, NÃO a `currentInvoice`
4. PAYMENT incluso em `openTransactions`, NÃO em `closedTransactions`
5. ⭐ Encargos NUNCA são recalculados — lidos do billing_charges ou de paidLateCharges
6. ⭐ daysOverdue é sempre calculado EM TEMPO REAL (independente do residual)

---

## 16. Pipeline PAYMENT e Cronograma

> 🔗 Consulte as [seções 14](docs/REGRAS-NEGOCIO-FATURA.md#14-pipeline-de-transformação-de-transações-payment-do-banco-ao-frontend) e [15](docs/REGRAS-NEGOCIO-FATURA.md#15-cronograma-e-jobs-agendados) no documento completo para o mapeamento completo INSERT → Frontend e lista de jobs.

### Pipeline PAYMENT (5 estágios)

```
INSERT → SELECT → .map() → Filtro janela → Renderização
```

| Estágio | Campo | Comportamento |
|:--------|:------|:--------------|
| INSERT | `amount` | NEGATIVO (-3870.86) — crédito |
| INSERT | `description` | `'Pagamento minimo...'` / `'Pagamento parcial...'` |
| .map() | `amount` | `Math.abs()` → "+R$ 3.870,86" |
| .map() | `merchant` | `parcial` > `minimo` > `Total` |
| Render | badge | Verde (PAYMENT) |

### Jobs Agendados

| Job | Frequência |
|:----|:-----------|
| Invoice Engine | Diário 00:00 |
| runBillingValidation | Diário 00:05 |
| Recurring Engine | Diário 00:10 |
| Sync Dias Atraso | Diário 00:15 |
| Fix Pagamentos Órfãos | Semanal dom 03:00 |
| Auditoria Completa | Semanal dom 02:00 |

---
