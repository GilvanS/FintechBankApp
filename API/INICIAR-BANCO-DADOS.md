# 🗄️ Guia Completo - Iniciar Docker e Configurar Banco de Dados

Este guia explica como iniciar o Docker e configurar o banco de dados PostgreSQL do FintechBankApp, tanto na **primeira vez** quanto quando precisar **recriar do zero**.

---

## 📋 Índice

1. [Primeira Vez - Setup Inicial](#primeira-vez---setup-inicial)
2. [Recriar do Zero - Quando Banco ou Docker Foram Deletados](#recriar-do-zero---quando-banco-ou-docker-foram-deletados)
3. [Scripts Completos para Gerar Schemas](#-scripts-completos-para-gerar-schemas)
   - [Script PowerShell (.ps1)](#-script-powershell-ps1)
   - [Script Bash (Git Bash / Linux / macOS)](#-script-bash-git-bash--linux--macos)
   - [Script CMD (Windows Command Prompt)](#-script-cmd-windows-command-prompt)
   - [Script PowerShell (Linha de Comando)](#-script-powershell-linha-de-comando)
4. [Configuração do .env](#configuração-do-env)
5. [Verificar se Está Funcionando](#verificar-se-está-funcionando)
6. [Troubleshooting](#troubleshooting)

---

## 🚀 Primeira Vez - Setup Inicial

### Pré-requisitos

- ✅ Docker instalado e rodando
- ✅ PowerShell ou Git Bash
- ✅ Arquivos SQL na pasta `API/`

### Informações do Banco

- **Container**: `pgdb`
- **Imagem**: `postgres:trixie`
- **Porta**: `5432`
- **Usuário**: `postgres`
- **Senha**: `pwd123`
- **Banco de Dados**: `fintech`
- **Schema**: `fintech`

---

### Opção 1: Script Automatizado (Recomendado) ⚡

Execute o script PowerShell que faz tudo automaticamente:

```powershell
cd API
.\RECRIAR-BANCO.ps1
```

O script executa automaticamente:
- ✅ Para e remove containers antigos (se existirem)
- ✅ Inicia PostgreSQL no Docker
- ✅ Aguarda o banco inicializar completamente
- ✅ Cria o banco de dados `fintech`
- ✅ Cria o schema `fintech`
- ✅ Executa todos os scripts SQL necessários
- ✅ Verifica se tudo foi criado corretamente

**Tempo estimado**: 2-3 minutos

---

### Opção 2: Passo a Passo Manual 📝

Se preferir fazer manualmente ou entender cada etapa:

#### 1. Ir para a pasta API

```powershell
cd API
```

#### 2. Iniciar PostgreSQL no Docker

```powershell
docker-compose up -d database
```

**Aguarde 15-20 segundos** para o PostgreSQL inicializar completamente.

#### 3. Criar o banco de dados

```powershell
docker exec pgdb psql -U postgres -c "CREATE DATABASE fintech;"
```

#### 4. Criar o schema 'fintech'

```powershell
docker exec pgdb psql -U postgres -d fintech -c "CREATE SCHEMA IF NOT EXISTS fintech;"
```

#### 5. Executar script principal (cria todas as tabelas)

```powershell
Get-Content "schema_pg_fintech.sql" | docker exec -i pgdb psql -U postgres -d fintech
```

#### 6. Executar migrações adicionais (se existirem)

```powershell
# Migração para ciclo de vida de faturas (opcional)
if (Test-Path "schema_invoice_lifecycle.sql") {
    Get-Content "schema_invoice_lifecycle.sql" | docker exec -i pgdb psql -U postgres -d fintech
}

# Migração para valores padrão de signup (opcional)
if (Test-Path "migration_update_signup_defaults.sql") {
    Get-Content "migration_update_signup_defaults.sql" | docker exec -i pgdb psql -U postgres -d fintech
}
```

#### 7. Verificar se foi criado corretamente

```powershell
# Listar todas as tabelas
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"
```

---

## 🔄 Recriar do Zero - Quando Banco ou Docker Foram Deletados

Use esta seção quando:
- ❌ O banco de dados foi deletado
- ❌ Os containers Docker foram removidos
- ❌ Você precisa começar do zero novamente
- ❌ Há erros persistentes e quer recriar tudo

### ⚠️ ATENÇÃO: Isso apagará TODOS os dados!

---

### Opção 1: Script Automatizado (Recomendado) ⚡

Execute o script que faz tudo automaticamente:

```powershell
cd API
.\RECRIAR-BANCO.ps1
```

O script:
- ✅ Para e remove containers e volumes antigos
- ✅ Remove todos os dados existentes
- ✅ Recria tudo do zero
- ✅ Executa todos os scripts SQL
- ✅ Verifica se está tudo funcionando

**Tempo estimado**: 2-3 minutos

---

### Opção 2: Passo a Passo Manual 📝

#### 1. Ir para a pasta API

```powershell
cd API
```

#### 2. Parar e remover containers e volumes

```powershell
docker-compose down -v
```

Isso remove:
- Todos os containers PostgreSQL
- Todos os volumes (dados do banco)
- Todas as configurações de rede

#### 3. Aguardar um momento

```powershell
Start-Sleep -Seconds 5
```

#### 4. Iniciar PostgreSQL

```powershell
docker-compose up -d database
```

#### 5. Aguardar banco inicializar (CRÍTICO!)

```powershell
Start-Sleep -Seconds 20
```

**⚠️ IMPORTANTE**: Não pule este passo! O PostgreSQL precisa de tempo para inicializar completamente.

#### 6. Criar banco de dados

```powershell
docker exec pgdb psql -U postgres -c "DROP DATABASE IF EXISTS fintech;" 2>$null
docker exec pgdb psql -U postgres -c "CREATE DATABASE fintech;"
```

#### 7. Criar schema 'fintech'

```powershell
docker exec pgdb psql -U postgres -d fintech -c "CREATE SCHEMA IF NOT EXISTS fintech;"
```

#### 8. Executar script principal

```powershell
Get-Content "schema_pg_fintech.sql" | docker exec -i pgdb psql -U postgres -d fintech
```

#### 9. Executar migrações adicionais (se existirem)

```powershell
# Migração para ciclo de vida de faturas
if (Test-Path "schema_invoice_lifecycle.sql") {
    Get-Content "schema_invoice_lifecycle.sql" | docker exec -i pgdb psql -U postgres -d fintech
}

# Migração para valores padrão de signup
if (Test-Path "migration_update_signup_defaults.sql") {
    Get-Content "migration_update_signup_defaults.sql" | docker exec -i pgdb psql -U postgres -d fintech
}
```

#### 10. Criar tabela products (se necessário)

```powershell
docker exec pgdb psql -U postgres -d fintech -c "CREATE TABLE IF NOT EXISTS fintech.products (id VARCHAR(255) NOT NULL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(15,2) NOT NULL, image_url TEXT);"
```

#### 11. Verificar se foi criado corretamente

```powershell
# Listar todas as tabelas
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"
```

---

## 📜 Scripts Completos para Gerar Schemas

Abaixo estão os scripts completos para executar o processo de criação do banco de dados e schemas. Escolha o formato que preferir:

---

### 🔷 Script PowerShell (.ps1)

Salve como `RECRIAR-BANCO.ps1` na pasta `API/`:

```powershell
# Script PowerShell para Recriar Banco de Dados PostgreSQL do Zero
# ⚠️ ATENÇÃO: Isso apagará TODOS os dados do banco!

Write-Host ""
Write-Host "🔄 RECRIAR BANCO DE DADOS POSTGRESQL - FintechBankApp" -ForegroundColor Cyan
Write-Host "⚠️  ATENÇÃO: Isso apagará TODOS os dados!" -ForegroundColor Yellow
Write-Host ""

# Verificar se está na pasta API
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "❌ Erro: Execute este script na pasta API/" -ForegroundColor Red
    Write-Host "   Diretório atual: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

Write-Host "📁 Diretório: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# Passo 1: Parar e remover containers e volumes
Write-Host "🛑 Passo 1: Parando e removendo containers e volumes..." -ForegroundColor Yellow
docker-compose down -v 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Alguns containers podem não ter sido encontrados (normal se for primeira vez)" -ForegroundColor Yellow
}
Write-Host "✅ Containers e volumes removidos" -ForegroundColor Green
Write-Host ""

# Aguardar um momento
Write-Host "⏳ Aguardando 5 segundos..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Passo 2: Iniciar PostgreSQL
Write-Host "🚀 Passo 2: Iniciando PostgreSQL..." -ForegroundColor Yellow
docker-compose up -d database
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao iniciar PostgreSQL" -ForegroundColor Red
    exit 1
}
Write-Host "✅ PostgreSQL iniciado" -ForegroundColor Green
Write-Host ""

# Passo 3: Aguardar banco inicializar (IMPORTANTE!)
Write-Host "⏳ Passo 3: Aguardando PostgreSQL inicializar completamente (20 segundos)..." -ForegroundColor Yellow
Write-Host "   (Este passo é CRÍTICO - não pule!)" -ForegroundColor Yellow
Start-Sleep -Seconds 20
Write-Host "✅ Aguardamento concluído" -ForegroundColor Green
Write-Host ""

# Passo 4: Criar banco de dados
Write-Host "📦 Passo 4: Criando banco de dados 'fintech'..." -ForegroundColor Yellow
docker exec pgdb psql -U postgres -c "DROP DATABASE IF EXISTS fintech;" 2>$null
docker exec pgdb psql -U postgres -c "CREATE DATABASE fintech;"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao criar banco de dados" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Banco 'fintech' criado" -ForegroundColor Green
Write-Host ""

# Passo 5: Criar schema 'fintech'
Write-Host "📋 Passo 5: Criando schema 'fintech'..." -ForegroundColor Yellow
docker exec pgdb psql -U postgres -d fintech -c "CREATE SCHEMA IF NOT EXISTS fintech;"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao criar schema" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Schema 'fintech' criado" -ForegroundColor Green
Write-Host ""

# Passo 6: Verificar se arquivos SQL existem
Write-Host "📄 Passo 6: Verificando arquivos SQL..." -ForegroundColor Yellow
$sqlFiles = @(
    "schema_pg_fintech.sql",
    "schema_invoice_lifecycle.sql",
    "migration_update_signup_defaults.sql"
)

foreach ($file in $sqlFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "⚠️  Arquivo não encontrado: $file" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Arquivo encontrado: $file" -ForegroundColor Green
    }
}
Write-Host ""

# Passo 7: Executar script principal
Write-Host "🔧 Passo 7: Executando script principal (schema_pg_fintech.sql)..." -ForegroundColor Yellow
if (Test-Path "schema_pg_fintech.sql") {
    Get-Content "schema_pg_fintech.sql" | docker exec -i pgdb psql -U postgres -d fintech
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao executar schema_pg_fintech.sql" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Script principal executado" -ForegroundColor Green
} else {
    Write-Host "⚠️  Arquivo schema_pg_fintech.sql não encontrado, pulando..." -ForegroundColor Yellow
}
Write-Host ""

# Passo 8: Executar migrações
Write-Host "🔄 Passo 8: Executando migrações..." -ForegroundColor Yellow

if (Test-Path "schema_invoice_lifecycle.sql") {
    Write-Host "   Executando schema_invoice_lifecycle.sql..." -ForegroundColor Cyan
    Get-Content "schema_invoice_lifecycle.sql" | docker exec -i pgdb psql -U postgres -d fintech
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ schema_invoice_lifecycle.sql executado" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Erro ao executar schema_invoice_lifecycle.sql (pode ser normal se já foi executado)" -ForegroundColor Yellow
    }
}

if (Test-Path "migration_update_signup_defaults.sql") {
    Write-Host "   Executando migration_update_signup_defaults.sql..." -ForegroundColor Cyan
    Get-Content "migration_update_signup_defaults.sql" | docker exec -i pgdb psql -U postgres -d fintech
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ migration_update_signup_defaults.sql executado" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Erro ao executar migration_update_signup_defaults.sql (pode ser normal se já foi executado)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Passo 9: Criar tabela products (se não existir)
Write-Host "📦 Passo 9: Criando tabela 'products' (se não existir)..." -ForegroundColor Yellow
docker exec pgdb psql -U postgres -d fintech -c "CREATE TABLE IF NOT EXISTS fintech.products (id VARCHAR(255) NOT NULL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(15,2) NOT NULL, image_url TEXT);"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Tabela 'products' verificada/criada" -ForegroundColor Green
} else {
    Write-Host "⚠️  Erro ao criar tabela 'products' (pode já existir)" -ForegroundColor Yellow
}
Write-Host ""

# Passo 10: Verificar tabelas criadas
Write-Host "✅ Passo 10: Verificando tabelas criadas..." -ForegroundColor Yellow
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"
Write-Host ""

# Passo 11: Verificar usuário admin
Write-Host "👤 Passo 11: Verificando usuário admin..." -ForegroundColor Yellow
docker exec pgdb psql -U postgres -d fintech -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"
Write-Host ""

# Resumo final
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "SUCCESS: BANCO DE DADOS RECRIADO COM SUCESSO!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Yellow
Write-Host "   1. Configure o arquivo .env com:" -ForegroundColor White
Write-Host "      DB_PROVIDER=postgres" -ForegroundColor Gray
Write-Host "      DB_HOST=localhost" -ForegroundColor Gray
Write-Host "      DB_PORT=5432" -ForegroundColor Gray
Write-Host "      DB_USER=postgres" -ForegroundColor Gray
Write-Host "      DB_PASS=pwd123" -ForegroundColor Gray
Write-Host "      DB_NAME=fintech" -ForegroundColor Gray
Write-Host "      DB_SCHEMA=fintech" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Inicie a API:" -ForegroundColor White
Write-Host "      npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "   3. A API criara automaticamente o usuario admin:" -ForegroundColor White
Write-Host "      CPF: 99999999999" -ForegroundColor Gray
Write-Host "      Senha: admin999" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
```

**Como executar:**
```powershell
cd API
.\RECRIAR-BANCO.ps1
```

---

### 🐚 Script Bash (Git Bash / Linux / macOS)

Salve como `recriar-banco.sh` na pasta `API/`:

```bash
#!/bin/bash

# Script Bash para Recriar Banco de Dados PostgreSQL do Zero
# ⚠️ ATENÇÃO: Isso apagará TODOS os dados do banco!

echo ""
echo "🔄 RECRIAR BANCO DE DADOS POSTGRESQL - FintechBankApp"
echo "⚠️  ATENÇÃO: Isso apagará TODOS os dados!"
echo ""

# Verificar se está na pasta API
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erro: Execute este script na pasta API/"
    echo "   Diretório atual: $(pwd)"
    exit 1
fi

echo "📁 Diretório: $(pwd)"
echo ""

# Passo 1: Parar e remover containers e volumes
echo "🛑 Passo 1: Parando e removendo containers e volumes..."
docker-compose down -v 2>/dev/null || true
echo "✅ Containers e volumes removidos"
echo ""

# Aguardar um momento
echo "⏳ Aguardando 5 segundos..."
sleep 5

# Passo 2: Iniciar PostgreSQL
echo "🚀 Passo 2: Iniciando PostgreSQL..."
docker-compose up -d database
if [ $? -ne 0 ]; then
    echo "❌ Erro ao iniciar PostgreSQL"
    exit 1
fi
echo "✅ PostgreSQL iniciado"
echo ""

# Passo 3: Aguardar banco inicializar (IMPORTANTE!)
echo "⏳ Passo 3: Aguardando PostgreSQL inicializar completamente (20 segundos)..."
echo "   (Este passo é CRÍTICO - não pule!)"
sleep 20
echo "✅ Aguardamento concluído"
echo ""

# Passo 4: Criar banco de dados
echo "📦 Passo 4: Criando banco de dados 'fintech'..."
docker exec pgdb psql -U postgres -c "DROP DATABASE IF EXISTS fintech;" 2>/dev/null || true
docker exec pgdb psql -U postgres -c "CREATE DATABASE fintech;"
if [ $? -ne 0 ]; then
    echo "❌ Erro ao criar banco de dados"
    exit 1
fi
echo "✅ Banco 'fintech' criado"
echo ""

# Passo 5: Criar schema 'fintech'
echo "📋 Passo 5: Criando schema 'fintech'..."
docker exec pgdb psql -U postgres -d fintech -c "CREATE SCHEMA IF NOT EXISTS fintech;"
if [ $? -ne 0 ]; then
    echo "❌ Erro ao criar schema"
    exit 1
fi
echo "✅ Schema 'fintech' criado"
echo ""

# Passo 6: Verificar se arquivos SQL existem
echo "📄 Passo 6: Verificando arquivos SQL..."
sqlFiles=("schema_pg_fintech.sql" "schema_invoice_lifecycle.sql" "migration_update_signup_defaults.sql")

for file in "${sqlFiles[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ Arquivo encontrado: $file"
    else
        echo "⚠️  Arquivo não encontrado: $file"
    fi
done
echo ""

# Passo 7: Executar script principal
echo "🔧 Passo 7: Executando script principal (schema_pg_fintech.sql)..."
if [ -f "schema_pg_fintech.sql" ]; then
    docker exec -i pgdb psql -U postgres -d fintech < schema_pg_fintech.sql
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao executar schema_pg_fintech.sql"
        exit 1
    fi
    echo "✅ Script principal executado"
else
    echo "⚠️  Arquivo schema_pg_fintech.sql não encontrado, pulando..."
fi
echo ""

# Passo 8: Executar migrações
echo "🔄 Passo 8: Executando migrações..."

if [ -f "schema_invoice_lifecycle.sql" ]; then
    echo "   Executando schema_invoice_lifecycle.sql..."
    docker exec -i pgdb psql -U postgres -d fintech < schema_invoice_lifecycle.sql
    if [ $? -eq 0 ]; then
        echo "   ✅ schema_invoice_lifecycle.sql executado"
    else
        echo "   ⚠️  Erro ao executar schema_invoice_lifecycle.sql (pode ser normal se já foi executado)"
    fi
fi

if [ -f "migration_update_signup_defaults.sql" ]; then
    echo "   Executando migration_update_signup_defaults.sql..."
    docker exec -i pgdb psql -U postgres -d fintech < migration_update_signup_defaults.sql
    if [ $? -eq 0 ]; then
        echo "   ✅ migration_update_signup_defaults.sql executado"
    else
        echo "   ⚠️  Erro ao executar migration_update_signup_defaults.sql (pode ser normal se já foi executado)"
    fi
fi
echo ""

# Passo 9: Criar tabela products (se não existir)
echo "📦 Passo 9: Criando tabela 'products' (se não existir)..."
docker exec pgdb psql -U postgres -d fintech -c "CREATE TABLE IF NOT EXISTS fintech.products (id VARCHAR(255) NOT NULL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(15,2) NOT NULL, image_url TEXT);"
if [ $? -eq 0 ]; then
    echo "✅ Tabela 'products' verificada/criada"
else
    echo "⚠️  Erro ao criar tabela 'products' (pode já existir)"
fi
echo ""

# Passo 10: Verificar tabelas criadas
echo "✅ Passo 10: Verificando tabelas criadas..."
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"
echo ""

# Passo 11: Verificar usuário admin
echo "👤 Passo 11: Verificando usuário admin..."
docker exec pgdb psql -U postgres -d fintech -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"
echo ""

# Resumo final
echo ""
echo "============================================================"
echo "SUCCESS: BANCO DE DADOS RECRIADO COM SUCESSO!"
echo "============================================================"
echo ""
echo "Proximos passos:"
echo "   1. Configure o arquivo .env com:"
echo "      DB_PROVIDER=postgres"
echo "      DB_HOST=localhost"
echo "      DB_PORT=5432"
echo "      DB_USER=postgres"
echo "      DB_PASS=pwd123"
echo "      DB_NAME=fintech"
echo "      DB_SCHEMA=fintech"
echo ""
echo "   2. Inicie a API:"
echo "      npm run dev"
echo ""
echo "   3. A API criara automaticamente o usuario admin:"
echo "      CPF: 99999999999"
echo "      Senha: admin999"
echo ""
echo "============================================================"
echo ""
```

**Como executar:**
```bash
cd API
chmod +x recriar-banco.sh
./recriar-banco.sh
```

---

### 💻 Script CMD (Windows Command Prompt)

Salve como `recriar-banco.cmd` na pasta `API/`:

```cmd
@echo off
REM Script CMD para Recriar Banco de Dados PostgreSQL do Zero
REM ⚠️ ATENÇÃO: Isso apagará TODOS os dados do banco!

echo.
echo 🔄 RECRIAR BANCO DE DADOS POSTGRESQL - FintechBankApp
echo ⚠️  ATENÇÃO: Isso apagará TODOS os dados!
echo.

REM Verificar se está na pasta API
if not exist "docker-compose.yml" (
    echo ❌ Erro: Execute este script na pasta API/
    echo    Diretório atual: %CD%
    exit /b 1
)

echo 📁 Diretório: %CD%
echo.

REM Passo 1: Parar e remover containers e volumes
echo 🛑 Passo 1: Parando e removendo containers e volumes...
docker-compose down -v >nul 2>&1
echo ✅ Containers e volumes removidos
echo.

REM Aguardar um momento
echo ⏳ Aguardando 5 segundos...
timeout /t 5 /nobreak >nul
echo.

REM Passo 2: Iniciar PostgreSQL
echo 🚀 Passo 2: Iniciando PostgreSQL...
docker-compose up -d database
if errorlevel 1 (
    echo ❌ Erro ao iniciar PostgreSQL
    exit /b 1
)
echo ✅ PostgreSQL iniciado
echo.

REM Passo 3: Aguardar banco inicializar (IMPORTANTE!)
echo ⏳ Passo 3: Aguardando PostgreSQL inicializar completamente (20 segundos)...
echo    (Este passo é CRÍTICO - não pule!)
timeout /t 20 /nobreak >nul
echo ✅ Aguardamento concluído
echo.

REM Passo 4: Criar banco de dados
echo 📦 Passo 4: Criando banco de dados 'fintech'...
docker exec pgdb psql -U postgres -c "DROP DATABASE IF EXISTS fintech;" >nul 2>&1
docker exec pgdb psql -U postgres -c "CREATE DATABASE fintech;"
if errorlevel 1 (
    echo ❌ Erro ao criar banco de dados
    exit /b 1
)
echo ✅ Banco 'fintech' criado
echo.

REM Passo 5: Criar schema 'fintech'
echo 📋 Passo 5: Criando schema 'fintech'...
docker exec pgdb psql -U postgres -d fintech -c "CREATE SCHEMA IF NOT EXISTS fintech;"
if errorlevel 1 (
    echo ❌ Erro ao criar schema
    exit /b 1
)
echo ✅ Schema 'fintech' criado
echo.

REM Passo 6: Verificar se arquivos SQL existem
echo 📄 Passo 6: Verificando arquivos SQL...
if exist "schema_pg_fintech.sql" (
    echo ✅ Arquivo encontrado: schema_pg_fintech.sql
) else (
    echo ⚠️  Arquivo não encontrado: schema_pg_fintech.sql
)
if exist "schema_invoice_lifecycle.sql" (
    echo ✅ Arquivo encontrado: schema_invoice_lifecycle.sql
) else (
    echo ⚠️  Arquivo não encontrado: schema_invoice_lifecycle.sql
)
if exist "migration_update_signup_defaults.sql" (
    echo ✅ Arquivo encontrado: migration_update_signup_defaults.sql
) else (
    echo ⚠️  Arquivo não encontrado: migration_update_signup_defaults.sql
)
echo.

REM Passo 7: Executar script principal
echo 🔧 Passo 7: Executando script principal (schema_pg_fintech.sql)...
if exist "schema_pg_fintech.sql" (
    type schema_pg_fintech.sql | docker exec -i pgdb psql -U postgres -d fintech
    if errorlevel 1 (
        echo ❌ Erro ao executar schema_pg_fintech.sql
        exit /b 1
    )
    echo ✅ Script principal executado
) else (
    echo ⚠️  Arquivo schema_pg_fintech.sql não encontrado, pulando...
)
echo.

REM Passo 8: Executar migrações
echo 🔄 Passo 8: Executando migrações...

if exist "schema_invoice_lifecycle.sql" (
    echo    Executando schema_invoice_lifecycle.sql...
    type schema_invoice_lifecycle.sql | docker exec -i pgdb psql -U postgres -d fintech
    if not errorlevel 1 (
        echo    ✅ schema_invoice_lifecycle.sql executado
    ) else (
        echo    ⚠️  Erro ao executar schema_invoice_lifecycle.sql (pode ser normal se já foi executado)
    )
)

if exist "migration_update_signup_defaults.sql" (
    echo    Executando migration_update_signup_defaults.sql...
    type migration_update_signup_defaults.sql | docker exec -i pgdb psql -U postgres -d fintech
    if not errorlevel 1 (
        echo    ✅ migration_update_signup_defaults.sql executado
    ) else (
        echo    ⚠️  Erro ao executar migration_update_signup_defaults.sql (pode ser normal se já foi executado)
    )
)
echo.

REM Passo 9: Criar tabela products (se não existir)
echo 📦 Passo 9: Criando tabela 'products' (se não existir)...
docker exec pgdb psql -U postgres -d fintech -c "CREATE TABLE IF NOT EXISTS fintech.products (id VARCHAR(255) NOT NULL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(15,2) NOT NULL, image_url TEXT);"
if not errorlevel 1 (
    echo ✅ Tabela 'products' verificada/criada
) else (
    echo ⚠️  Erro ao criar tabela 'products' (pode já existir)
)
echo.

REM Passo 10: Verificar tabelas criadas
echo ✅ Passo 10: Verificando tabelas criadas...
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"
echo.

REM Passo 11: Verificar usuário admin
echo 👤 Passo 11: Verificando usuário admin...
docker exec pgdb psql -U postgres -d fintech -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"
echo.

REM Resumo final
echo.
echo ============================================================
echo SUCCESS: BANCO DE DADOS RECRIADO COM SUCESSO!
echo ============================================================
echo.
echo Proximos passos:
echo    1. Configure o arquivo .env com:
echo       DB_PROVIDER=postgres
echo       DB_HOST=localhost
echo       DB_PORT=5432
echo       DB_USER=postgres
echo       DB_PASS=pwd123
echo       DB_NAME=fintech
echo       DB_SCHEMA=fintech
echo.
echo    2. Inicie a API:
echo       npm run dev
echo.
echo    3. A API criara automaticamente o usuario admin:
echo       CPF: 99999999999
echo       Senha: admin999
echo.
echo ============================================================
echo.
pause
```

**Como executar:**
```cmd
cd API
recriar-banco.cmd
```

---

### 📋 Script PowerShell (Linha de Comando)

Para executar diretamente no PowerShell sem salvar arquivo:

```powershell
cd API

# Parar e remover containers
docker-compose down -v 2>$null
Start-Sleep -Seconds 5

# Iniciar PostgreSQL
docker-compose up -d database
Start-Sleep -Seconds 20

# Criar banco e schema
docker exec pgdb psql -U postgres -c "DROP DATABASE IF EXISTS fintech;" 2>$null
docker exec pgdb psql -U postgres -c "CREATE DATABASE fintech;"
docker exec pgdb psql -U postgres -d fintech -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Executar scripts SQL
Get-Content "schema_pg_fintech.sql" | docker exec -i pgdb psql -U postgres -d fintech

if (Test-Path "schema_invoice_lifecycle.sql") {
    Get-Content "schema_invoice_lifecycle.sql" | docker exec -i pgdb psql -U postgres -d fintech
}

if (Test-Path "migration_update_signup_defaults.sql") {
    Get-Content "migration_update_signup_defaults.sql" | docker exec -i pgdb psql -U postgres -d fintech
}

# Criar tabela products
docker exec pgdb psql -U postgres -d fintech -c "CREATE TABLE IF NOT EXISTS fintech.products (id VARCHAR(255) NOT NULL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(15,2) NOT NULL, image_url TEXT);"

# Verificar
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"
```

---

## ⚙️ Configuração do .env

Após criar o banco, configure o arquivo `.env` na pasta `API/`:

```env
# Provider do banco
DB_PROVIDER=postgres

# Configurações de conexão
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=pwd123
DB_NAME=fintech
DB_SCHEMA=fintech
DB_SSL=false
```

**⚠️ IMPORTANTE**: 
- O `DB_NAME` deve ser `fintech` (não `fintechbank`)
- O `DB_SCHEMA` deve ser `fintech`
- Verifique se o arquivo `.env` existe na pasta `API/`

---

## ✅ Verificar se Está Funcionando

### 1. Verificar se o container está rodando

```powershell
docker ps | findstr pgdb
```

Deve mostrar algo como:
```
pgdb    postgres:trixie    Up X minutes    0.0.0.0:5432->5432/tcp
```

### 2. Verificar se o banco existe

```powershell
docker exec pgdb psql -U postgres -c "\l" | findstr fintech
```

Deve mostrar:
```
fintech | postgres | UTF8     | ...
```

### 3. Verificar se as tabelas foram criadas

```powershell
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"
```

Deve listar várias tabelas como:
- `users`
- `transactions`
- `pix_keys`
- `contacts`
- `products`
- etc.

### 4. Iniciar a API

```powershell
cd API
npm run dev
```

Você deve ver logs como:
```
🔍 [PostgresProvider] Iniciando conexão com PostgreSQL...
✅ [PostgresProvider] Conectado ao PostgreSQL com sucesso!
✅ [PostgresProvider] Database atual: fintech
```

### 5. Verificar usuário admin (criado automaticamente pela API)

A API cria automaticamente o usuário admin na primeira inicialização:
- **CPF**: `99999999999`
- **Senha**: `admin999`
- **Email**: `admin@fintechbank.com`

Para verificar:
```powershell
docker exec pgdb psql -U postgres -d fintech -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"
```

---

## 🐛 Troubleshooting

### Erro: "container pgdb not found"

**Solução:**
```powershell
# Verificar se o container existe
docker ps -a | findstr pgdb

# Se não existir, iniciar
cd API
docker-compose up -d database

# Aguardar 20 segundos
Start-Sleep -Seconds 20
```

### Erro: "database 'fintech' does not exist"

**Solução:**
```powershell
# Criar o banco
docker exec pgdb psql -U postgres -c "CREATE DATABASE fintech;"
docker exec pgdb psql -U postgres -d fintech -c "CREATE SCHEMA IF NOT EXISTS fintech;"
```

### Erro: "could not connect to server"

**Solução:**
```powershell
# Verificar se o container está rodando
docker ps | findstr pgdb

# Se não estiver, iniciar
docker-compose up -d database

# Aguardar mais tempo (às vezes precisa de 30 segundos)
Start-Sleep -Seconds 30

# Verificar logs
docker-compose logs database
```

### Erro: "password authentication failed"

**Solução:**
- Verifique a senha no `.env`: deve ser `pwd123`
- Verifique o `docker-compose.yml`: `POSTGRES_PASSWORD: "pwd123"`

### Erro: "relation 'fintech.products' does not exist"

**Solução:**
```powershell
# Criar a tabela products
docker exec pgdb psql -U postgres -d fintech -c "CREATE TABLE IF NOT EXISTS fintech.products (id VARCHAR(255) NOT NULL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(15,2) NOT NULL, image_url TEXT);"
```

### Erro: "column 'login_attempts' does not exist"

**Solução:**
```powershell
# Adicionar a coluna
docker exec pgdb psql -U postgres -d fintech -c "ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;"
```

### Múltiplos containers PostgreSQL rodando

**Sintoma**: Aviso "MÚLTIPLOS CONTAINERS POSTGRESQL DETECTADOS!"

**Solução:**
```powershell
# Ver todos os containers PostgreSQL
docker ps | findstr postgres

# Parar containers desnecessários
docker stop <nome-do-container>

# Manter apenas o pgdb rodando
docker stop postgres  # se existir outro container chamado "postgres"
```

### Container não inicia

**Solução:**
```powershell
# Ver logs para diagnosticar
docker-compose logs database

# Tentar recriar do zero
docker-compose down -v
docker-compose up -d database
Start-Sleep -Seconds 20
```

### Arquivo SQL não encontrado

**Solução:**
```powershell
# Verificar se os arquivos SQL existem
cd API
Get-ChildItem *.sql

# Deve mostrar pelo menos:
# - schema_pg_fintech.sql
```

Se algum arquivo estiver faltando, você pode pular as migrações opcionais (`schema_invoice_lifecycle.sql` e `migration_update_signup_defaults.sql`).

---

## 📚 Comandos Úteis

### Ver logs do PostgreSQL

```powershell
docker-compose logs database
```

### Entrar no psql interativo

```powershell
docker exec -it pgdb psql -U postgres -d fintech
```

Dentro do psql, você pode executar:
```sql
\dt fintech.*          -- listar tabelas
SELECT * FROM fintech.users;  -- ver usuários
\q                     -- sair
```

### Parar PostgreSQL

```powershell
docker-compose stop database
```

### Iniciar PostgreSQL (se já estiver criado)

```powershell
docker-compose start database
```

### Remover tudo (banco + containers + volumes)

```powershell
docker-compose down -v
```

---

## 🎯 Resumo Rápido

### Primeira vez:
```powershell
cd API
.\RECRIAR-BANCO.ps1
```

### Recriar do zero:
```powershell
cd API
.\RECRIAR-BANCO.ps1
```

### Verificar se funcionou:
```powershell
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"
cd API
npm run dev
```

---

## 📝 Próximos Passos

Após configurar o banco:

1. ✅ Configure o arquivo `.env` (veja seção [Configuração do .env](#configuração-do-env))
2. ✅ Inicie a API: `npm run dev`
3. ✅ A API criará automaticamente o usuário admin:
   - CPF: `99999999999`
   - Senha: `admin999`
4. ✅ Teste a API no Swagger: `http://localhost:3001/api-docs`

---

**Última atualização**: Janeiro 2025
