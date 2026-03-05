# 🔄 Guia Completo - Atualizar PostgreSQL no Docker

Este guia explica como atualizar o PostgreSQL no Docker de forma segura, preservando ou fazendo backup dos dados.

---

## 📋 Índice

1. [Métodos de Atualização](#métodos-de-atualização)
2. [Atualização com Preservação de Dados](#atualização-com-preservação-de-dados)
3. [Atualização com Backup](#atualização-com-backup)
4. [Atualização do Zero](#atualização-do-zero)
5. [Atualização Manual](#atualização-manual)
6. [Troubleshooting](#troubleshooting)

---

## 🚀 Métodos de Atualização

### Opção 1: Script Automatizado (Recomendado)

O script `ATUALIZAR-POSTGRESQL.ps1` automatiza todo o processo:

```powershell
cd API

# Atualizar preservando dados (recomendado)
.\ATUALIZAR-POSTGRESQL.ps1 -NovaVersao "18-trixie"

# Atualizar com backup
.\ATUALIZAR-POSTGRESQL.ps1 -NovaVersao "18-trixie" -FazerBackup

# Atualizar recriando do zero (apaga dados)
.\ATUALIZAR-POSTGRESQL.ps1 -NovaVersao "18-trixie" -RecriarDoZero
```

---

## 💾 Atualização com Preservação de Dados

**Este é o método mais seguro e recomendado.** Os dados são preservados automaticamente através dos volumes do Docker.

### Passo a Passo

1. **Parar os containers:**
   ```powershell
   cd API
   docker-compose down
   ```

2. **Atualizar a versão no docker-compose.yml:**
   ```yaml
   # Alterar de:
   image: postgres:trixie
   
   # Para (exemplo):
   image: postgres:18-trixie
   ```

3. **Baixar a nova imagem:**
   ```powershell
   docker pull postgres:18-trixie
   ```

4. **Iniciar o container:**
   ```powershell
   docker-compose up -d database
   ```

5. **Aguardar inicialização (importante!):**
   ```powershell
   Start-Sleep -Seconds 20
   ```

6. **Verificar versão:**
   ```powershell
   docker exec pgdb psql -U postgres -c "SELECT version();"
   ```

### ⚠️ Importante

- Os volumes do Docker preservam os dados automaticamente
- O PostgreSQL faz upgrade automático dos dados na primeira inicialização
- Pode levar alguns minutos na primeira inicialização após atualização

---

## 🔄 Atualização com Backup

**Recomendado se você quer ter um backup antes de atualizar.**

### Passo a Passo

1. **Fazer backup:**
   ```powershell
   cd API
   
   # Criar pasta de backups
   New-Item -ItemType Directory -Path backups -Force
   
   # Fazer backup
   $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
   docker exec pgdb pg_dump -U postgres -d fintech > "backups\fintech_backup_$timestamp.sql"
   ```

2. **Seguir os passos da atualização com preservação de dados**

3. **Se necessário, restaurar backup:**
   ```powershell
   Get-Content "backups\fintech_backup_YYYYMMDD_HHMMSS.sql" | docker exec -i pgdb psql -U postgres -d fintech
   ```

---

## 🗑️ Atualização do Zero

**⚠️ ATENÇÃO: Isso apaga TODOS os dados!**

Use apenas se você não precisa preservar os dados ou se vai restaurar de um backup.

### Passo a Passo

1. **Fazer backup (se necessário):**
   ```powershell
   cd API
   docker exec pgdb pg_dump -U postgres -d fintech > backup.sql
   ```

2. **Parar e remover tudo:**
   ```powershell
   docker-compose down -v
   ```

3. **Atualizar docker-compose.yml:**
   ```yaml
   image: postgres:18-trixie
   ```

4. **Recriar banco:**
   ```powershell
   # Usar o script de recriação
   .\RECRIAR-BANCO.ps1
   
   # OU restaurar do backup
   docker-compose up -d database
   Start-Sleep -Seconds 20
   Get-Content backup.sql | docker exec -i pgdb psql -U postgres -d fintech
   ```

---

## 🔧 Atualização Manual

Se preferir fazer manualmente, siga estes passos:

### 1. Verificar Versão Atual

```powershell
docker exec pgdb psql -U postgres -c "SELECT version();"
```

### 2. Fazer Backup (Opcional mas Recomendado)

```powershell
docker exec pgdb pg_dump -U postgres -d fintech > backup_$(Get-Date -Format "yyyyMMdd_HHmmss").sql
```

### 3. Parar Containers

```powershell
cd API
docker-compose down
```

### 4. Atualizar docker-compose.yml

Edite o arquivo `docker-compose.yml` e altere:

```yaml
services:
  database:
    image: postgres:18-trixie  # Atualizar aqui
```

### 5. Baixar Nova Imagem

```powershell
docker pull postgres:18-trixie
```

### 6. Iniciar Container

```powershell
docker-compose up -d database
```

### 7. Aguardar Inicialização

```powershell
Start-Sleep -Seconds 20
```

### 8. Verificar Nova Versão

```powershell
docker exec pgdb psql -U postgres -c "SELECT version();"
```

### 9. Verificar Dados

```powershell
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"
```

---

## 📦 Versões Disponíveis do PostgreSQL

### Versões Recomendadas

- **`postgres:18-trixie`** - PostgreSQL 18 com Debian Trixie (mais recente)
- **`postgres:18-bookworm`** - PostgreSQL 18 com Debian Bookworm
- **`postgres:18-alpine`** - PostgreSQL 18 com Alpine Linux (imagem menor)
- **`postgres:18`** - PostgreSQL 18 (versão genérica)

### Versões Específicas

- **`postgres:17`** - PostgreSQL 17
- **`postgres:16`** - PostgreSQL 16
- **`postgres:15`** - PostgreSQL 15

### Verificar Versões Disponíveis

```powershell
# Listar tags disponíveis (requer acesso à internet)
docker search postgres
```

Ou visite: https://hub.docker.com/_/postgres/tags

---

## ⚠️ Troubleshooting

### Problema: Container não inicia após atualização

**Solução:**
```powershell
# Verificar logs
docker logs pgdb

# Verificar se a porta está em uso
netstat -ano | findstr :5432

# Remover container e recriar
docker-compose down
docker-compose up -d database
```

### Problema: Dados não aparecem após atualização

**Solução:**
```powershell
# Verificar se o volume está montado
docker volume ls

# Verificar se o banco existe
docker exec pgdb psql -U postgres -l

# Restaurar do backup (se tiver)
Get-Content backup.sql | docker exec -i pgdb psql -U postgres -d fintech
```

### Problema: Erro de compatibilidade de versão

**Solução:**
- O PostgreSQL faz upgrade automático dos dados
- Se houver erro, pode ser necessário fazer upgrade manual
- Consulte a documentação oficial do PostgreSQL para upgrade paths

### Problema: pgAdmin não conecta após atualização

**Solução:**
```powershell
# Reiniciar pgAdmin
docker-compose restart pgadmin

# Verificar se o container database está rodando
docker ps | Select-String "pgdb"
```

---

## 📝 Notas Importantes

1. **Backup é sempre recomendado** antes de atualizar
2. **Aguardar inicialização** é crítico (20 segundos mínimo)
3. **Volumes preservam dados** automaticamente
4. **PostgreSQL faz upgrade automático** dos dados na primeira inicialização
5. **Testar aplicação** após atualização é essencial

---

## 🔗 Referências

- [Documentação Oficial do PostgreSQL](https://www.postgresql.org/docs/)
- [Docker Hub - PostgreSQL](https://hub.docker.com/_/postgres)
- [Guia de Upgrade do PostgreSQL](https://www.postgresql.org/docs/current/upgrading.html)

---

**Última atualização:** Janeiro 2025
