# Liga o Docker Engine que roda dentro do WSL2 (Ubuntu) SEM abrir o Docker Desktop,
# e opcionalmente sobe os containers do projeto (pgdb + pgadmin).
#
# Pre-requisito: ter rodado scripts/setup-docker-wsl.sh uma vez dentro do Ubuntu.
#
# Uso:
#   .\scripts\start-docker.ps1                # so liga o docker dentro do WSL
#   .\scripts\start-docker.ps1 -UpApi         # liga o docker E sobe API/docker-compose.yml
#   .\scripts\start-docker.ps1 -Distro Ubuntu # forca a distro (default: Ubuntu)

param(
    [string]$Distro = "Ubuntu",
    [switch]$UpApi
)

Write-Host "==> Iniciando a distro WSL '$Distro' (o systemd la dentro sobe o dockerd sozinho)..."
wsl -d $Distro -e true

Write-Host "==> Aguardando o Docker Engine responder..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    $out = wsl -d $Distro -e sh -c "docker info >/dev/null 2>&1 && echo ok"
    if ($out -eq "ok") {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 1
}

if (-not $ready) {
    Write-Host "Docker nao respondeu a tempo. Rode manualmente dentro do WSL: sudo systemctl status docker" -ForegroundColor Red
    exit 1
}

Write-Host "Docker Engine ativo (dentro do WSL, sem Docker Desktop)." -ForegroundColor Green
wsl -d $Distro -e docker --version
wsl -d $Distro -e docker compose version

if ($UpApi) {
    Write-Host "==> Subindo containers do projeto (pgdb + pgadmin)..."
    $wslPath = "/mnt/f/GITHUB/FintechBankApp/API"
    wsl -d $Distro -e sh -c "cd '$wslPath' && docker compose up -d"
    Write-Host "Containers no ar. pgAdmin: http://localhost:16543  |  Postgres: localhost:5432" -ForegroundColor Green
}
