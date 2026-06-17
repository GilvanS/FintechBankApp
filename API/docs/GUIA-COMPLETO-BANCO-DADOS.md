# 🗄️ Guia Completo - Banco de Dados PostgreSQL FintechBankApp

Este guia consolidado contém **TODAS** as informações necessárias para gerenciar o banco de dados PostgreSQL do FintechBankApp.

---

## 📋 Índice

1. [Configuração Inicial](#configuração-inicial)
2. [Recriar Banco do Zero](#recriar-banco-do-zero)
3. [Conectar ao PostgreSQL](#conectar-ao-postgresql)
4. [Verificar Status](#verificar-status)
5. [Troubleshooting](#troubleshooting)
6. [Configuração do .env](#configuração-do-env)
7. [Acessar via pgAdmin](#acessar-via-pgadmin)

---

## 🚀 Configuração Inicial

### Pré-requisitos

- Docker instalado e rodando
- PowerShell ou Git Bash
- Arquivos SQL na pasta `API/`

### Informações do Banco

- **Container**: `pgdb`
- **Imagem**: `postgres:trixie`
- **Porta**: `5432`
- **Usuário**: `postgres`
- **Senha**: `pwd123`
- **Banco de Dados**: `fintech` (ou `fintechbank` - verificar `.env`)
- **Schema**: `fintech`

---

## 🔄 Recriar Banco do Zero

### ⚠️ ATENÇÃO: Isso apagará TODOS os dados!

### Opção 1: Script PowerShell Automatizado (Recomendado)

Execute o script `RECRIAR-BANCO.ps1`:

```powershell
cd API
.\RECRIAR-BANCO.ps1
```

### Opção 2: Comandos Manuais

```powershell
# 1. Ir para pasta API
cd API

# 2. Parar e remover containers e volumes
docker-compose down -v

# 3. Aguardar um momento
Start-Sleep -Seconds 5

# 4. Iniciar PostgreSQL
docker-compose up -d database

# 5. Aguardar banco inicializar (IMPORTANTE: aguarde 15-20 segundos)
Start-Sleep -Seconds 20

# 6. Criar banco de dados
docker exec pgdb psql -U postgres -c "CREATE DATABASE fintech;"

# 7. Criar schema 'fintech'
docker exec pgdb psql -U postgres -d fintech -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# 8. Executar script principal (cria todas as tabelas)
docker exec -i pgdb psql -U postgres -d fintech < schema_pg_fintech.sql

# 9. Executar migrações adicionais
docker exec -i pgdb psql -U postgres -d fintech < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintech < migration_update_signup_defaults.sql

# 10. Criar tabela products (se não existir)
docker exec pgdb psql -U postgres -d fintech -c "CREATE TABLE IF NOT EXISTS fintech.products (id VARCHAR(255) NOT NULL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(15,2) NOT NULL, image_url TEXT);"

# 11. Verificar se foi criado corretamente
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"
```

### Opção 3: Git Bash

```bash
# 1. Ir para pasta API
cd API

# 2. Parar e remover tudo
docker-compose down -v 2>/dev/null || true

# 3. Iniciar PostgreSQL
docker-compose up -d database

# 4. Aguardar inicialização
sleep 20

# 5. Criar banco e schema
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintech;"
docker exec -i pgdb psql -U postgres -d fintech -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# 6. Executar scripts SQL
docker exec -i pgdb psql -U postgres -d fintech < schema_pg_fintech.sql
docker exec -i pgdb psql -U postgres -d fintech < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintech < migration_update_signup_defaults.sql

# 7. Criar tabela products
docker exec pgdb psql -U postgres -d fintech -c "CREATE TABLE IF NOT EXISTS fintech.products (id VARCHAR(255) NOT NULL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(15,2) NOT NULL, image_url TEXT);"

# 8. Verificar
docker exec -i pgdb psql -U postgres -d fintech -c "\dt fintech.*"
```

---

## 🔗 Conectar ao PostgreSQL

### Opção 1: Conectar Diretamente (Recomendado)

```powershell
docker exec -it pgdb psql -U postgres -d fintech
```

**Se der erro de TTY**, use:

```powershell
docker exec pgdb psql -U postgres -d fintech
```

### Opção 2: Entrar no Container e Depois no psql

```powershell
# 1. Entrar no container
docker exec -it pgdb bash

# 2. Dentro do container, conectar ao PostgreSQL
psql -U postgres -d fintech

# 3. Para sair do psql: \q
# 4. Para sair do container: exit
```

### Opção 3: Executar Comandos SQL Diretos

```powershell
# Ver versão do PostgreSQL
docker exec pgdb psql -U postgres -c "SELECT version();"

# Listar bancos
docker exec pgdb psql -U postgres -c "\l"

# Listar tabelas
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"

# Ver usuários
docker exec pgdb psql -U postgres -d fintech -c "SELECT cpf, full_name, email FROM fintech.users LIMIT 5;"

# Ver usuário admin
docker exec pgdb psql -U postgres -d fintech -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"
```

---

## 📋 Comandos Úteis no psql

Depois de conectar, você pode usar:

```sql
-- Listar bancos
\l

-- Conectar a um banco específico
\c fintech

-- Listar schemas
\dn

-- Listar tabelas do schema fintech
\dt fintech.*

-- Descrever uma tabela
\d fintech.users

-- Executar query
SELECT * FROM fintech.users LIMIT 10;

-- Sair do psql
\q
```

---

## ✅ Verificar Status

### Verificar Containers

```powershell
# Ver containers rodando
docker ps | findstr postgres

# Ver logs do container
docker-compose logs database

# Ver logs em tempo real
docker-compose logs -f database
```

### Verificar Banco de Dados

```powershell
# Verificar se o banco existe
docker exec pgdb psql -U postgres -c "\l" | findstr fintech

# Verificar se o schema existe
docker exec pgdb psql -U postgres -d fintech -c "\dn"

# Verificar tabelas criadas
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"

# Verificar estrutura de uma tabela
docker exec pgdb psql -U postgres -d fintech -c "\d fintech.users"

# Contar registros
docker exec pgdb psql -U postgres -d fintech -c "SELECT COUNT(*) FROM fintech.users;"
```

### Verificar Conexão da API

```powershell
# Testar conexão direta
cd API
node -e "const { Pool } = require('pg'); const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: 'pwd123', database: 'fintech' }); pool.query('SELECT current_database()').then(r => { console.log('✅ Conectado! Database:', r.rows[0].current_database); pool.end(); }).catch(e => { console.error('❌ Erro:', e.message); process.exit(1); });"
```

---

## 🐛 Troubleshooting

### Erro: "database does not exist"

**Sintoma:**
```
❌ [PostgresProvider] Falha ao conectar com PostgreSQL:
   Erro: database "fintech" does not exist
```

**Solução:**
```powershell
# Criar o banco
docker exec pgdb psql -U postgres -c "CREATE DATABASE fintech;"
docker exec pgdb psql -U postgres -d fintech -c "CREATE SCHEMA IF NOT EXISTS fintech;"
```

### Erro: "schema does not exist"

**Solução:**
```powershell
# Criar o schema
docker exec pgdb psql -U postgres -d fintech -c "CREATE SCHEMA IF NOT EXISTS fintech;"
```

### Erro: "relation does not exist" (tabela não existe)

**Solução:**
```powershell
# Executar scripts SQL
docker exec -i pgdb psql -U postgres -d fintech < schema_pg_fintech.sql
docker exec -i pgdb psql -U postgres -d fintech < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintech < migration_update_signup_defaults.sql
```

### Erro: "port 5432 is already allocated"

**Sintoma:** Porta 5432 já está em uso

**Solução:**
```powershell
# Ver o que está usando a porta
netstat -ano | findstr :5432

# Parar containers PostgreSQL
docker-compose down

# OU parar container específico
docker stop pgdb
```

### Erro: "MÚLTIPLOS CONTAINERS POSTGRESQL DETECTADOS"

**Sintoma:** API detecta múltiplos containers PostgreSQL

**Solução:**
```powershell
# Ver containers PostgreSQL
docker ps | findstr postgres

# Parar containers desnecessários
docker stop postgres  # se houver outro container chamado "postgres"

# Manter apenas o pgdb rodando
docker ps | findstr pgdb
```

### Erro: "password authentication failed"

**Solução:**
- Verifique a senha no `.env`: deve ser `pwd123`
- Ou use variável de ambiente:
```powershell
$env:PGPASSWORD="pwd123"
docker exec pgdb psql -U postgres -d fintech
```

### Erro: "null value in column 'id' violates not-null constraint"

**Sintoma:** Erro ao criar usuário admin

**Solução:**
- Verifique se a tabela `users` tem a coluna `id` como NOT NULL
- A API deve gerar UUID automaticamente - verifique o código

### Erro: "column 'login_attempts' does not exist"

**Solução:**
```powershell
# Adicionar coluna
docker exec pgdb psql -U postgres -d fintech -c "ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;"
```

### Container não inicia

**Solução:**
```powershell
# Ver logs para diagnosticar
docker-compose logs database

# Tentar recriar do zero
docker-compose down -v
docker-compose up -d database
```

---

## ⚙️ Configuração do .env

Configure o arquivo `.env` na pasta `API/`:

```env
# Provider do banco
DB_PROVIDER=postgres
# ou
DB_DIALECT=postgres

# Configurações de conexão
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=pwd123
DB_NAME=fintech
DB_SCHEMA=fintech
DB_SSL=false

# Alternativamente, você pode usar connection string:
# POSTGRES_CONNECTION_STRING=postgresql://postgres:pwd123@localhost:5432/fintech
```

**⚠️ IMPORTANTE:** 
- Se o banco se chama `fintechbank`, use `DB_NAME=fintechbank`
- Se o banco se chama `fintech`, use `DB_NAME=fintech`
- Verifique qual banco existe: `docker exec pgdb psql -U postgres -c "\l"`

---

## 🌐 Acessar via pgAdmin (Interface Gráfica)

### 1. Iniciar pgAdmin

```powershell
cd API
docker-compose up -d pgadmin
```

### 2. Acessar no Navegador

- URL: **http://localhost:16543**
- Email: `admin@test.com`
- Senha: `pwd123`

### 3. Conectar ao Banco

1. Clique direito em "Servers" → "Register" → "Server"
2. Preencha:
   - **Name**: `FintechBankApp`
   - **Host**: `pgdb` (nome do container)
   - **Port**: `5432`
   - **Maintenance database**: `postgres`
   - **Username**: `postgres`
   - **Password**: `pwd123`
3. Clique em "Save"

### 4. Navegar pelo Banco

- Expanda "Servers" → "FintechBankApp" → "Databases" → "fintech" → "Schemas" → "fintech" → "Tables"

---

## 📚 Estrutura de Arquivos SQL

- **`schema_pg_fintech.sql`** - Script principal com todas as tabelas base no schema `fintech`
- **`schema_invoice_lifecycle.sql`** - Extensões para ciclo de vida de faturas
- **`migration_update_signup_defaults.sql`** - Atualiza valores padrão para novos usuários
- **`schema_pg.sql`** - Script original (pode criar no schema `public`)

---

## 🎯 Tabelas Esperadas

Após executar todos os scripts, você deve ter estas tabelas no schema `fintech`:

1. `users` - Usuários do sistema
2. `transactions` - Transações financeiras
3. `pix_keys` - Chaves PIX cadastradas
4. `pix_contacts` - Contatos PIX
5. `products` - Produtos da loja
6. `purchased_items` - Itens comprados
7. `installment_plans` - Planos de parcelamento
8. `invoices` - Faturas do cartão
9. `notifications` - Notificações
10. `limit_increase_requests` - Solicitações de aumento de limite
11. `card_due_date_calendar` - Calendário de vencimentos

---

## ✅ Verificação Final

Após recriar o banco, verifique:

```powershell
# 1. Verificar tabelas
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"

# 2. Verificar usuário admin
docker exec pgdb psql -U postgres -d fintech -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"

# 3. Verificar estrutura da tabela users
docker exec pgdb psql -U postgres -d fintech -c "\d fintech.users"

# 4. Iniciar API e verificar logs
cd API
npm run dev
```

**Logs esperados:**
```
🔍 [PostgresProvider] Iniciando conexão com PostgreSQL...
🔍 [PostgresProvider] Tentando conectar em: postgresql://postgres:****@localhost:5432/fintech
🔍 [PostgresProvider] Testando conexão...
✅ [PostgresProvider] Conectado ao PostgreSQL com sucesso!
✅ [PostgresProvider] Database atual: fintech
```

---

## 🎉 Próximos Passos

Após criar o banco:

1. ✅ Configure o arquivo `.env` com as credenciais corretas
2. ✅ Inicie a API: `npm run dev`
3. ✅ A API verificará e aplicará migrações automaticamente
4. ✅ O usuário administrador padrão será criado:
   - CPF: `99999999999`
   - Email: `admin@fintechbank.com`
   - Senha: `admin999`

---

## 📝 Notas Importantes

- ⚠️ **SEMPRE aguarde 15-20 segundos** após iniciar o container PostgreSQL antes de executar comandos SQL
- ⚠️ **Verifique o nome do banco** no `.env` (`fintech` ou `fintechbank`)
- ⚠️ **Use o schema `fintech`** para manter consistência
- ⚠️ **Backup antes de recriar** se houver dados importantes

---

**Última atualização:** 2026-01-06
**Versão:** 1.0
