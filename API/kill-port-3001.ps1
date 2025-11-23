# Script para liberar a porta 3001 no Windows
# Execute como Administrador se necessário

Write-Host "🔍 Verificando processos usando a porta 3001..." -ForegroundColor Cyan

# Encontrar processos usando a porta 3001
$processes = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($processes) {
    Write-Host "⚠️  Processos encontrados usando a porta 3001:" -ForegroundColor Yellow
    foreach ($pid in $processes) {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "  - PID: $pid | Nome: $($proc.ProcessName) | Caminho: $($proc.Path)" -ForegroundColor Yellow
        }
    }
    
    $response = Read-Host "Deseja encerrar esses processos? (S/N)"
    if ($response -eq 'S' -or $response -eq 's') {
        foreach ($pid in $processes) {
            try {
                Stop-Process -Id $pid -Force
                Write-Host "✅ Processo $pid encerrado com sucesso." -ForegroundColor Green
            } catch {
                Write-Host "❌ Erro ao encerrar processo $pid : $_" -ForegroundColor Red
            }
        }
        Write-Host "✅ Porta 3001 liberada!" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  Nenhum processo foi encerrado." -ForegroundColor Cyan
    }
} else {
    Write-Host "✅ Nenhum processo está usando a porta 3001." -ForegroundColor Green
}

Write-Host "`n💡 Dica: Se a porta ainda estiver em uso, verifique:" -ForegroundColor Cyan
Write-Host "   1. Outros terminais com 'npm run dev' ou 'npm run preview' rodando" -ForegroundColor Gray
Write-Host "   2. Outros servidores Node.js em execução" -ForegroundColor Gray
Write-Host "   3. Execute 'netstat -ano | findstr :3001' para mais detalhes" -ForegroundColor Gray

