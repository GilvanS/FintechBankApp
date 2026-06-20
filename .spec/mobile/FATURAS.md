# Spec Mobile: Tela de Faturas

**Issue:** #36
**Componentes alvo:** `MOBILE/src/components/ClosedInvoiceView.tsx`, `MOBILE/src/components/Cards.tsx`
**Status:** Pendente implementação
**Fonte original:** `docs/tasks/LAYOUT_FATURAS_SPEC.md`

---

## 1. Header e Navegação Temporal

- **Header:** `bg-primary`, título "Fatura" centralizado, branco semi-bold, seta voltar à esquerda
- **Carrossel de meses:**
  - Fundo: `bg-primary`
  - Meses exibidos: janela de 6 meses (ex: Fev Mar **Abr** Mai Jun Jul)
  - Inativo: branco 60% opacidade
  - Ativo: branco 100% + sublinhado espesso ponta a ponta
  - Scroll: horizontal com snap-to-item

## 2. Card de Resumo da Fatura

```
┌─────────────────────────────────────────┐
│ ✓ A fatura está fechada                  │  ← tag verde pastel
│                                          │
│  Valor total                             │
│  R$ 12.781,50                    👁      │  ← H1 + ícone olho
│                                          │
│  Vence em 04/05  │  Pagamento mínimo     │  ← grid 2 colunas
│                  │  R$ 1.916,04          │
│                                          │
│  [ Pagar fatura                        ] │  ← btn full-width, bg-primary
└─────────────────────────────────────────┘
```

**Estilo do card:**
- `bg-surface` (branco ou dark conforme tema)
- `border-radius: 16px`
- `padding: 20–24px`
- `box-shadow` sutil para elevação

## 3. Edge Cases

### Saldo credor (fatura negativa)
- Valor em `text-primary` (verde)
- Tag: "Não há fatura para pagar neste mês"
- Botão "Pagar fatura": oculto ou `disabled`

### Fatura em aberto (ciclo ativo)
- Tag: "Fatura em aberto" (azul/neutro)
- Valor: total acumulado até o momento
- Botão: mantido visível

## 4. Lista de Lançamentos

```
Confira aqui os detalhes da fatura e os lançamentos do mês.

── Total do Titular ──────────────────────   ← sticky header

┌──────────────────────────────────────────┐
│ [🛒]  Mercado Livre          15/04       │
│       E-commerce             (1/3)       │  ← tag parcela
│                          R$ 450,00  ──► │
└──────────────────────────────────────────┘
```

**Item de transação:**
- Layout: `flex-row`, `align-items: center`, `justify-content: space-between`
- Ícone: círculo `bg-primary/10` com ícone da categoria
- Bloco central: nome (bold) + data/hora (text-subtle)
- Tag parcela: `(1/2)` quando parcelado
- Valor: negrito (débito) ou `text-primary` (estorno/crédito)

## 5. Accordion de Detalhes (expansão por toque)

Toque no item expande:

```
  Valor de origem:    US$ 10,00
  Cotação PTAX:       R$ 4,90
  IOF:                R$ 0,49
```

- Fundo: `bg-surface-dark/50`
- Layout: flex-row space-between por linha
- Divisórias sutis entre linhas
- Animação: expand suave

## 6. Rodapé Totalizador

```
────────────────────────────────────────
Total do Titular                R$ 12.781,50
```

- Linha divisória acentuada no topo
- "Total do Titular" semi-bold à esquerda
- Valor com destaque à direita

## Dados necessários da API

```typescript
// De GET /users/me → creditCard
closedInvoice: number           // valor da fatura fechada
closedInvoiceDueDate: string    // data de vencimento
closedTransactions: CardTransaction[]

// De GET /billing/invoice-status
cycleStatus: 'aberta' | 'fechada' | 'vencida' | 'inadimplente'
pendingCharges: number
```

## Componentes a criar/modificar

| Componente | Ação |
|-----------|------|
| `ClosedInvoiceView.tsx` | Redesign completo conforme spec |
| `Cards.tsx` | Integrar carrossel de meses |
| Novo: `MonthCarousel.tsx` | Carrossel reutilizável |
| Novo: `TransactionAccordion.tsx` | Item com expansão |
| Novo: `InvoiceSummaryCard.tsx` | Card de resumo |
