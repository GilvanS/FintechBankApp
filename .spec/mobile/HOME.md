# Spec Mobile: Tela Home

**Arquivo:** `MOBILE/src/components/HomeView.tsx`
**Status:** Implementado (billing banner adicionado na issue #35)

## Seções (ordem top → bottom)

1. **Header** — saudação + notificações
2. **AccountStatus Banner** — visível apenas quando relevante
3. **Balance** — saldo com toggle ocultar
4. **Limits** — limite disponível do cartão
5. **Quick Actions** — PIX, Pagar, Extrato, Cartão
6. **News/Banners** — banners promocionais
7. **BottomNavBar**

## Billing Status Banner (issue #35)

| accountStatus | cycleStatus | Banner |
|---------------|-------------|--------|
| `inadimplente` | qualquer | 🔴 Vermelho — dias em atraso + encargos + "Acesse Cartões" |
| `suspenso` | qualquer | 🟡 Amarelo — conta suspensa |
| `adimplente` | `fechada` | 🟢 Verde sutil — fatura fecha em DD/MM |
| `adimplente` | `vencida` | 🟡 Amarelo — urgência pagamento |
| `adimplente` | `aberta` | nenhum banner |

## Dados de `/users/me` usados

```typescript
user.accountStatus      // 'adimplente' | 'inadimplente' | 'suspenso'
user.daysOverdue        // número de dias em atraso
user.pendingCharges     // encargos pendentes (R$)
user.billingCycle.status // 'aberta' | 'fechada' | 'vencida' | 'inadimplente'
user.billingCycle.dueDate // data de vencimento
user.balance
user.creditCard.availableLimit
```
