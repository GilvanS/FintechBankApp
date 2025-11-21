MOBILE/src/types.t# FintechBankApp

FintechBankApp é um projeto didático desenvolvido para treinamento de desenvolvimento Web e APIs com foco em boas práticas aplicáveis ao ecossistema Java + frameworks (conceitos, padrões e arquitetura). A implementação de referência desta branch usa Node.js (Express) no backend e Vite + React + TypeScript no frontend para acelerar a prática e a validação dos fluxos.

O objetivo é proporcionar um ambiente completo para:
- Exercitar princípios SOLID, Clean Code e testes automatizados.
- Simular rotinas bancárias (faturas, cartão de crédito, PIX, extrato).
- Praticar integrações com diferentes bancos de dados e ambientes.

## Principais Módulos
- `API/`: backend Express, documentação Swagger e scripts de migração/seed.
- `WEB/`: frontend React + Vite com páginas e componentes de fluxo bancário.
- `docker-compose.yml`: infraestrutura de Postgres via Docker (quando aplicável).

## Branches de Banco de Dados
Este projeto possui três tipos de branches para treinar com diferentes bancos de dados:
- Databricks: integração via SQL Warehouse/HTTP Path (produção/labs).
- SQLite: armazenamento local simples para desenvolvimento rápido.
- Postgres (Docker): banco relacional rodando em container para ambiente local.

Cada branch ajusta a configuração de conexão e os scripts conforme o destino (consulte o README/arquivos de cada branch para detalhes específicos).

## Pré-requisitos
- Node.js (>= 18)
- Docker Desktop (para a opção Postgres)
- Opcional (Databricks): credenciais e acesso a um SQL Warehouse

## Variáveis de Ambiente (API)
Copie `API/.env.example` para `.env` e ajuste conforme o ambiente. Exemplos suportados:
- Servidor: `PORT`, `JWT_SECRET`
- Databricks: `DATABRICKS_SERVER_HOSTNAME`, `DATABRICKS_HTTP_PATH`, `DATABRICKS_TOKEN`, `DATABRICKS_CATALOG`, `DATABRICKS_SCHEMA`
- Postgres: `DB_*` ou `PG_*` (host, porta, usuário, senha, database, schema)

Por padrão, `PORT=3001`. A API ficará disponível em `http://localhost:3001`.

## Como Executar (Desenvolvimento)

1) Backend (API)
```bash
cd API
```

```bash
npm install
```

```bash
npm run dev:api
```

2) Frontend (WEB)
```bash
cd WEB
```

```bash
npm install
```

```bash
npm run dev
```

- A interface web abrirá em `http://localhost:5173` (padrão do Vite).
- O frontend consome a API em `http://localhost:3001` (ajustável via `.env`/config).

## Expondo API para Mobile (ngrok)
Para permitir que o aplicativo mobile acesse a API localmente:

1. Certifique-se de que a API está rodando (`npm run dev:api`).
2. Em um novo terminal, execute:
```bash
ngrok http 3001
```
3. Copie a URL HTTPS gerada (ex: `https://xxxx.ngrok-free.app`).
4. Atualize a URL da API no projeto Mobile (em `MOBILE/src/services/api.ts` ou `.env`).

## Postgres via Docker (opção de branch Postgres)
Suba o container antes de executar migração/seed:
```bash
docker-compose up -d
```

Execute migração e seed (no diretório `API/`):
```bash
npm run db:migrate
```

```bash
npm run db:seed
```

## Build e Preview (Frontend)
Para gerar build de produção do frontend:
```bash
cd WEB
```

```bash
npm run build
```

```bash
npm run preview
```

## Testes
- Frontend: `WEB/package.json` (Vitest). Execute:
```bash
cd WEB
```

```bash
npm run test
```

- Backend: coleções Postman/Newman disponíveis em `API/` (veja `NEWMAN-TESTS.md` e `postman-collection*.json`).

## Endpoints de Referência (exemplos)
- Fatura e cartão de crédito:
  - `POST /cards/invoice/pay` — pagamento da fatura
  - `POST /cards/invoice/parcel` — parcelamento da fatura
  - `POST /cards/installments/anticipate` — antecipação de parcelas
- PIX:
  - `POST /pix/transfer` — transferência PIX
  - `POST /pix/transfer-credit` — PIX no crédito (com parcelamento)

Consulte o Swagger (`API/swagger.yaml`) ou a versão limpa (`API/swagger-clean.yaml`) para a lista completa.

## Observações
- Este repositório é usado como base prática para treinar conceitos de **Web e API com Java + frameworks**. A escolha por Node.js/React aqui facilita a rápida prototipação dos fluxos e testes automatizados; os mesmos princípios se aplicam ao ecossistema Java (ex.: Spring, JPA, etc.) em branches dedicadas.
- Ajuste as variáveis de ambiente conforme o banco alvo (Databricks/SQLite/Postgres).
- Para dúvidas sobre scripts e integrações, verifique os arquivos `API/package.json`, `WEB/package.json` e documentação em `API/README-backend.md` e `WEB/README.md`.
