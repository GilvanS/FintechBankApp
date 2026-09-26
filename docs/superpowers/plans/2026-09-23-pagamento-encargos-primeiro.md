# Plano: pagamento de fatura aplica ENCARGOS PRIMEIRO + herança correta + auditoria + gerador

Spec: regra de negócio definida pelo usuário em 2026-09-23 (memória `C:\Users\GilvanS\.claude\projects\F--GITHUB-FintechBankApp\memory\regra-encargos-pagamento-parcial.md` — ler antes de começar).

## Global Constraints (valem para TODAS as tasks)

1. **Ordem de aplicação do pagamento**: ENCARGOS PRIMEIRO — multa, juros de mora, juros remuneratórios, IOF diário — e só depois o principal (valor_total da fatura). O **IOF adicional (0,38%, calcIofAdicional)** é calculado sobre as compras e **não entra** nessa ordem nem é recalculado.
2. **Pagamento parcial / mínimo / abaixo do mínimo**: o residual continua devendo e os encargos seguem sendo calculados do **vencimento** até a quitação total. **Só o pagamento TOTAL** para os encargos. Residual + encargos acumulados são **herdados pela fatura aberta**.
3. **Mínimo inalterado**: 10% das compras + principal + 100% dos encargos (fórmula atual).
4. **Fatura FECHADA é imutável**: nunca UPDATE em colunas monetárias de invoices com status FECHADA, nunca `ALTER TABLE ... DISABLE TRIGGER`, nunca `session_replication_role`. Quitação é derivada de `transactions.invoice_id` (INVOICE_PAYMENT vinculados, distribuídos em cascata da mais antiga para a mais nova).
5. **Workspace**: trabalhar SÓ em `F:\GITHUB\FintechBankApp\.claude\worktrees\trusting-montalcini-71c952` (branch `claude/trusting-montalcini-71c952`). **Nunca ler nem escrever arquivos em `F:\GITHUB\FintechBankApp\API\...`** (checkout principal): ler arquivos lá dispara reinício da API do usuário. A única exceção é o caminho do .env passado por variável.
6. **Banco real**: consultas de validação só de LEITURA, usando código do worktree com `DOTENV_CONFIG_PATH=F:/GITHUB/FintechBankApp/API/.env` (ex.: `require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH })`). Nenhuma escrita no banco fora dos testes existentes.
7. **Testes**: `cd API && npx jest --selectProjects unit` (2 suítes — massa805Lifecycle e acquirerSimulate — só rodam com o .env: `DOTENV_CONFIG_PATH=... node -r dotenv/config node_modules/jest/bin/jest.js --selectProjects unit --forceExit`). A falha pré-existente de massa805Lifecycle na linha 74 (`>= 4 pending` da ref 2026-07) já existia antes do plano.
8. **Commits**: 1+ commit por task no branch do worktree, mensagem em pt-BR no estilo do repo, **sem** trailer Co-Authored-By. Nada de push, merge ou rebase.
9. Arquivos lixo vazios na raiz/API (nomes como `{`, `0.02)`) são artefato de hook — ignorar, não commitar.
10. Seguir o estilo do código vizinho; comentários explicam o porquê; arquivos < 500 linhas quando possível.

## Task 1: Função canônica de alocação "encargos primeiro"

Em `API/utils/invoiceMath.js`, criar uma função pura (ex.: `alocarPagamento`) que, dado o valor pago, o principal em aberto e os encargos em aberto discriminados (multa, jurosMora, jurosRemuneratorios, iofDiario), devolve quanto foi para cada encargo, quanto foi para o principal, o que sobrou de cada um e o excedente — na ordem da Global Constraint 1 (IOF adicional fora). Incluir testes unitários (total, mínimo, abaixo do mínimo, parcial que só cobre encargos, parcial que cobre encargos e parte do principal, excedente). Não ligar em lugar nenhum ainda.

## Task 2: Rota de pagamento aplica encargos primeiro

`API/src/controllers/invoiceController.js` (`pay` e o que ele usa, ex.: `persistPaymentDistribution`, `getClosedInvoiceDebt`): hoje abate o principal e deixa os encargos `pending` ("pagou R$ X (principal), deixando R$ Y de encargos pending para a fatura aberta"). Passar a usar a função da Task 1: o pagamento quita primeiro as `billing_charges` pending (multa → juros_mora → juros_remuneratorios → iof diário; investigar como o IOF diário e o adicional estão gravados em billing_charges e preservar o adicional), marcando o que foi quitado de forma rastreável, e só o restante abate o principal (INVOICE_PAYMENT vinculado). Parcial/mínimo: residual segue gerando encargos (Global Constraint 2). Atualizar/adicionar testes unitários da rota. Não alterar fatura FECHADA.

## Task 3: Quitação exibida, fechamento e herança com a mesma ordem

`API/index.cjs` (`enrichUserCreditCardData` — cascata `planDistribution`), `API/services/saldoAnterior.js` e `API/services/invoiceEngine.js`: a quitação derivada (quanto de cada fechada está pago/em aberto, currentInvoiceTotal, closedInvoiceTotal, encargos herdados) e o saldo anterior do fechamento passam a considerar que o pagamento cobre encargos primeiro (mesma função da Task 1). Resultado esperado: pagamento maior que o principal deixa de virar "crédito" quando havia encargos; a fatura seguinte herda residual + encargos quando não houve pagamento total. Atualizar os testes unitários afetados (ex.: validateDoubleChargeFix, planDistribution) para a regra nova, explicando no teste por que o valor mudou.

## Task 4: Auditoria sem regressão

`API/services/saldoAnterior.js` + `API/services/dailyAudit.js` + `API/services/auditAlerts.js`: a Anomalia 8d vira `SALDO_ANTERIOR_DIVERGENTE`, nas duas direções (herdou a mais / herdou a menos), usando a regra das Tasks 1–3, só para fechamentos do motor (função `fechadaPeloMotor` já existe). Adicionar anomalia para encargo que continuou contando depois de pagamento TOTAL e para residual de pagamento parcial que parou de gerar encargo, se o dado permitir detectar. Critério do Telegram: 'faturas'. Validar contra a base real (leitura) e registrar no relatório da task quantas faturas cada regra acusa.

## Task 5: Gerador de massas com ciclos em atraso e tipos de pagamento

`API/repositories/usersRepo.js` (`seedMassBilling` e afins) + gerador (rota de massa / Gerador 4.0): ao gerar massa com ciclos de fatura em atraso e pagamentos de tipos diferentes (TOTAL, MÍNIMO, ABAIXO DO MÍNIMO, PARCIAL), gravar tudo pela regra: pagamento vinculado (`transactions.invoice_id`), encargos primeiro, residual + encargos herdados pela fatura seguinte (saldo_anterior acumulado coerente com saldoAnterior.js), encargos param só no TOTAL. Testes unitários do gerador para cada tipo de pagamento.

## Task 6: Suítes completas — unitários e integração

Rodar a suíte unitária completa (com as 2 suítes que precisam de .env) e a suíte de integração da API (`npx jest --selectProjects integration`, com o .env). Corrigir o que for regressão das Tasks 1–5; para testes cuja expectativa era a regra antiga (principal primeiro), atualizar a expectativa com comentário da regra nova. Relatar no report: comandos, totais, e cada teste alterado com o motivo.
