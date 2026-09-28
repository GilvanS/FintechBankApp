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
                  @{Name="CPU (s)";  Expression={[math]::round($_.CPU, 2)}},
                  @{Name="Inicio";   Expression={try { $_.StartTime } catch { "?" }}} |
    Format-Table -AutoSize

Write-Host "COMO FECHAR UM PROCESSO PELO PID (coluna Id):" -ForegroundColor Yellow
Write-Host "Stop-Process -Id <PID> -Force" -ForegroundColor Cyan
Write-Host "Exemplo (para fechar um processo): Stop-Process -Id 10064 -Force`n" -ForegroundColor Gray

# 4. API (porta 3001) e WEB (porta 3000) - PID pronto pra fechar
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "           API (3001) e WEB (3000) - PID ATUAL             " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$portas = @{ 3001 = "API"; 3000 = "WEB" }
foreach ($porta in $portas.Keys | Sort-Object) {
    $nome = $portas[$porta]
    $conexao = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conexao) {
        $proc = Get-Process -Id $conexao.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            $ramMB = [math]::round($proc.WorkingSet64 / 1MB, 2)
            Write-Host ("{0,-4} (porta {1}) -> PID {2}  |  {3}  |  RAM {4} MB" -f $nome, $porta, $proc.Id, $proc.ProcessName, $ramMB) -ForegroundColor Green
            Write-Host ("  Fechar: Stop-Process -Id {0} -Force" -f $proc.Id) -ForegroundColor Cyan
        } else {
            Write-Host ("{0,-4} (porta {1}) -> PID {2} (processo nao encontrado)" -f $nome, $porta, $conexao.OwningProcess) -ForegroundColor DarkYellow
        }
    } else {
        Write-Host ("{0,-4} (porta {1}) -> nao esta rodando" -f $nome, $porta) -ForegroundColor DarkGray
    }
}
Write-Host ""

# 5. Docker Desktop / WSL2 (vmmem) - vilao classico de RAM quando ligado, mas
# invisivel se voce nao souber o nome do processo pra procurar.
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "           DOCKER DESKTOP / WSL2 (vmmem)                   " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
$vmmem = Get-Process -Name "vmmem","vmmemWSL","com.docker.backend","Docker Desktop" -ErrorAction SilentlyContinue
if ($vmmem) {
    $vmmem | Select-Object Id, ProcessName, @{Name="RAM (MB)"; Expression={[math]::round($_.WorkingSet64 / 1MB, 2)}} |
        Format-Table -AutoSize
    Write-Host "Docker/WSL2 esta rodando e consumindo RAM acima." -ForegroundColor Red
} else {
    Write-Host "Docker Desktop / WSL2 nao esta rodando agora (nenhum vmmem ativo)." -ForegroundColor Green
}
Write-Host ""

# 6. node.exe sem porta TCP em LISTEN = candidato a processo orfao (dev server
# de preview/teste que ficou pra tras, ex.: Vite fechado errado). O node real
# da API/WEB (secao 4 acima) sempre tem uma porta associada - quem nao tem,
# sobrou de alguma coisa. Exclui quem tem processo filho (supervisor/launcher
# tipo omniroute: o pai nao tem porta, mas sobe um filho que tem - matar o pai
# errado derruba os dois).
#
# Checa 2x com 5s de intervalo: node.exe de CLI/script passageiro (npx, etc.)
# aparece e sai sozinho em menos de 1s - um snapshot unico pega ele "no flagra"
# e sugere matar um processo que ja ia morrer sozinho (caso real 2026-09-27,
# PIDs 13820/25184/11620 - sumiram sozinhos antes do Stop-Process rodar). So
# quem sobrevive nas DUAS checagens e orfao de verdade.
function Get-NodeOrfaosSnapshot {
    $portasEmUso = (Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue).OwningProcess
    $pidsComFilho = (Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue).ParentProcessId | Select-Object -Unique
    Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Id -notin $portasEmUso -and $_.Id -notin $pidsComFilho }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     NODE.EXE SEM PORTA ATIVA (candidato a orfao)          " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
$candidatos1 = Get-NodeOrfaosSnapshot | Select-Object -ExpandProperty Id
if ($candidatos1) {
    Write-Host "Confirmando em 5s (ignora CLI passageiro que sai sozinho)..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 5
}
$candidatos2 = Get-NodeOrfaosSnapshot
$nodeOrfaos = $candidatos2 | Where-Object { $_.Id -in $candidatos1 }
if ($nodeOrfaos) {
    $nodeOrfaos | Select-Object Id,
                                 @{Name="RAM (MB)"; Expression={[math]::round($_.WorkingSet64 / 1MB, 2)}},
                                 @{Name="Inicio";   Expression={try { $_.StartTime } catch { "?" }}} |
        Format-Table -AutoSize
    Write-Host "Esses PIDs nao estao ouvindo nenhuma porta - normalmente sobra de dev server fechado errado." -ForegroundColor Yellow
    $idsOrfaos = ($nodeOrfaos | Select-Object -ExpandProperty Id) -join ","
    Write-Host "Fechar todos de uma vez: Stop-Process -Id $idsOrfaos -Force" -ForegroundColor Cyan
} else {
    Write-Host "Nenhum node.exe orfao encontrado - todos estao ouvindo alguma porta." -ForegroundColor Green
}
Write-Host ""
