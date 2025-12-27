# ✅ Comandos FINAIS Simples - Criar Banco Completo

## 🚀 Execute Estes Comandos (Copiar e Colar)

```bash
cd API
docker-compose down -v 2>/dev/null || true
docker-compose up -d database
sleep 20
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"
docker exec -i pgdb psql -U postgres -d fintechbank < schema_pg_fintech.sql
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

**OU use o script:**

```bash
cd API
chmod +x INSTALAR-COMPLETO.sh
./INSTALAR-COMPLETO.sh
```

---

## 📋 O Que Foi Feito

Criei o arquivo **`schema_pg_fintech.sql`** que:
- ✅ Cria o schema `fintech` se não existir
- ✅ Cria TODAS as tabelas diretamente no schema `fintech` (usando `fintech.tabela`)
- ✅ Inclui o usuário administrador padrão
- ✅ Está pronto para ser executado de uma vez

---

## ⚙️ Configurar .env

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

