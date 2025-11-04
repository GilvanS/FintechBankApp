# FintechBankApp Backend (Node + Express + Databricks + Swagger)

API backend da FintechBankApp integrada com Databricks. Este README explica setup, execução, variáveis de ambiente, testes e como replicar o backend em outro projeto.

## Visão Geral
- Stack: Node.js, Express, JWT, bcrypt, Databricks SQL SDK
- Documentação: Swagger UI (`swagger.yaml`)
- Inicialização de schema/tabelas realizada automaticamente na subida do servidor

## Pré-requisitos
- Node.js 18+ (recomendado 18 LTS ou 20 LTS)
- Acesso ao workspace Databricks (host, httpPath e token válidos)
- Windows PowerShell (para scripts `.ps1`, se necessário)

## Configuração de Ambiente
Use o arquivo de exemplo `.env.example` como base e crie `.env` no diretório `server/`.

Variáveis suportadas:
- `PORT` — porta da API (padrão `3001`)
- `JWT_SECRET` — segredo JWT (defina um valor forte)
- `DATABRICKS_SERVER_HOSTNAME` — hostname do seu workspace Databricks
- `DATABRICKS_HTTP_PATH` — httpPath do cluster/endpoint
- `DATABRICKS_TOKEN` — token de acesso
- `DATABRICKS_CATALOG` — catálogo (padrão `workspace`)
- `DATABRICKS_SCHEMA` — schema (padrão `fintechbank`)

Exemplo (ajuste para seu ambiente):

```bash
copy .env.example .env
```

Edite o `.env` com seus valores.

## Instalação
Instale as dependências no diretório `server/`.

```bash
npm install
```

Ou, para ambientes limpos:

```bash
npm ci
```

## Executar em desenvolvimento
Inicie com `nodemon`:

```bash
npm run dev
```

- Health: `http://localhost:3001/api/v1/health`
- Swagger UI: `http://localhost:3001/api-docs`
- Base URL da API: `http://localhost:3001`

Na inicialização:
- Conecta ao Databricks.
- Verifica/cria `catalog` e `schema`.
- Cria/valida tabelas `users`, `transactions`, `pix_contacts`.
- Recria o usuário admin padrão:
  - CPF: `00000000000`
  - Senha: `admin123`
  - Email: `admin@fintechbank.com`
  - Role: `admin`

## Endpoints Principais
- Autenticação:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/request-password-reset`
- Usuário:
  - `GET /api/v1/user/me/:cpf`
  - `PUT /api/v1/user/limits/pix-daily/:cpf`
- Contatos PIX:
  - `GET /api/v1/pix/contacts/:cpf`
  - `POST /api/v1/pix/contacts/:cpf`
  - `DELETE /api/v1/pix/contacts/:cpf/:contactKey`
- Admin:
  - `GET /api/v1/admin/users`
  - `POST /api/v1/admin/users/:cpf/block`
  - `POST /api/v1/admin/users/:cpf/unblock`
  - `PUT /api/v1/admin/users/:cpf/pix-limit`
  - `POST /api/v1/admin/users/:cpf/reset-password`

Swagger disponível em `http://localhost:3001/api-docs`.

## Testes de API (Newman/Postman)
Coleção Postman: `../postman-collection.json`  
Config Newman: `./newman.config.json`  
Scripts auxiliares: `run-newman-tests.ps1`, `run-newman-tests.js`, `run-tests.bat`

Executar os testes via Node:

```bash
node run-newman-tests.js
```

Executar via PowerShell:

```bash
./run-newman-tests.ps1
```

Executar via `.bat`:

```bash
./run-tests.bat
```

## Replicação do Backend em Outro Projeto
1. Copie o diretório `server/` completo para o novo projeto.
2. Garanta que os arquivos essenciais estejam presentes:
   - `index.js` (servidor + rotas + inicialização Databricks)
   - `swagger.yaml` (ou use `swagger-clean.yaml` como base)
   - `package.json`, `package-lock.json` (opcional), scripts `.ps1` e `.js` auxiliares
   - `.env.example` (crie `.env` no projeto novo)
3. Atualize `package.json` (nome, scripts, versão) conforme seu projeto.
4. Ajuste `.env` com seus dados Databricks.
5. Instale dependências:
   ```bash
   npm install
   ```
6. Suba o servidor:
   ```bash
   npm run dev
   ```
7. Valide:
   - `GET /api/v1/health` retorna `success: true`.
   - `Swagger` abre sem erros.
   - Admin é criado e login funciona.

### Observações importantes ao replicar
- Se alterar o schema/catalog, o servidor cria automaticamente estruturas conforme definidos em `index.js`.
- Consistência de colunas:
  - `pix_contacts` usa `contact_cpf` (não `contact_key`). As queries devem selecionar `contact_cpf as key`.
- Se ocorrer erro de YAML no Swagger, substitua por `swagger-clean.yaml` e garanta o regex correto: `pattern: '^[0-9]{11}$'`.

## Problemas Comuns e Soluções
- Falha ao conectar no Databricks:
  - Verifique `DATABRICKS_*` no `.env`.
  - Confirme catálogo `workspace` e schema `fintechbank` existem ou deixe o servidor criar.
- Erro 500 em `/user/me/:cpf`:
  - Confirme que a query de contatos usa `contact_cpf as key`.
- CORS/Autorização:
  - Token JWT é obrigatório; obtenha via `POST /auth/login`.

## Scripts Úteis
- Validação de Swagger:
  ```bash
  node validate-swagger.js
  ```
- Testar start do servidor:
  ```bash
  ./test-server-start.ps1
  ```