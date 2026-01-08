# Script simples para rodar testes - Versão direta
# Execute este script na pasta API

Write-Host "🚀 Rodando testes Newman..." -ForegroundColor Cyan
Write-Host ""

# Verificar arquivos
if (-not (Test-Path "postman-collection.json")) {
    Write-Host "❌ Arquivo postman-collection.json não encontrado!" -ForegroundColor Red
    Write-Host "   Execute: cd .." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "postman-environment.json")) {
    Write-Host "❌ Arquivo postman-environment.json não encontrado!" -ForegroundColor Red
    exit 1
}

# Verificar servidor
Write-Host "🔍 Verificando servidor..." -ForegroundColor Yellow
try {
    $null = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/health" -Method GET -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✅ Servidor OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Servidor não está rodando! Execute: npm run dev" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🧪 Executando testes..." -ForegroundColor Cyan
Write-Host ""

# Rodar Newman
npx newman run postman-collection.json -e postman-environment.json

exit $LASTEXITCODE
