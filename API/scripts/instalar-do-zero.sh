#!/bin/bash

# Script para instalar banco PostgreSQL do Zero
# Uso: ./instalar-do-zero.sh

# Encontrar diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📁 Diretório: $(pwd)"

# Verificar se docker-compose.yml existe
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erro: docker-compose.yml não encontrado!"
    echo "   Execute este script na pasta API/"
    exit 1
fi

echo "🛑 Parando containers existentes (se houver)..."
docker-compose down -v 2>/dev/null || docker compose down -v 2>/dev/null || true

echo "🚀 Iniciando PostgreSQL do zero..."
docker-compose up -d database 2>/dev/null || docker compose up -d database

echo "⏳ Aguardando PostgreSQL inicializar (20 segundos)..."
sleep 20

echo "📦 Criando banco de dados fintechbank..."
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;" 2>/dev/null || {
    echo "⚠️  Banco já existe ou erro ao criar. Continuando..."
}

echo "📦 Criando schema 'fintech'..."
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

echo "📋 Criando arquivo SQL combinado..."
TEMP_FILE="$SCRIPT_DIR/schema_pg_fintech.sql"
{
  echo "SET search_path TO fintech, public;"
  cat "$SCRIPT_DIR/schema_pg.sql"
} > "$TEMP_FILE"

echo "📋 Executando schema_pg.sql..."
docker cp "$TEMP_FILE" pgdb:/tmp/schema_pg_fintech.sql
# Usar bash -c com stdin ao invés de -f para evitar problemas com caminhos no Git Bash
docker exec -i pgdb bash -c "psql -U postgres -d fintechbank < /tmp/schema_pg_fintech.sql"

echo "🧹 Limpando arquivo temporário..."
rm -f "$TEMP_FILE"

echo "📋 Executando migrações..."
docker exec -i pgdb psql -U postgres -d fintechbank < "$SCRIPT_DIR/schema_invoice_lifecycle.sql"
docker exec -i pgdb psql -U postgres -d fintechbank < "$SCRIPT_DIR/migration_update_signup_defaults.sql"

echo "✅ Verificando tabelas criadas..."
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"

echo "✅ Verificando usuário admin..."
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT cpf, full_name, email FROM fintech.users WHERE role = 'admin';"

echo ""
echo "🎉 Banco instalado com sucesso!"
echo ""
echo "📝 Configure o arquivo .env na pasta API com:"
echo ""
echo "DB_PROVIDER=postgres"
echo "DB_HOST=localhost"
echo "DB_PORT=5432"
echo "DB_USER=postgres"
echo "DB_PASS=pwd123"
echo "DB_NAME=fintechbank"
echo "DB_SCHEMA=fintech"
echo "DB_SSL=false"

