# Script rápido para corrigir o swagger.yaml

Write-Host "🔧 Aplicando correção rápida no swagger.yaml..." -ForegroundColor Yellow

$file = "swagger.yaml"

if (-not (Test-Path $file)) {
    Write-Host "❌ Arquivo swagger.yaml não encontrado!" -ForegroundColor Red
    exit 1
}

# Fazer backup
Copy-Item $file "$file.backup" -Force
Write-Host "✅ Backup criado" -ForegroundColor Green

# Ler e corrigir o conteúdo
$content = Get-Content $file -Raw

# Substituições necessárias
$fixes = @(
    @{ Pattern = "pattern: '\^[0-9]\{11\}(?!\$)"; Replacement = "pattern: '^[0-9]{11}$'" },
    @{ Pattern = "pattern: '\^[0-9]\{11\}[^']*$"; Replacement = "pattern: '^[0-9]{11}$'" }
)

$changesMade = 0
foreach ($fix in $fixes) {
    $before = $content
    $content = $content -replace $fix.Pattern, $fix.Replacement
    if ($before -ne $content) {
        $changesMade++
    }
}

# Salvar o arquivo corrigido
$content | Set-Content $file -NoNewline

Write-Host "✅ Correções aplicadas: $changesMade" -ForegroundColor Green

# Testar o servidor
Write-Host "🧪 Testando o servidor..." -ForegroundColor Yellow
try {
    $process = Start-Process "node" -ArgumentList "index.js" -PassThru -WindowStyle Hidden
    Start-Sleep 3
    
    if (-not $process.HasExited) {
        Write-Host "✅ Servidor iniciou com sucesso!" -ForegroundColor Green
        Stop-Process $process -Force
        Remove-Item "$file.backup" -ErrorAction SilentlyContinue
    } else {
        Write-Host "❌ Servidor ainda com problemas" -ForegroundColor Red
        Copy-Item "$file.backup" $file -Force
        Write-Host "🔄 Backup restaurado" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Não foi possível testar automaticamente" -ForegroundColor Yellow
}

Write-Host "✅ Correção concluída!" -ForegroundColor Green