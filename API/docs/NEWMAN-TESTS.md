# 🧪 Testes Newman - FintechBankApp

Este documento descreve como executar os testes automatizados usando Newman para validar todas as APIs da FintechBankApp, incluindo as funcionalidades administrativas.

## 📋 Pré-requisitos

### 1. Servidor Rodando
```bash
# No diretório /server
npm start
```

### 2. Newman Instalado
```bash
# Instalar Newman globalmente
npm install -g newman newman-reporter-html

# OU instalar localmente no projeto
npm install --save-dev newman newman-reporter-html
```

## 🚀 Executando os Testes

### Opção 1: Scripts NPM (Recomendado)

```bash
# Executar todos os testes
npm run test

# Executar apenas testes administrativos
npm run test:admin

# Executar com script JavaScript personalizado
npm run test:js

# Executar com script PowerShell (Windows)
npm run test:ps
```

### Opção 2: Newman Direto

```bash
# Todos os testes
newman run ../postman-collection.json --reporters cli,html,json

# Apenas testes administrativos
newman run ../postman-collection.json --folder "👨‍💼 ADMIN" --reporters cli,html,json

# Com configurações personalizadas
newman run ../postman-collection.json \
  --reporters cli,html,json \
  --reporter-html-export newman-report.html \
  --reporter-json-export newman-report.json \
  --timeout 30000 \
  --delay-request 500 \
  --insecure
```

### Opção 3: Scripts Personalizados

```bash
# Script JavaScript
node run-newman-tests.js

# Script PowerShell (Windows)
powershell -ExecutionPolicy Bypass -File run-newman-tests.ps1

# Script PowerShell com opções
powershell -ExecutionPolicy Bypass -File run-newman-tests.ps1 -OpenReport -Delay 1000
```

## 📊 Relatórios Gerados

Os testes geram relatórios em múltiplos formatos:

### 📄 HTML Report
- **Arquivo**: `newman-report.html` ou `newman-report-YYYYMMDD-HHMMSS.html`
- **Descrição**: Relatório visual completo com gráficos e detalhes
- **Uso**: Abrir no navegador para análise detalhada

### 📋 JSON Report
- **Arquivo**: `newman-report.json` ou `newman-report-YYYYMMDD-HHMMSS.json`
- **Descrição**: Dados estruturados para integração com outras ferramentas
- **Uso**: Análise programática ou integração CI/CD

### 🖥️ CLI Output
- **Descrição**: Saída em tempo real no terminal
- **Uso**: Feedback imediato durante a execução

## 🧪 Testes Incluídos

### 🔍 Diagnóstico
- ✅ Health Check
- ✅ Login Admin
- ✅ Login User

### 👤 Autenticação
- ✅ Cadastro de usuário
- ✅ Login de usuário
- ✅ Validação de token

### 💰 Operações Bancárias
- ✅ Consultar saldo
- ✅ Extrato de transações
- ✅ Transferências PIX
- ✅ Gerenciar contatos PIX
- ✅ Configurar limites

### 👨‍💼 Funcionalidades Administrativas
- ✅ **Listar usuários** - `GET /admin/users`
- ✅ **Consultar usuário** - `GET /admin/users/:cpf`
- ✅ **Depositar** - `POST /admin/users/:cpf/deposit`
- ✅ **Bloquear usuário** - `PUT /admin/users/:cpf/block`
- ✅ **Desbloquear usuário** - `PUT /admin/users/:cpf/unblock`
- 🆕 **Alterar limite PIX** - `PUT /admin/users/:cpf/pix-limit`
- 🆕 **Resetar senha** - `PUT /admin/users/:cpf/reset-password`
- 🆕 **Gerar senha temporária** - `POST /admin/users/:cpf/generate-temp-password`

## ⚙️ Configurações dos Testes

### Variáveis da Collection
```json
{
  "baseUrl": "http://localhost:3001/api/v1",
  "adminToken": "", // Preenchido automaticamente após login
  "userToken": ""   // Preenchido automaticamente após login
}
```

### Parâmetros Configuráveis
- **Timeout**: 30 segundos por request
- **Delay**: 500ms entre requests
- **Iterações**: 1 execução completa
- **Relatórios**: CLI + HTML + JSON

## 🔧 Troubleshooting

### Problema: Servidor não está rodando
```bash
# Solução: Iniciar o servidor
cd server
npm start
```

### Problema: Newman não encontrado
```bash
# Solução: Instalar Newman
npm install -g newman newman-reporter-html
```

### Problema: Testes falhando
1. Verificar se o servidor está saudável: `http://localhost:3001/health`
2. Verificar logs do servidor
3. Analisar o relatório HTML gerado
4. Verificar se as credenciais admin estão corretas

### Problema: Permissão PowerShell
```powershell
# Solução: Permitir execução de scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 📈 Interpretando os Resultados

### ✅ Sucesso Total