# Script para correção imediata do swagger.yaml
Write-Host "🚨 Correção URGENTE do swagger.yaml" -ForegroundColor Red

# Fazer backup do arquivo atual
Write-Host "📦 Fazendo backup do arquivo atual..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item "swagger.yaml" "swagger-backup-$timestamp.yaml"
Write-Host "✅ Backup criado: swagger-backup-$timestamp.yaml" -ForegroundColor Green

# Substituir pelo arquivo limpo
Write-Host "🔄 Substituindo pelo arquivo limpo..." -ForegroundColor Blue
Copy-Item "swagger-clean.yaml" "swagger.yaml"
Write-Host "✅ Arquivo swagger.yaml substituído!" -ForegroundColor Green

# Verificar se o nodemon vai reiniciar
Write-Host "⏳ Aguardando reinicialização do nodemon..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "🎉 Correção aplicada! Verifique o terminal do servidor." -ForegroundColor Green
Write-Host ""
Write-Host "📋 Se o servidor ainda não iniciar:" -ForegroundColor Cyan
Write-Host "1. Pare o nodemon (Ctrl+C)" -ForegroundColor White
Write-Host "2. Execute: npm run dev" -ForegroundColor White
Write-Host "3. Teste: http://localhost:3001/health" -ForegroundColor White