# 📋 Plano — Implementações e Sugestões (acumulado)

> **Status:** Ativo · **Criado em:** 07/ago/2026
> **Escopo:** Todas as implementações e sugestões que surgiram nos últimos turnos
> (PDF da fatura universal — Página 2 e 4, boleto/PIX Febraban, datas `toDateOnly`,
> Telegram, validador de regras, imutabilidade/órfãos).
> **Regra de ouro:** nada atropela nada — cada item tem dependência explícita; itens já
> feitos estão marcados ✅ para não serem refeitos.

---

## 🗺️ Visão Geral das Fases

| Fase | Domínio | Itens | Prioridade |
|:-----|:--------|:------|:-----------|
| **1** | PDF Fatura Universal — Página 2 (compras/parcelas/pagamentos) | 1.1✅, 1.2, 1.3, 1.4, 1.5 | 🔴 Alta |
| **2** | PDF Fatura Universal — Página 4 (boleto) + PIX Febraban | 2.1, 2.2, 2.3, 2.4 | 🔴 Alta |
| **3** | Datas: driver pg → `toDateOnly` (obrigatório, sem `split('T')[0]`) | 3.1✅, 3.2, 3.3, 3.4 | 🔴 Alta |
| **4** | Telegram + validador de regras | 4.1✅, 4.2, 4.3, 4.4 | 🟡 Média |
| **5** | Imutabilidade / órfãos / motor de encargos | 5.1, 5.2, 5.3, 5.4 | 🟡 Média |
| **6** | Testes e validação final | 6.1, 6.2, 6.3 | 🔴 Gate |

> **Complementa** o `docs/PLANO-CONSOLIDADO-PENDENCIAS.md` (fases A–E: órfãos pré-005,
> botão no Admin, refactor SRC). Este documento cobre **PDFs/boleto/datas/Telegram**;
> aquele cobre **auditoria/migração/refactor**. Não duplicam.

---

## 🔵 FASE 1 — PDF Fatura Universal · Página 2 (compras)

### 1.1 ✅ Coluna PARCELA + destaque de total financiado — **FEITO**

**Arquivos:** `API/index.cjs` (rota send-pdf) · `API/services/invoicePdfService.js`
(`drawMovimentacoes`) · `API/scripts/render_massa_pdf_preview.cjs`

- `movimentacoes` propaga `parcela` (zero-padded `02/04`), `jurosTotal`,
  `originalAmount`, `totalParcelado`, `taxaEfetivaMensal` (×100);
- Fechada (snapshot `itemized_transactions`) enriquecida com os `installment_plans`
  ativos (casamento por nº de parcelas + valor da parcela);
- Coluna **PARCELA** no header (`x=350` centralizado), célula `—` para à vista;
- Linha vermelha destacada **"Total financiado R$ X (juros R$ Y · Z% a.m.)"** quando
  `jurosTotal > 0` (art. 52 CDC);
- Header encurtado para `VALOR R$` (não quebra linha);
- Teste determinístico com 9 checks PASS · PDFs da massa 12310012300 regenerados.

### 1.2 ❌ Incluir seção "Pagamentos" na Página 2 da fatura ABERTA

**Arquivos:** `API/index.cjs` (map de `movimentacoes`) · `API/services/invoicePdfService.js`

**Contexto:** hoje o `purchaseTypes` exclui `PAYMENT` da Página 2 — a fatura aberta não
mostra os pagamentos efetuados, ao contrário do exemplo real de fatura universal.

**Implementação:**
1. No tipo `open`, **incluir** transações `PAYMENT`/`INVOICE_PAYMENT` no
   `movimentacoes`, com `valor` negativo;
2. No `drawMovimentacoes`, renderizar valor negativo em **verde** (`#16a34a`) com sinal
   `−`;
3. Quando houver `PAYMENT`, desenhar **seção separada** "Pagamentos" (sub-header) abaixo
   do bloco de compras, com subtotal próprio;
4. Manter a regra de negócio: **PAYMENT não altera `currentInvoice`** (só aparece como
   transação).

**Critério de aceite:** PDF da aberta da massa 12310012300 mostra
`Pagamento fatura (Total) − R$ X` em verde + subtotal de pagamentos.

### 1.3 ❌ Subtotal por cartão (físico/virtual) na Página 2

**Arquivos:** `API/index.cjs` (enrich) · `API/services/invoicePdfService.js`

**Contexto:** hoje o subtotal usa um único `(final XXXX)` puxado do cartão mais recente;
não agrupa por cartão.

**Implementação:**
1. No enrich do send-pdf, agrupar `movimentacoes` por `cardLast4` (quando disponível);
2. `drawMovimentacoes` desenha um subtotal por cartão: "Lançamentos no cartão (final
   XXXX)" para cada grupo, somando ao total geral.

**Critério de aceite:** com cartão físico + virtual, a Página 2 mostra 2 subtotais.

### 1.4 ❌ Documentar a regra da Página 2 no SKILL + REGRAS

**Arquivos:** `docs/REGRAS-NEGOCIO-FATURA.md` · `SKILL.md`

**Implementação:** nova seção documentando:
- Página 2 = **compras reais** de `card.transactions`/`closedTransactions` (snapshot
  `itemized_transactions` para a fechada) — **nunca** `openTransactions`/
  `_closedInvoiceSnapshot`;
- Coluna **PARCELA obrigatória** para compras parceladas;
- **Juros em R$ + taxa efetiva + total com/sem financiamento** obrigatórios (art. 52 CDC
  + Res. BCB 96/2021 e 365/2023);
- PAYMENT na aberta com valor negativo em verde (seção 1.2).

**Critério de aceite:** `validate:rules` ✓ · `validate:anchors` ✓.

### 1.5 ❌ Registrar PDFs no Preview para comparação visual

**Ação:** registrar `fatura_closed_12310012300.pdf` e `fatura_open_12310012300.pdf`
(ou os de preview em `.freebuff/pdf-preview/`) no Preview para o usuário comparar a
Página 2 com o exemplo enviado.

---

## 🟠 FASE 2 — PDF Página 4 (Boleto) + PIX Febraban

### 2.1 ❌ Regenerar previews e conferir Página 4 com linha digitável nova

**Arquivo:** `API/scripts/render_universal_pdf_preview.cjs`

**Contexto:** a correção do `fatorVencimento` (extrair data calendária da string ISO,
sem `new Date`/fuso) foi aplicada em `API/utils/boletoMath.js`. Faltou confirmar a
Página 4 dos PDFs de preview com o padrão novo (fator 5 dígitos, DV posição 20, campo
livre 24).

**Implementação:**
1. Rodar `render_universal_pdf_preview.cjs`;
2. Extrair texto da Página 4 e conferir a linha digitável (ex. esperada
   `23791...` no padrão Febraban novo — banco 237, fator 5 dígitos, DV posição 20);
3. Comparar campo a campo (agência, conta, nosso número, vencimento, valor) com o
   `scripts/invoice_payment_generator.py` da mesma fatura;
4. Registrar no Preview para validação visual do Recibo do Pagador + Ficha de
   Compensação.

### 2.2 ❌ Testar `GET /pix/:cpf/:invoiceId` (payload EMV completo)

**Ação:** curl na rota com a massa 12312312388 e validar o payload EMV completo
(campos 00, 26, 54, 62 e CRC16), conferindo consistência com o Python.

### 2.3 ❌ Testar `POST /generate-payment-codes` com `dueDate` ISO

**Ação:** enviar `dueDate: '2026-08-10T00:00:00.000Z'` no body e confirmar que a
normalização no handler evita **fator 0** (fuso horário).

### 2.4 ❌ Documentar o padrão Febraban novo + fonte única Python↔JS

**Arquivos:** `docs/REGRAS-NEGOCIO-FATURA.md` · `SKILL.md`

**Implementação:** seção documentando:
- Padrão Febraban **novo**: banco 237, fator de vencimento 5 dígitos, DV posição 20,
  campo livre 24 dígitos;
- `generatePaymentCodesFallback` (JS) deve gerar **idêntico** ao
  `invoice_payment_generator.py` (Python) — fonte única;
- `fatorVencimento` e `ddmmYYYY` **nunca** via `new Date(iso)` + componentes locais —
  extrair `YYYY-MM-DD` da string (regex) para eliminar o fuso;
- Regra do driver pg: datas vêm como `Date` → usar `toDateOnly`, nunca
  `String(x).split('T')[0]`.

---

## 🟢 FASE 3 — Datas: driver pg → `toDateOnly` (obrigatório)

### 3.1 ✅ `boletoMath.js` — fator de vencimento corrigido — **FEITO**

**Arquivo:** `API/utils/boletoMath.js`

`fatorVencimento` e `ddmmYYYY` agora extraem `YYYY-MM-DD` direto da string ISO (regex),
sem passar por `new Date` — eliminando o desvio de fuso (−3h → dia anterior).

### 3.2 ❌ Migrar ocorrências restantes de `.split('T')[0]`

**Arquivos:** `API/services/invoiceEngine.js:181` · `API/services/invoicePdfService.js:43,49`

**Implementação:** trocar `String(x).split('T')[0]` por `toDateOnly(x)` (utils de data),
mantendo o comportamento para strings sem fuso.

### 3.3 ❌ Corrigir a §21.4/§21.5 do REGRAS (afirma que já estavam corrigidos)

**Arquivo:** `docs/REGRAS-NEGOCIO-FATURA.md`

**Implementação:** atualizar a seção 21 (regra obrigatória de datas) para refletir a
realidade após 3.2 — ou remover a afirmação incorreta.

### 3.4 ❌ Ampliar a regra R8.1 do `validate_skill_rules.js`

**Arquivo:** `API/scripts/validate_skill_rules.js`

**Implementação:** a regra que reprova `String(x).split('T')[0]` hoje varre apenas
`API/index.cjs` + `API/src/**` — estender para **`API/utils/**`** e **`API/services/**`**
(e rodar `npm run validate:rules` para confirmar 0 hits).

---

## 🟡 FASE 4 — Telegram + validador de regras

### 4.1 ✅ Regra R-PDF1 no `validate_skill_rules.js` — **FEITO**

**Arquivo:** `API/scripts/validate_skill_rules.js`

- Novo **Grupo 8 — PDF: Fonte de Movimentações (Página 2)**;
- Reprova `card.openTransactions`/`cc.openTransactions`/
  `card._closedInvoiceSnapshot`/`cc._closedInvoiceSnapshot` em código real de
  `API/index.cjs` + `API/src/**`;
- Trata CRLF (`split(/\r?\n/)`), comentários `//`/`/* */`/`*`, URL em string
  (`(^|[^:])\/\/`), apóstrofo em comentário trailing;
- Validado: 50 passaram / 6 falharam (falhas pré-existentes: R2.1/R2.3/R3.2/Bug1-3).

### 4.2 ❌ Adicionar referência da regra R-PDF1 no SKILL.md

**Arquivo:** `SKILL.md` (seção de PDF)

**Implementação:** linha compacta na seção de PDF do SKILL apontando para a regra
R-PDF1 (fonte de movimentações da Página 2) e a referência cruzada para o REGRAS.

### 4.3 ❌ Generalizar `verify_topic_733.cjs` para CPF/tópico como parâmetro

**Arquivo:** `API/scripts/verify_topic_733.cjs`

**Implementação:**
1. Aceitar `--cpf <cpf>` e `--topic <id>` como argumentos CLI (default: 12310012300/733);
2. Listar os últimos envios (message_id, arquivo, tamanho, link) do tópico;
3. Reusar em testes de entrega de PDFs de qualquer massa.

### 4.4 ❌ Zerar as 6 falhas pré-existentes do `validate_skill_rules.js`

**Arquivo:** `API/scripts/validate_skill_rules.js` (ou código correspondente)

**Contexto:** R2.1/R2.3/R3.2/Bug1-3 falham no branch atual. Algumas podem ser falsos
positivos do validador (ex.: "Pagamento minimo/parcial", "currentInvoice filtra
PAYMENT", "closedInvoiceTotal") que precisam apontar para `API/src/controllers/
invoiceController.js` (já extraído do index.cjs).

**Implementação:** atualizar os alvos das regras para incluir `src/controllers/` +
`src/routes/`, validar cada uma e zerar as falhas.

---

## 🟣 FASE 5 — Imutabilidade / órfãos / motor de encargos

### 5.1 ❌ Corrigir `creditoExcedente` no `index.cjs:679`

**Contexto:** ao pagar além do bruto devido, o excedente vai ao balance — mas o cálculo
não subtrai `chargesTotal`, debitando encargos indevidamente do balance.

**Implementação:** `creditoExcedente = pagamento − principal − chargesTotal` (operação
de 1 linha), validar com a massa 12464865954 (Wade).

### 5.2 ❌ Passo 7 do `fix_orphan_payment_step7.cjs` para os CPFs restantes

**Arquivos:** `API/scripts/fix_orphan_payment_step7.cjs`

**Contexto:** os CPFs 090.867.473-29, 99999999999 e 11111111111 ainda têm
`INVOICE_PAYMENT` órfão (ou precisam de reprocessamento).

**Implementação:**
1. Analisar se os órfãos de 99999999999/11111111111 são **intencionais** (admin/teste) —
   se sim, documentar e ignorar;
2. Para 090.867.473-29: `DISABLE TRIGGER` → reprocessar R$ 4.070,86 com `invoice_id` →
   `ENABLE TRIGGER`;
3. Re-rodar o health check de imutabilidade → 0 achados.

### 5.3 ❌ Registrar `test_invoice_immutability_trigger.cjs` como script npm

**Arquivo:** `API/package.json`

**Implementação:** adicionar `"test:trigger": "node scripts/test_invoice_immutability_trigger.cjs"`
+ documentar no SKILL/REGRAS como teste de regressão da imutabilidade.

### 5.4 ❌ Confirmar que `runBillingValidation` segue funcional com a trigger ativa

**Ação:** executar `POST /admin/billing/validate-all` e conferir que a sincronização de
`dias_atraso`/`updated_at` nas faturas FECHADAS não é bloqueada pela trigger
(ela só rejeita colunas monetárias).

---

## 🧪 FASE 6 — Testes e validação final (gate)

| # | Validação | Comando | Esperado |
|:--|:----------|:--------|:---------|
| 6.1 | Sintaxe | `node --check API/index.cjs && node --check API/services/invoicePdfService.js` | OK |
| 6.2 | Unit API | `cd API && node node_modules/jest/bin/jest.js --selectProjects unit` | 440/440 (6 falhas pré-existentes documentadas: boleto Febraban, fix_user, auditLog) |
| 6.3 | Regras + docs | `npm run validate:rules` + `npm run validate:anchors` | ✓ ✓ (0 BAD) |

---

## ✅ Estado atual (verificado no código em 07/ago/2026)

| Item | Estado |
|:-----|:-------|
| 1.1 Coluna PARCELA + juros na Página 2 | ✅ **FEITO** (3 arquivos + teste 9 checks) |
| 3.1 Fator de vencimento em `boletoMath.js` | ✅ **FEITO** (regex, sem fuso) |
| 4.1 Regra R-PDF1 no validador | ✅ **FEITO** (CRLF + comentários + URLs tratados) |
| 1.2 Pagamentos na Página 2 da aberta | ❌ Pendente |
| 1.3 Subtotal por cartão | ❌ Pendente |
| 1.4/2.4/3.3/4.2 Docs (REGRAS + SKILL) | ❌ Pendente |
| 2.1–2.3 Validação Página 4/PIX/codes | ❌ Pendente |
| 3.2 Migrar `split('T')[0]` restantes | ❌ Pendente |
| 3.4 Ampliar R8.1 para utils/services | ❌ Pendente |
| 4.4 Zerar 6 falhas do validador | ❌ Pendente |
| 5.1 `creditoExcedente` subtrair charges | ❌ Pendente |
| 5.2–5.4 Órfãos restantes + trigger | ❌ Pendente |

---

## 🗃️ Arquivos afetados (resumo)

| Arquivo | Item |
|:--|:--|
| `API/index.cjs` | 1.1✅, 1.2, 1.3, 5.1 |
| `API/services/invoicePdfService.js` | 1.1✅, 1.2, 1.3, 3.2 |
| `API/scripts/render_massa_pdf_preview.cjs` | 1.1✅, 2.1 |
| `API/scripts/render_universal_pdf_preview.cjs` | 2.1 |
| `API/utils/boletoMath.js` | 3.1✅ |
| `API/services/invoiceEngine.js` | 3.2 |
| `API/scripts/validate_skill_rules.js` | 3.4, 4.1✅, 4.4 |
| `API/scripts/verify_topic_733.cjs` | 4.3 |
| `API/scripts/fix_orphan_payment_step7.cjs` | 5.2 |
| `API/scripts/test_invoice_immutability_trigger.cjs` | 5.3 |
| `API/package.json` | 5.3 |
| `docs/REGRAS-NEGOCIO-FATURA.md` | 1.4, 2.4, 3.3 |
| `SKILL.md` | 1.4, 2.4, 4.2 |
| `.freebuff/pdf-preview/*.pdf` | 1.5, 2.1 (output) |
