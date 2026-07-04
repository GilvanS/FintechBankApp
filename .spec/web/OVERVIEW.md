# Spec Web: Visão Geral

**Pasta:** `WEB/`
**Stack:** React 19.2 + Vite 6 + Tailwind 4 + Motion 12 + Recharts 3 + Lucide React
**Porta:** 3000
**Testes:** Vitest + Testing Library (`WEB/tests/`)

## Funcionalidades

- Login/Signup
- Dashboard com saldo e extrato
- PIX (transferência, chaves, contatos)
- Cartão de crédito (faturas, parcelamento)
- Pagamento de Boleto (fluxo de leitura/digitação, mockado)
- Shop, Investments, Wallet, Loans
- Admin panel (role=admin)
- AI Assistant (mockado, sem Gemini)
- AI Recurring Bills (mockado)

## Conexão com API

- Base URL: `http://localhost:3001/api`
- Auth: `Authorization: Bearer <token>` via localStorage
- Demo mode: `VITE_USE_MOCK_API=true` → alias Vite troca `services/api` por `services/mockApi.ts`

## Referências de spec

- Auth: `.spec/api/AUTH.md`
- PIX: `.spec/api/PIX.md`
- Billing: `.spec/api/BILLING.md`
- Cards/Faturas: `.spec/api/CARDS.md`
- Design System: `.spec/web/DESIGN_SYSTEM.md`
- Modais: `.spec/web/MODAIS.md`
