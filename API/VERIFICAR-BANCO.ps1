# Script para verificar se o banco está configurado corretamente

Write-Host "🔍 Verificando banco de dados 'fintech'..." -ForegroundColor Cyan
Write-Host ""

# Verificar se o banco existe
Write-Host "1. Verificando se o banco existe..." -ForegroundColor Yellow
$dbExists = docker exec pgdb psql -U postgres -c "\l" | Select-String -Pattern "fintech"
if ($dbExists) {
    Write-Host "   ✅ Banco 'fintech' existe" -ForegroundColor Green
} else {
    Write-Host "   ❌ Banco 'fintech' não existe!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Verificar schemas
Write-Host "2. Verificando schemas..." -ForegroundColor Yellow
docker exec pgdb psql -U postgres -d fintech -c "\dn"

Write-Host ""

# Verificar tabelas
Write-Host "3. Verificando tabelas no schema 'fintech'..." -ForegroundColor Yellow
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"

Write-Host ""

# Verificar usuário admin
Write-Host "4. Verificando usuário admin..." -ForegroundColor Yellow
docker exec pgdb psql -U postgres -d fintech -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"

Write-Host ""
Write-Host "✅ Banco configurado corretamente!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Agora você pode iniciar a API com:" -ForegroundColor Cyan
Write-Host "   npm run dev" -ForegroundColor Yellow
