Write-Host "Iniciando API (Backend) e WEB (Frontend) em abas do Windows Terminal..." -ForegroundColor Green

$apiPath = Join-Path $PSScriptRoot "API"
$webPath = Join-Path $PSScriptRoot "WEB"

# Executa o Windows Terminal (wt) abrindo a primeira aba para a API e uma nova aba para a WEB
wt -d $apiPath cmd /k "title Fintech API && npm run dev" `; new-tab -d $webPath cmd /k "title Fintech WEB && npm run dev"
