# Script de monitoramento de RAM e CPU compatível com PowerShell 5.1

Clear-Host

# 1. Informações de Memória do Sistema
$os = Get-CimInstance Win32_OperatingSystem
$totalRamGB = [math]::round($os.TotalVisibleMemorySize / 1MB, 2)
$freeRamGB  = [math]::round($os.FreePhysicalMemory / 1MB, 2)
$usedRamGB  = [math]::round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1MB, 2)
$usedPct    = [math]::round(($usedRamGB / $totalRamGB) * 100, 1)

$statusColor = "Green"
if ($usedPct -gt 85) { $statusColor = "Red" } elseif ($usedPct -gt 70) { $statusColor = "Yellow" }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "             STATUS GERAL DE MEMORIA RAM                  " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Total de RAM  : $totalRamGB GB"
Write-Host "RAM Em Uso    : $usedRamGB GB ($usedPct%)" -ForegroundColor $statusColor
Write-Host "RAM Livre     : $freeRamGB GB"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 2. Uso Total Agrupado por Aplicativo
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "           USO TOTAL AGRUPADO POR APLICATIVO              " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

Get-Process | Group-Object ProcessName | Select-Object @{Name="Aplicativo"; Expression={$_.Name}},
                                                        @{Name="Instancias"; Expression={$_.Count}},
                                                        @{Name="RAM Total (MB)"; Expression={[math]::round(($_.Group | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 2)}} |
    Sort-Object "RAM Total (MB)" -Descending | Select-Object -First 10 |
    Format-Table -AutoSize

# 3. Top 15 Processos Individuais com PID (Id)
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      TOP 15 PROCESSOS INDIVIDUAIS (COM PID PARA FECHAR)   " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 15 | 
    Select-Object Id, 
                  ProcessName, 
                  @{Name="RAM (MB)"; Expression={[math]::round($_.WorkingSet64 / 1MB, 2)}}, 
                  @{Name="CPU (s)";  Expression={[math]::round($_.CPU, 2)}} |
    Format-Table -AutoSize

Write-Host "COMO FECHAR UM PROCESSO PELO PID (coluna Id):" -ForegroundColor Yellow
Write-Host "Stop-Process -Id <PID> -Force" -ForegroundColor Cyan
Write-Host "Exemplo (para fechar um processo): Stop-Process -Id 10064 -Force`n" -ForegroundColor Gray
