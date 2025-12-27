# 🗄️ Criar Banco de Dados PostgreSQL - FintechBankApp (Primeira Vez)

Este guia fornece os comandos para criar o banco de dados PostgreSQL do FintechBankApp como se fosse a primeira vez.

## 📋 Pré-requisitos

- PostgreSQL instalado e rodando
- Acesso ao PostgreSQL (usuário com privilégios para criar banco de dados e schemas)
- `psql` instalado (CLI do PostgreSQL)

## 🚀 Opção 1: Usando Docker (Recomendado)

Se você está usando o `docker-compose.yml` fornecido:

### 1. Iniciar o PostgreSQL via Docker

```powershell
cd API
docker-compose up -d database
```

Isso criará um container PostgreSQL com:
- **Host**: `localhost`
- **Porta**: `5432`
- **Usuário**: `postgres` (padrão)
- **Senha**: `pwd123`
- **Banco**: Será criado pelo usuário

### 2. Criar o Banco de Dados

```powershell
# Conectar ao PostgreSQL
psql -h localhost -p 5432 -U postgres -d postgres

# No prompt do psql, execute:
CREATE DATABASE fintechbank;
\c fintechbank
```

Ou via linha de comando direta:

```powershell
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE fintechbank;"
```

### 3. Criar o Schema 'fintech'

```powershell
psql -h localhost -p 5432 -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"
```

### 4. Executar o Script de Criação das Tabelas

```powershell
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_pg.sql
```

**Nota**: O arquivo `schema_pg.sql` cria as tabelas no schema `public` por padrão. Você tem duas opções:

#### Opção A: Usar schema 'fintech' (Recomendado - padrão da aplicação)

Execute com `SET search_path`:

```powershell
psql -h localhost -p 5432 -U postgres -d fintechbank << EOF
SET search_path TO fintech, public;
\i schema_pg.sql
EOF
```

Ou execute manualmente no psql:
```sql
SET search_path TO fintech, public;
\i schema_pg.sql
```

#### Opção B: Usar schema 'public' (Mais simples)

Execute diretamente:
```powershell
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_pg.sql
```

E configure no `.env`: `DB_SCHEMA=public`

### 5. (Opcional) Executar Migrações Adicionais

```powershell
# Migração para ciclo de vida de faturas
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_invoice_lifecycle.sql

# Migração para valores padrão de signup
psql -h localhost -p 5432 -U postgres -d fintechbank -f migration_update_signup_defaults.sql
```

---

## 🚀 Opção 2: PostgreSQL Local (Sem Docker)

### 1. Criar o Banco de Dados

```powershell
# Conectar ao PostgreSQL como superusuário
psql -U postgres

# No prompt do psql, execute:
CREATE DATABASE fintechbank;
\c fintechbank
```

Ou via linha de comando:

```powershell
psql -U postgres -c "CREATE DATABASE fintechbank;"
```

### 2. Criar o Schema

```powershell
psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"
```

### 3. Executar Scripts SQL

```powershell
cd API

# Script principal de criação das tabelas
psql -U postgres -d fintechbank -f schema_pg.sql

# (Opcional) Scripts adicionais
psql -U postgres -d fintechbank -f schema_invoice_lifecycle.sql
psql -U postgres -d fintechbank -f migration_update_signup_defaults.sql
```

---

## ⚙️ Configurar Variáveis de Ambiente

Após criar o banco, configure as variáveis de ambiente no arquivo `.env` da API:

```env
# Provider do banco
DB_PROVIDER=postgres
# ou
DB_DIALECT=postgres

# Configurações de conexão (usando Docker)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=pwd123
DB_NAME=fintechbank
DB_SCHEMA=fintech
# ou use 'public' se não criou o schema fintech
# DB_SCHEMA=public

# SSL (geralmente false para desenvolvimento local)
DB_SSL=false

# Alternativamente, você pode usar connection string:
# POSTGRES_CONNECTION_STRING=postgresql://postgres:pwd123@localhost:5432/fintechbank
```

---

## 📝 Comandos Completos em Sequência (Docker - Schema 'fintech')

```powershell
# 1. Iniciar PostgreSQL
cd API
docker-compose up -d database

# 2. Aguardar alguns segundos para o banco inicializar (10-15 segundos)

# 3. Criar banco de dados
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE fintechbank;"

# 4. Criar schema 'fintech'
psql -h localhost -p 5432 -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# 5. Executar script principal com schema 'fintech'
# Método 1: Criar arquivo SQL temporário (funciona em PowerShell e Bash)
@"
SET search_path TO fintech, public;
"@ | Out-File -Encoding utf8 temp_set_schema.sql
Get-Content schema_pg.sql | Add-Content temp_set_schema.sql
psql -h localhost -p 5432 -U postgres -d fintechbank -f temp_set_schema.sql
Remove-Item temp_set_schema.sql

# Método 2: Executar manualmente no psql (recomendado)
# psql -h localhost -p 5432 -U postgres -d fintechbank
# No prompt do psql, execute:
# SET search_path TO fintech, public;
# \i schema_pg.sql

# 6. (Opcional) Migrações adicionais (já usam schema 'fintech')
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_invoice_lifecycle.sql
psql -h localhost -p 5432 -U postgres -d fintechbank -f migration_update_signup_defaults.sql

# 7. Verificar se as tabelas foram criadas
psql -h localhost -p 5432 -U postgres -d fintechbank -c "\dt fintech.*"
```

## 📝 Comandos Completos em Sequência (Docker - Schema 'public' - Mais Simples)

```powershell
# 1. Iniciar PostgreSQL
cd API
docker-compose up -d database

# 2. Aguardar alguns segundos para o banco inicializar (10-15 segundos)

# 3. Criar banco de dados
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE fintechbank;"

# 4. Executar script principal (cria no schema 'public' por padrão)
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_pg.sql

# 5. (Opcional) Migrações adicionais - PRECISAM SER AJUSTADAS para usar 'public' ao invés de 'fintech'
# Se quiser usar schema 'public', edite os arquivos de migração primeiro ou pule esta etapa

# 6. Verificar se as tabelas foram criadas
psql -h localhost -p 5432 -U postgres -d fintechbank -c "\dt"

# 7. Configure no .env: DB_SCHEMA=public
```

---

## ✅ Verificação

Verifique se as tabelas foram criadas corretamente:

```powershell
psql -h localhost -p 5432 -U postgres -d fintechbank
```

No prompt do psql:

```sql
-- Listar tabelas no schema fintech
\dt fintech.*

-- Ou se usou schema public:
\dt

-- Verificar estrutura da tabela users
\d fintech.users
-- ou
\d users

-- Verificar usuário admin foi criado
SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';
-- ou
SELECT cpf, full_name, email, role FROM users WHERE role = 'admin';
```

---

## 🔄 Recriar do Zero (Drop e Recriar)

**⚠️ CUIDADO: Isso apagará todos os dados!**

```powershell
# Conectar ao PostgreSQL
psql -h localhost -p 5432 -U postgres

# No prompt do psql:
DROP DATABASE IF EXISTS fintechbank;
CREATE DATABASE fintechbank;
\c fintechbank
CREATE SCHEMA IF NOT EXISTS fintech;
\q

# Executar scripts
cd API
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_pg.sql
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_invoice_lifecycle.sql
psql -h localhost -p 5432 -U postgres -d fintechbank -f migration_update_signup_defaults.sql
```

---

## 📚 Estrutura de Arquivos SQL

- **`schema_pg.sql`** - Script principal com todas as tabelas base
- **`schema_invoice_lifecycle.sql`** - Extensões para ciclo de vida de faturas
- **`migration_update_signup_defaults.sql`** - Atualiza valores padrão para novos usuários
- **`schema_pix_fix.sql`** - Correções para tabela PIX (se necessário)

---

## 🐛 Troubleshooting

### Erro: "database does not exist"
- Certifique-se de que o banco foi criado: `CREATE DATABASE fintechbank;`

### Erro: "schema does not exist"
- Crie o schema: `CREATE SCHEMA IF NOT EXISTS fintech;`
- Ou use o schema `public` e configure `DB_SCHEMA=public` no `.env`

### Erro: "permission denied"
- Certifique-se de que está usando um usuário com privilégios adequados
- Para Docker, use `postgres` como usuário

### Erro: "relation already exists"
- As tabelas já existem. Se quiser recriar, faça DROP primeiro (cuidado!)

### Erro: "password authentication failed"
- Verifique a senha no `.env` ou docker-compose.yml
- Para Docker: senha padrão é `pwd123`

---

## 🎯 Próximos Passos

Após criar o banco:

1. Configure o arquivo `.env` com as credenciais do banco
2. Inicie a API: `npm start` ou `npm run dev`
3. A API verificará e aplicará migrações automaticamente na inicialização
4. O usuário administrador padrão será criado:
   - CPF: `99999999999`
   - Email: `admin@fintechbank.com`
   - Senha: `admin999` (verificar no código da API)

