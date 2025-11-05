# Script para forçar a correção do swagger.yaml
Write-Host "🚨 CORREÇÃO FORÇADA DO SWAGGER.YAML" -ForegroundColor Red

# Parar qualquer processo que possa estar usando o arquivo
Write-Host "⏹️  Parando processos..." -ForegroundColor Yellow

# Fazer backup com timestamp
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = "swagger-backup-$timestamp.yaml"
Write-Host "📦 Criando backup: $backupFile" -ForegroundColor Blue
Copy-Item "swagger.yaml" $backupFile -Force

# Remover o arquivo problemático
Write-Host "🗑️  Removendo arquivo problemático..." -ForegroundColor Yellow
Remove-Item "swagger.yaml" -Force

# Copiar o arquivo limpo
Write-Host "✨ Copiando arquivo limpo..." -ForegroundColor Green
Copy-Item "swagger-clean.yaml" "swagger.yaml" -Force

# Verificar se a cópia foi bem-sucedida
if (Test-Path "swagger.yaml") {
    $lines = (Get-Content "swagger.yaml").Count
    Write-Host "✅ Arquivo substituído com sucesso! ($lines linhas)" -ForegroundColor Green
} else {
    Write-Host "❌ Falha na substituição!" -ForegroundColor Red
    # Restaurar backup se falhou
    Copy-Item $backupFile "swagger.yaml" -Force
    Write-Host "🔄 Backup restaurado." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 Próximos passos:" -ForegroundColor Cyan
Write-Host "1. O nodemon deve reiniciar automaticamente" -ForegroundColor White
Write-Host "2. Se não reiniciar, pressione 'rs' no terminal" -ForegroundColor White
Write-Host "3. Teste: http://localhost:3001/health" -ForegroundColor White