#!/bin/bash

# Script para criar banco de dados PostgreSQL FintechBankApp
# Uso: ./setup-database.sh

set -e  # Parar em caso de erro

echo "🛑 Parando containers existentes..."
cd "$(dirname "$0")"
docker-compose down -v

echo "⏳ Aguardando 5 segundos..."
sleep 5

echo "🚀 Iniciando PostgreSQL..."
docker-compose up -d database

echo "⏳ Aguardando banco inicializar (15 segundos)..."
sleep 15

echo "📦 Criando banco de dados fintechbank..."
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;" || echo "Banco já existe (continuando...)"

echo "📦 Criando schema 'fintech'..."
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

echo "📋 Copiando schema_pg.sql para container..."
docker cp schema_pg.sql pgdb:/tmp/schema_pg.sql

echo "📋 Executando schema_pg.sql no schema 'fintech'..."
# Criar script SQL temporário com search_path
docker exec -i pgdb bash -c "cat > /tmp/run_schema.sql << 'EOF'
SET search_path TO fintech, public;
\i /tmp/schema_pg.sql
EOF
psql -U postgres -d fintechbank -f /tmp/run_schema.sql"

echo "📋 Executando schema_invoice_lifecycle.sql..."
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql

echo "📋 Executando migration_update_signup_defaults.sql..."
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

echo "✅ Verificando tabelas criadas..."
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"

echo "✅ Verificando usuário admin..."
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"

echo ""
echo "🎉 Banco de dados criado com sucesso!"
echo ""
echo "📝 Configure o arquivo .env com:"
echo "DB_PROVIDER=postgres"
echo "DB_HOST=localhost"
echo "DB_PORT=5432"
echo "DB_USER=postgres"
echo "DB_PASS=pwd123"
echo "DB_NAME=fintechbank"
echo "DB_SCHEMA=fintech"
echo "DB_SSL=false"

