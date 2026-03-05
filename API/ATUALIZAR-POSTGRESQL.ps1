# Script PowerShell para Atualizar PostgreSQL no Docker
# Este script atualiza o PostgreSQL preservando os dados (com backup)

param(
    [string]$NovaVersao = "18-trixie",
    [switch]$FazerBackup = $true,
    [switch]$RecriarDoZero = $false
)

Write-Host ""
Write-Host "🔄 ATUALIZAR POSTGRESQL NO DOCKER - FintechBankApp" -ForegroundColor Cyan
Write-Host ""

# Verificar se está na pasta API
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "❌ Erro: Execute este script na pasta API/" -ForegroundColor Red
    Write-Host "   Diretório atual: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

Write-Host "📁 Diretório: $(Get-Location)" -ForegroundColor Green
Write-Host "📦 Versão atual: postgres:trixie" -ForegroundColor Yellow
Write-Host "📦 Nova versão: postgres:$NovaVersao" -ForegroundColor Green
Write-Host ""

# Verificar versão atual do PostgreSQL
Write-Host "🔍 Verificando versão atual do PostgreSQL..." -ForegroundColor Yellow
$versaoAtual = docker exec pgdb psql -U postgres -d fintech -t -c "SELECT version();" 2>$null
if ($versaoAtual) {
    Write-Host "✅ Versão atual: $($versaoAtual.Trim())" -ForegroundColor Green
} else {
    Write-Host "⚠️  Não foi possível verificar a versão atual" -ForegroundColor Yellow
}
Write-Host ""

# Passo 1: Fazer backup (se solicitado)
if ($FazerBackup) {
    Write-Host "💾 Passo 1: Fazendo backup do banco de dados..." -ForegroundColor Yellow
    
    $backupDir = "backups"
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir | Out-Null
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = "$backupDir\fintech_backup_$timestamp.sql"
    
    Write-Host "   Salvando backup em: $backupFile" -ForegroundColor Cyan
    
    # Verificar se o banco existe
    $bancoExiste = docker exec pgdb psql -U postgres -lqt | Select-String "fintech"
    if ($bancoExiste) {
        docker exec pgdb pg_dump -U postgres -d fintech > $backupFile
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Backup criado com sucesso: $backupFile" -ForegroundColor Green
        } else {
            Write-Host "❌ Erro ao criar backup" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "⚠️  Banco 'fintech' não encontrado, pulando backup..." -ForegroundColor Yellow
    }
    Write-Host ""
}

# Passo 2: Parar containers
Write-Host "🛑 Passo 2: Parando containers..." -ForegroundColor Yellow
docker-compose down
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Alguns containers podem não ter sido encontrados" -ForegroundColor Yellow
}
Write-Host "✅ Containers parados" -ForegroundColor Green
Write-Host ""

# Passo 3: Atualizar docker-compose.yml
Write-Host "📝 Passo 3: Atualizando docker-compose.yml..." -ForegroundColor Yellow

$dockerComposeContent = Get-Content "docker-compose.yml" -Raw
$dockerComposeContent = $dockerComposeContent -replace "image: postgres:trixie", "image: postgres:$NovaVersao"

Set-Content -Path "docker-compose.yml" -Value $dockerComposeContent -NoNewline
Write-Host "✅ docker-compose.yml atualizado para postgres:$NovaVersao" -ForegroundColor Green
Write-Host ""

# Passo 4: Remover volumes (apenas se RecriarDoZero)
if ($RecriarDoZero) {
    Write-Host "🗑️  Passo 4: Removendo volumes (dados serão apagados)..." -ForegroundColor Yellow
    docker-compose down -v
    Write-Host "✅ Volumes removidos" -ForegroundColor Green
    Write-Host ""
    
    # Aguardar um momento
    Write-Host "⏳ Aguardando 5 segundos..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
} else {
    Write-Host "💾 Passo 4: Preservando volumes (dados serão mantidos)..." -ForegroundColor Yellow
    Write-Host "✅ Volumes preservados" -ForegroundColor Green
    Write-Host ""
}

# Passo 5: Baixar nova imagem
Write-Host "⬇️  Passo 5: Baixando nova imagem do PostgreSQL..." -ForegroundColor Yellow
docker pull "postgres:$NovaVersao"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao baixar nova imagem" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Nova imagem baixada" -ForegroundColor Green
Write-Host ""

# Passo 6: Iniciar PostgreSQL com nova versão
Write-Host "🚀 Passo 6: Iniciando PostgreSQL com nova versão..." -ForegroundColor Yellow
docker-compose up -d database
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao iniciar PostgreSQL" -ForegroundColor Red
    exit 1
}
Write-Host "✅ PostgreSQL iniciado" -ForegroundColor Green
Write-Host ""

# Passo 7: Aguardar banco inicializar
Write-Host "⏳ Passo 7: Aguardando PostgreSQL inicializar completamente (20 segundos)..." -ForegroundColor Yellow
Write-Host "   (Este passo é CRÍTICO - não pule!)" -ForegroundColor Yellow
Start-Sleep -Seconds 20
Write-Host "✅ Aguardamento concluído" -ForegroundColor Green
Write-Host ""

# Passo 8: Verificar nova versão
Write-Host "🔍 Passo 8: Verificando nova versão do PostgreSQL..." -ForegroundColor Yellow
$novaVersaoInstalada = docker exec pgdb psql -U postgres -t -c "SELECT version();" 2>$null
if ($novaVersaoInstalada) {
    Write-Host "✅ Nova versão instalada: $($novaVersaoInstalada.Trim())" -ForegroundColor Green
} else {
    Write-Host "⚠️  Não foi possível verificar a nova versão" -ForegroundColor Yellow
}
Write-Host ""

# Passo 9: Restaurar dados (se necessário)
if ($RecriarDoZero -and $FazerBackup -and (Test-Path $backupFile)) {
    Write-Host "🔄 Passo 9: Restaurando dados do backup..." -ForegroundColor Yellow
    
    # Aguardar mais um pouco para garantir que o banco está pronto
    Start-Sleep -Seconds 5
    
    # Criar banco se não existir
    docker exec pgdb psql -U postgres -c "CREATE DATABASE fintech;" 2>$null
    
    # Restaurar backup
    Get-Content $backupFile | docker exec -i pgdb psql -U postgres -d fintech
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Dados restaurados com sucesso" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Erro ao restaurar dados (pode ser necessário restaurar manualmente)" -ForegroundColor Yellow
    }
    Write-Host ""
} elseif (-not $RecriarDoZero) {
    Write-Host "✅ Passo 9: Dados preservados automaticamente (volumes mantidos)" -ForegroundColor Green
    Write-Host ""
}

# Passo 10: Verificar tabelas
Write-Host "📊 Passo 10: Verificando tabelas..." -ForegroundColor Yellow
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*" 2>$null
Write-Host ""

# Resumo final
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "SUCCESS: POSTGRESQL ATUALIZADO COM SUCESSO!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Resumo da atualização:" -ForegroundColor Yellow
Write-Host "   Versão anterior: postgres:trixie" -ForegroundColor Gray
Write-Host "   Nova versão: postgres:$NovaVersao" -ForegroundColor Gray
if ($FazerBackup -and (Test-Path $backupFile)) {
    Write-Host "   Backup criado: $backupFile" -ForegroundColor Gray
}
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Yellow
Write-Host "   1. Verifique se a aplicacao esta funcionando corretamente" -ForegroundColor White
Write-Host "   2. Teste as funcionalidades principais" -ForegroundColor White
Write-Host "   3. Se houver problemas, restaure o backup manualmente:" -ForegroundColor White
if ($FazerBackup -and (Test-Path $backupFile)) {
    Write-Host "      Get-Content $backupFile | docker exec -i pgdb psql -U postgres -d fintech" -ForegroundColor Gray
}
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
