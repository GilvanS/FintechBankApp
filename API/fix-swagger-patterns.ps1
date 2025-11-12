# Script para corrigir todos os padrões regex malformados no swagger.yaml

$swaggerFile = "swagger.yaml"
$backupFile = "swagger.yaml.backup"

Write-Host "🔧 Corrigindo padrões regex malformados no swagger.yaml..." -ForegroundColor Yellow

# Fazer backup do arquivo original
if (Test-Path $swaggerFile) {
    Copy-Item $swaggerFile $backupFile
    Write-Host "✅ Backup criado: $backupFile" -ForegroundColor Green
} else {
    Write-Host "❌ Arquivo swagger.yaml não encontrado!" -ForegroundColor Red
    exit 1
}

# Ler o conteúdo do arquivo
$content = Get-Content $swaggerFile -Raw

# Contar padrões malformados antes da correção
$malformedPatterns = ($content | Select-String "pattern: '\^[0-9]\{11\}[^'$]" -AllMatches).Matches.Count
Write-Host "🔍 Encontrados $malformedPatterns padrões malformados" -ForegroundColor Cyan

# Corrigir todos os padrões malformados
$correctedContent = $content -replace "pattern: '\^[0-9]\{11\}(?!['\$])", "pattern: '^[0-9]{11}$'"

# Verificar se houve mudanças
if ($content -ne $correctedContent) {
    # Salvar o arquivo corrigido
    $correctedContent | Set-Content $swaggerFile -NoNewline
    
    # Contar padrões corretos após a correção
    $correctPatterns = ($correctedContent | Select-String "pattern: '\^[0-9]\{11\}\$'" -AllMatches).Matches.Count
    
    Write-Host "✅ Arquivo corrigido com sucesso!" -ForegroundColor Green
    Write-Host "📊 Padrões corrigidos: $correctPatterns" -ForegroundColor Cyan
    Write-Host "💾 Backup salvo em: $backupFile" -ForegroundColor Yellow
} else {
    Write-Host "ℹ️  Nenhuma correção necessária" -ForegroundColor Blue
    Remove-Item $backupFile -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "🧪 Testando se o YAML está válido..." -ForegroundColor Yellow

# Testar se o servidor consegue carregar o arquivo
try {
    # Tentar parsear o YAML usando Node.js
    $testResult = node -e "
        const yaml = require('yamljs');
        try {
            const doc = yaml.load('$swaggerFile');
            console.log('✅ YAML válido');
            process.exit(0);
        } catch (error) {
            console.log('❌ YAML inválido:', error.message);
            process.exit(1);
        }
    " 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host $testResult -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 Correção concluída com sucesso!" -ForegroundColor Green
        Write-Host "   O servidor agora deve iniciar sem erros." -ForegroundColor Cyan
    } else {
        Write-Host $testResult -ForegroundColor Red
        Write-Host ""
        Write-Host "⚠️  Ainda há problemas no YAML. Restaurando backup..." -ForegroundColor Yellow
        Copy-Item $backupFile $swaggerFile
        Write-Host "🔄 Backup restaurado" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Não foi possível testar o YAML (yamljs não encontrado)" -ForegroundColor Yellow
    Write-Host "   Execute 'npm install yamljs' se necessário" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Green
Write-Host "   1. Execute: npm run dev" -ForegroundColor Cyan
Write-Host "   2. Teste as APIs: npm run test" -ForegroundColor Cyan
Write-Host "   3. Verifique os logs do servidor" -ForegroundColor Cyan