# Script para executar testes Newman da FintechBankApp

param(
    [switch]$SkipServerCheck,
    [switch]$OpenReport,
    [string]$Collection = ".\postman-collection.json",
    [int]$Timeout = 30000,
    [int]$Delay = 500
)

Write-Host "NEWMAN TESTS - FintechBankApp"
Write-Host "================================="
Write-Host ""

# Verificar se Newman esta instalado
Write-Host "Verificando dependencias..."
try {
    $newmanVersion = newman --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host ("Newman instalado: v{0}" -f $newmanVersion)
    } else {
        throw "Newman nao encontrado"
    }
} catch {
    Write-Host "Newman nao esta instalado!"
    Write-Host "Instale com: npm install -g newman newman-reporter-html"
    exit 1
}

# Verificar se o arquivo de collection existe
if (-not (Test-Path $Collection)) {
    Write-Host ("Arquivo de collection nao encontrado: {0}" -f $Collection)
    # Tentar fallback relativo ao script
    $root = Split-Path -Parent $MyInvocation.MyCommand.Path
    $collectionPath = Join-Path $root "..\postman-collection.json"
    if (Test-Path $collectionPath) {
        Write-Host ("Usando collection no caminho alternativo: {0}" -f $collectionPath)
        $Collection = $collectionPath
    } else {
        exit 1
    }
}

Write-Host ("Collection encontrada: {0}" -f $Collection)

# Verificar se o servidor esta rodando (opcional)
if (-not $SkipServerCheck) {
    Write-Host "Verificando se o servidor esta rodando..."
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "Servidor esta rodando e saudavel"
        } else {
            throw "Servidor nao saudavel"
        }
    } catch {
        Write-Host "Servidor nao esta rodando ou nao esta saudavel!"
        Write-Host "Inicie o servidor com: npm start"
        Write-Host "Ou use -SkipServerCheck para pular esta verificacao"
        exit 1
    }
}

Write-Host ""
Write-Host "Executando testes Newman..."
Write-Host ("Collection: {0}" -f $Collection)
Write-Host ("Timeout: {0} ms" -f $Timeout)
Write-Host ("Delay: {0} ms" -f $Delay)
Write-Host ""

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$collectionPath = Join-Path $root "..\postman-collection.json"
$configPath = Join-Path $root "newman.config.json"

if (!(Test-Path $collectionPath)) {
    Write-Host ("Colecao Postman nao encontrada: {0}" -f $collectionPath)
    exit 1
}

if (!(Test-Path $configPath)) {
    Write-Host ("Arquivo de configuracao nao encontrado: {0}" -f $configPath)
}

# Executar Newman via Node (script JS gerencia reporter/flags)
$exitCode = 0
try {
    Write-Host "Executando Newman via Node..."
    node .\run-newman-tests.js
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        Write-Host ("Newman terminou com erro. Codigo: {0}" -f $exitCode)
        exit $exitCode
    }
    Write-Host "Suite Newman concluida com sucesso."
} catch {
    $msg = $_.Exception.Message
    Write-Host ("Erro ao executar Newman: {0}" -f $msg)
    exit 1
}

# Relatorios (informativo; gerados pelo script JS quando configurado)
Write-Host ""
Write-Host "RELATORIOS:"
Write-Host "HTML e JSON podem ser gerados via newman.config.json"

if ($OpenReport) {
    Write-Host "Abra o relatorio HTML manualmente se necessario."
}

if ($exitCode -eq 0) {
    Write-Host "TODOS OS TESTES PASSARAM!"
    Write-Host "APIs funcionando corretamente, incluindo administracao."
} else {
    Write-Host "ALGUNS TESTES FALHARAM"
    Write-Host "Verifique o relatorio para mais detalhes."
}

exit $exitCode