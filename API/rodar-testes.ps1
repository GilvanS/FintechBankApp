# Script para rodar testes Newman - Detecta pasta automaticamente
# Funciona de qualquer lugar dentro do projeto

$ErrorActionPreference = "Stop"

# Encontrar a pasta API
$currentDir = Get-Location
$apiPath = $null

# Tentar encontrar a pasta API
if (Test-Path "postman-collection.json") {
    $apiPath = Get-Location
    Write-Host "✅ Arquivos encontrados na pasta atual" -ForegroundColor Green
} elseif (Test-Path "..\postman-collection.json") {
    $apiPath = (Get-Location).Parent
    Write-Host "✅ Arquivos encontrados na pasta pai" -ForegroundColor Green
    Set-Location $apiPath
} elseif (Test-Path "..\..\API\postman-collection.json") {
    $apiPath = (Get-Location).Parent.Parent.FullName + "\API"
    Write-Host "✅ Arquivos encontrados em ..\API" -ForegroundColor Green
    Set-Location $apiPath
} else {
    Write-Host "❌ Arquivo postman-collection.json não encontrado!" -ForegroundColor Red
    Write-Host "   Procurando em: $currentDir" -ForegroundColor Yellow
    Write-Host "   Execute este script na pasta API ou em uma subpasta" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "📁 Pasta de trabalho: $apiPath" -ForegroundColor Cyan
Write-Host ""

# Verificar se o servidor está rodando
Write-Host "🔍 Verificando se o servidor está rodando..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Servidor está rodando" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Servidor não está rodando!" -ForegroundColor Red
    Write-Host "   Inicie o servidor com: npm run dev" -ForegroundColor Yellow
    Write-Host "   Em outro terminal, execute: cd API && npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🧪 Executando testes com Newman..." -ForegroundColor Cyan
Write-Host ""

# Executar Newman
npx newman run postman-collection.json -e postman-environment.json

$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "✅ Testes concluídos com sucesso!" -ForegroundColor Green
} else {
    Write-Host "❌ Alguns testes falharam." -ForegroundColor Red
}

exit $exitCode
