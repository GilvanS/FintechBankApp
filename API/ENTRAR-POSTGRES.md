# 🔗 Como Entrar no PostgreSQL no Docker

## ✅ Opção 1: Conectar Diretamente (Recomendado)

No PowerShell, execute:

```powershell
docker exec -it pgdb psql -U postgres
```

**Se der erro de TTY**, use:

```powershell
docker exec pgdb psql -U postgres
```

---

## ✅ Opção 2: Entrar no Container e Depois no psql

```powershell
# 1. Entrar no container
docker exec -it pgdb bash

# 2. Dentro do container, conectar ao PostgreSQL
psql -U postgres

# 3. Para sair do psql: \q
# 4. Para sair do container: exit
```

---

## ✅ Opção 3: Executar Comandos SQL Diretos

```powershell
# Ver versão do PostgreSQL
docker exec pgdb psql -U postgres -c "SELECT version();"

# Listar bancos
docker exec pgdb psql -U postgres -c "\l"

# Listar tabelas (se o banco fintechbank existir)
docker exec pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"

# Ver usuários
docker exec pgdb psql -U postgres -d fintechbank -c "SELECT cpf, full_name, email FROM fintech.users LIMIT 5;"
```

---

## 📋 Comandos Úteis no psql

Depois de conectar, você pode usar:

```sql
-- Listar bancos
\l

-- Conectar a um banco específico
\c fintechbank

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

## 🚀 Criar o Banco fintechbank (se necessário)

Se o banco `fintechbank` não existir, crie com:

```powershell
docker exec pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"
docker exec pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"
```

---

## 🌐 Acessar via pgAdmin (Interface Gráfica)

1. Abra no navegador: **http://localhost:16543**
2. Login:
   - Email: `admin@test.com`
   - Senha: `pwd123`
3. Conectar ao banco:
   - Clique direito em "Servers" → "Register" → "Server"
   - **Name**: FintechBankApp
   - **Host**: `pgdb` (nome do container)
   - **Port**: `5432`
   - **Database**: `postgres` (ou `fintechbank` se criou)
   - **Username**: `postgres`
   - **Password**: `pwd123`
