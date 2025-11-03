# Script para testar se o servidor consegue inicializar após correção
Write-Host "🚀 Testando inicialização do servidor..." -ForegroundColor Cyan

# Validar YAML primeiro
Write-Host "📋 Validando swagger.yaml..." -ForegroundColor Yellow
if (Test-Path "validate-swagger.js") {
    node validate-swagger.js
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro na validação do YAML. Abortando teste." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠️  Script de validação não encontrado. Continuando..." -ForegroundColor Yellow
}

# Testar inicialização do servidor
Write-Host "🔧 Iniciando servidor de teste..." -ForegroundColor Blue
$serverProcess = Start-Process -FilePath "node" -ArgumentList "index.js" -PassThru -WindowStyle Hidden

# Aguardar alguns segundos para inicialização
Start-Sleep -Seconds 5

# Verificar se o processo ainda está rodando
if ($serverProcess.HasExited) {
    Write-Host "❌ Servidor falhou ao inicializar!" -ForegroundColor Red
    Write-Host "📋 Verificar logs de erro acima." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ Servidor iniciou com sucesso!" -ForegroundColor Green
    
    # Testar endpoint de health
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 10
        Write-Host "✅ Health check passou: $($response.status)" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Health check falhou, mas servidor está rodando" -ForegroundColor Yellow
    }
    
    # Parar o servidor de teste
    Stop-Process -Id $serverProcess.Id -Force
    Write-Host "🛑 Servidor de teste parado." -ForegroundColor Blue
}

Write-Host "🎉 Teste de inicialização concluído!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Execute: npm run dev" -ForegroundColor White
Write-Host "2. Teste: http://localhost:3001/health" -ForegroundColor White
Write-Host "3. Acesse: http://localhost:3001/api-docs" -ForegroundColor White