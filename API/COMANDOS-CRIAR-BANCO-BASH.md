# 🚀 Comandos Rápidos - Criar Banco PostgreSQL (Git Bash / Linux)

## 📋 Comandos para Copiar e Colar (Docker)

### Opção 1: Schema 'fintech' (Recomendado) - Usando Docker

**⚠️ IMPORTANTE: Se você não tem `psql` instalado (erro "command not found"), use os comandos com `docker exec` abaixo!**

```bash
# 1. Iniciar PostgreSQL
cd API
docker-compose up -d database

# 2. Aguardar 10-15 segundos para o banco inicializar
sleep 15

# 3. Criar banco de dados (usando psql do container Docker)
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"

# 4. Criar schema 'fintech'
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# 5. Executar script principal (com schema 'fintech')
docker exec -i pgdb psql -U postgres -d fintechbank -c "SET search_path TO fintech, public;" -f /tmp/schema_pg.sql

# OU copiar arquivo para container e executar:
docker cp schema_pg.sql pgdb:/tmp/schema_pg.sql
docker exec -i pgdb bash -c "cd /tmp && psql -U postgres -d fintechbank -c 'SET search_path TO fintech, public;' -f schema_pg.sql"

# Método mais simples: executar direto (cria no schema public, depois ajuste se necessário)
docker exec -i pgdb psql -U postgres -d fintechbank < schema_pg.sql

# 6. Migrações adicionais
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# 7. Verificar tabelas criadas
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

### Opção 2: Schema 'public' (Mais Simples) - Usando Docker

```bash
# 1. Iniciar PostgreSQL
cd API
docker-compose up -d database

# 2. Aguardar 10-15 segundos
sleep 15

# 3. Criar banco de dados (usando psql do container)
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"

# 4. Executar script principal (cria no schema 'public')
docker exec -i pgdb psql -U postgres -d fintechbank < schema_pg.sql

# 5. Migrações (se quiser, mas podem precisar ajuste para schema public)
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# 6. Verificar tabelas criadas
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt"
```

**Importante**: Se usar schema 'public', configure no `.env`: `DB_SCHEMA=public`

**Nota sobre portas:**
- Use `docker exec` para acessar o PostgreSQL (não precisa da porta 5432 do host)
- A porta **5432** é mapeada do container para o host (para acessar de fora do Docker)
- A porta **16543** é apenas do pgAdmin (interface web)

---

## 🔐 Configurar Senha (Evitar Digitar Toda Vez)

```bash
# Definir variável de ambiente
export PGPASSWORD="pwd123"

# Agora os comandos psql não pedirão senha
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE fintechbank;"
```

---

## 🐳 Usando psql do Container Docker (Recomendado - Não precisa ter psql instalado)

**Nota sobre portas:**
- **5432** = Porta do PostgreSQL (banco de dados) - esta é a correta para comandos SQL
- **16543** = Porta do pgAdmin (interface web) - apenas para acessar via navegador

```bash
cd API

# Verificar se o container está rodando
docker ps

# Se não estiver, iniciar
docker-compose up -d database
sleep 15

# Criar banco usando psql do container (porta interna 5432)
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"

# Criar schema
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Executar scripts SQL (copiar arquivo para container)
docker cp schema_pg.sql pgdb:/tmp/schema_pg.sql
docker exec -i pgdb psql -U postgres -d fintechbank -f /tmp/schema_pg.sql

# OU executar direto do diretório local (mais simples)
docker exec -i pgdb psql -U postgres -d fintechbank < schema_pg.sql

# Migrações
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# Verificar
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

---

## ⚙️ Configurar .env

Após criar o banco, adicione no arquivo `.env` da API:

```env
DB_PROVIDER=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=pwd123
DB_NAME=fintechbank
DB_SCHEMA=fintech
# ou DB_SCHEMA=public se usou schema public
DB_SSL=false
```

---

## ✅ Verificar se Funcionou

```bash
# Com psql local
psql -h localhost -p 5432 -U postgres -d fintechbank -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"

# Ou com psql do container
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"

# Se usou schema public:
psql -h localhost -p 5432 -U postgres -d fintechbank -c "SELECT cpf, full_name, email, role FROM users WHERE role = 'admin';"
```

Você deve ver o usuário administrador criado.

---

## 🔄 Recriar do Zero (Drop e Recriar) - Usando Docker

**⚠️ CUIDADO: Apaga todos os dados!**

```bash
# Parar e remover volumes
cd API
docker-compose down -v
sleep 5

# Recriar
docker-compose up -d database
sleep 15

# Criar banco e schema (usando psql do container)
docker exec -i pgdb psql -U postgres -c "DROP DATABASE IF EXISTS fintechbank;"
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Executar scripts
docker exec -i pgdb psql -U postgres -d fintechbank < schema_pg.sql
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# Verificar
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

---

## 💡 Dica: Criar Script Executável

Crie um arquivo `setup-db.sh`:

```bash
#!/bin/bash

cd API

echo "🛑 Parando containers..."
docker-compose down -v

echo "⏳ Aguardando..."
sleep 5

echo "🚀 Iniciando PostgreSQL..."
docker-compose up -d database

echo "⏳ Aguardando banco inicializar..."
sleep 15

export PGPASSWORD="pwd123"

echo "📦 Criando banco de dados..."
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE fintechbank;"

echo "📦 Criando schema..."
psql -h localhost -p 5432 -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

echo "📋 Executando scripts SQL..."
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_pg.sql
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_invoice_lifecycle.sql
psql -h localhost -p 5432 -U postgres -d fintechbank -f migration_update_signup_defaults.sql

echo "✅ Verificando..."
psql -h localhost -p 5432 -U postgres -d fintechbank -c "\dt fintech.*"

echo "🎉 Banco criado com sucesso!"
```

Tornar executável e executar:
```bash
chmod +x setup-db.sh
./setup-db.sh
```

