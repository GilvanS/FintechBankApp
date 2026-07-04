# Spec Web: Modais

Todos os modais ficam em `WEB/components/` e são espelhados 1:1 em
`MOBILE/src/components/`. Renderizam via `motion`/`AnimatePresence` sobre um
backdrop `bg-black/…` e são montados na raiz do `Dashboard.tsx` (estado por
`useState` no Dashboard).

## Modais implementados

| Modal | Arquivo | Props principais |
|-------|---------|------------------|
| DepositModal | `DepositModal.tsx` | `isOpen, onClose, onDepositComplete` |
| PixModal | `PixModal.tsx` | `isOpen, onClose, …` |
| BoletoModal | `BoletoModal.tsx` | `isOpen, onClose, accountBalance, onTransactionComplete` |
| BiometricModal | `BiometricModal.tsx` | `isOpen, onClose, …` |
| FinancialHealthModal | `FinancialHealthModal.tsx` | `isOpen, onClose, theme, …` |
| AiAssistantModal | `AiAssistantModal.tsx` | `isOpen, onClose, theme` |
| AiRecurringBillModal | `AiRecurringBillModal.tsx` | `isOpen, onClose, theme` |

## BoletoModal

Fluxo de pagamento de boleto em 4 passos (`scan_camera → input_barcode →
boleto_info → confirm_payment`) + tela de sucesso. Dados de homologação mockados
(código de barras exemplo, R$ 393,22). Chrome escuro fixo (`bg-[#0a0a0a]`),
usa tokens `volt-*`. Ao confirmar, emite `Transaction` (`type: 'PAYMENT'`,
`amount` negativo) via `onTransactionComplete`, que debita o saldo no Dashboard.

## Modais AI (mockados, sem Gemini)

Ambos recebem `theme: 'yellow' | 'midnight'` e são theme-aware (visual brutalista
no Yellow, dark neon no Midnight). Dados e respostas 100% locais (`useState`),
sem chamada de API externa.

### AiAssistantModal

**Props:** `{ isOpen: boolean, onClose: () => void, theme: 'yellow' | 'midnight' }`

- Chatbot com histórico de mensagens (`Message[]`, `sender: 'ai' | 'user'`)
- Delay simulado (~2s) + animação de "typing dots"
- Resposta mockada (modo simulação) — não chama Gemini
- Drag-to-dismiss (arrastar para baixo fecha) via `motion` drag

### AiRecurringBillModal

**Props:** `{ isOpen: boolean, onClose: () => void, theme: 'yellow' | 'midnight' }`

- Lista de contas recorrentes com itens default
- Total mensal calculado
- Ordenação por proximidade do vencimento (relativo ao dia de hoje)
- Cor de urgência: vermelho (≤2 dias), amarelo (≤5 dias), muted (resto)
- Formulário inline para adicionar/remover conta
- Sem chamada de API — 100% `useState` local

> Nota: a spec descreve a implementação atual. Um plano anterior propôs para os
> modais AI uma prop `user: User | null` com respostas por keyword; a versão
> adotada usa `theme` e resposta única simulada.
