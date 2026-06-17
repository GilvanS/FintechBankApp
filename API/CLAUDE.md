# API — FintechBankApp Backend

Node.js + Express 4 + JWT + bcryptjs. 62 endpoints REST para o banco digital.

## Como rodar

```bash
npm install
cp .env.example .env   # configurar variáveis
npm run dev            # node --watch index.cjs (porta 3001)
npm test               # Jest
```

## Variáveis de ambiente (.env)

```env
JWT_SECRET=<string-longa-aleatoria>   # NUNCA usar o default hardcoded
DB_TYPE=sqlite                        # sqlite | postgres
DATABASE_URL=./fintech.db             # caminho SQLite ou URL postgres
PORT=3001
```

## Grupos de endpoints

| Grupo | Prefixo | Endpoints |
|-------|---------|-----------|
| Auth | `/auth` | login, signup, request-password-reset, reset-password |
| Users | `/users` | me, /:cpf, /:cpf/statement, /:cpf/pix-limit |
| PIX | `/pix` | transfer, keys, contacts, recipient-info |
| Cards | `/cards` | invoice/pay, invoice/parcel, invoice/anticipate |
| Shop | `/shop` | products, checkout |
| Admin | `/admin` | users/*, requests/*, stats |
| Debug | `/debug` | tables, user/:cpf — **requer scope admin** |

## Estrutura de arquivos

```
API/
├── index.cjs            # Entry point, rotas montadas aqui
├── middlewares/         # bearerAuth, requireScope, pinGuard
├── repositories/        # Acesso ao banco (queries SQL)
├── services/            # Lógica de negócio
├── utils/               # Helpers (formatters, validators)
├── tests/               # Jest + Supertest
│   └── signup.test.js   # Único teste existente (Fase 4 vai expandir)
├── schema.sql           # Schema Databricks
├── schema_pg.sql        # Schema PostgreSQL (canônico)
├── schema_pg_fintech.sql # Schema PostgreSQL alternativo
└── swagger.yaml         # Documentação OpenAPI (27% de cobertura atual)
```

## Schemas de banco (Issue #18)

Existem 3 schemas desincronizados. O `schema_pg.sql` é o mais completo.
Migração para Knex planejada na Fase 3.

## Segurança

- JWT secret deve vir de `process.env.JWT_SECRET` — sem fallback hardcoded
- `/debug/*` requer `requireScope('admin')`
- Rate limiting planejado para Fase 5
