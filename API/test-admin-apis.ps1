# Script para testar as novas APIs administrativas
# Execute este script após iniciar o servidor (npm start)

$baseUrl = "http://localhost:3001"
$adminToken = ""

Write-Host "=== TESTE DAS NOVAS APIs ADMINISTRATIVAS ===" -ForegroundColor Green
Write-Host ""

# 1. Login como administrador
Write-Host "1. Fazendo login como administrador..." -ForegroundColor Yellow
$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -ContentType "application/json" -Body (@{
    cpf = "00000000000"
    password = "admin123"
} | ConvertTo-Json)

if ($loginResponse.success) {
    $adminToken = $loginResponse.token
    Write-Host "✓ Login realizado com sucesso" -ForegroundColor Green
    Write-Host "Token: $adminToken" -ForegroundColor Cyan
} else {
    Write-Host "✗ Falha no login: $($loginResponse.message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 2. Buscar um usuário para testar
Write-Host "2. Buscando usuário de teste (CPF: 12345678901)..." -ForegroundColor Yellow
try {
    $userResponse = Invoke-RestMethod -Uri "$baseUrl/admin/users/12345678901" -Method GET -Headers @{
        "Authorization" = "Bearer $adminToken"
    }
    
    if ($userResponse.success) {
        Write-Host "✓ Usuário encontrado: $($userResponse.user.fullName)" -ForegroundColor Green
        Write-Host "  Saldo atual: R$ $($userResponse.user.balance)" -ForegroundColor Cyan
        Write-Host "  Limite PIX atual: R$ $($userResponse.user.pixDailyLimit)" -ForegroundColor Cyan
        Write-Host "  Status: $($userResponse.user.isBlocked ? 'Bloqueado' : 'Ativo')" -ForegroundColor Cyan
    } else {
        Write-Host "✗ Usuário não encontrado: $($userResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Erro ao buscar usuário: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 3. Testar alteração de limite PIX
Write-Host "3. Testando alteração de limite PIX..." -ForegroundColor Yellow
try {
    $limitResponse = Invoke-RestMethod -Uri "$baseUrl/admin/users/12345678901/pix-limit" -Method PUT -ContentType "application/json" -Headers @{
        "Authorization" = "Bearer $adminToken"
    } -Body (@{
        newLimit = 2000.00
    } | ConvertTo-Json)
    
    if ($limitResponse.success) {
        Write-Host "✓ Limite PIX alterado com sucesso" -ForegroundColor Green
        Write-Host "  Novo limite: R$ $($limitResponse.user.pixDailyLimit)" -ForegroundColor Cyan
    } else {
        Write-Host "✗ Falha ao alterar limite: $($limitResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Erro ao alterar limite PIX: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 4. Testar reset de senha
Write-Host "4. Testando reset de senha..." -ForegroundColor Yellow
try {
    $resetResponse = Invoke-RestMethod -Uri "$baseUrl/admin/users/12345678901/reset-password" -Method PUT -ContentType "application/json" -Headers @{
        "Authorization" = "Bearer $adminToken"
    } -Body (@{
        newPassword = "nova123"
    } | ConvertTo-Json)
    
    if ($resetResponse.success) {
        Write-Host "✓ Senha resetada com sucesso" -ForegroundColor Green
        Write-Host "  Nova senha: nova123" -ForegroundColor Cyan
    } else {
        Write-Host "✗ Falha ao resetar senha: $($resetResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Erro ao resetar senha: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 5. Testar geração de senha temporária
Write-Host "5. Testando geração de senha temporária..." -ForegroundColor Yellow
try {
    $tempResponse = Invoke-RestMethod -Uri "$baseUrl/admin/users/12345678901/generate-temp-password" -Method POST -Headers @{
        "Authorization" = "Bearer $adminToken"
    }
    
    if ($tempResponse.success) {
        Write-Host "✓ Senha temporária gerada com sucesso" -ForegroundColor Green
        Write-Host "  Senha temporária: $($tempResponse.tempPassword)" -ForegroundColor Cyan
        Write-Host "  Usuário deve alterar no próximo login" -ForegroundColor Yellow
    } else {
        Write-Host "✗ Falha ao gerar senha temporária: $($tempResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Erro ao gerar senha temporária: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 6. Verificar estado final do usuário
Write-Host "6. Verificando estado final do usuário..." -ForegroundColor Yellow
try {
    $finalUserResponse = Invoke-RestMethod -Uri "$baseUrl/admin/users/12345678901" -Method GET -Headers @{
        "Authorization" = "Bearer $adminToken"
    }
    
    if ($finalUserResponse.success) {
        Write-Host "✓ Estado final do usuário:" -ForegroundColor Green
        Write-Host "  Nome: $($finalUserResponse.user.fullName)" -ForegroundColor Cyan
        Write-Host "  Saldo: R$ $($finalUserResponse.user.balance)" -ForegroundColor Cyan
        Write-Host "  Limite PIX: R$ $($finalUserResponse.user.pixDailyLimit)" -ForegroundColor Cyan
        Write-Host "  Status: $($finalUserResponse.user.isBlocked ? 'Bloqueado' : 'Ativo')" -ForegroundColor Cyan
        Write-Host "  Reset de senha solicitado: $($finalUserResponse.user.passwordResetRequested ? 'Sim' : 'Não')" -ForegroundColor Cyan
    } else {
        Write-Host "✗ Erro ao verificar estado final: $($finalUserResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Erro ao verificar estado final: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== TESTE CONCLUÍDO ===" -ForegroundColor Green
Write-Host "Todas as novas APIs administrativas foram testadas!" -ForegroundColor Cyan