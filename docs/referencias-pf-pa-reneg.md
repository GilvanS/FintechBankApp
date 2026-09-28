# Referências reais — PF, PA e Reneg

Capturas de bancos reais (Santander app + Santander ferramenta interna de QA + Itaú app), documentadas em ASCII pra servir de exemplo quando for solicitar/desenhar os campos de PF (Parcelamento de Fatura), PA (Parcelamento Automático) e Reneg no FintechBankApp.

---

## 1. Opções de Pagamento até a Data de Vencimento (Santander)

Painel lateral da fatura, 3 opções lado a lado com fórmula visível:

```
┌────────────────────────────────────────────────────────────────┐
│ 1  Pagamento Total                              R$ 18.274,50   │
│    "Sempre a sua MELHOR opção!"                                │
│    Pagamentos após vencimento têm custo adicional:              │
│      Juros: 15,39% a.m.                                        │
│    + Juros por atraso: 1,00% a.m.                               │
│    + IOF: 0,246% a.m.                                           │
│    + IOF adicional: 0,380%                                     │
│    + Multa: 2,00%                                               │
├────────────────────────────────────────────────────────────────┤
│ 2  Pagamento Mínimo                             R$ 18.139,46   │
│    Valor mínimo pra não ficar em atraso.                        │
│    Diferença até o saldo total vai pra próxima fatura           │
│    + juros de R$ 135,04.                                        │
│    Juros: 15,39% a.m. + IOF: 0,246% a.m.                        │
│    + IOF adicional: 0,380% (CET: 527,44% a.a.)                  │
├────────────────────────────────────────────────────────────────┤
│ 3  Entrada Mínima p/ Parcelamento Automático     R$ 2.227,78   │
│    Saldo restante R$ 16.046,72 parcelado em 10x de              │
│    R$ 2.557,21, juros 8,95% a.m. + IOF 0,246% a.m.               │
│    + IOF adicional 0,380% (CET: 195,67% a.a.)                   │
│    Total final pago ao fim do parcelamento: R$ 25.572,10        │
│    (pode pagar qualquer valor entre a Entrada Mínima e o        │
│    Pagamento Mínimo — a diferença financia nas mesmas           │
│    condições do PA acima)                                       │
└────────────────────────────────────────────────────────────────┘
```

**Regra-chave**: PF/PA tem taxa própria (8,95% a.m., CET 195,67% a.a.) — MENOR que a do rotativo/mínimo (15,39% a.m., CET 527,44% a.a.). É a alternativa "mais barata" pra quem não vai pagar o total.

---

## 2. Resumo da Fatura + Parcelamentos (Santander)

```
Parcelamentos
─────────────────────────────────────────────────────────
Compra    Data     Descrição          Parcela   R$       US$
                    MERCHANT NAME      2/10      150,05
                    VALOR TOTAL                  150,05   0,00

Resumo da Fatura
─────────────────────────────────────────────────────────
Descrição                                        R$        US$
Saldo Anterior                                   15.226,05
(+) Juros Moratórios                              2.343,28
(+) IOF                                              37,45
(+) IOF Adicional                                    57,85
(+) Juros de Mora                                   155,30
(+) Multa por Atraso                                304,52
Total de Encargos dos parcelamentos     Juros: 0,00 / IOF: 0,00 / IOF Adicional: 0,00
(+) Total Despesas/Débitos no Brasil                150,05
(+) Total Despesas/Débitos no Exterior                0,00    0,00
(-) Total de pagamentos                               0,00
(-) Total de créditos                                 0,00
──────────────────────────────────────────────────────────
(=) Saldo Desta Fatura                           18.274,50
"Saldo total consolidado de obrigações futuras" (cortado)
```

**Nota**: bate exatamente com o valor do painel 1 (R$18.274,50) — mesma fatura, duas telas.
Composição = saldo anterior + (juros moratórios + IOF + IOF adicional + juros de mora + multa) + compras do período − pagamentos − créditos.

---

## 3. App real — timeline de parcelas futuras + lançamento com "Parcela X de Y" (Itaú)

Tela "Fatura aberta":
```
┌──────┬──────┬──────┬──────┐
│  Jul │ Ago● │  Set │  Out │   ← timeline de meses, valor projetado decrescente
│2.031,│1.558,│1.489,│1.227,│      conforme parcelas vão "saindo" (quitando)
│  24  │  90  │  24  │  24  │
└──────┴──────┴──────┴──────┘
Fatura aberta                    R$ 1.558,90
Melhor data de compra             20 ago
Vencimento                        27 ago
Débito automático                 Desativado

Resumo da fatura
  Compras                        R$ 1.558,90
  Produtos e serviços            R$ 0,00
  [Antecipar pagamento]
```

Tela "Lançamentos" (mesmo cartão, mesma timeline no topo):
```
20 de julho
  Pagamento com saldo (Cartão físico)          -R$ 2.031,24

26 de junho
  Mercadolivre*mercadolsao paulobra             R$ 79,99
  Cartão físico · Parcela 2 de 10

25 de junho
  Drogarias medfarmaosascobra                   R$ 69,66
  Cartão físico · Parcela 2 de 2

9 de junho
  Itaushop                                      R$ 405,11
  Cartão físico · Parcela 3 de 10
```

**Padrão a copiar**: cada lançamento parcelado mostra "Parcela X de Y" junto da compra — é exatamente o que corrigimos essa semana pro `Histórico Completo`/expandir do WEB (mas lá já bate). O timeline de 4 meses com valor decrescente é a representação visual de "Parcelas a Vencer" mês a mês — poderia inspirar um gráfico futuro em vez de só o total.

---

## 4. Ferramenta interna de QA do Santander — códigos técnicos

### 4.1 Saldos (`Resumo — Fatura N`)

| Código | Descrição | Exemplo |
|---|---|---|
| TOT | Total da Fatura | R$ 316,02 |
| MIN | Pagamento Mínimo | R$ 316,02 |
| CLO | Saldo de Fechamento | R$ 265,50 |
| PCO | Saldo de Fechamento Anterior | R$ 0,00 |
| TCR | Total de Créditos | R$ 0,00 |
| TDB | Total de Débitos | R$ 50,52 |
| TCH | Total de Encargos | R$ 50,52 |
| LAR | Saldo em Aberto | R$ 265,50 |
| PPR | Pagamentos Fatura Anterior | R$ 265,50 |
| PCB | Saldo Anterior | R$ 465,50 |
| TPU | Total de Compras | R$ 40,86 |
| INT | Juros | R$ 1,65 |
| FEE | Tarifas | R$ 0,00 |
| CUR | Saldo Atual | R$ 0,00 |

### 4.2 Taxas de Juros (por código de encargo)

| Código | Descrição | Taxa |
|---|---|---|
| 2000 | Rotativo / Financiamento | 15,39% |
| 2001 | Juros de Mora | 1,0% |
| 3000 | Taxa de Multa | 2,0% |
| 2002 | Saque Nacional | 0,0% |
| 2003 | Parcelamento (Emissor) | 0,0% |
| 2008 | Parcelamento c/ Seguro | 0,0% |
| 2007 | Parcelamento s/ Seguro | 0,0% |
| 2006 | **Parcelamento Automático** | 0,0% (exemplo sem uso; no painel 1 real = 8,95% a.m.) |
| 2004 | (nome cortado) | 0,0% |
| 4000 | IOF | 0,0% |
| 4001 | IOF Adicional | 0,0% |

### 4.3 Taxas efetivamente cobradas na fatura (valores, não %)

| Código | Descrição | Valor |
|---|---|---|
| 4000 | iof | R$ 0,65 |
| 2000 | juros de financiamento | R$ 40,86 |
| 4001 | iof adicional | R$ 1,00 |
| 2001 | juros de mora | R$ 2,70 |
| 3000 | multa de atraso | R$ 5,31 |

### 4.4 Limites do Cliente (por contrato)

```
Credit
  CRL  Limite de Crédito      R$ 600,00
  AVL  Saldo Disponível        R$ 33,92
  CUR  Saldo Atual            R$ 566,08
  OSB  Saldo em Aberto        R$ 450,58
  INS  Parcelas               R$ 400,00

Withdraw (saque)
  CRL  Limite de Crédito      R$ 120,00
  AVL  Saldo Disponível       R$ 120,00
  CUR  Saldo Atual              R$ 0,00
```

**Insight**: Credit e Withdraw são limites SEPARADOS, cada um com seu próprio CRL/AVL/CUR — o FintechBankApp hoje só tem 1 limite de crédito (sem separar saque). `INS` (Parcelas, R$400,00) é o quanto do limite está comprometido só com parcelamentos — equivalente direto ao nosso "Parcelas a Vencer".

### 4.5 Faturas (listagem por contrato)

```
Faturas — 00337097GR0000024820                              [3 faturas]

ID  Status    Vencimento   Fechamento   Pagto Anterior   Total         Pgto Mínimo
3   Aberta    28/08/2026   21/08/2026   R$ 0,00          R$ 10.307,75  R$ 0,00
2   Fechada   28/07/2026   21/07/2026   R$ 0,00          R$ 10.007,75  R$ 9.737,75
1   Fechada   28/06/2026   22/06/2026   R$ 0,00          R$ 9.300,00   R$ 930,00

Contrato: 00337097GR0000024820 | Criação: 20-05-2026 | Status: NORMAL
Produto: 66/1320 FREE VISA | Dia Vencimento: 28 | Qtd. Cartões: 2
```

**Nota**: fatura FECHADA já vem com "Pgto Mínimo" calculado por fatura individualmente (não só a mais recente) — cada uma das 3 tem seu próprio mínimo, diferente do que fazemos hoje (só a fatura fechada mais recente tem essa granularidade completa).

---

## 5. Fluxo de Renegociação — app cliente (Santander)

```
Fatura fechada R$ 1.299,03 → ação rápida "Renegociar"
  │
  ▼
Selecione o que for melhor pra você
  ┌────────────────────────────────────────────┐
  │ Renegociar saldo do cartão   [RECOMENDADO]  │  ← inclui TODAS as faturas
  │ "melhores taxas e você continua usando"     │
  ├────────────────────────────────────────────┤
  │ Parcelar Fatura                             │  ← só ESSA fatura, até 12x
  └────────────────────────────────────────────┘
  │
  ▼ (escolheu Renegociar)
Passo 1 de 2 — Informe como quer pagar
  Saldo total a pagar: R$ 1.299,03
  ( ) Sem entrada     ( ) Com entrada
  ┌────────────────────────────────────┐
  │  3x de R$ 473,67    │ 4,20% a.m    │
  │ 14x de R$ 127,84    │ 4,20% a.m    │
  │ 15x de R$ 121,69    │ 4,20% a.m    │
  │ 16x de R$ 116,32 (●)│ 4,20% a.m    │  ← taxa FIXA igual em toda opção
  │ 36x de R$  63,16    │ 3,15% a.m    │  ← só a 36x muda a taxa
  │ Outras opções...                   │
  └────────────────────────────────────┘
  │
  ▼
Passo 2 de 2 — Confirmação
  Detalhes: cartão, "16x de R$116,32", data 1ª parcela 28/08/2026
  Taxa de juros: 4,2% a.m | 63,84% a.a
  CET: 70,87% a.a
  Dados CET: Valor financiado R$1.299,03 (69,8%) | IOF R$29,36 (1,58%)
             Juros R$532,73 (28,62%) | Total a pagar R$1.861,12 (100%)
  ⚠ "O limite do cartão vai ser liberado de acordo com o pagamento das parcelas"
  ☑ Termos e condições  →  [Confirmar renegociação]
  │
  ▼
✓ Renegociação realizada  →  [Compartilhar comprovante]  [Ir para parcelamentos]
```

**Pós-contratação — "Meus Parcelamentos"**:
```
        ╭──────────────╮
       │   Renegociação │  ← anel de progresso (pago vs total)
       │ Valor restante │
       │  R$ 1.744,80   │
        ╰──────────────╯
  Total Contratado (Principal + Encargos): R$ 1.861,12

Produtos contratados → Renegociação →
  Data da Contratação      23/07/2026
  Valor Total              R$ 1.861,12 (16 parcelas de R$116,32)
  Valor Restante           R$ 1.744,80
  Parcelas Lançadas        1 de 16
  Próxima Parcela          28/08/2026
  Canal de Contratação     App Santander Brasil
  [Cancelar Parcelamento]   [Ver comprovante completo]
```
Regras extras achadas: **7 dias pra desistir** da renegociação sem custo; cancelar depois disso = pagar o valor total restante da proposta, com abatimento proporcional dos juros já embutidos.

---

## 6. Ferramenta interna de operação — elegibilidade + simulação (mesmo estilo da seção 4)

Tela "Parcelados", 3 abas independentes, cada uma com seu próprio veredito de elegibilidade:
```
[Parcelamento de Fatura] [Renegociação] [Parcelamento Automático]
✓ Cliente elegível para contratação!                    Contratar →
Parcelados Contratados: (vazio se nunca contratou)
```

Simulação de Parcelamento de Fatura:
```
Valor total da fatura: R$ 1.500,00       Pagamento Mínimo: R$ 0,00
Cliente Elegível ao sem entrada? Sim
Valor da Entrada: R$ 0,00    Valor a Parcelar: R$ 1.500,00
Quantidade de Parcelas: [ 10 ]
Parcelas Recomendadas: 10x R$225,04 · 9x R$241,33 · 8x R$261,90 · 7x R$288,66
                        6x R$324,61 · 5x R$375,43 · 4x R$451,63 · 3x R$579,32
                                                          [Simular]
```
Proposta gerada:
```
Quantidade de Parcelas   10x              Valor total da dívida   R$ 1.500,00
Valor da parcela         R$ 225,04        Valor da entrada        R$ 0,00
Tipo de parcelamento     Parc. Fatura S/Seg.Prestamista
Valor total a pagar      R$ 2.250,40      Valor total a parcelar  R$ 1.500,00
CET - Custo efetivo total 8,41% a.m | 163,49% a.a
                                          Taxa de Juros 7,95% a.m | 150,42% a.a

Composição CET (Custo Efetivo Total)          Valor         Percentual
  Valor Principal                          R$ 1.500,00        66,66%
  IOF                                      R$    22,52          1%
  IOF adicional                            R$     0,08          0%
  Juros                                    R$   727,80        32,34%
  Valor Total a pagar                      R$ 2.250,40        100%

"Ao clicar em Concluir, a Proposta de PARCELAMENTO DE FATURA será criada..."
                                          [Voltar]  [Concluir Proposta]
```
**Nota**: aqui a taxa do PF (7,95% a.m., CET 163,49% a.a.) é DIFERENTE da taxa do Reneg (4,20% a.m., CET 70,87% a.a.) — confirma 3 taxas distintas no mesmo banco: Reneg (mais barata, trava TODAS as faturas) < PA (~8,95%, só o saldo) < PF (~7,95%~8% mas às vezes mais caro que PA por ser só a fatura aberta, sem consolidar o resto).

---

## 7. Fatura detalhada — lançamentos técnicos e composição (mesma ferramenta interna)

Lançamentos brutos por tipo de operação:
```
Final Cartão  Data        Tipo de Lançamento              Estabelecimento   Valor
8286          04/09/2026  100 - SALDO INICIAL              -                R$ 1.500,00
5783          03/09/2026  3100 - PARCELADO LOJISTA         BRASILIA CC      R$ 1.500,00
8286          14/09/2026  3120 - PARCELADO EMISSOR         -                R$ 1.459,75
8286          12/09/2026  103 - SALDO EM ATRASO            -                R$ 1.500,00
8286          12/09/2026  101 - SALDO FINANCIADO           -                R$ 1.500,00
```

Aba "Composição saldo atualizado":
```
Valor Total da Fatura Atualizado   R$ 1.562,82      Valor Multa por Atraso   R$ 30,00
Valor Juros Remuneratórios         (dado por taxa)  Valor Juros de Mora      R$ 2,04
Percentual Multa Atraso            2%               Taxa de Juros de Mora    1%
Total de Dias em Atraso            4                Valor Total Última Fatura R$ 0,00
                                                     Valor Juros Financiamento R$ 30,78
                                                     Taxa Juros Remuneratórios 15,39%
```

Resumo Fatura ("Demonstrativo em Reais"):
```
Pagamento Mínimo         R$ 150,00      (+) Despesas/Débitos      R$ 1.500,00
Pagamento Parcial        R$ 0,00        (-) Pagamentos/Créditos   -
Saldo Anterior em Reais  R$ 0,00        Débito Automático         Não
(+) Encargos Financeiros R$ 69,01       Entrada Mín. Parc. Autom. R$ 0,00
```

Menu de ações sobre a Fatura (ferramenta interna): Consultar faturas · 2ª via · Saldo remanescente atualizado · Cotação do dólar · Alterar vencimento · Forma de envio · Pulo de fatura.

---

## 8. Tela consolidada do contrato (cliente completo)

```
Limite do Contrato        R$ 900.000,00     Aumento de Limite Automático: Desativado
Limite Disponível         R$ 874.062,29
Limite Utilizado          R$  25.937,71
Parcelas a Vencer         R$  21.408,96     ← mesmo nome exato do nosso campo!
Limite de Saque           R$ 180.000,00     ← separado do limite de compra

Faturas
  Aberta              venc. 12/10/2026    Valor Total  R$ 4.528,75
  Pagamento pendente  venc. 12/09/2026    Valor Total  R$ 1.500,00
```
Confirma achado da seção 4.4 (limite de saque separado) e valida a nomenclatura "Parcelas a Vencer" que já usamos no tile do WEB — é campo nativo de banco real, não invenção nossa.

---

## Pontos pra decidir quando for implementar PF/PA/Reneg de verdade

1. Taxa do PA é BEM menor que a do rotativo/mínimo (8,95% vs 15,39% a.m.) — confirma que `installmentCalcEngine.js` já modela isso certo (é a mesma taxa fixa 7,95%/8,95% que já vimos no código).
2. Cada fatura FECHADA individual tem seu próprio "Pgto Mínimo" — não só a mais recente.
3. Limite de saque separado do limite de compra (`CRL`/`AVL` duplicado) — o FintechBankApp não tem essa separação hoje.
4. Timeline de parcelas futuras mês a mês (Itaú) — visual mais rico que só o total agregado que temos no tile "Parcelas a Vencer".
5. Reneg tem prazo de desistência de 7 dias + regra de cancelamento com abatimento proporcional de juros — nosso backend não modela isso hoje (`renegociacao_elegiveis` só tem o flag, sem essas regras).
6. 3 taxas distintas coexistindo no mesmo banco: Reneg 4,20% a.m (mais barata, trava tudo) < PA ~8,95% (só saldo) < PF ~7,95-8,41% (só fatura aberta) — cada produto tem seu próprio motor de taxa, não dá pra reusar 1 só.
7. Reneg trava TODAS as faturas (fechadas + aberta) num parcelamento único; PF trava só a fatura selecionada; PA já existe no nosso código pro saldo — confirma que os 3 produtos são mutuamente exclusivos por fatura/saldo, não compõem.
