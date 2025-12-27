# 🔄 Recriar Banco PostgreSQL no Docker (Git Bash / Linux)

## 🛑 Passo 1: Parar e Remover o Container Docker

```bash
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

```bash
# Remover volumes (apaga os dados)
docker-compose down -v

# OU remover volume específico
docker volume ls  # Listar volumes
docker volume rm <nome_do_volume>  # Remover volume específico
```

## 🚀 Passo 3: Recriar Tudo do Zero

```bash
# 1. Iniciar PostgreSQL novamente
docker-compose up -d database

# 2. Aguardar 10-15 segundos para o banco inicializar completamente
sleep 15

# 3. Criar banco de dados
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE fintechbank;"

# 4. Criar schema 'fintech'
psql -h localhost -p 5432 -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# 5. Executar script principal (abre psql interativo)
psql -h localhost -p 5432 -U postgres -d fintechbank
```

No prompt do psql que abrir:
```sql
SET search_path TO fintech, public;
\i schema_pg.sql
\q
```

Voltar ao bash e executar migrações:
```bash
# 6. Migrações adicionais
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_invoice_lifecycle.sql
psql -h localhost -p 5432 -U postgres -d fintechbank -f migration_update_signup_defaults.sql

# 7. Verificar se foi criado corretamente
psql -h localhost -p 5432 -U postgres -d fintechbank -c "\dt fintech.*"
```

---

## 📋 Comandos em Sequência Completa (Copiar e Colar)

```bash
# Parar e remover tudo (incluindo volumes/dados)
cd API
docker-compose down -v

# Aguardar um momento
sleep 5

# Recriar container
docker-compose up -d database

# Aguardar banco inicializar
sleep 15

# Criar banco de dados
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE fintechbank;"

# Criar schema
psql -h localhost -p 5432 -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Executar scripts SQL (para usar schema 'fintech', execute manualmente no psql)
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_pg.sql
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_invoice_lifecycle.sql
psql -h localhost -p 5432 -U postgres -d fintechbank -f migration_update_signup_defaults.sql

# Verificar
psql -h localhost -p 5432 -U postgres -d fintechbank -c "\dt fintech.*"
```

**Nota**: Se você usar o último comando acima (que executa `schema_pg.sql` direto), as tabelas serão criadas no schema `public`. Se quiser usar o schema `fintech`, execute manualmente no psql como mostrado antes.

---

## 🔧 Versão com Schema 'fintech' (Executar Manualmente no psql)

```bash
# Parar e remover tudo
cd API
docker-compose down -v
sleep 5

# Recriar container
docker-compose up -d database
sleep 15

# Criar banco e schema
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE fintechbank;"
psql -h localhost -p 5432 -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Executar script principal com schema 'fintech'
# Criar arquivo temporário com SET search_path
cat > temp_setup.sql << 'EOF'
SET search_path TO fintech, public;
\i schema_pg.sql
EOF

psql -h localhost -p 5432 -U postgres -d fintechbank -f temp_setup.sql
rm temp_setup.sql

# OU execute manualmente no psql:
# psql -h localhost -p 5432 -U postgres -d fintechbank
# No psql: SET search_path TO fintech, public;
# No psql: \i schema_pg.sql
# No psql: \q

# Migrações adicionais (já usam schema 'fintech')
psql -h localhost -p 5432 -U postgres -d fintechbank -f schema_invoice_lifecycle.sql
psql -h localhost -p 5432 -U postgres -d fintechbank -f migration_update_signup_defaults.sql

# Verificar
psql -h localhost -p 5432 -U postgres -d fintechbank -c "\dt fintech.*"
```

---

## 🔍 Verificar Status do Docker

```bash
# Ver containers rodando
docker ps

# Ver logs do container
docker-compose logs database

# Ver todos os containers (incluindo parados)
docker ps -a
```

---

## ⚡ Comandos Rápidos Úteis

```bash
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

## 🔐 Configurar Senha do PostgreSQL (se necessário)

Se o psql pedir senha toda vez, você pode:

```bash
# Opção 1: Usar variável de ambiente
export PGPASSWORD="pwd123"
psql -h localhost -p 5432 -U postgres -d fintechbank

# Opção 2: Criar arquivo .pgpass
echo "localhost:5432:*:postgres:pwd123" > ~/.pgpass
chmod 600 ~/.pgpass
```

---

## 🐛 Troubleshooting

### Erro: "port 5432 is already allocated"
```bash
# Ver o que está usando a porta (Linux)
sudo netstat -tulpn | grep :5432
# ou
sudo lsof -i :5432

# No Git Bash (Windows)
netstat -ano | grep :5432

# Parar container que está usando
docker-compose down
```

### Erro: "container name already exists"
```bash
# Remover container específico
docker rm -f pgdb
```

### Erro: "password authentication failed"
- Verifique se está usando a senha correta: `pwd123` (conforme docker-compose.yml)
- Use variável de ambiente: `export PGPASSWORD="pwd123"; psql -h localhost -p 5432 -U postgres ...`

### Erro: "psql: command not found"
```bash
# No Git Bash, você precisa ter o PostgreSQL instalado no Windows
# Ou usar o psql do container Docker:
docker exec -it pgdb psql -U postgres -d fintechbank

# Para executar script:
docker exec -i pgdb psql -U postgres -d fintechbank < schema_pg.sql
```

### Container não inicia
```bash
# Ver logs para diagnosticar
docker-compose logs database

# Tentar recriar do zero
docker-compose down -v
docker-compose up -d database
```

---

## 🎯 Usando psql do Container Docker (Alternativa)

Se você não tem psql instalado no Windows, pode usar o psql do container:

```bash
cd API

# Parar e remover
docker-compose down -v
sleep 5

# Recriar
docker-compose up -d database
sleep 15

# Criar banco usando psql do container
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Copiar arquivo SQL para o container e executar
docker cp schema_pg.sql pgdb:/tmp/schema_pg.sql
docker exec -i pgdb psql -U postgres -d fintechbank -c "SET search_path TO fintech, public;" -f /tmp/schema_pg.sql

# OU executar direto (mais simples, mas cria no schema public)
docker exec -i pgdb psql -U postgres -d fintechbank < schema_pg.sql

# Migrações
docker cp schema_invoice_lifecycle.sql pgdb:/tmp/
docker cp migration_update_signup_defaults.sql pgdb:/tmp/
docker exec -i pgdb psql -U postgres -d fintechbank -f /tmp/schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank -f /tmp/migration_update_signup_defaults.sql

# Verificar
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

