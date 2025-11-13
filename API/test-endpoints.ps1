# Script de Teste Estruturado dos Endpoints da API
# Executa validações por etapas sem afetar as lógicas existentes

Write-Host "🚀 Iniciando Validação Estruturada dos Endpoints da API" -ForegroundColor Green
Write-Host "=" * 60

$baseUrl = "http://localhost:3001/api/v1"
$adminToken = ""
$userToken = ""

# Função para fazer requisições com tratamento de erro
function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [string]$Description
    )
    
    Write-Host "`n🔍 $Description" -ForegroundColor Cyan
    Write-Host "   Método: $Method | URI: $Uri"
    
    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            ContentType = "application/json"
        }
        
        if ($Headers.Count -gt 0) { $params.Headers = $Headers }
        if ($Body) { $params.Body = $Body }
        
        $response = Invoke-RestMethod @params
        Write-Host "   ✅ Sucesso" -ForegroundColor Green
        return $response
    }
    catch {
        Write-Host "   ❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host "   📝 Detalhes: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
        }
        return $null
    }
}

# FASE 1: DIAGNÓSTICO E PREPARAÇÃO
Write-Host "`n📋 FASE 1: DIAGNÓSTICO E PREPARAÇÃO" -ForegroundColor Magenta
Write-Host "-" * 40

# 1.1 Health Check
$health = Invoke-ApiRequest -Method "GET" -Uri "$baseUrl/health" -Description "Health Check da API"

# 1.2 Login do Administrador
Write-Host "`n🔐 Fazendo login do administrador..." -ForegroundColor Yellow
$adminLoginBody = @{
    cpf = "00000000000"
    password = "admin123"
} | ConvertTo-Json

$adminResponse = Invoke-ApiRequest -Method "POST" -Uri "$baseUrl/auth/login" -Body $adminLoginBody -Description "Login do Administrador"
if ($adminResponse) {
    $adminToken = $adminResponse.token
    $adminHeaders = @{ "Authorization" = "Bearer $adminToken" }
    Write-Host "   🎫 Token obtido com sucesso" -ForegroundColor Green
}

# 1.3 Verificação das Tabelas (apenas se admin logado)
if ($adminToken) {
    $tables = Invoke-ApiRequest -Method "GET" -Uri "$baseUrl/debug/tables" -Headers $adminHeaders -Description "Verificação das Tabelas do Banco"
}

# 1.4 Login do Usuário de Teste
Write-Host "`n👤 Fazendo login do usuário de teste..." -ForegroundColor Yellow
$userLoginBody = @{
    cpf = "12345678901"
    password = "123456"
} | ConvertTo-Json

$userResponse = Invoke-ApiRequest -Method "POST" -Uri "$baseUrl/auth/login" -Body $userLoginBody -Description "Login do Usuário de Teste"
if ($userResponse) {
    $userToken = $userResponse.token
    $userHeaders = @{ "Authorization" = "Bearer $userToken" }
    Write-Host "   🎫 Token obtido com sucesso" -ForegroundColor Green
}

# FASE 2: VALIDAÇÃO POR CATEGORIA
Write-Host "`n📊 FASE 2: VALIDAÇÃO POR CATEGORIA" -ForegroundColor Magenta
Write-Host "-" * 40

# 2.1 Endpoints de Usuário (apenas se user logado)
if ($userToken) {
    Write-Host "`n👤 2.1 ENDPOINTS DE USUÁRIO" -ForegroundColor Blue
    
    # Debug do usuário
    if ($adminToken) {
        Invoke-ApiRequest -Method "GET" -Uri "$baseUrl/debug/user/12345678901" -Headers $adminHeaders -Description "Debug do Usuário de Teste"
    }
    
    # Consulta de saldo
    Invoke-ApiRequest -Method "GET" -Uri "$baseUrl/users/12345678901/balance" -Headers $userHeaders -Description "Consulta de Saldo"
    
    # Extrato
    Invoke-ApiRequest -Method "GET" -Uri "$baseUrl/users/12345678901/statement" -Headers $userHeaders -Description "Consulta de Extrato"
}

# 2.2 Endpoints PIX (apenas se user logado)
if ($userToken) {
    Write-Host "`n💰 2.2 ENDPOINTS PIX" -ForegroundColor Blue
    
    # Listar contatos PIX
    Invoke-ApiRequest -Method "GET" -Uri "$baseUrl/pix/contacts/12345678901" -Headers $userHeaders -Description "Listar Contatos PIX"
    
    # Adicionar contato PIX
    $contactBody = @{
        key = "11999887766"
        name = "João Silva"
    } | ConvertTo-Json
    
    Invoke-ApiRequest -Method "POST" -Uri "$baseUrl/pix/contacts/12345678901" -Headers $userHeaders -Body $contactBody -Description "Adicionar Contato PIX"
    
    # Listar contatos PIX novamente
    Invoke-ApiRequest -Method "GET" -Uri "$baseUrl/pix/contacts/12345678901" -Headers $userHeaders -Description "Listar Contatos PIX (após adição)"
}

# 2.3 Endpoints Admin (apenas se admin logado)
if ($adminToken) {
    Write-Host "`n👨‍💼 2.3 ENDPOINTS ADMIN" -ForegroundColor Blue
    
    # Listar usuários
    Invoke-ApiRequest -Method "GET" -Uri "$baseUrl/admin/users" -Headers $adminHeaders -Description "Listar Usuários (Admin)"
    
    # Consultar usuário específico
    Invoke-ApiRequest -Method "GET" -Uri "$baseUrl/admin/users/12345678901" -Headers $adminHeaders -Description "Consultar Usuário Específico (Admin)"
}

Write-Host "`n🏁 VALIDAÇÃO CONCLUÍDA" -ForegroundColor Green
Write-Host "=" * 60
Write-Host "📝 Verifique os logs do servidor para detalhes dos erros encontrados."