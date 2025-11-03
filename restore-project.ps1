# Script para restaurar o projeto FintechBankApp
Write-Host "🔧 Restaurando projeto FintechBankApp..." -ForegroundColor Cyan

# 1. Fazer backup do swagger atual
Write-Host "📦 Fazendo backup do swagger atual..." -ForegroundColor Yellow
if (Test-Path "server\swagger.yaml") {
    Copy-Item "server\swagger.yaml" "server\swagger-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').yaml"
}

# 2. Criar swagger limpo
Write-Host "✨ Criando swagger.yaml limpo..." -ForegroundColor Green
@"
openapi: 3.0.0
info:
  title: FintechBankApp API
  description: API completa para o sistema bancário FintechBankApp
  version: 1.0.0
  contact:
    name: FintechBankApp Team
    email: support@fintechbankapp.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: http://localhost:3001
    description: Servidor de desenvolvimento

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
          description: ID único do usuário
          example: 1
        fullName:
          type: string
          description: Nome completo do usuário
          example: "João da Silva"
        cpf:
          type: string
          description: CPF do usuário
          example: "12345678901"
        email:
          type: string
          format: email
          description: Email do usuário
          example: "joao.silva@example.com"
        balance:
          type: number
          format: float
          description: Saldo atual da conta
          example: 1500.75
        pixDailyLimit:
          type: number
          format: float
          description: Limite diário para PIX
          example: 1000.00
        isBlocked:
          type: boolean
          description: Status de bloqueio do usuário
          example: false
        role:
          type: string
          enum: [customer, admin]
          description: Papel do usuário no sistema
          example: "customer"

    LoginRequest:
      type: object
      required:
        - cpf
        - password
      properties:
        cpf:
          type: string
          pattern: '^[0-9]{11}$'
          description: CPF com 11 dígitos
          example: "12345678901"
        password:
          type: string
          minLength: 6
          example: "MinhaSenh@123"

    AuthResponse:
      type: object
      properties:
        success:
          type: boolean
          example: true
        message:
          type: string
          example: "Login realizado com sucesso"
        user:
          `$ref: '#/components/schemas/User'
        token:
          type: string
          example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

    SuccessResponse:
      type: object
      properties:
        success:
          type: boolean
          example: true
        message:
          type: string
          example: "Operação realizada com sucesso"

    ErrorResponse:
      type: object
      properties:
        success:
          type: boolean
          example: false
        message:
          type: string
          example: "Erro na operação"

paths:
  /health:
    get:
      tags:
        - Sistema
      summary: Health Check
      description: Verifica se a API está funcionando
      responses:
        '200':
          description: API funcionando
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: "OK"
                  timestamp:
                    type: string
                    example: "2024-03-20T10:30:00Z"

  /auth/login:
    post:
      tags:
        - Autenticação
      summary: Fazer login
      description: Autentica um usuário no sistema
      requestBody:
        required: true
        content:
          application/json:
            schema:
              `$ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: Login realizado com sucesso
          content:
            application/json:
              schema:
                `$ref: '#/components/schemas/AuthResponse'
        '400':
          description: Dados inválidos
          content:
            application/json:
              schema:
                `$ref: '#/components/schemas/ErrorResponse'
        '401':
          description: Credenciais inválidas
          content:
            application/json:
              schema:
                `$ref: '#/components/schemas/ErrorResponse'

  /users/{cpf}:
    get:
      tags:
        - Usuários
      summary: Consultar usuário
      description: Retorna os dados de um usuário
      parameters:
        - name: cpf
          in: path
          required: true
          schema:
            type: string
            pattern: '^[0-9]{11}$'
          description: CPF do usuário
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Dados do usuário
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  user:
                    `$ref: '#/components/schemas/User'

  /admin/users:
    get:
      tags:
        - Administração
      summary: Listar usuários (Admin)
      description: Lista todos os usuários (apenas administradores)
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Lista de usuários
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  users:
                    type: array
                    items:
                      `$ref: '#/components/schemas/User'

  /admin/users/{cpf}/deposit:
    post:
      tags:
        - Administração
      summary: Fazer depósito (Admin)
      description: Realiza um depósito na conta do usuário (apenas administradores)
      parameters:
        - name: cpf
          in: path
          required: true
          schema:
            type: string
            pattern: '^[0-9]{11}$'
          description: CPF do usuário
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - amount
              properties:
                amount:
                  type: number
                  format: float
                  minimum: 0.01
                  description: Valor do depósito
                  example: 500.00
      responses:
        '200':
          description: Depósito realizado com sucesso

  /admin/users/{cpf}/block:
    put:
      tags:
        - Administração
      summary: Bloquear usuário (Admin)
      description: Bloqueia um usuário (apenas administradores)
      parameters:
        - name: cpf
          in: path
          required: true
          schema:
            type: string
            pattern: '^[0-9]{11}$'
          description: CPF do usuário
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Usuário bloqueado com sucesso

  /admin/users/{cpf}/unblock:
    put:
      tags:
        - Administração
      summary: Desbloquear usuário (Admin)
      description: Desbloqueia um usuário (apenas administradores)
      parameters:
        - name: cpf
          in: path
          required: true
          schema:
            type: string
            pattern: '^[0-9]{11}$'
          description: CPF do usuário
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Usuário desbloqueado com sucesso

  /admin/users/{cpf}/pix-limit:
    put:
      tags:
        - Administração
      summary: Alterar limite PIX (Admin)
      description: Altera o limite diário PIX de um usuário (apenas administradores)
      parameters:
        - name: cpf
          in: path
          required: true
          schema:
            type: string
            pattern: '^[0-9]{11}$'
          description: CPF do usuário
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - newLimit
              properties:
                newLimit:
                  type: number
                  format: float
                  minimum: 0
                  description: Novo limite diário PIX
                  example: 2000.00
      responses:
        '200':
          description: Limite alterado com sucesso

  /admin/users/{cpf}/reset-password:
    put:
      tags:
        - Administração
      summary: Resetar senha (Admin)
      description: Reseta a senha de um usuário (apenas administradores)
      parameters:
        - name: cpf
          in: path
          required: true
          schema:
            type: string
            pattern: '^[0-9]{11}$'
          description: CPF do usuário
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - newPassword
              properties:
                newPassword:
                  type: string
                  minLength: 6
                  maxLength: 12
                  description: Nova senha
                  example: "nova123"
      responses:
        '200':
          description: Senha resetada com sucesso

  /admin/users/{cpf}/generate-temp-password:
    post:
      tags:
        - Administração
      summary: Gerar senha temporária (Admin)
      description: Gera uma senha temporária para um usuário (apenas administradores)
      parameters:
        - name: cpf
          in: path
          required: true
          schema:
            type: string
            pattern: '^[0-9]{11}$'
          description: CPF do usuário
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Senha temporária gerada com sucesso
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  message:
                    type: string
                    example: "Senha temporária gerada com sucesso"
                  tempPassword:
                    type: string
                    example: "temp1234"
"@ | Out-File -FilePath "server\swagger.yaml" -Encoding UTF8

# 3. Verificar se o servidor pode iniciar
Write-Host "🚀 Testando se o servidor pode iniciar..." -ForegroundColor Blue
Set-Location server
$testProcess = Start-Process -FilePath "node" -ArgumentList "server.js" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 3

if ($testProcess.HasExited -eq $false) {
    Write-Host "✅ Servidor iniciou com sucesso!" -ForegroundColor Green
    Stop-Process -Id $testProcess.Id -Force
} else {
    Write-Host "❌ Erro ao iniciar servidor. Verificando logs..." -ForegroundColor Red
}

# 4. Instalar dependências Newman se necessário
Write-Host "📦 Verificando dependências Newman..." -ForegroundColor Yellow
if (-not (Get-Command newman -ErrorAction SilentlyContinue)) {
    Write-Host "Instalando Newman globalmente..." -ForegroundColor Yellow
    npm install -g newman newman-reporter-html
}

# 5. Instalar dependências locais
Write-Host "📦 Instalando dependências locais..." -ForegroundColor Yellow
npm install newman newman-reporter-html --save-dev

Write-Host "🎉 Restauração concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Execute: cd server && npm start" -ForegroundColor White
Write-Host "2. Teste a API: http://localhost:3001/health" -ForegroundColor White
Write-Host "3. Execute os testes Newman: npm run test" -ForegroundColor White
Write-Host "4. Acesse a documentação: http://localhost:3001/api-docs" -ForegroundColor White