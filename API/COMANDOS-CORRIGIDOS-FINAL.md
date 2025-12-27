# ✅ Comandos Corrigidos - Versão Final

## 🔍 Problema Identificado

O comando `psql -f /tmp/arquivo.sql` estava falhando no Git Bash. A solução é usar `stdin` (`<`) ao invés de `-f`.

## 🚀 Comandos Corretos (Copiar e Colar)

```bash
cd API

# Limpar tudo
docker-compose down -v 2>/dev/null || true

# Iniciar PostgreSQL
docker-compose up -d database
sleep 20

# Criar banco e schema
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Criar arquivo SQL combinado
{ echo "SET search_path TO fintech, public;"; cat schema_pg.sql; } > schema_pg_fintech.sql

# Copiar para container
docker cp schema_pg_fintech.sql pgdb:/tmp/

# Executar usando stdin (CORRIGIDO!)
docker exec -i pgdb bash -c "psql -U postgres -d fintechbank < /tmp/schema_pg_fintech.sql"

# Limpar arquivo local
rm -f schema_pg_fintech.sql

# Executar migrações
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# Verificar
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT cpf, full_name, email FROM fintech.users WHERE role = 'admin';"
```

---

## 🎯 Diferença Principal

**❌ ERRO (não funciona no Git Bash):**
```bash
docker exec -i pgdb psql -U postgres -d fintechbank -f /tmp/schema_pg_fintech.sql
```

**✅ CORRETO:**
```bash
docker exec -i pgdb bash -c "psql -U postgres -d fintechbank < /tmp/schema_pg_fintech.sql"
```

O uso de `bash -c` com `<` (stdin) evita problemas com interpretação de caminhos no Git Bash.

