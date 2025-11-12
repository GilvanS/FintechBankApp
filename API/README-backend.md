# FintechBankApp Backend (Node + Express + Databricks + Swagger)

## Como subir
- Instale dependencias:
```bash
npm ci
```
- Configure `.env` com `JWT_SECRET` e credenciais do Databricks.
- Suba a API:
```bash
node index.js
```

## Inicializacao do banco
- Estrutura e seeds sao aplicados automaticamente ao iniciar.
- Tabelas: `users`, `transactions`, `pix_contacts`, `notifications`, `limit_increase_requests`, `pix_keys`, `products`.

## Endpoints principais (links no swagger.yaml)
- Autenticacao:
  - `POST /auth/login`, `POST /auth/request-password-reset`
- Usuarios:
  - `GET /users/me`
  - `GET /users/{cpf}`, `GET /users/{cpf}/statement`
  - `GET /users/{cpf}/notifications`, `POST /users/{cpf}/notifications/{id}/read`
- PIX:
  - `POST /pix/recipient-info`
  - `POST /pix/transfer`, `POST /pix/transfer-credit`
  - `GET/POST/DELETE /pix/keys`
  - `GET/POST/DELETE /pix/contacts`
- Cartao:
  - `POST /cards/invoice/pay`, `POST /cards/invoice/parcel`, `POST /cards/invoice/anticipate`
- Shop:
  - `GET /shop/products`, `POST /shop/checkout`
- Admin:
  - `GET/POST /admin/users/*`
  - `GET/POST /admin/requests/*`
- Proxy:
  - `GET /proxy/news` (cache simples + bearer)

## Segurança e middlewares
- `bearerAuth`: 401 sem token; 403 token invalido.
- `requireScope`: 403 quando escopo inadequado (admin/customer).
- `pinGuard`: 400 em endpoints sensiveis sem `pin`.
- `withReqId`: correlacao minima de logs.

## Testes (Newman/Postman)
- Configure `API/newman.config.json`.
- Execute:
```bash
powershell -ExecutionPolicy Bypass -File .\API\run-newman-tests.ps1
```
- Objetivo: 95%+ dos cenarios passando; documentar falhas com bug IDs.

## Validacao do Swagger
```bash
node F:\GITHUB\FintechBankApp\API\validate-swagger.js
```

## Observabilidade
- Logs padronizados via `auditLog`; sem PII sensivel.
- Correlaçao via `x-request-id`.