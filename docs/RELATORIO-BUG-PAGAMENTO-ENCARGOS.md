# Relatório de Correção de Bug: Fluxo de Pagamento de Faturas e Encargos

**Destinatário:** Diretoria Executiva  
**Autor:** Equipe de Engenharia / Claude  
**Data:** 02 de Agosto de 2026  
**Status:** Implementado e Homologado (100% de cobertura de testes passando)

---

## 1. Descrição do Bug (Causa Raiz)

Durante a homologação da massa de testes `124.648.659-54` (e outras similares em atraso), foi detectada uma divergência crítica no processamento de pagamentos e no cálculo do saldo consolidado das faturas:

1. **Capamento de Pagamento no Principal (Sub-registro de Receita)**:
   O cliente efetuou um pagamento de **R$ 5.623,68** para quitar a fatura fechada vencida (cujo principal original era **R$ 3.870,86** e os encargos de atraso acumulados no banco somavam **R$ 1.752,82**). 
   * **O Problema:** A rota de pagamento (`/cards/invoice/pay` no backend) definia o limite máximo de pagamento (`totalDue`) apenas sobre o principal devido (`closedDebt.owed`), desconsiderando os encargos acumulados na tabela `billing_charges`. 
   * **A Consequência:** O sistema executava um limitador de segurança `Math.min(requestedAmount, totalDue)`, o que capou o pagamento de R$ 5.623,68 para apenas R$ 3.870,86. A conta corrente do cliente foi debitada a menor, a transação foi gravada a menor, e o banco deixou de receber R$ 1.752,82 de encargos de atraso legítimos.

2. **Surgimento e Desaparecimento Indevido de Encargos (Bug Visual no Web)**:
   Uma vez pago o principal de R$ 3.870,86, a fatura fechada anterior era marcada como quitada (`data_pagamento` preenchida).
   * **O Problema:** A função `enrichUserCreditCardData` (que alimenta o dashboard do cliente) determinava que, se a fatura fechada anterior estivesse paga (`closedInvoiceIsPaid = true`), ela deveria zerar as variáveis de exibição de encargos de atraso no resumo. 
   * **A Consequência:** Os encargos sumiam visualmente da fatura aberta do cliente (dando a falsa impressão de que tinham sido perdoados), mas continuavam como `'pending'` no banco de dados. Isso impedia a conciliação e gerava discrepâncias entre o saldo consolidado final e a soma dos itens da fatura.

3. **Data Retroativa Incorreta na Transação de Pagamento**:
   A transação de pagamento de fatura (`INVOICE_PAYMENT`) era inserida no banco com a data de vencimento da fatura fechada (ex: `10/Julho`) em vez de usar a data real em que o pagamento foi de fato processado (ex: `02/Agosto`).
   * **A Consequência:** O extrato do cliente exibia transações futuras/passadas fora de ordem cronológica e comprometia a auditoria temporal das movimentações de caixa do banco.

---

## 2. Solução Implementada

Realizamos uma refatoração profunda no motor de faturamento e pagamentos para garantir consistência contábil e regularizar o fluxo:

1. **Integração de Encargos no Total Devido**:
   * O backend foi alterado para buscar ativamente o total de encargos com status `'pending'` na tabela `billing_charges`.
   * O total devido completo agora é a soma: $\text{totalDueComplete} = \text{Principal Devido} + \text{Encargos Acumulados}$.
   * O pagamento do cliente agora é aceito na totalidade (até o limite de `totalDueComplete`).

2. **Divisão de Amortização de Pagamento**:
   Ao receber o pagamento (`payAmount`), o backend separa o valor em duas partes:
   * **Amortização do Principal**: Quita a fatura fechada no banco.
   * **Amortização dos Encargos**: O excedente (`chargesToPay`) é utilizado para marcar proporcionalmente o status dos registros de `billing_charges` de `'pending'` para `'paid'` (pago).
   * **Geração de Crédito**: Se o pagamento ultrapassar a soma de principal + encargos, a sobra é gravada como `creditoExcedente`.

3. **Correção do Cálculo e Exibição de Crédito Excedente**:
   * Implementamos a fórmula de crédito excedente: $\text{creditoExcedente} = \text{Pagamentos no Ciclo} - (\text{Principal das Faturas} + \text{Encargos Totais do Ciclo})$.
   * Esse crédito excedente reduz o saldo devedor restante da fatura fechada anterior. Caso o cliente pague a maior, o residual (`closedInvoiceResidual`) fica **negativo** (ex: `-R$ 1.752,82`), representando o saldo credor.
   * O frontend (resumo da fatura aberta e painel admin) foi atualizado para identificar se `closedInvoiceResidual < 0`. Quando negativo, exibe uma linha verde destacada com o rótulo **"🟢 Saldo credor (sobra do pagamento anterior)"**, explicitando de forma transparente de onde veio o abatimento no total da fatura aberta.

4. **Correção das Datas de Lançamento**:
   * Desacoplamos a data limite de exclusão de parcelas (`cutoffIso`) da data de gravação da transação de pagamento (`paymentDateIso`).
   * A transação `INVOICE_PAYMENT` agora é registrada com a data exata do processamento (`nowDb()`), aparecendo corretamente em ordem cronológica no extrato do cliente.

---

## 3. Atualização na Regra de Negócio Canônica

O documento oficial de engenharia ([`docs/REGRAS-NEGOCIO-FATURA.md`](REGRAS-NEGOCIO-FATURA.md)) foi atualizado na **Seção 19** com as seguintes definições canônicas de negócio:

1. **Princípio de Estopo de Atraso**:
   A quitação do principal da fatura fechada vencida **congelará (estopará)** a contagem de dias em atraso e impedirá a incidência de novos encargos diários (juros de mora, juros remuneratórios e IOF diário). No entanto, os encargos acumulados até o dia do pagamento **não são zerados automaticamente**. Eles continuam devidos na fatura aberta (como herança de atraso) até que ocorra o pagamento consolidado.

2. **Consistência de Mínimo Zerado por Crédito**:
   Caso o cliente efetue um pagamento excedente que cubra a dívida anterior + encargos, o crédito gerado abate diretamente o pagamento mínimo exigido do novo ciclo aberto. Se o crédito for igual ou maior do que 10% das novas compras, o mínimo consolidado no corte será legalmente **R$ 0,00**, pois o cliente já pagou adiantado.

3. **Espelhamento Estrito Admin-Cliente**:
   O painel do Backoffice Administrativo e a tela do cliente compartilham a **mesma fonte única de dados (`closedInvoiceCharges`)**. O painel admin não realiza cálculos locais paralelos, garantindo que o gerente e o cliente vejam exatamente os mesmos centavos em tempo real.
