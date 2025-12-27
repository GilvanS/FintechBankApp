# 🚀 Comandos Simples para Git Bash (Sem psql instalado)

## ✅ Usar psql do Container Docker (Recomendado)

**⚠️ IMPORTANTE:**
- A porta **5432** é do PostgreSQL (banco de dados) - correta para comandos SQL
- A porta **16543** é do pgAdmin (interface web) - apenas para navegador
- Se você não tem `psql` instalado, use `docker exec` (não precisa da porta do host)

---

## 📋 Comandos Completos (Copiar e Colar)

### Criar Banco do Zero

```bash
cd API

# Parar e remover tudo (se já existir)
docker-compose down -v
sleep 5

# Iniciar PostgreSQL
docker-compose up -d database
sleep 15

# Criar banco de dados
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"

# Criar schema 'fintech'
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Criar arquivo SQL combinado (search_path + schema_pg.sql)
{
  echo "SET search_path TO fintech, public;"
  cat schema_pg.sql
} > schema_pg_fintech.sql

# Copiar para container e executar
docker cp schema_pg_fintech.sql pgdb:/tmp/
docker exec -i pgdb psql -U postgres -d fintechbank -f /tmp/schema_pg_fintech.sql

# Limpar arquivo temporário local
rm schema_pg_fintech.sql

# Executar migrações (elas já esperam schema 'fintech')
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# Verificar se funcionou
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

---

## 🎯 Versão Simplificada (Apenas o Essencial)

```bash
cd API
docker-compose down -v
sleep 5
docker-compose up -d database
sleep 15
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"
docker cp schema_pg.sql pgdb:/tmp/
docker exec -i pgdb psql -U postgres -d fintechbank -c "SET search_path TO fintech, public;" -f /tmp/schema_pg.sql
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

---

## ✅ Verificar se Funcionou

```bash
# Ver usuário admin criado
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"

# Ver todas as tabelas
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

---

## 🔍 Comandos Úteis

```bash
# Ver containers rodando
docker ps

# Ver logs do PostgreSQL
docker-compose logs database

# Entrar no psql interativo do container
docker exec -it pgdb psql -U postgres -d fintechbank

# Dentro do psql interativo, você pode executar:
# \dt fintech.*          (listar tabelas)
# SELECT * FROM fintech.users;  (ver usuários)
# \q                     (sair)
```

---

## ⚙️ Configurar .env

Após criar o banco, configure no arquivo `.env` da API:

```env
DB_PROVIDER=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=pwd123
DB_NAME=fintechbank
DB_SCHEMA=fintech
DB_SSL=false
```

**Nota**: A porta 5432 no `.env` é para a API conectar ao PostgreSQL. O `docker exec` usa a porta interna do container.

---

## 🐛 Troubleshooting

### Erro: "container pgdb not found"
```bash
# Verificar se o container está rodando
docker ps

# Se não estiver, iniciar
docker-compose up -d database
sleep 15
```

### Erro: "could not connect to server"
```bash
# Aguardar mais tempo para o banco inicializar
sleep 20

# Verificar logs
docker-compose logs database
```

### Verificar se o arquivo SQL existe
```bash
# Listar arquivos SQL
ls -la *.sql

# Deve mostrar: schema_pg.sql, schema_invoice_lifecycle.sql, etc.
```

