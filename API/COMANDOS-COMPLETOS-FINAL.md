# 🎯 Comandos COMPLETOS - Setup Final

## 🚀 Passo 1: Iniciar Todos os Serviços

```bash
cd API

# Iniciar PostgreSQL + pgAdmin
docker-compose up -d

# Aguardar inicialização
sleep 20
```

---

## 🚀 Passo 2: Criar Banco de Dados

```bash
# Criar banco
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"

# Criar schema
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"
```

---

## 🚀 Passo 3: Executar Scripts SQL

```bash
# Script principal (cria todas as tabelas)
docker exec -i pgdb psql -U postgres -d fintechbank < schema_pg_fintech.sql

# Migrações
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql
```

---

## ✅ Passo 4: Verificar

```bash
# Ver tabelas
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"

# Ver usuário admin
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT cpf, full_name, email FROM fintech.users WHERE role = 'admin';"
```

---

## 🌐 Passo 5: Acessar pgAdmin

1. Abra no navegador: **http://localhost:16543**
2. Login:
   - Email: `admin@test.com`
   - Senha: `pwd123`
3. Conectar ao banco:
   - Clique direito em "Servers" → "Register" → "Server"
   - Name: `FintechBankApp`
   - Host: `pgdb`
   - Port: `5432`
   - Database: `postgres`
   - Username: `postgres`
   - Password: `pwd123`

---

## ⚙️ Passo 6: Configurar .env

```env
DB_PROVIDER=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=pwd123
DB_NAME=fintechbank
DB_SCHEMA=fintech
DB_SSL=false
```

---

## 🎉 Tudo Pronto!

Agora você tem:
- ✅ PostgreSQL rodando
- ✅ pgAdmin rodando (http://localhost:16543)
- ✅ Banco `fintechbank` criado
- ✅ Schema `fintech` criado
- ✅ Todas as tabelas criadas
- ✅ Usuário admin criado



