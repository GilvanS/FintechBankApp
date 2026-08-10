# Execução por Agentes — Ciclo de Vida da Fatura

**Plano:** [`PLANO-CICLO-VIDA-FATURA.md`](./PLANO-CICLO-VIDA-FATURA.md)
**Lang:** `typescript` (backend `.cjs`/`.js` + frontend `.tsx` — `typescript-reviewer` cobre os dois)
**ECC mode:** `plugin`, prefixo `ecc`
**Tarefas:** 8 (as etapas 1+2 e 3+4 do plano viram commits únicos)

## Regras de execução

> **Sequencial no caminho crítico.** T1 → T2 → T3 é a linha do dinheiro. T1 é pré-requisito
> de T7: massa corrigida pelo gerador volta a corromper se o motor não foi consertado antes.

> **Zero mock. Zero string fixa. Zero fallback numérico.** Sem dado do backend → traço ou
> erro, nunca um número plausível.

## Ordem e agentes

| T | Tarefa | Sev. | Depende | Agentes (chain) | Skills a carregar |
|---|---|---|---|---|---|
| 1 | Motor: fatura mais antiga + status | **P0** | — | `ecc:tdd-guide` → `ecc:database-reviewer` → `ecc:typescript-reviewer` | `superpowers:systematic-debugging`, `superpowers:test-driven-development`, `ecc:postgres-patterns` |
| 2 | Isolamento por massa + alerta com CPF | **P0** | T1 | `ecc:tdd-guide` → `ecc:typescript-reviewer` | `ecc:silent-failure-hunter`, `ecc:error-handling` |
| 3 | Validar e decidir reprocessamento | **P0** | T2 | `ecc:database-reviewer` → `ecc:code-reviewer` | `ecc:postgres-patterns`, `ecc:production-audit` |
| 4 | Mocks fora do painel do CLIENTE | P1 | — | `ecc:tdd-guide` → `ecc:react-reviewer` → `ecc:typescript-reviewer` | `ecc:silent-failure-hunter`, `ecc:react-patterns`, `impeccable` |
| 5 | Mocks fora do painel do ADMIN | P1 | T4 | `ecc:tdd-guide` → `ecc:react-reviewer` → `ecc:typescript-reviewer` | `ecc:silent-failure-hunter`, `ecc:react-patterns`, `impeccable` |
| 6 | Agendamento resiliente | P2 | T2 | `ecc:architect` → `ecc:tdd-guide` → `ecc:typescript-reviewer` | `ecc:architecture-decision-records`, `ecc:backend-patterns` |
| 7 | Gerador de Massas 2.0 — contrato | P1 | **T1** | `ecc:tdd-guide` → `ecc:database-reviewer` → `ecc:typescript-reviewer` | `superpowers:test-driven-development`, `ecc:postgres-patterns`, `ecc:type-design-analyzer` |
| 8 | Gate final de validação | — | todas | `ecc:tdd-guide` → `ecc:e2e-runner` | `superpowers:verification-before-completion`, `ecc:quality-gate` |

T4 e T5 não tocam nos arquivos de T1–T3 — podem correr em paralelo se houver duas pessoas.

## Por que cada agente

| Agente | Papel na cadeia |
|---|---|
| `ecc:tdd-guide` | abre a cadeia escrevendo o teste que falha **antes** da correção — é o que impede a T1 de voltar |
| `ecc:database-reviewer` | valida SQL, índice e integridade; T1 mexe na query que define a base de cálculo dos encargos |
| `ecc:typescript-reviewer` | fecha a cadeia; cobre TS **e** JS, então serve para `.cjs` do backend e `.tsx` do front |
| `ecc:react-reviewer` | hooks, render e boundary de componente — só nas tarefas de UI |
| `ecc:code-reviewer` | revisão genérica onde não há código novo (T3 é auditoria, não feature) |
| `ecc:architect` | decisão de desenho antes de codar (T6: catch-up no boot × agendador externo) |
| `ecc:e2e-runner` | fecha o gate com fluxo ponta a ponta |

---

## T1 — Motor: ancorar na fatura mais antiga (P0)

**Cobre:** etapas 1 e 2 do plano (mesma causa, mesmo commit)
**Skills:** `superpowers:systematic-debugging` (causa raiz antes do fix), `superpowers:test-driven-development`, `ecc:postgres-patterns`

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:database-reviewer,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CICLO-VIDA-FATURA.md#t1] Corrigir runBillingValidation em API/index.cjs:5294-5305: a query de closedInvoiceRows usa ORDER BY due_date DESC e o loop seguinte grava so a primeira ocorrencia por CPF, selecionando a fatura FECHADA nao paga MAIS RECENTE em vez da MAIS ANTIGA. Efeito medido: 39 de 54 massas em atraso ficam com daysOverdue=0 e sao gravadas como adimplente na linha 5325, deixando de acumular multa, juros e IOF. Espelhar a regra ja implementada no caminho de leitura enrichUserCreditCardData em API/index.cjs:349-358 (_closedInvoiceOldestDueDate). Mapear todos os consumidores de closedDueByCpf antes de mudar, pois o campo amount alimenta a base de calculo dos encargos. Carregar as skills superpowers:systematic-debugging e superpowers:test-driven-development antes de editar; Acceptance: teste com massa de 2 faturas FECHADA nao pagas (uma vencida, uma futura) resulta em inadimplente com o atraso da mais antiga; teste de regressao com 1 fatura vencida preserva o comportamento atual; SELECT COUNT(*) FROM fintech.users WHERE account_status='inadimplente' passa de 15 para ~54"
```

---

## T2 — Isolamento por massa + alerta que identifica a massa (P0)

**Cobre:** etapas 3 e 4 do plano · **Depende de:** T1
**Skills:** `ecc:silent-failure-hunter` (é literalmente o alvo dela), `ecc:error-handling`

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CICLO-VIDA-FATURA.md#t2] Isolar o processamento por massa nos dois motores diarios. Hoje runBillingValidation (loop em API/index.cjs:5312) nao tem try/catch por CPF, e invoiceEngine.runEngine (loop em API/services/invoiceEngine.js:26) tem o try da linha 9 envolvendo o laco inteiro com rethrow na 262, entao uma massa com erro impede todas as seguintes de serem processadas naquele dia. Envolver o corpo de cada laco em try/catch por CPF, acumular errors[] com cpf, etapa e mensagem, seguir para a proxima massa, e retornar {processadas, falhas, errors}. Corrigir tambem os alertas do Telegram em API/index.cjs linhas 134, 146, 157 e 172, que enviam apenas e.message sem identificar qual massa quebrou: incluir CPF e etapa no catch por massa, e ao fim de cada motor enviar resumo com X processadas, Y falharam e a lista de CPFs truncada em 20. Carregar as skills ecc:silent-failure-hunter e ecc:error-handling antes de editar; Acceptance: teste injetando erro na massa 2 de 5 confirma que as outras 4 completam; retorno inclui errors[] com o CPF da que falhou; alerta do Telegram com falha usa categoria system_error e cita o CPF"
```

---

## T3 — Validar resultado e decidir reprocessamento (P0)

**Depende de:** T2 · Sem `tdd-guide`: é auditoria, não feature
**Skills:** `ecc:postgres-patterns`, `ecc:production-audit`

```bash
/ecc:orchestrate custom "ecc:database-reviewer,ecc:code-reviewer" "[Plan: docs/plans/PLANO-CICLO-VIDA-FATURA.md#t3] Validar o efeito das correcoes T1 e T2 no banco fintechbank (schema fintech, container pgdb no Docker do WSL Ubuntu) e preparar a decisao de reprocessamento. Rodar o motor e conferir que a contagem de inadimplentes vai de 15 para o universo real de 54, usando a consulta de referencia do plano que compara a fatura mais antiga nao paga contra a escolhida pelo motor. As 39 massas afetadas ficaram sem encargos entre 03/08 e a data da correcao; avaliar as tres opcoes registradas no plano: A reprocessar retroativo com idempotencia, B recomecar de hoje, C recalcular apenas days_overdue e account_status sem gerar encargo retroativo. NAO executar reprocessamento sem aprovacao explicita do dono do produto. Carregar a skill ecc:production-audit; Acceptance: contagem de inadimplentes bate com o universo real; relatorio lista as 39 massas com atraso real e encargos faltantes por periodo; recomendacao A/B/C documentada com risco de cobranca dupla avaliado"
```

---

## T4 — Tirar os mocks do painel do CLIENTE (P1)

**Skills:** `ecc:silent-failure-hunter`, `ecc:react-patterns`, `impeccable` (estado vazio decente)

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:react-reviewer,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CICLO-VIDA-FATURA.md#t4] Remover todo dado fixo do painel do cliente, que em agosto de 2026 ainda exibe maio. Alvos: WEB/components/SpendingHeatmapSection.tsx:19-24 e MOBILE/src/components/SpendingHeatmapSection.tsx:22, onde MONTH_OPTIONS e uma lista literal com Abril, Maio e Junho de 2026 e o item rolling usa indices de mes fixos 3, 4 e 5, fazendo o seletor de periodo envelhecer sozinho; WEB/components/FinancialInsightsCarouselModal.tsx:151-157, onde o Comparativo Mensal e um array literal de Fev/26 a Jun/26 com valores inventados; WEB/components/Profile.tsx:295, com fallback || 3870.86 que exibe valor de fatura falso; WEB/components/CardUnlockModal.tsx:27 com invoiceDueDate fixo; WEB/components/BoletoModal.tsx:35 com 3870.86 embutido no SAMPLE_PIX. Regra do plano: sem dado do backend a tela mostra traco ou erro, nunca um numero plausivel. Nomes de mes em pt-BR podem ser array constante de idioma, seguindo o padrao de paidAtLabel em WEB/components/Admin/BackofficeInvoiceSection.tsx:44. Carregar as skills ecc:silent-failure-hunter e impeccable; Acceptance: com a data do sistema em agosto de 2026 o seletor oferece Jun, Jul e Ago; Comparativo Mensal consome agregacao real do backend ou o componente e removido; nenhum fallback numerico permanece; correcao aplicada em WEB e MOBILE"
```

---

## T5 — Tirar os mocks do painel do ADMIN (P1)

**Depende de:** T4 (reaproveita o helper de formatação de mês)
**Skills:** `ecc:silent-failure-hunter`, `ecc:react-patterns`, `impeccable`

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:react-reviewer,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CICLO-VIDA-FATURA.md#t5] Remover dado fixo de WEB/components/Admin/BackofficeInvoiceSection.tsx. Caso real: o CPF 41649264658 tem uma unica fatura no banco (vencimento 05/08/2026, FECHADA, R$ 697,57, nao paga) mas o painel exibe tres slots, sendo Fat 1 Mai/26 no valor de R$ 1.120,00 marcada como PAGA, um valor literal identico para todo cliente. Alvos: linha 58 previousAmount = 1120.00; linha 27 fallback 2365.05 de currentInvoice; linha 62 data fantasma 2026-07-15 no calculo de overdueDays; linhas 308, 325 e 350 com os rotulos fixos Mai/26, Fechada (Jun) e Aberta (Jul); e as repeticoes dos mesmos meses nas linhas 114, 129, 131, 141, 184, 200, 202, 212, 366, 454, 486 e 545. Os rotulos vazam para fora da tela: vao no TSV copiado para o Excel e na tabela enviada ao Telegram, propagando mes errado para relatorios. Derivar todos os rotulos de due_date real e ocultar o slot Fat 1 quando nao existir fatura anterior. Carregar as skills ecc:silent-failure-hunter e impeccable; Acceptance: rotulos refletem as datas reais das faturas do cliente consultado; slot Fat 1 nao aparece para cliente com uma unica fatura; nenhum valor monetario ou mes literal permanece no arquivo; correcao aplicada nos tres destinos, tela, TSV do Excel e tabela do Telegram"
```

---

## T6 — Agendamento resiliente (P2)

**Depende de:** T2 · `architect` primeiro: é decisão de desenho antes de código
**Skills:** `ecc:architecture-decision-records`, `ecc:backend-patterns`

```bash
/ecc:orchestrate custom "ecc:architect,ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CICLO-VIDA-FATURA.md#t6] Tornar o motor diario resiliente a API desligada. O cron.schedule('0 0 * * *') em API/index.cjs:126 so dispara com o processo Node vivo, e a API sobe manualmente a cada sessao, entao maquina desligada a meia-noite significa dia sem fechamento de fatura nem geracao de encargos. Evidencia dos dois modos de execucao: em 09/08 as 00:00:00.663 houve disparo real do cron, e em 08/08 as 22:36:38 oito faturas foram criadas dentro de um segundo, caracterizando execucao manual em lote. Avaliar catch-up no boot, verificando se o motor rodou hoje e executando se nao rodou, versus agendador externo do sistema operacional. Registrar last_run_at para permitir a checagem. A rota POST /admin/invoices/engine/force-cycle ja existe em API/index.cjs:5012 e pode ganhar botao no painel. Registrar a decisao como ADR usando a skill ecc:architecture-decision-records; Acceptance: subir a API apos um dia sem execucao dispara o catch-up uma unica vez; last_run_at persistido e consultavel; execucao duplicada no mesmo dia nao gera encargo em dobro; ADR escrito em docs/adr"
```

---

## T7 — Gerador de Massas 2.0: contrato da massa (P1)

**Depende de:** T1 — sem ela, massa nova nasce certa e o motor corrompe na virada seguinte
**Skills:** `superpowers:test-driven-development`, `ecc:postgres-patterns`, `ecc:type-design-analyzer` (o contrato tem que virar tipo, não convenção)

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:database-reviewer,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CICLO-VIDA-FATURA.md#t7] Travar o contrato de forma da massa no gerador seedMassBilling em API/repositories/usersRepo.js:65-155 e na UI WEB/components/Admin/MainMassCreatorFlow.tsx. O gerador ja cria a forma correta para inadimplente, uma fatura FECHADA vencida com compras do ciclo anterior mais os cinco encargos e snapshot, mais compras do ciclo corrente para a fatura aberta ter conteudo, mas o invoiceEngine fecha esse ciclo aberto na primeira execucao e cria uma segunda FECHADA nao paga, quebrando o contrato. Perfil A massa em atraso: exatamente duas faturas, sendo Fat 1 FECHADA vencida nao paga e Fat 2 em andamento com transacoes, garantindo que credit_card_invoice_due_date deixe o corte no futuro (hoje menor que due_date menos 7 dias). Perfil B conta nova com compras: apenas a fatura aberta, sem nenhuma linha em invoices, com todas as compras vencendo no mesmo dia. Adicionar validador de invariante executado apos cada geracao, falhando alto quando a massa nascer fora do contrato. Carregar as skills superpowers:test-driven-development e ecc:type-design-analyzer para que o contrato vire tipo e nao convencao; Acceptance: apos gerar perfil A o COUNT de invoices FECHADA sem data_pagamento e exatamente 1; apos gerar perfil B o COUNT de invoices do CPF e 0; teste de ciclo completo gera perfil A, roda invoiceEngine e confirma que continua com uma unica FECHADA nao paga"
```

---

## T8 — Gate final de validação

**Skills:** `superpowers:verification-before-completion`, `ecc:quality-gate`

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:e2e-runner" "[Plan: docs/plans/PLANO-CICLO-VIDA-FATURA.md#t8] Rodar o gate de validacao final apos T1 a T7. Executar cd API && npm test && npm run validate:rules. Rodar cd WEB && npx tsc --noEmit comparando contra o baseline conhecido de 77 erros pre-existentes em LimitView, Dashboard, HomeView, CardsView e RequestsManagement, aceitando apenas reducao ou empate, nunca aumento. Executar a consulta de aceite de ausencia de dado fixo com grep -rnE sobre WEB/components e MOBILE/src procurando fallback numerico e rotulos de mes literais, que precisa retornar zero linhas. Conferir no banco que a contagem de inadimplentes bate com o universo real de massas com fatura fechada vencida nao paga. Carregar as skills superpowers:verification-before-completion e ecc:quality-gate; Acceptance: suite unitaria da API verde e validate:rules sem falha; tsc do WEB sem erros novos acima do baseline; grep de dado fixo retorna zero linhas; contagem de inadimplentes consistente entre users.account_status e a realidade das invoices"
```

---

## Inventário de skills — tudo já instalado

Verificado na lista de skills disponíveis desta sessão. **Nada falta instalar.**

| Skill | Origem | Usada em |
|---|---|---|
| `superpowers:systematic-debugging` | plugin superpowers | T1 |
| `superpowers:test-driven-development` | plugin superpowers | T1, T7 |
| `superpowers:verification-before-completion` | plugin superpowers | T8 |
| `ecc:silent-failure-hunter` | plugin ecc | T2, T4, T5 |
| `ecc:error-handling` | plugin ecc | T2 |
| `ecc:postgres-patterns` | plugin ecc | T1, T3, T7 |
| `ecc:production-audit` | plugin ecc | T3 |
| `ecc:react-patterns` | plugin ecc | T4, T5 |
| `impeccable` | global | T4, T5 |
| `ecc:architecture-decision-records` | plugin ecc | T6 |
| `ecc:backend-patterns` | plugin ecc | T6 |
| `ecc:type-design-analyzer` | plugin ecc | T7 |
| `ecc:quality-gate` | plugin ecc | T8 |

Complementares, se quiser aprofundar: `ecc:tdd-workflow`, `ecc:verification-loop`,
`ecc:database-migrations` (só se T7 exigir migração), `gsd-debug` (investigação que
atravessa sessões).
