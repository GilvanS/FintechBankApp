# Script PowerShell para Recriar Banco de Dados PostgreSQL do Zero
# ⚠️ ATENÇÃO: Isso apagará TODOS os dados do banco!

Write-Host ""
Write-Host "🔄 RECRIAR BANCO DE DADOS POSTGRESQL - FintechBankApp" -ForegroundColor Cyan
Write-Host "⚠️  ATENÇÃO: Isso apagará TODOS os dados!" -ForegroundColor Yellow
Write-Host ""

# Verificar se está na pasta API
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "❌ Erro: Execute este script na pasta API/" -ForegroundColor Red
    Write-Host "   Diretório atual: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

Write-Host "📁 Diretório: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# Passo 1: Parar e remover containers e volumes
Write-Host "🛑 Passo 1: Parando e removendo containers e volumes..." -ForegroundColor Yellow
docker-compose down -v 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Alguns containers podem não ter sido encontrados (normal se for primeira vez)" -ForegroundColor Yellow
}
Write-Host "✅ Containers e volumes removidos" -ForegroundColor Green
Write-Host ""

# Aguardar um momento
Write-Host "⏳ Aguardando 5 segundos..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Passo 2: Iniciar PostgreSQL
Write-Host "🚀 Passo 2: Iniciando PostgreSQL..." -ForegroundColor Yellow
docker-compose up -d database
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao iniciar PostgreSQL" -ForegroundColor Red
    exit 1
}
Write-Host "✅ PostgreSQL iniciado" -ForegroundColor Green
Write-Host ""

# Passo 3: Aguardar banco inicializar (IMPORTANTE!)
Write-Host "⏳ Passo 3: Aguardando PostgreSQL inicializar completamente (20 segundos)..." -ForegroundColor Yellow
Write-Host "   (Este passo é CRÍTICO - não pule!)" -ForegroundColor Yellow
Start-Sleep -Seconds 20
Write-Host "✅ Aguardamento concluído" -ForegroundColor Green
Write-Host ""

# Passo 4: Criar banco de dados
Write-Host "📦 Passo 4: Criando banco de dados 'fintech'..." -ForegroundColor Yellow
docker exec pgdb psql -U postgres -c "DROP DATABASE IF EXISTS fintech;" 2>$null
docker exec pgdb psql -U postgres -c "CREATE DATABASE fintech;"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao criar banco de dados" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Banco 'fintech' criado" -ForegroundColor Green
Write-Host ""

# Passo 5: Criar schema 'fintech'
Write-Host "📋 Passo 5: Criando schema 'fintech'..." -ForegroundColor Yellow
docker exec pgdb psql -U postgres -d fintech -c "CREATE SCHEMA IF NOT EXISTS fintech;"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao criar schema" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Schema 'fintech' criado" -ForegroundColor Green
Write-Host ""

# Passo 6: Verificar se arquivos SQL existem
Write-Host "📄 Passo 6: Verificando arquivos SQL..." -ForegroundColor Yellow
$sqlFiles = @(
    "schema_pg_fintech.sql",
    "schema_invoice_lifecycle.sql",
    "migration_update_signup_defaults.sql"
)

foreach ($file in $sqlFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "⚠️  Arquivo não encontrado: $file" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Arquivo encontrado: $file" -ForegroundColor Green
    }
}
Write-Host ""

# Passo 7: Executar script principal
Write-Host "🔧 Passo 7: Executando script principal (schema_pg_fintech.sql)..." -ForegroundColor Yellow
if (Test-Path "schema_pg_fintech.sql") {
    Get-Content "schema_pg_fintech.sql" | docker exec -i pgdb psql -U postgres -d fintech
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao executar schema_pg_fintech.sql" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Script principal executado" -ForegroundColor Green
} else {
    Write-Host "⚠️  Arquivo schema_pg_fintech.sql não encontrado, pulando..." -ForegroundColor Yellow
}
Write-Host ""

# Passo 8: Executar migrações
Write-Host "🔄 Passo 8: Executando migrações..." -ForegroundColor Yellow

if (Test-Path "schema_invoice_lifecycle.sql") {
    Write-Host "   Executando schema_invoice_lifecycle.sql..." -ForegroundColor Cyan
    Get-Content "schema_invoice_lifecycle.sql" | docker exec -i pgdb psql -U postgres -d fintech
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ schema_invoice_lifecycle.sql executado" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Erro ao executar schema_invoice_lifecycle.sql (pode ser normal se já foi executado)" -ForegroundColor Yellow
    }
}

if (Test-Path "migration_update_signup_defaults.sql") {
    Write-Host "   Executando migration_update_signup_defaults.sql..." -ForegroundColor Cyan
    Get-Content "migration_update_signup_defaults.sql" | docker exec -i pgdb psql -U postgres -d fintech
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ migration_update_signup_defaults.sql executado" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Erro ao executar migration_update_signup_defaults.sql (pode ser normal se já foi executado)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Passo 9: Criar tabela products (se não existir)
Write-Host "📦 Passo 9: Criando tabela 'products' (se não existir)..." -ForegroundColor Yellow
docker exec pgdb psql -U postgres -d fintech -c "CREATE TABLE IF NOT EXISTS fintech.products (id VARCHAR(255) NOT NULL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(15,2) NOT NULL, image_url TEXT);"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Tabela 'products' verificada/criada" -ForegroundColor Green
} else {
    Write-Host "⚠️  Erro ao criar tabela 'products' (pode já existir)" -ForegroundColor Yellow
}
Write-Host ""

# Passo 10: Verificar tabelas criadas
Write-Host "✅ Passo 10: Verificando tabelas criadas..." -ForegroundColor Yellow
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"
Write-Host ""

# Passo 11: Verificar usuário admin
Write-Host "👤 Passo 11: Verificando usuário admin..." -ForegroundColor Yellow
docker exec pgdb psql -U postgres -d fintech -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"
Write-Host ""

# Resumo final
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "SUCCESS: BANCO DE DADOS RECRIADO COM SUCESSO!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Yellow
Write-Host "   1. Configure o arquivo .env com:" -ForegroundColor White
Write-Host "      DB_PROVIDER=postgres" -ForegroundColor Gray
Write-Host "      DB_HOST=localhost" -ForegroundColor Gray
Write-Host "      DB_PORT=5432" -ForegroundColor Gray
Write-Host "      DB_USER=postgres" -ForegroundColor Gray
Write-Host "      DB_PASS=pwd123" -ForegroundColor Gray
Write-Host "      DB_NAME=fintech" -ForegroundColor Gray
Write-Host "      DB_SCHEMA=fintech" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Inicie a API:" -ForegroundColor White
Write-Host "      npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "   3. A API criara automaticamente o usuario admin:" -ForegroundColor White
Write-Host "      CPF: 99999999999" -ForegroundColor Gray
Write-Host "      Senha: admin999" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
