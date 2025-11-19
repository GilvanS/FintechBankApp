param(
  [string]$Device = "",
  [int]$Port = 3001,
  [int]$IntervalSeconds = 30
)

function EnsureReverse {
  $list = adb reverse --list 2>$null
  if ($null -eq $list -or ($list -notmatch "tcp:$Port")) {
    Write-Host "[adb-keeper] Aplicando reverse tcp:$Port -> tcp:$Port"
    adb reverse tcp:$Port tcp:$Port | Out-Null
  } else {
    Write-Host "[adb-keeper] Reverse tcp:$Port ativo"
  }
}

function Connected {
  $devices = adb devices 2>$null
  return ($devices -match "\bdevice\b")
}

function ConnectDevice($dev) {
  if ([string]::IsNullOrWhiteSpace($dev)) { return }
  Write-Host "[adb-keeper] Conectando ao device $dev"
  adb tcpip 5555 | Out-Null
  Start-Sleep -Seconds 1
  adb connect $dev | Out-Null
}

if ($Device -ne "") { ConnectDevice $Device }

if (Connected) { EnsureReverse } else { Write-Host "[adb-keeper] Nenhum device conectado; aguardando..." }

while ($true) {
  Start-Sleep -Seconds $IntervalSeconds
  if (-not (Connected)) {
    if ($Device -ne "") { ConnectDevice $Device }
  }
  if (Connected) { EnsureReverse }
}
