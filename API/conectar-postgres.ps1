# Script para conectar ao PostgreSQL no Docker
# Uso: .\conectar-postgres.ps1

Write-Host "🔍 Verificando container PostgreSQL..." -ForegroundColor Cyan

# Verificar se o container está rodando
$container = docker ps --filter "name=pgdb" --format "{{.Names}}"
if (-not $container) {
    Write-Host "❌ Container pgdb não está rodando!" -ForegroundColor Red
    Write-Host "   Execute: docker-compose up -d" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Container pgdb está rodando" -ForegroundColor Green
Write-Host ""

# Listar bancos disponíveis
Write-Host "📋 Bancos de dados disponíveis:" -ForegroundColor Cyan
docker exec pgdb psql -U postgres -c "\l"

Write-Host ""
Write-Host "🔗 Para conectar ao banco, use um dos comandos abaixo:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Conectar ao banco 'postgres' (padrão):" -ForegroundColor White
Write-Host "   docker exec -it pgdb psql -U postgres" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Conectar ao banco 'fintechbank' (se existir):" -ForegroundColor White
Write-Host "   docker exec -it pgdb psql -U postgres -d fintechbank" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Executar comando SQL direto:" -ForegroundColor White
Write-Host "   docker exec pgdb psql -U postgres -c 'SELECT version();'" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Entrar no shell interativo do container:" -ForegroundColor White
Write-Host "   docker exec -it pgdb bash" -ForegroundColor Gray
Write-Host "   Depois execute: psql -U postgres" -ForegroundColor Gray
Write-Host ""

# Tentar conectar diretamente
Write-Host "🚀 Tentando conectar ao banco 'postgres'..." -ForegroundColor Cyan
Write-Host "   (Pressione Ctrl+D ou digite \q para sair)" -ForegroundColor Gray
Write-Host ""

docker exec -it pgdb psql -U postgres
