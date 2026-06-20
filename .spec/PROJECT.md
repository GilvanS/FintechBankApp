# FintechBankApp — Project Spec

## Visão Geral

Aplicação bancária digital completa com backend REST, frontend web e app mobile Android.
Projeto didático para praticar SOLID, Clean Code, testes automatizados e rotinas bancárias reais.

## Módulos

| Módulo | Stack | Porta |
|--------|-------|-------|
| `API/` | Node.js 18 + Express 4 + JWT + PostgreSQL | 3001 |
| `MOBILE/` | Capacitor 7 + React 18 + Ionic + Tailwind | APK Android |
| `WEB/` | React 18 + Vite + Tailwind | 5173 |
| DB | PostgreSQL 15 via Docker (`fintech` schema) | 5432 |

## Funcionalidades principais

- **Auth** — signup, login JWT, reset de senha
- **PIX** — transferência, chaves, contatos, limite diário
- **Cartão de Crédito** — fatura atual, fatura fechada, parcelamento, antecipação
- **Billing** — ciclo fatura (aberta→fechada→vencida→inadimplente), encargos, grace period
- **Shop** — produtos, checkout, carrinho, cashback
- **Notificações** — push notifications, leitura
- **Admin** — gerenciamento de usuários, billing config, stats

## Decisões arquiteturais (locked)

- API single-file (`API/index.cjs`) — todas as rotas em um arquivo, repositórios separados
- Routes duplicadas em `/api` e `/api/v1` para retrocompatibilidade
- `DatabaseFactory` seleciona SQLite (dev) ou PostgreSQL (prod) via `DB_PROVIDER`
- Schema canônico: `API/schema_pg.sql` — tabelas prefixadas `"fintech"."table"`
- Mobile usa state machine (`view` string) sem router — `AuthContext` global
- JWT secret obrigatoriamente via env — sem fallback hardcoded
- Testes API: Jest + Supertest com Express isolado (sem DB real)
- Testes MOBILE/WEB: Vitest + Testing Library

## Convenções de código

- Commits: `type(scope): resolver issue #N — descrição`
- Sem `Co-Authored-By` nos commits
- Arquivos ≤ 500 linhas
- Validação apenas em system boundaries (input do usuário, APIs externas)
- Sem tratamento de erros para cenários impossíveis

## Especificações por módulo

- API: `.spec/api/`
- Mobile: `.spec/mobile/`
- Web: `.spec/web/`
