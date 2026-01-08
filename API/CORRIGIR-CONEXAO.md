# 🔧 Corrigir Problema de Conexão com PostgreSQL

## ❌ Erro
```
❌ [PostgresProvider] Falha ao conectar com PostgreSQL:
   Erro: database "fintech" does not exist
```

## 🔍 Diagnóstico

O banco `fintech` existe no container `pgdb` (porta 5432), mas a API pode estar tentando conectar em outro container.

## ✅ Solução

### Opção 1: Parar Container Desnecessário (Recomendado)

Se você tem múltiplos containers PostgreSQL rodando, pare o que não está sendo usado:

```powershell
# Ver containers PostgreSQL
docker ps | findstr postgres

# Parar o container "postgres" (porta 5433) se não estiver usando
docker stop postgres

# OU manter apenas o pgdb rodando
docker stop postgres
```

### Opção 2: Verificar Configuração do .env

Certifique-se de que o `.env` tem:

```env
DB_PROVIDER=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=pwd123
DB_NAME=fintech
DB_SCHEMA=fintech
DB_SSL=false
```

### Opção 3: Verificar se o Banco Existe

```powershell
# Verificar no container pgdb (porta 5432)
docker exec pgdb psql -U postgres -c "\l" | findstr fintech

# Se não aparecer, criar o banco:
docker exec pgdb psql -U postgres -c "CREATE DATABASE fintech;"
docker exec pgdb psql -U postgres -d fintech -c "CREATE SCHEMA IF NOT EXISTS fintech;"
```

### Opção 4: Testar Conexão Direta

```powershell
cd API
node -e "const { Pool } = require('pg'); const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: 'pwd123', database: 'fintech' }); pool.query('SELECT current_database()').then(r => { console.log('✅ Conectado! Database:', r.rows[0].current_database); pool.end(); }).catch(e => { console.error('❌ Erro:', e.message); process.exit(1); });"
```

## 🚀 Depois de Corrigir

Reinicie a API:

```powershell
cd API
npm run dev
```

## 📋 Verificação Final

Execute o script de verificação:

```powershell
.\VERIFICAR-BANCO.ps1
```
