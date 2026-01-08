# Script PowerShell para testar a API FintechBankApp completa
# Testa todos os endpoints usando Newman

Write-Host "🚀 Iniciando testes completos da API FintechBankApp" -ForegroundColor Cyan
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
        Write-Host "✅ Servidor está rodando e saudável" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Servidor não está rodando ou não está acessível!" -ForegroundColor Red
    Write-Host "   Por favor, inicie o servidor com: npm run dev" -ForegroundColor Yellow
    Write-Host "   Em outro terminal, execute: cd API && npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "📋 Configuração dos testes:" -ForegroundColor Cyan
Write-Host "   Collection: postman-collection.json"
Write-Host "   Environment: postman-environment.json"
Write-Host "   Base URL: http://localhost:3001/api/v1"
Write-Host "   CPFs de teste: 11111111111, 77777777777, 88888888888"
Write-Host "   Admin CPF: 99999999999"
Write-Host "   Senha padrão: admin999"
Write-Host "   PIN padrão: 9898"
Write-Host ""

# Verificar se newman está instalado
Write-Host "🔍 Verificando dependências..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js não está instalado ou não está no PATH!" -ForegroundColor Red
    exit 1
}

# Verificar se node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules não encontrado. Instalando dependências..." -ForegroundColor Yellow
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao instalar dependências!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Dependências verificadas" -ForegroundColor Green
Write-Host ""

# Executar testes com Newman
Write-Host "🧪 Executando testes com Newman..." -ForegroundColor Cyan
Write-Host ""

# Usar o script Node.js que já está configurado corretamente
node run-newman-tests.js

$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "✅ Testes concluídos com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 Dica: Para gerar relatórios HTML/JSON, instale:" -ForegroundColor Cyan
    Write-Host "   npm install newman-reporter-html --save-dev" -ForegroundColor Yellow
} else {
    Write-Host "❌ Alguns testes falharam. Verifique os detalhes acima." -ForegroundColor Red
}

exit $exitCode
