# 🚀 Comandos Rápidos - Criar Banco PostgreSQL FintechBankApp

## 📋 Comandos para Copiar e Colar (Docker)

### Opção 1: Schema 'fintech' (Recomendado)

```powershell
# 1. Iniciar PostgreSQL
cd API
docker-compose up -d database

# 2. Aguardar 10-15 segundos para o banco inicializar

# 3. Criar banco de dados
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE fintechbank;"

# 4. Criar schema 'fintech'
psql -h localhost -p 5432 -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# 5. Executar script principal (executar manualmente no psql para usar schema 'fintech')
psql -h localhost -p 5432 -U postgres -d fintechbank
```

No prompt do psql que abrir, execute:
```sql
SET search_path TO fintech, public;
\i schema_pg.sql
\q
```

Depois, execute as migrações (já no PowerShell novamente):
```powershell
# 6. Migrações adicionais
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_invoice_lifecycle.sql
psql -h localhost -p 5432 -U postgres -d fintechbank -f migration_update_signup_defaults.sql

# 7. Verificar tabelas criadas
psql -h localhost -p 5432 -U postgres -d fintechbank -c "\dt fintech.*"
```

### Opção 2: Schema 'public' (Mais Simples)

```powershell
# 1. Iniciar PostgreSQL
cd API
docker-compose up -d database

# 2. Aguardar 10-15 segundos

# 3. Criar banco de dados
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE fintechbank;"

# 4. Executar script principal (cria no schema 'public')
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_pg.sql

# 5. Verificar tabelas criadas
psql -h localhost -p 5432 -U postgres -d fintechbank -c "\dt"
```

**Importante**: Se usar schema 'public', configure no `.env`: `DB_SCHEMA=public`

---

## ⚙️ Configurar .env

Após criar o banco, adicione no arquivo `.env` da API:

```env
DB_PROVIDER=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=pwd123
DB_NAME=fintechbank
DB_SCHEMA=fintech
# ou DB_SCHEMA=public se usou schema public
DB_SSL=false
```

---

## ✅ Verificar se Funcionou

```powershell
psql -h localhost -p 5432 -U postgres -d fintechbank -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"
# ou se usou schema public:
psql -h localhost -p 5432 -U postgres -d fintechbank -c "SELECT cpf, full_name, email, role FROM users WHERE role = 'admin';"
```

Você deve ver o usuário administrador criado.

---

## 🔄 Recriar do Zero (Drop e Recriar)

**⚠️ CUIDADO: Apaga todos os dados!**

```powershell
psql -h localhost -p 5432 -U postgres -c "DROP DATABASE IF EXISTS fintechbank;"
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE fintechbank;"
psql -h localhost -p 5432 -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"
psql -h localhost -p 5432 -U postgres -d fintechbank
```

No psql:
```sql
SET search_path TO fintech, public;
\i schema_pg.sql
\q
```

Voltar ao PowerShell e executar migrações:
```powershell
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_invoice_lifecycle.sql
psql -h localhost -p 5432 -U postgres -d fintechbank -f migration_update_signup_defaults.sql
```

