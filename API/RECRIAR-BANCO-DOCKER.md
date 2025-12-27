# 🔄 Recriar Banco PostgreSQL no Docker (Do Zero)

## 🛑 Passo 1: Parar e Remover o Container Docker

```powershell
cd API

# Parar o container
docker-compose stop database

# Remover o container (opcional - para forçar recriação)
docker-compose rm -f database

# OU parar e remover tudo de uma vez
docker-compose down
```

## 🗑️ Passo 2: Remover Volumes (Para Apagar os Dados do Banco)

**⚠️ ATENÇÃO: Isso apaga TODOS os dados do banco!**

```powershell
# Remover volumes (apaga os dados)
docker-compose down -v

# OU remover volume específico
docker volume ls  # Listar volumes
docker volume rm <nome_do_volume>  # Remover volume específico
```

## 🚀 Passo 3: Recriar Tudo do Zero

```powershell
# 1. Iniciar PostgreSQL novamente
docker-compose up -d database

# 2. Aguardar 10-15 segundos para o banco inicializar completamente
Start-Sleep -Seconds 15

# 3. Criar banco de dados
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE fintechbank;"

# 4. Criar schema 'fintech'
psql -h localhost -p 5432 -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# 5. Executar script principal
psql -h localhost -p 5432 -U postgres -d fintechbank
```

No prompt do psql que abrir:
```sql
SET search_path TO fintech, public;
\i schema_pg.sql
\q
```

Voltar ao PowerShell e executar migrações:
```powershell
# 6. Migrações adicionais
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_invoice_lifecycle.sql
psql -h localhost -p 5432 -U postgres -d fintechbank -f migration_update_signup_defaults.sql

# 7. Verificar se foi criado corretamente
psql -h localhost -p 5432 -U postgres -d fintechbank -c "\dt fintech.*"
```

---

## 📋 Comandos em Sequência Completa (Copiar e Colar)

```powershell
# Parar e remover tudo (incluindo volumes/dados)
cd API
docker-compose down -v

# Aguardar um momento
Start-Sleep -Seconds 5

# Recriar container
docker-compose up -d database

# Aguardar banco inicializar
Start-Sleep -Seconds 15

# Criar banco de dados
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE fintechbank;"

# Criar schema
psql -h localhost -p 5432 -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Executar scripts SQL
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_pg.sql
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_invoice_lifecycle.sql
psql -h localhost -p 5432 -U postgres -d fintechbank -f migration_update_signup_defaults.sql

# Verificar
psql -h localhost -p 5432 -U postgres -d fintechbank -c "\dt fintech.*"
```

**Nota**: Se você usar o último comando acima (que executa `schema_pg.sql` direto), as tabelas serão criadas no schema `public`. Se quiser usar o schema `fintech`, execute manualmente no psql como mostrado antes.

---

## 🔍 Verificar Status do Docker

```powershell
# Ver containers rodando
docker ps

# Ver logs do container
docker-compose logs database

# Ver todos os containers (incluindo parados)
docker ps -a
```

---

## ⚡ Comandos Rápidos Úteis

```powershell
# Parar container (sem remover)
docker-compose stop database

# Iniciar container parado
docker-compose start database

# Reiniciar container
docker-compose restart database

# Ver logs em tempo real
docker-compose logs -f database

# Entrar no container (bash)
docker exec -it pgdb bash

# Entrar no psql direto do container
docker exec -it pgdb psql -U postgres
```

---

## 🐛 Troubleshooting

### Erro: "port 5432 is already allocated"
```powershell
# Ver o que está usando a porta
netstat -ano | findstr :5432

# Parar container que está usando
docker-compose down
```

### Erro: "container name already exists"
```powershell
# Remover container específico
docker rm -f pgdb
```

### Erro: "password authentication failed"
- Verifique se está usando a senha correta: `pwd123` (conforme docker-compose.yml)
- Ou use: `$env:PGPASSWORD="pwd123"; psql -h localhost -p 5432 -U postgres ...`

### Container não inicia
```powershell
# Ver logs para diagnosticar
docker-compose logs database

# Tentar recriar do zero
docker-compose down -v
docker-compose up -d database
```

