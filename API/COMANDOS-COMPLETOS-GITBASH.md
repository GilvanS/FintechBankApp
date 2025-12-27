# 🚀 Comandos Completos para Criar Banco PostgreSQL (Git Bash)

## 📋 Análise do Problema

- O `schema_pg.sql` cria tabelas no schema `public` (não especifica schema)
- Os scripts `schema_invoice_lifecycle.sql` e `migration_update_signup_defaults.sql` esperam tabelas no schema `fintech`
- Precisamos criar as tabelas no schema `fintech` usando `SET search_path`

## ✅ Solução Correta (Funciona 100%)

```bash
cd API

# 1. Limpar tudo
docker-compose down -v
sleep 5

# 2. Iniciar PostgreSQL
docker-compose up -d database
sleep 15

# 3. Criar banco de dados
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"

# 4. Criar schema 'fintech'
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# 5. Copiar schema_pg.sql para o container
docker cp schema_pg.sql pgdb:/tmp/schema_pg.sql

# 6. Executar schema_pg.sql com search_path para schema 'fintech'
# Usando heredoc para definir search_path e executar o arquivo
docker exec -i pgdb bash -c "psql -U postgres -d fintechbank << 'EOF'
SET search_path TO fintech, public;
\i /tmp/schema_pg.sql
EOF"

# 7. Executar migrações (já esperam schema 'fintech')
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# 8. Verificar
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

---

## 🎯 Versão Simplificada (Uma Linha de Cada)

```bash
cd API
docker-compose down -v && sleep 5
docker-compose up -d database && sleep 15
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"
docker cp schema_pg.sql pgdb:/tmp/schema_pg.sql
docker exec -i pgdb bash -c "psql -U postgres -d fintechbank -c \"SET search_path TO fintech, public;\" -f /tmp/schema_pg.sql"
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql
docker exec -i pgdb psql -U postgres -d fintechbank -c "\\dt fintech.*"
```

---

## 🔧 Alternativa: Criar Arquivo SQL Completo

Se a solução acima não funcionar, podemos criar um arquivo SQL que combina tudo:

```bash
cd API

# Limpar e iniciar
docker-compose down -v
sleep 5
docker-compose up -d database
sleep 15

# Criar banco e schema
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Criar arquivo SQL completo com search_path + schema_pg.sql
{
  echo "SET search_path TO fintech, public;"
  cat schema_pg.sql
} > schema_pg_with_fintech.sql

# Copiar para container e executar
docker cp schema_pg_with_fintech.sql pgdb:/tmp/
docker exec -i pgdb psql -U postgres -d fintechbank -f /tmp/schema_pg_with_fintech.sql

# Limpar arquivo temporário
rm schema_pg_with_fintech.sql

# Executar migrações
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# Verificar
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

---

## 🎯 Solução Definitiva (Recomendada)

Esta solução cria um script SQL completo que funciona corretamente:

```bash
cd API

# Limpar e iniciar
docker-compose down -v
sleep 5
docker-compose up -d database
sleep 15

# Criar banco e schema
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Criar script SQL completo
cat > /tmp/setup_fintech.sql << 'EOFSQL'
SET search_path TO fintech, public;
EOFSQL
cat schema_pg.sql >> /tmp/setup_fintech.sql

# Copiar para container e executar
docker cp /tmp/setup_fintech.sql pgdb:/tmp/setup_fintech.sql
docker exec -i pgdb psql -U postgres -d fintechbank -f /tmp/setup_fintech.sql

# Remover arquivo temporário
rm /tmp/setup_fintech.sql

# Executar migrações
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# Verificar
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"
```

---

## ✅ Verificação Completa

```bash
# Ver todas as tabelas no schema fintech
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"

# Ver estrutura da tabela users
docker exec -i pgdb psql -U postgres -d fintechbank -c "\d fintech.users"

# Ver usuário admin
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"

# Contar tabelas
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'fintech';"
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

---

## 🐛 Troubleshooting

### Se ainda der erro de "relation does not exist"

1. Verificar se as tabelas foram criadas no schema correto:
```bash
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt public.*"
```

2. Se as tabelas estiverem no `public`, mover para `fintech`:
```bash
docker exec -i pgdb psql -U postgres -d fintechbank << 'EOF'
ALTER TABLE public.users SET SCHEMA fintech;
ALTER TABLE public.invoices SET SCHEMA fintech;
-- etc... para todas as tabelas
EOF
```

### Se o heredoc não funcionar no Git Bash

Use a alternativa de criar arquivo temporário mostrada acima.

