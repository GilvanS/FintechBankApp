# 🚀 Instalar Banco PostgreSQL do Zero

## ✅ Comandos Completos (Copiar e Colar)

Execute estes comandos **na pasta API** no Git Bash:

```bash
# 1. Ir para pasta API
cd API

# 2. Parar e remover tudo (caso exista algo)
docker-compose down -v 2>/dev/null || true

# 3. Iniciar PostgreSQL do zero
docker-compose up -d database

# 4. Aguardar PostgreSQL inicializar (importante!)
sleep 20

# 5. Criar banco de dados
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"

# 6. Criar schema 'fintech'
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# 7. Criar arquivo SQL combinado
{ echo "SET search_path TO fintech, public;"; cat schema_pg.sql; } > schema_pg_fintech.sql

# 8. Copiar para container e executar
docker cp schema_pg_fintech.sql pgdb:/tmp/
docker exec -i pgdb psql -U postgres -d fintechbank -f /tmp/schema_pg_fintech.sql

# 9. Limpar arquivo temporário
rm -f schema_pg_fintech.sql

# 10. Executar migrações
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# 11. Verificar se funcionou
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"

# 12. Verificar usuário admin
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT cpf, full_name, email FROM fintech.users WHERE role = 'admin';"
```

---

## 📝 Depois, configure o `.env`:

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

## ✅ Verificar se Está Funcionando

```bash
# Ver containers rodando
docker ps

# Ver tabelas criadas
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"

# Testar conexão
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT version();"
```

