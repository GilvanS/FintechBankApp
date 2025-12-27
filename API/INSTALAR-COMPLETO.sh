#!/bin/bash

# Script para instalar banco PostgreSQL FintechBankApp COMPLETO
# Cria todas as tabelas no schema 'fintech' de uma vez

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

echo "🛑 Parando containers existentes..."
docker-compose down -v 2>/dev/null || docker compose down -v 2>/dev/null || true

echo "🚀 Iniciando PostgreSQL..."
docker-compose up -d database 2>/dev/null || docker compose up -d database

echo "⏳ Aguardando PostgreSQL inicializar (20 segundos)..."
sleep 20

echo "📦 Criando banco de dados fintechbank..."
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;" 2>/dev/null || true

echo "📦 Criando schema 'fintech'..."
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

echo "📋 Executando schema_pg_fintech.sql (cria todas as tabelas no schema fintech)..."
# Verificar se o arquivo schema_pg_fintech.sql existe, se não, criar do schema_pg.sql
if [ ! -f "schema_pg_fintech.sql" ]; then
    echo "⚠️  schema_pg_fintech.sql não encontrado, usando schema_pg.sql com search_path..."
    {
        echo "CREATE SCHEMA IF NOT EXISTS fintech;"
        echo "SET search_path TO fintech, public;"
        cat schema_pg.sql
    } > schema_pg_fintech.sql
fi

docker exec -i pgdb psql -U postgres -d fintechbank < schema_pg_fintech.sql

echo "📋 Executando schema_invoice_lifecycle.sql..."
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql

echo "📋 Executando migration_update_signup_defaults.sql..."
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

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

