# ⚡ Execute Agora - Instalar do Zero

## 🚨 IMPORTANTE: Você precisa estar na pasta API!

## 🆕 Se você deletou o container no Docker Desktop:

Use o script `instalar-do-zero.sh`:

## Opção 1: Usar o Script (Recomendado)

```bash
# 1. Navegar para a pasta API
cd /f/GITHUB/FintechBankApp/API

# OU se você está na raiz do projeto:
cd API

# 2. Verificar se está no lugar certo
pwd
ls docker-compose.yml

# 3. Executar o script de instalação do zero
chmod +x instalar-do-zero.sh
./instalar-do-zero.sh
```

---

## Opção 2: Comandos Manuais (Copiar e Colar Tudo)

**IMPORTANTE: Execute PRIMEIRO o `cd API`!**

```bash
cd /f/GITHUB/FintechBankApp/API
docker-compose down -v
sleep 5
docker-compose up -d database
sleep 15
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"
{ echo "SET search_path TO fintech, public;"; cat schema_pg.sql; } > schema_pg_fintech.sql
docker cp schema_pg_fintech.sql pgdb:/tmp/
docker exec -i pgdb psql -U postgres -d fintechbank -f /tmp/schema_pg_fintech.sql
rm -f schema_pg_fintech.sql
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

---

## ✅ Como Saber se Está no Diretório Correto?

Execute:
```bash
pwd
ls docker-compose.yml
```

Se mostrar o caminho da pasta API e listar o arquivo `docker-compose.yml`, está correto!

