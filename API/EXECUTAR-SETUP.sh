#!/bin/bash

# Script para criar banco PostgreSQL FintechBankApp
# Execute este script de QUALQUER lugar

# Encontrar diretório do script
if [ -L "${BASH_SOURCE[0]}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "$(readlink "${BASH_SOURCE[0]}")")" && pwd)"
else
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

# Mudar para o diretório do script
cd "$SCRIPT_DIR"

echo "📁 Diretório atual: $(pwd)"

# Verificar se docker-compose.yml existe
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erro: docker-compose.yml não encontrado em $(pwd)"
    echo "   Certifique-se de que o script está na pasta API/"
    exit 1
fi

echo "🛑 Parando containers..."
docker-compose down -v 2>/dev/null || docker compose down -v
sleep 5

echo "🚀 Iniciando PostgreSQL..."
docker-compose up -d database 2>/dev/null || docker compose up -d database
sleep 15

echo "📦 Criando banco de dados..."
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;" 2>/dev/null || true

echo "📦 Criando schema 'fintech'..."
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

echo "📋 Criando arquivo SQL combinado..."
TEMP_FILE="$SCRIPT_DIR/schema_pg_fintech.sql"
{
  echo "SET search_path TO fintech, public;"
  cat "$SCRIPT_DIR/schema_pg.sql"
} > "$TEMP_FILE"

echo "📋 Executando schema_pg.sql no schema 'fintech'..."
docker cp "$TEMP_FILE" pgdb:/tmp/schema_pg_fintech.sql
docker exec -i pgdb psql -U postgres -d fintechbank -f /tmp/schema_pg_fintech.sql

echo "🧹 Limpando arquivo temporário..."
rm -f "$TEMP_FILE"

echo "📋 Executando migrações..."
docker exec -i pgdb psql -U postgres -d fintechbank < "$SCRIPT_DIR/schema_invoice_lifecycle.sql"
docker exec -i pgdb psql -U postgres -d fintechbank < "$SCRIPT_DIR/migration_update_signup_defaults.sql"

echo "✅ Verificando tabelas..."
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"

echo "✅ Verificando usuário admin..."
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT cpf, full_name, email FROM fintech.users WHERE role = 'admin';"

echo ""
echo "🎉 Banco criado com sucesso!"
echo ""
echo "📝 Configure o .env com:"
echo "   DB_PROVIDER=postgres"
echo "   DB_HOST=localhost"
echo "   DB_PORT=5432"
echo "   DB_USER=postgres"
echo "   DB_PASS=pwd123"
echo "   DB_NAME=fintechbank"
echo "   DB_SCHEMA=fintech"
echo "   DB_SSL=false"

