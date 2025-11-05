# CORREÇÃO DE EMERGÊNCIA - SWAGGER.YAML
Write-Host "🚨 CORREÇÃO DE EMERGÊNCIA DO SWAGGER.YAML" -ForegroundColor Red
Write-Host "Problema: Arquivo corrompido com 17.352 linhas" -ForegroundColor Yellow

# Parar o nodemon se estiver rodando
Write-Host "⏹️  Tentando parar processos Node..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Fazer backup com timestamp
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = "swagger-corrupted-$timestamp.yaml"
Write-Host "📦 Fazendo backup do arquivo corrompido..." -ForegroundColor Blue

if (Test-Path "swagger.yaml") {
    Move-Item "swagger.yaml" $backupFile -Force
    Write-Host "✅ Backup criado: $backupFile" -ForegroundColor Green
}

# Copiar o arquivo limpo
Write-Host "✨ Copiando arquivo limpo..." -ForegroundColor Green
if (Test-Path "swagger-clean.yaml") {
    Copy-Item "swagger-clean.yaml" "swagger.yaml" -Force
    
    # Verificar se a cópia foi bem-sucedida
    if (Test-Path "swagger.yaml") {
        $lines = (Get-Content "swagger.yaml").Count
        Write-Host "✅ Arquivo substituído com sucesso! ($lines linhas)" -ForegroundColor Green
        
        # Verificar se não há padrões malformados
        $malformed = Select-String -Path "swagger.yaml" -Pattern "pattern: '\^.*[^$]$" -SimpleMatch:$false
        if ($malformed) {
            Write-Host "⚠️  Ainda há padrões malformados!" -ForegroundColor Yellow
        } else {
            Write-Host "✅ Nenhum padrão malformado encontrado!" -ForegroundColor Green
        }
    } else {
        Write-Host "❌ Falha na substituição!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Arquivo swagger-clean.yaml não encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎯 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host "1. Execute: npm run dev" -ForegroundColor White
Write-Host "2. Teste: http://localhost:3001/health" -ForegroundColor White
Write-Host "3. Se ainda falhar, verifique os logs" -ForegroundColor White

Write-Host ""
Write-Host "📊 RESUMO DA CORREÇÃO:" -ForegroundColor Magenta
Write-Host "- Arquivo corrompido movido para: $backupFile" -ForegroundColor White
Write-Host "- Arquivo limpo copiado com sucesso" -ForegroundColor White
Write-Host "- Pronto para reiniciar o servidor" -ForegroundColor White