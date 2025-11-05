# Script para executar testes Newman da FintechBankApp
# Este script executa todos os testes, incluindo os administrativos

param(
    [switch]$SkipServerCheck,
    [switch]$OpenReport,
    [string]$Collection = "..\postman-collection.json",
    [int]$Timeout = 30000,
    [int]$Delay = 500
)

Write-Host "🚀 NEWMAN TESTS - FintechBankApp" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""

# Verificar se Newman está instalado
Write-Host "🔍 Verificando dependências..." -ForegroundColor Yellow
try {
    $newmanVersion = newman --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Newman instalado: v$newmanVersion" -ForegroundColor Green
    } else {
        throw "Newman não encontrado"
    }
} catch {
    Write-Host "❌ Newman não está instalado!" -ForegroundColor Red
    Write-Host "   Instale com: npm install -g newman newman-reporter-html" -ForegroundColor Yellow
    exit 1
}

# Verificar se o arquivo de collection existe
if (-not (Test-Path $Collection)) {
    Write-Host "❌ Arquivo de collection não encontrado: $Collection" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Collection encontrada: $Collection" -ForegroundColor Green

# Verificar se o servidor está rodando (opcional)
if (-not $SkipServerCheck) {
    Write-Host "🔍 Verificando se o servidor está rodando..." -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Servidor está rodando e saudável" -ForegroundColor Green
        } else {
            throw "Servidor não saudável"
        }
    } catch {
        Write-Host "❌ Servidor não está rodando ou não está saudável!" -ForegroundColor Red
        Write-Host "   Inicie o servidor com: npm start" -ForegroundColor Yellow
        Write-Host "   Ou use -SkipServerCheck para pular esta verificação" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "🧪 Executando testes Newman..." -ForegroundColor Yellow
Write-Host "   Collection: $Collection" -ForegroundColor Cyan
Write-Host "   Timeout: $Timeout ms" -ForegroundColor Cyan
Write-Host "   Delay: $Delay ms" -ForegroundColor Cyan
Write-Host ""

# Executar Newman
$reportHtml = "newman-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').html"
$reportJson = "newman-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"

try {
    newman run $Collection `
        --reporters cli,html,json `
        --reporter-html-export $reportHtml `
        --reporter-json-export $reportJson `
        --timeout $Timeout `
        --delay-request $Delay `
        --insecure `
        --color on

    $exitCode = $LASTEXITCODE

    Write-Host ""
    Write-Host "📄 RELATÓRIOS GERADOS:" -ForegroundColor Green
    Write-Host "   📊 HTML: $reportHtml" -ForegroundColor Cyan
    Write-Host "   📋 JSON: $reportJson" -ForegroundColor Cyan

    if ($OpenReport -and (Test-Path $reportHtml)) {
        Write-Host ""
        Write-Host "🌐 Abrindo relatório HTML..." -ForegroundColor Yellow
        Start-Process $reportHtml
    }

    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "🎉 TODOS OS TESTES PASSARAM! 🎉" -ForegroundColor Green
        Write-Host "✅ APIs funcionando corretamente, incluindo as administrativas" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠️  ALGUNS TESTES FALHARAM" -ForegroundColor Yellow
        Write-Host "❌ Verifique o relatório para mais detalhes" -ForegroundColor Red
    }

    exit $exitCode

} catch {
    Write-Host ""
    Write-Host "❌ Erro ao executar Newman: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}