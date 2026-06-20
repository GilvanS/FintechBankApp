# Spec Web: Visão Geral

**Pasta:** `WEB/`
**Stack:** React 18 + Vite + Tailwind CSS
**Porta:** 5173
**Testes:** Vitest + Testing Library (`WEB/src/**/__tests__/`)

## Funcionalidades

Mesmo escopo funcional do MOBILE mas em SPA desktop/browser:
- Login/Signup
- Dashboard com saldo e extrato
- PIX (transferência, chaves, contatos)
- Cartão de crédito (faturas, parcelamento)
- Shop
- Admin panel (role=admin)

## Conexão com API

- Base URL: `http://localhost:3001/api`
- Auth: `Authorization: Bearer <token>` via localStorage
- CORS: aceita `Origin: http://localhost:5173`

## Referências de spec

- Auth: `.spec/api/AUTH.md`
- PIX: `.spec/api/PIX.md`
- Billing: `.spec/api/BILLING.md`
- Cards/Faturas: `.spec/api/CARDS.md`
