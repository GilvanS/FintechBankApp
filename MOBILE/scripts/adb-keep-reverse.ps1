param(
  [string]$Device = "",
  [int]$Port = 3001,
  [int]$IntervalSeconds = 30
)

function EnsureReverse {
  $list = adb reverse --list 2>$null
  if ($null -eq $list -or ($list -notmatch "tcp:$Port")) {
    adb reverse tcp:$Port tcp:$Port | Out-Null
  }
}

if ($Device -ne "") {
  adb tcpip 5555 | Out-Null
  Start-Sleep -Seconds 1
  adb connect $Device | Out-Null
}

EnsureReverse

while ($true) {
  Start-Sleep -Seconds $IntervalSeconds
  $devices = adb devices 2>$null
  if ($devices -match "\bdevice\b") {
    EnsureReverse
  }
}
