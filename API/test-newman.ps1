# Script PowerShell simplificado para testar API com Newman
# Usa apenas o reporter CLI (não requer newman-reporter-html)

Write-Host "🚀 Testando API FintechBankApp com Newman" -ForegroundColor Cyan
Write-Host ""

# Verificar se estamos no diretório correto
if (-not (Test-Path "postman-collection.json")) {
    Write-Host "❌ Erro: Arquivo postman-collection.json não encontrado!" -ForegroundColor Red
    Write-Host "   Execute este script na pasta API" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "postman-environment.json")) {
    Write-Host "❌ Erro: Arquivo postman-environment.json não encontrado!" -ForegroundColor Red
    exit 1
}

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
    exit 1
}

Write-Host ""
Write-Host "🧪 Executando testes com Newman (CLI reporter)..." -ForegroundColor Cyan
Write-Host ""

# Executar com apenas CLI reporter (mais compatível)
npx newman run postman-collection.json -e postman-environment.json

$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "✅ Testes concluídos com sucesso!" -ForegroundColor Green
} else {
    Write-Host "❌ Alguns testes falharam." -ForegroundColor Red
}

exit $exitCode
