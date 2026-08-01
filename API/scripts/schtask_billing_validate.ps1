<#
.SYNOPSIS
  Executa a validação de faturamento (runBillingValidation) via API.
  Projetado para ser chamado pelo Windows Task Scheduler diariamente à 1h.

.DESCRIPTION
  - Autentica como admin na API FintechBank
  - Chama POST /admin/billing/validate-all
  - Registra resultado e horário em log
  - Retorna exit code 0 (sucesso) ou 1 (falha) para o Task Scheduler

.PARAMETER ApiBase
  URL base da API. Default: http://localhost:3001/api

.PARAMETER AdminCpf
  CPF do admin para autenticação. Default: 99999999999

.PARAMETER AdminPassword
  Senha do admin. Default: admin999

.PARAMETER LogDir
  Diretório onde os logs serão salvos. Default: $PSScriptRoot\logs

.PARAMETER RetryCount
  Número de tentativas em caso de falha. Default: 3

.PARAMETER NoAuth
  Se presente, pula a etapa de login (útil se a rota não exigir autenticação).

.EXAMPLE
  .\schtask_billing_validate.ps1
  Executa com valores padrão e salva log em .\logs\

.EXAMPLE
  .\schtask_billing_validate.ps1 -ApiBase "http://localhost:3001/api" -NoAuth
  Executa sem autenticação contra localhost:3001
#>

param(
    [string]$ApiBase = "http://localhost:3001/api",
    [string]$AdminCpf = "99999999999",
    [string]$AdminPassword = "admin999",
    [string]$LogDir = "$PSScriptRoot\logs",
    [int]$RetryCount = 3,
    [switch]$NoAuth
)

# ─── Garantir diretório de log ───
if (-not (Test-Path $LogDir)) {
    $null = New-Item -ItemType Directory -Path $LogDir -Force
}

# Limpar logs com mais de 90 dias (evita acúmulo)
Get-ChildItem "$LogDir\billing_validate_*.log" -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-90) } |
    Remove-Item -Force -ErrorAction SilentlyContinue

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile   = "$LogDir\billing_validate_$timestamp.log"
$startTime = Get-Date

function Write-Log {
    param([string]$Message)
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | $Message"
    Add-Content -Path $logFile -Value $line
    Write-Host $line
}

# ─── Cabeçalho ───
Write-Log "=== INÍCIO: Validação de Faturamento ==="
Write-Log "API Base : $ApiBase"
Write-Log "Admin CPF: $AdminCpf"
Write-Log "NoAuth   : $($NoAuth.IsPresent)"
Write-Log "Tentativas máx: $RetryCount"

$headers = @{
    "Content-Type" = "application/json"
}

# ─── Etapa 1: Login (se necessário) ───
if (-not $NoAuth) {
    Write-Log "Autenticando como admin..."
    $loginBody = @{ cpf = $AdminCpf; password = $AdminPassword } | ConvertTo-Json

    try {
        $loginResponse = Invoke-RestMethod `
            -Uri "$ApiBase/auth/login" `
            -Method Post `
            -Body $loginBody `
            -ContentType "application/json" `
            -TimeoutSec 15

        $token = $loginResponse.token
        if (-not $token) {
            throw "Token não retornado pelo login"
        }
        $headers["Authorization"] = "Bearer $token"
        Write-Log "Autenticação OK — token obtido."
    }
    catch {
        Write-Log "ERRO na autenticação: $($_.Exception.Message)"
        Write-Log "=== FIM (falha) ==="
        exit 1
    }
}
else {
    Write-Log "Autenticação pulada (modo NoAuth)."
}

# ─── Etapa 2: Chamar validate-all com retry ───
$lastError = $null
$attempt = 0
$response = $null

while ($attempt -lt $RetryCount) {
    $attempt++
    Write-Log "Tentativa $attempt de $RetryCount — chamando POST /admin/billing/validate-all..."

    try {
        $response = Invoke-RestMethod `
            -Uri "$ApiBase/admin/billing/validate-all" `
            -Method Post `
            -Headers $headers `
            -TimeoutSec 120  # Pode demorar para processar muitas massas
        $lastError = $null
        break
    }
    catch {
        $lastError = $_
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Log "Tentativa $attempt falhou (HTTP $statusCode): $($_.Exception.Message)"

        if ($attempt -lt $RetryCount) {
            $waitSec = $attempt * 5  # backoff: 5s, 10s, 15s
            Write-Log "Aguardando $waitSec segundos antes de tentar novamente..."
            Start-Sleep -Seconds $waitSec
        }
    }
}

# ─── Etapa 3: Processar resultado ───
if ($lastError) {
    Write-Log "ERRO após $RetryCount tentativas: $($lastError.Exception.Message)"
    Write-Log "=== FIM (falha) ==="
    exit 1
}

$summary = $response.summary -join ", "
Write-Log "RESPOSTA: success=$($response.success), message=$($response.message)"
if ($response.summary) {
    Write-Log "RESUMO: $summary"
}

# Extrair métricas do resumo
if ($response.summary) {
    foreach ($s in $response.summary) {
        if ($s -match '(\d+)\s+(\w+)') {
            Write-Log "  → $s"
        }
    }
}

$duration = (Get-Date) - $startTime
Write-Log "DURAÇÃO: $([math]::Round($duration.TotalSeconds, 1))s"
Write-Log "=== FIM (sucesso) ==="
Write-Log "Log salvo em: $logFile"
exit 0
