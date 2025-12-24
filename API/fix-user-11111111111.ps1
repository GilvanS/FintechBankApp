# Script PowerShell para corrigir usuário 11111111111 via API
# Requer servidor rodando em http://localhost:3001

$baseUrl = "http://localhost:3001"
$adminCpf = "99999999999"
$adminPassword = "admin999"
$targetCpf = "11111111111"
$targetPassword = "admin999"

Write-Host "🔧 Corrigindo usuário via API..." -ForegroundColor Cyan
Write-Host "📍 URL da API: $baseUrl" -ForegroundColor Gray
Write-Host "👤 CPF do usuário a corrigir: $targetCpf" -ForegroundColor Gray
Write-Host ""

# 1. Login como admin
Write-Host "1️⃣ Fazendo login como administrador..." -ForegroundColor Yellow
try {
    $loginBody = @{
        cpf = $adminCpf
        password = $adminPassword
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/login" -Method POST -ContentType "application/json" -Body $loginBody

    if ($loginResponse.success) {
        $adminToken = $loginResponse.token
        Write-Host "✅ Login admin bem-sucedido" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "❌ Falha no login admin: $($loginResponse.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erro ao fazer login:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host $responseBody -ForegroundColor Red
    }
    exit 1
}

# 2. Verificar usuário atual
Write-Host "2️⃣ Verificando status atual do usuário..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $adminToken"
    }
    $userResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/admin/users/$targetCpf" -Method GET -Headers $headers

    if ($userResponse.success -and $userResponse.user) {
        $user = $userResponse.user
        Write-Host "✅ Usuário encontrado:" -ForegroundColor Green
        Write-Host "   Nome: $($user.fullName)" -ForegroundColor Gray
        Write-Host "   Email: $($user.email)" -ForegroundColor Gray
        Write-Host "   Status: $(if ($user.isBlocked) { '❌ BLOQUEADO' } else { '✅ ATIVO' })" -ForegroundColor $(if ($user.isBlocked) { 'Red' } else { 'Green' })
        Write-Host "   Tentativas de login: $($user.loginAttempts)" -ForegroundColor Gray
    }
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "⚠️ Usuário não encontrado" -ForegroundColor Yellow
    } else {
        Write-Host "⚠️ Erro ao verificar usuário: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}
Write-Host ""

# 3. Corrigir usuário usando o novo endpoint
Write-Host "3️⃣ Corrigindo usuário (desbloquear + resetar senha)..." -ForegroundColor Yellow
try {
    $fixBody = @{
        password = $targetPassword
    } | ConvertTo-Json

    $headers = @{
        "Authorization" = "Bearer $adminToken"
    }

    $fixResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/admin/users/$targetCpf/fix" -Method POST -ContentType "application/json" -Body $fixBody -Headers $headers

    if ($fixResponse.success) {
        Write-Host "✅ Usuário corrigido com sucesso!" -ForegroundColor Green
        Write-Host "📋 Mensagem: $($fixResponse.message)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        Write-Host "✅ CORREÇÃO CONCLUÍDA!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Credenciais do usuário:" -ForegroundColor Cyan
        Write-Host "   CPF: $targetCpf" -ForegroundColor White
        Write-Host "   Senha: $targetPassword" -ForegroundColor White
        Write-Host ""
        Write-Host "💡 Agora você pode testar o login:" -ForegroundColor Cyan
        Write-Host "   curl -X POST $baseUrl/api/v1/auth/login \`" -ForegroundColor Gray
        Write-Host "     -H `"Content-Type: application/json`" \`" -ForegroundColor Gray
        Write-Host "     -d '{\"cpf\":\"$targetCpf\",\"password\":\"$targetPassword\"}'" -ForegroundColor Gray
    } else {
        Write-Host "❌ Falha ao corrigir: $($fixResponse.message)" -ForegroundColor Red
    }
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "⚠️ Endpoint /fix não encontrado. Tentando método alternativo..." -ForegroundColor Yellow
        Write-Host ""
        
        # Método alternativo: unblock + generate-temp-password
        Write-Host "🔄 Usando método alternativo: unblock + generate-temp-password" -ForegroundColor Yellow
        
        # Desbloquear
        Write-Host "   Desbloqueando usuário..." -ForegroundColor Gray
        try {
            Invoke-RestMethod -Uri "$baseUrl/api/v1/admin/users/$targetCpf/unblock" -Method POST -Headers $headers | Out-Null
            Write-Host "   ✅ Usuário desbloqueado" -ForegroundColor Green
        } catch {
            Write-Host "   ❌ Erro ao desbloquear: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        # Gerar senha temporária
        Write-Host "   Gerando senha temporária..." -ForegroundColor Gray
        try {
            $tempResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/admin/users/$targetCpf/generate-temp-password" -Method POST -Headers $headers
            
            if ($tempResponse.success) {
                Write-Host "   ✅ Senha temporária gerada: $($tempResponse.tempPassword)" -ForegroundColor Green
                Write-Host ""
                Write-Host "⚠️ NOTA: A senha temporária gerada é '$($tempResponse.tempPassword)'" -ForegroundColor Yellow
                Write-Host "   Para usar '$targetPassword', você precisará fazer reset de senha via API" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   ❌ Erro ao gerar senha: $($_.Exception.Message)" -ForegroundColor Red
            if ($_.Exception.Response) {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                Write-Host "   Detalhes: $responseBody" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "❌ Erro HTTP: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "   Detalhes: $responseBody" -ForegroundColor Red
        }
    }
}

Write-Host ""
