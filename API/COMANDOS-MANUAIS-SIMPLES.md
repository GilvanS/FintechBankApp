# 🚀 Comandos Manuais Simples (Copiar e Colar)

Execute estes comandos **na pasta API** no Git Bash:

```bash
# 1. Ir para pasta API
cd API

# 2. Parar containers
docker-compose down -v
sleep 5

# 3. Iniciar PostgreSQL
docker-compose up -d database
sleep 15

# 4. Criar banco de dados
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"

# 5. Criar schema 'fintech'
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# 6. Criar arquivo SQL combinado
{ echo "SET search_path TO fintech, public;"; cat schema_pg.sql; } > schema_pg_fintech.sql

# 7. Copiar para container e executar
docker cp schema_pg_fintech.sql pgdb:/tmp/
docker exec -i pgdb psql -U postgres -d fintechbank -f /tmp/schema_pg_fintech.sql

# 8. Limpar arquivo temporário
rm -f schema_pg_fintech.sql

# 9. Executar migrações
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# 10. Verificar
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

---

## ✅ Se der erro "docker-compose.yml não encontrado"

Certifique-se de estar na pasta `API`:
```bash
pwd  # Deve mostrar: .../FintechBankApp/API
ls docker-compose.yml  # Deve listar o arquivo
```

