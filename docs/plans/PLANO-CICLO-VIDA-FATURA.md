# Plano de Correção — Ciclo de Vida da Fatura

**Data:** 2026-08-09 · **Severidade:** P0 (dado financeiro incorreto em produção)
**Vinculado a:** [`PLANO-CONSOLIDADO.md`](./PLANO-CONSOLIDADO.md) — entra como **P0**, junto com a segurança
**Evidência:** consultas ao `pgdb` e leitura de código em 2026-08-09

> **Status em 2026-08-11: PLANO CONCLUÍDO.** T1 (`2ab86fdf`), T2 (`3d94f4c0`),
> T4 (`d8df01c3`), T5 (`557fe1f5`), T6 (`7c2e9455`), T7 (`bb7847c4`) commitadas.
> T3 (validação) executada como parte da validação de T1. T8 (gate final) verificado:
> API 570 testes (1 flaky documentado, confirmado passando isolado), WEB 83/96
> (13 falhas baseline, todas confirmadas pré-existentes e sem relação com os arquivos
> desta mudança), `tsc --noEmit` 68 erros (≤ baseline 77), grep de zero-mock limpo
> (só bate em comentários explicando a correção), `account_status='inadimplente'` = 54,
> estável. Decisão A/B/C sobre reprocessar encargos retroativos das massas afetadas
> pelo período do bug segue em aberto — não técnica, do dono do produto.

## Política inegociável deste plano

> **Zero mock. Zero string fixa. Zero fallback numérico.**
>
> Nenhum valor monetário, data, mês ou rótulo de período pode existir literal no código do
> ciclo de vida da fatura. Quando o dado não vier do backend, a tela mostra vazio, traço ou
> erro — **nunca** um número plausível inventado. Um fallback como `|| 3870.86` é pior que
> um erro: o erro você vê, o número falso você acredita.

## Ordem de execução

A numeração **é** a ordem. Cada etapa fecha antes da seguinte começar.

| # | Etapa | Sev. | Impacto medido | Skill |
|---|---|---|---|---|
| 1 | ✅ Motor pega a fatura em aberto errada | **P0** | 39 de 54 massas sem encargos | `systematic-debugging` |
| 2 | ✅ Status `adimplente` gravado errado | **P0** | 30 dias de atraso vira 0 | mesma correção do #1 |
| 3 | ✅ Laços sem isolamento por massa | **P0** | 1 erro derruba o resto do dia | `ecc:silent-failure-hunter` |
| 4 | ✅ Alerta do Telegram sem identificar a massa | P1 | não dá pra saber qual revisar | `ecc:silent-failure-hunter` |
| 5 | ✅ **Mocks no painel do CLIENTE** | **P1** | agosto mostrando maio | `ecc:silent-failure-hunter` + `impeccable` |
| 6 | ✅ Mocks no painel do ADMIN | P1 | fatura fantasma de R$ 1.120 | idem |
| 7 | Cron depende da API viva à meia-noite | P2 | dia sem execução | `ecc:architect` |
| 8 | Gerador de Massas 2.0 — forma canônica | **P1** | massas nascem certas e viram inválidas | `ecc:tdd-guide` + `ecc:database-reviewer` |

Commits: 1+2 em `2ab86fdf` · 3+4 em `3d94f4c0` · 5 em `d8df01c3` · 6 em `557fe1f5`.

Etapas 1–4 param o sangramento financeiro. 5–6 tiram a mentira da tela. 7 evita repetir.
8 garante que massa nova nasça no formato certo — e **depende da 1 estar pronta**, senão
a massa nasce certa e o motor a corrompe de novo na virada seguinte.

---

## 1. Motor escolhe a fatura errada (P0)

### Sintoma
54 massas têm fatura fechada vencida e não paga. Só **15** recebem encargos diários.
As outras **39** não acumulam multa, juros nem IOF desde 03/08.

### Causa raiz
[`API/index.cjs:5294-5305`](../../API/index.cjs):

```js
SELECT cpf, due_date, valor_total, COALESCE(valor_pago, 0) AS valor_pago FROM invoices
WHERE status = 'FECHADA' AND data_pagamento IS NULL
ORDER BY due_date DESC          // ← mais RECENTE primeiro
...
for (const row of closedInvoiceRows) {
    if (!closedDueByCpf.has(row.cpf)) {   // ← primeira vence, resto descartado
        closedDueByCpf.set(row.cpf, { dueDate: row.due_date, ... });
    }
}
```

`ORDER BY due_date DESC` + "primeiro que chega ganha" seleciona a fatura **mais recente**
de cada CPF. Massa com duas faturas em aberto — uma velha vencida e uma nova a vencer —
tem a nova escolhida, e `daysOverdue` sai 0.

O comentário das linhas 5289-5293 mostra consciência do problema de usar
`user.credit_card_invoice_due_date` (que o `invoiceEngine` rola para o ciclo seguinte),
mas a solução trocou um campo errado por uma ordenação errada.

### Prova
```sql
WITH e AS (SELECT DISTINCT ON (cpf) cpf, due_date AS escolhida
           FROM fintech.invoices WHERE status='FECHADA' AND data_pagamento IS NULL
           ORDER BY cpf, due_date DESC),
     m AS (SELECT cpf, MIN(due_date) AS mais_antiga
           FROM fintech.invoices WHERE status='FECHADA' AND data_pagamento IS NULL
           GROUP BY cpf)
SELECT COUNT(*) FILTER (WHERE m.mais_antiga < NOW() AND e.escolhida >= NOW()) AS ignoradas,
       COUNT(*) FILTER (WHERE m.mais_antiga < NOW() AND e.escolhida <  NOW()) AS processadas
FROM e JOIN m USING (cpf);
-- ignoradas: 39 | processadas: 15
```

Casos concretos (2 faturas em aberto, vencimento real 10/07):

| CPF | Atraso real | Motor pegou | Gravado |
|---|---|---|---|
| 76671725950 | 30 dias | 10/08 | `adimplente`, 0 dias |
| 77551164685 | 30 dias | 10/08 | `adimplente`, 0 dias |
| 37810513150 | 30 dias | 10/08 | `adimplente`, 0 dias |

### O código já sabe a regra certa — só não aplica no motor

`enrichUserCreditCardData` ([`index.cjs:349-358`](../../API/index.cjs)), o caminho de
**leitura**, já corrige exatamente isto:

```js
// daysOverdue REAL: ancorar na fatura fechada MAIS ANTIGA não paga.
// Ex.: massa com 2 fechadas não pagas (venc. jul/10 + ago/10) — a de jul
// tem 24 dias de atraso, a de ago ainda não venceu. Usar a mais recente
// (unpaidClosed[0]) mostraria 0 dias de atraso no payload, divergindo do
// banco (users.days_overdue=24) e do painel admin.
const _oldestDueMs = unpaidClosed.reduce(...);
```

Mesmo bug, mesmo exemplo, já diagnosticado e corrigido **na exibição**. O motor de
cobrança (`runBillingValidation`) ficou para trás e contradiz essa regra.

Isso é bom: a correção tem **precedente no próprio repositório** — basta espelhar o
comportamento de `_closedInvoiceOldestDueDate` no motor.

### Correção
- [ ] Trocar `ORDER BY due_date DESC` por `ASC` (`index.cjs:5297`), espelhando a regra
      já implementada em `enrichUserCreditCardData:354-358`
- [ ] **Antes de mudar:** mapear todos os consumidores de `closedDueByCpf` — a estrutura
      alimenta `newStatus`, `daysOverdue` e a geração de `billing_charges`
- [ ] Teste: massa com 2 faturas em aberto (uma vencida, uma futura) → `inadimplente`
      com o atraso da mais antiga
- [ ] Teste de regressão: massa com 1 fatura vencida → comportamento preservado

### Risco
Parece troca de uma palavra, mas `closedDueByCpf` carrega `amount` (residual) usado no
cálculo dos encargos. Trocar a fatura escolhida muda a **base de cálculo** de multa, juros
e IOF. Exige teste antes de rodar em massa.

---

### ✅ Validação em produção (2026-08-11)

Fix aplicado (`ORDER BY due_date ASC`), API reiniciada, `POST /admin/billing/validate-all`
disparado contra o banco real (não simulação).

| Métrica | Antes | Depois |
|---|---|---|
| `account_status='inadimplente'` | 15 | **54** |
| Falhas no processamento | — | 0 |
| CPFs do caso original (76671725950, 77551164685, 37810513150) | `adimplente`, 0 dias | `inadimplente`, **31 dias** |
| CPF 41649264658 (relatado pelo usuário) | — | `inadimplente`, **5 dias**, encargos R$17,82 |

**Diferença investigada:** universo bruto de faturas `FECHADA` vencidas = 111 CPFs, não 54.
Os 57 restantes têm **todos** `due_date = hoje` (10/08 local) — não é bug residual, é a
folga do próprio dia do vencimento ("passou da meia-noite do vencimento" só no dia
seguinte). Comportamento pretendido, confirmado por query agrupando os 57 por data.

## 2. Status `adimplente` gravado incorretamente (P0)

Consequência direta do #1. [`index.cjs:5325`](../../API/index.cjs):

```js
const newStatus = daysOverdue >= 1 ? 'inadimplente' : 'adimplente';
```

Não é só falta de atualização: o motor **sobrescreve ativamente** para `adimplente` e zera
`days_overdue`. Massa com 30 dias de atraso aparece em dia no painel, no dashboard de
inadimplência e em qualquer relatório que leia `account_status`.

- [ ] Corrigir junto com o #1 (mesma origem, mesmo commit)
- [ ] Validar contagem antes/depois: hoje 15, esperado ~54
- [ ] Conferir se régua de cobrança ou relatório consumiu o status errado

---

## 3. Laços sem isolamento por massa (P0)

### Causa raiz
Nenhum dos dois motores protege a iteração individual:

| Motor | Laço | Proteção |
|---|---|---|
| `runBillingValidation` | [`index.cjs:5312`](../../API/index.cjs) | nenhuma — só `try/catch` de notificação (5471, 5500) |
| `invoiceEngine.runEngine` | [`invoiceEngine.js:26`](../../API/services/invoiceEngine.js) | `try` da linha 9 envolve o laço inteiro e relança na 262 |

No `invoiceEngine`, só o rolo de planos de parcelamento tem `try/catch` por massa (linha 250).

Se a massa nº 10 falhar, as massas 11 a 54 nunca são processadas naquele dia — sem aviso.

### Correção
- [ ] Envolver o corpo de cada laço em `try/catch` por CPF
- [ ] Acumular `errors[]` com `{ cpf, etapa, mensagem }` e seguir para a próxima
- [ ] Retornar `{ processadas, falhas, errors }` em vez de só `processed`
- [ ] Teste: injetar erro na massa nº 2 de 5 → as outras 4 completam

---

## 4. Alerta do Telegram não identifica a massa (P1)

[`index.cjs:146`](../../API/index.cjs):

```js
telegramService.alertGroup(`🚨 ERRO na validação de faturamento: ${e.message}`, 'system_error');
```

Só a mensagem da exceção. Sem CPF, sem etapa, sem quantas ficaram para trás. Mesmo padrão
nas linhas 134, 157 e 172.

### Correção
- [ ] No `catch` por massa (#3), enviar CPF + etapa + mensagem
- [ ] Ao fim de cada motor, resumo: `X processadas, Y falharam` + lista de CPFs
- [ ] `Y > 0` → categoria `system_error`; `Y = 0` → `system_done`
- [ ] Truncar a lista acima de ~20 CPFs (limite de mensagem do Telegram)

---

## 5. Mocks no painel do CLIENTE (P1)

### Sintoma
Estamos em **agosto** e o cliente ainda vê **maio**.

### Causa raiz — inventário completo

| Arquivo | Linha | Conteúdo fixo | Efeito |
|---|---|---|---|
| `WEB/components/SpendingHeatmapSection.tsx` | 19-24 | `MONTH_OPTIONS` = Abr/**Mai**/Jun 2026; "Últimos 3 meses" = meses 3,4,5 | **o seletor de período do cliente para no tempo** — em agosto só oferece meses vencidos |
| `MOBILE/src/components/SpendingHeatmapSection.tsx` | 22 | idêntico | mesmo defeito no app |
| `WEB/components/FinancialInsightsCarouselModal.tsx` | 151-157 | array `Fev/26`→`Jun/26` com valores inventados (3100/2300, 3500/2800, 3800/2400…) | "Comparativo Mensal" inteiro é ficção; nada vem do banco |
| `WEB/components/Profile.tsx` | 295 | `\|\| 3870.86` | valor de fatura falso quando o backend não manda |
| `WEB/components/CardUnlockModal.tsx` | 27 | `invoiceDueDate: '2026-07-25'` | vencimento fixo |
| `WEB/components/BoletoModal.tsx` | 35 | `SAMPLE_PIX` com `3870.86` embutido no payload | boleto/PIX de exemplo com valor cravado |

O `MONTH_OPTIONS` é a resposta direta ao "ainda mostra maio": não é atraso de dado, é uma
**lista literal que ninguém atualiza desde junho**.

### Correção
- [ ] `MONTH_OPTIONS` gerado a partir da data atual (últimos N meses corridos), nunca literal
- [ ] "Últimos 3 meses" calculado de `new Date()`, não com índices fixos
- [ ] Aplicar no WEB **e** no MOBILE — mesmo defeito, dois arquivos
- [ ] "Comparativo Mensal" consumindo agregação real do backend; se não houver endpoint,
      criar um — **não** manter o array
- [ ] Remover `|| 3870.86` do `Profile.tsx`: sem valor → traço, não número
- [ ] Remover `invoiceDueDate: '2026-07-25'` do `CardUnlockModal.tsx`
- [ ] `SAMPLE_PIX`: se é exemplo estático, rotular claramente como exemplo na UI; se é
      usado em fluxo real, gerar do backend
- [ ] Formatação de mês em pt-BR determinística (array fixo de nomes, como o `paidAtLabel`
      em `BackofficeInvoiceSection.tsx:44`) — nomes de mês são constantes de idioma, não dado

### Verificação
Após a correção, com a data do sistema em agosto/2026, o seletor precisa oferecer
Jun/Jul/Ago — e nunca mais uma lista que envelhece sozinha.

---

## 6. Mocks no painel do ADMIN (P1)

### Sintoma
CPF `41649264658` tem **uma** fatura no banco (venc. 05/08, FECHADA, R$ 697,57, não paga).
O painel exibe três: "Fat 1 · Mai/26 — R$ 1.120,00 PAGA ✅", "Fat 2 · Fechada (Jun)",
"Fat 3 · Aberta (Jul)".

### Causa raiz
[`WEB/components/Admin/BackofficeInvoiceSection.tsx`](../../WEB/components/Admin/BackofficeInvoiceSection.tsx):

| Linha | Código | Problema |
|---|---|---|
| 58 | `const previousAmount = 1120.00;` | fatura inteira inventada, igual para todo cliente |
| 27 | `... : 2365.05` | fallback fantasma de `currentInvoice` |
| 62 | `\|\| '2026-07-15'` | data fantasma no cálculo de `overdueDays` |
| 308, 325, 350 | `Fat 1 · Mai/26`, `Fat 2 · Fechada (Jun)`, `Fat 3 · Aberta (Jul)` | meses fixos |
| 114, 129, 131, 141, 184, 200, 202, 212 | `Jun/26`, `Jul/26`, `Mai/26`, `15/05/2026` | repetidos no TSV do Excel e na tabela do Telegram |
| 366, 454, 486, 545 | idem no corpo da tela | |

Os rótulos fixos **vazam para fora do painel**: vão no arquivo copiado para o Excel e na
tabela enviada ao Telegram, propagando mês errado para relatórios e para o grupo.

### Correção
- [ ] Rótulos derivados de `due_date` real, nunca literais
- [ ] Remover `previousAmount` fixo — buscar a fatura anterior real ou **ocultar o slot
      Fat 1** quando não existir (é o caso do CPF acima: só tem uma fatura)
- [ ] Remover `2365.05` e `'2026-07-15'`
- [ ] Aplicar nos três destinos: tela, TSV do Excel, tabela do Telegram

---

## 7. Cron depende da API viva à meia-noite (P2)

`cron.schedule('0 0 * * *')` em [`index.cjs:126`](../../API/index.cjs) só dispara com o
processo Node rodando. A API sobe à mão a cada sessão, então máquina desligada às 00:00 =
dia sem fechamento nem encargos.

Evidência dos dois modos:
- 09/08 `00:00:00.663` → cron real
- 08/08 `22:36:38-39` (8 faturas em 1 segundo) → execução manual em lote

### Correção
- [ ] Catch-up no boot: ao subir, verificar se rodou hoje e executar se não rodou
- [ ] Botão no painel — a rota já existe (`POST /admin/invoices/engine/force-cycle`,
      [`index.cjs:5012`](../../API/index.cjs)), falta interface
- [ ] Registrar `last_run_at` para permitir a checagem

---

## 8. Gerador de Massas 2.0 — forma canônica da massa (P1)

### Descoberta: o gerador não é o culpado — o motor é

`seedMassBilling` ([`API/repositories/usersRepo.js:65-138`](../../API/repositories/usersRepo.js))
**já cria a forma correta** para inadimplente:

- 1 fatura `FECHADA` vencida — `due_date = hoje − daysOverdue`, 3 compras somando o
  principal, os 5 encargos ISO e `itemized_transactions`
- compras no ciclo **atual** (R$ 300–800, linhas 123-132) para a fatura aberta ter conteúdo

Ou seja: Fat 1 fechada em atraso + Fat 2 em andamento. Exatamente o pedido.

**O problema é o que acontece depois.** Na primeira execução do `invoiceEngine`, o ciclo
aberto passa do corte, fecha, e vira uma **segunda** `FECHADA` não paga. A massa passa a
ter 2 fechadas em aberto → cai no defeito #1 → para de acumular encargos silenciosamente.

Foi assim que nasceram as 39: invoice 1 (venc. 10/07) do gerador, invoice 2 (venc. 10/08)
do motor fechando o ciclo aberto.

> Por isso a etapa 8 vem **depois** da 1. Corrigir o gerador antes de corrigir o motor
> só produz massas que se corrompem na virada seguinte.

### Contrato da massa (a definir e travar)

**Perfil A — massa em atraso: exatamente 2 faturas**

| Slot | Estado | Conteúdo |
|---|---|---|
| Fat 1 | `FECHADA`, vencida, não paga | compras do ciclo anterior + 5 encargos + snapshot |
| Fat 2 | **em andamento** (aberta) | algumas transações do ciclo corrente |

- [ ] Fat 2 **nunca** pode nascer com corte no passado — `credit_card_invoice_due_date`
      tem que garantir `hoje < (due_date − 7)`, senão o motor a fecha na primeira execução
- [ ] Nunca gerar 2 faturas `FECHADA` não pagas: é estado inválido por definição
- [ ] Teste de invariante: após gerar, `COUNT(*) WHERE status='FECHADA' AND data_pagamento IS NULL` = **1**

**Perfil B — conta nova com compras: apenas 1 fatura**

| Slot | Estado | Conteúdo |
|---|---|---|
| Fat 1 | em andamento (aberta) | compras do ciclo corrente, **todas a vencer no mesmo dia** |

- [ ] Nenhuma linha em `invoices` — a fatura aberta é calculada on-the-fly (comportamento
      atual do ramo `adimplente`, linhas 139-155)
- [ ] Todas as compras dentro da mesma janela de ciclo, vencendo na mesma data
- [ ] Teste de invariante: `COUNT(*) FROM invoices WHERE cpf = X` = **0**

### Correção
- [ ] Escrever o contrato acima como constante/documento único consumido pelo gerador
- [ ] Ajustar `seedMassBilling` para garantir o corte futuro da Fat 2 (perfil A)
- [ ] Garantir no perfil B que as compras vençam todas no mesmo dia
- [ ] **Validador de invariante** rodando após cada geração: massa que nascer fora do
      contrato falha alto, não silenciosamente
- [ ] Estender ao `MainMassCreatorFlow.tsx` (WEB) para a UI refletir os dois perfis
- [ ] Teste de ciclo completo: gerar massa perfil A → rodar `invoiceEngine` → conferir
      que **continua** com 1 fechada não paga (é o teste que teria pego as 39)

### Nota sobre as massas já existentes
As 39 massas atuais estão fora do contrato (2 fechadas não pagas). Depois do fix do
defeito #1 elas voltam a acumular encargos corretamente, mas seguem com forma inválida.
Decidir: normalizar (consolidar as duas) ou marcar como legado e gerar massa nova.

---

## Decisão pendente — reprocessar as 39 massas

Depois do fix, as 39 continuam sem os encargos de 03/08 até hoje.

| Opção | Efeito | Risco |
|---|---|---|
| **A** — reprocessar retroativo | recupera multa/juros/IOF do período | precisa de idempotência; risco de cobrança dupla |
| **B** — recomeçar de hoje | simples, sem risco | perde ~6 dias de encargos |
| **C** — recalcular só `days_overdue` e status | painel correto sem mexer em dinheiro | encargos seguem defasados |

**Recomendação: C, depois avaliar A com validação massa a massa.** Corrigir primeiro o que
é exibição, conferir, e só então decidir sobre dinheiro. Decisão do dono do produto.

---

## Skills a usar

| Skill | Onde | Por quê |
|---|---|---|
| `superpowers:systematic-debugging` | etapas 1–2 | obriga causa raiz antes de corrigir; foi a que produziu este diagnóstico |
| `ecc:silent-failure-hunter` | etapas 3, 4, 5, 6 | feita exatamente para erro engolido, fallback mentiroso e falha que não propaga — o padrão `\|\| 3870.86` é o alvo dela |
| `superpowers:test-driven-development` | etapas 1, 3 | teste que reproduz antes da correção; sem isso a #1 volta |
| `ecc:silent-failure-hunter` (varredura) | após tudo | passar no resto do sistema atrás do mesmo padrão de fallback |
| `impeccable` | etapas 5–6 | estado vazio decente onde hoje há número falso |
| `ecc:architect` | etapa 7 | decidir entre catch-up no boot e agendador externo |
| `gsd-debug` | se necessário | investigação que atravessa sessões, com estado persistente |

Para bug urgente novo, a dupla certa é **`systematic-debugging` primeiro**
(causa raiz) e **`silent-failure-hunter` depois** (varrer o mesmo padrão no resto).

---

## Validação

```bash
cd API && npm test && npm run validate:rules
```

Aceite no banco (esperado 54, não 15):

```sql
SELECT COUNT(*) FROM fintech.users WHERE account_status = 'inadimplente';
```

Aceite de código — precisa retornar **zero** linhas:

```bash
grep -rnE "\|\| [0-9]{3,}\.[0-9]{2}|Mai/26|Jun/26|Jul/26|= 1120|: 2365\.05" WEB/components MOBILE/src
```

## Aceite

- [ ] 1 e 2 corrigidos, com teste de massa com 2 faturas em aberto
- [ ] Contagem de inadimplentes bate com o universo real (54)
- [ ] 3: erro em uma massa não impede as seguintes (teste com erro injetado)
- [ ] 4: alerta do Telegram traz CPF e resumo de falhas
- [ ] 5: seletor de período do cliente acompanha o mês corrente
- [ ] 6: nenhum valor ou mês fixo no `BackofficeInvoiceSection.tsx`
- [ ] `grep` de aceite retorna zero
- [ ] Decisão A/B/C registrada
- [ ] Suíte da API verde
