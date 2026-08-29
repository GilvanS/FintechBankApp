# Sobe o Postgres do FintechBankApp usando EXCLUSIVAMENTE o Docker Engine (docker-ce)
# que roda dentro da distro WSL2 "Ubuntu". O Docker Desktop nao e usado em momento
# algum: todo comando docker aqui passa por `wsl -d <distro> -e docker ...`, nunca
# pelo docker.exe do Windows (que fala com o daemon do Desktop).
#
# Se o Docker Desktop estiver aberto, este script o ENCERRA para liberar RAM.
# Use -KeepDesktop se, por algum motivo, quiser deixa-lo rodando.
#
# ATENCAO: usa API/docker-compose.wsl.yml, que aponta para o volume `fintech_pgdata`
# (daemon do WSL). O API/docker-compose.yml padrao aponta para o volume do Docker
# Desktop e, no daemon do WSL, entrega um banco VAZIO.
#
# Uso:
#   .\scripts\start-docker.ps1                 # encerra o Desktop, liga o docker do WSL, sobe Postgres + Redis
#   .\scripts\start-docker.ps1 -Full           # tambem sobe pgadmin e portainer
#   .\scripts\start-docker.ps1 -Kafka          # tambem sobe zookeeper + kafka (profile opcional)
#   .\scripts\start-docker.ps1 -Stop           # para containers e o dockerd do WSL
#   .\scripts\start-docker.ps1 -KeepDesktop    # nao mexe no Docker Desktop
#   .\scripts\start-docker.ps1 -Distro Ubuntu  # forca a distro (default: Ubuntu)

param(
    [string]$Distro = "Ubuntu",
    [switch]$Full,
    [switch]$Kafka,
    [switch]$Stop,
    [switch]$KeepDesktop
)

$proj = "/mnt/f/GITHUB/FintechBankApp"
$yml  = "API/docker-compose.wsl.yml"

Write-Host "Daemon alvo: docker-ce dentro da distro WSL '$Distro'. Docker Desktop NAO e usado." -ForegroundColor Cyan

if ($Stop) {
    Write-Host "==> Parando containers..."
    wsl -d $Distro -e docker stop pgdb pgadmin portainer redis kafka zookeeper 2>&1 | Out-Null
    wsl -d $Distro -e sh -c "service docker stop"
    Write-Host "Parado. Os dados continuam no volume fintech_pgdata." -ForegroundColor Green
    exit 0
}

# --- Encerra o Docker Desktop: nao e necessario e come ~500 MB + uma distro WSL ---
if (-not $KeepDesktop) {
    if (Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue) {
        Write-Host "==> Docker Desktop esta aberto; encerrando para liberar memoria..."
        # CLI oficial do Desktop: encerramento limpo, sem matar processo.
        docker desktop stop 2>&1 | Out-Null
        for ($i = 0; $i -lt 20; $i++) {
            if (-not (Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue)) { break }
            Start-Sleep -Seconds 1
        }
        if (Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue) {
            Write-Host "    Nao encerrou sozinho. Feche pela bandeja (Quit Docker Desktop)." -ForegroundColor Yellow
        } else {
            Write-Host "    Docker Desktop encerrado." -ForegroundColor Green
        }
    }
    # A distro interna dele fica residente mesmo depois de fechar. Encerra so ela.
    # NUNCA usar `wsl --shutdown` aqui: derrubaria a distro Ubuntu e os containers.
    $running = (wsl -l --running) -join " "
    if ($running -match "docker-desktop") {
        wsl --terminate docker-desktop 2>&1 | Out-Null
        Write-Host "    Distro 'docker-desktop' encerrada." -ForegroundColor Green
    }
}

Write-Host "==> Iniciando a distro WSL '$Distro'..."
wsl -d $Distro -e true

function Wait-Docker {
    for ($i = 0; $i -lt 30; $i++) {
        $out = wsl -d $Distro -e sh -c "docker info >/dev/null 2>&1 && echo ok"
        if ($out -eq "ok") { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

Write-Host "==> Aguardando o Docker Engine do WSL responder..."
if (-not (Wait-Docker)) {
    # Sem systemd habilitado o dockerd nao sobe sozinho; inicia via SysV.
    Write-Host "    dockerd nao estava no ar; iniciando via 'service docker start'..."
    wsl -d $Distro -e sh -c "service docker start"
    if (-not (Wait-Docker)) {
        Write-Host "Docker nao respondeu. Dentro do WSL, verifique: service docker status" -ForegroundColor Red
        exit 1
    }
}
Write-Host "Docker Engine ativo dentro do WSL." -ForegroundColor Green

Write-Host "==> Subindo Postgres + Redis (volume fintech_pgdata)..."
# O plugin `docker compose` instalado em /usr/local/lib e um symlink para os cli-tools
# do Docker Desktop; com ele desligado o symlink fica quebrado. Por isso escolhemos o
# binario do pacote docker-compose-plugin quando o subcomando nao responde.
# Sem aspas duplas internas: o wsl.exe re-divide a linha de comando nelas.
$up = "cd '$proj' && if docker compose version >/dev/null 2>&1; then docker compose -f $yml up -d database redis; else /usr/libexec/docker/cli-plugins/docker-compose -f $yml up -d database redis; fi"
wsl -d $Distro -e sh -c $up
if ($LASTEXITCODE -ne 0) {
    Write-Host "Falha ao subir Postgres/Redis." -ForegroundColor Red
    exit 1
}

if ($Full) {
    Write-Host "==> Subindo extras (pgadmin, portainer)..."
    # Se o container ja existe (criado fora deste compose, ex: docker run manual),
    # 'compose up' bate conflito de nome. Nesse caso so da start; senao cria via compose.
    $upFull = "cd '$proj' && " +
        "(docker inspect pgadmin >/dev/null 2>&1 && docker start pgadmin >/dev/null 2>&1 || " +
        "(docker compose version >/dev/null 2>&1 && docker compose -f $yml up -d pgadmin || /usr/libexec/docker/cli-plugins/docker-compose -f $yml up -d pgadmin)); " +
        "(docker inspect portainer >/dev/null 2>&1 && docker start portainer >/dev/null 2>&1 || " +
        "(docker compose version >/dev/null 2>&1 && docker compose -f $yml up -d portainer || /usr/libexec/docker/cli-plugins/docker-compose -f $yml up -d portainer))"
    wsl -d $Distro -e sh -c $upFull
}

if ($Kafka) {
    Write-Host "==> Subindo Kafka (zookeeper + kafka, profile opcional)..."
    $upKafka = "cd '$proj' && if docker compose version >/dev/null 2>&1; then docker compose -f $yml --profile kafka up -d zookeeper kafka; else /usr/libexec/docker/cli-plugins/docker-compose -f $yml --profile kafka up -d zookeeper kafka; fi"
    wsl -d $Distro -e sh -c $upKafka
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Falha ao subir Kafka." -ForegroundColor Red
        exit 1
    }
}

Write-Host "==> Verificando o banco..."
$wait = 'i=0; while [ $i -lt 30 ]; do docker exec pgdb pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; i=$((i+1)); done'
wsl -d $Distro -e sh -c $wait
$users = (wsl -d $Distro -e docker exec pgdb psql -U postgres -d fintechbank -tAc "select count(*) from fintech.users") -join ""
$users = $users.Trim()

if ($users -match '^\d+$' -and [int]$users -gt 0) {
    Write-Host "Banco no ar: $users usuarios em fintechbank." -ForegroundColor Green
} else {
    Write-Host "ATENCAO: nao consegui contar usuarios (retorno: '$users'). Confira o volume do container." -ForegroundColor Red
}

wsl -d $Distro -e docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host ""
Write-Host "Postgres: localhost:5432  (db fintechbank, user postgres)"
Write-Host "Redis:    localhost:6379"
if ($Full) {
    Write-Host "pgAdmin:   http://localhost:16543"
    Write-Host "Portainer: http://localhost:9000"
}
if ($Kafka) {
    Write-Host "Kafka:     localhost:9092"
}
Write-Host "Para subir a API:  cd F:\GITHUB\FintechBankApp\API ; npm run dev"
