# ✅ Comandos FINAIS Corretos para Git Bash

## 🎯 Solução Mais Simples: Script Automático

Execute apenas uma vez:
```bash
cd API
chmod +x setup-db.sh
./setup-db.sh
```

---

## 🔍 Problema Identificado

- `schema_pg.sql` cria tabelas no schema `public` (não especifica schema)
- `schema_invoice_lifecycle.sql` e `migration_update_signup_defaults.sql` esperam schema `fintech`
- Solução: Executar `schema_pg.sql` com `SET search_path TO fintech` antes

## 🚀 SOLUÇÃO MANUAL (Copiar e Colar)

```bash
cd API

# Limpar tudo
docker-compose down -v
sleep 5

# Iniciar PostgreSQL
docker-compose up -d database
sleep 15

# Criar banco e schema
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Copiar schema_pg.sql para container
docker cp schema_pg.sql pgdb:/tmp/schema_pg.sql

# Executar schema_pg.sql com search_path para fintech
# Método: Criar arquivo SQL temporário dentro do container
docker exec -i pgdb bash -c 'cat > /tmp/run_with_fintech.sql << EOF
SET search_path TO fintech, public;
\\i /tmp/schema_pg.sql
EOF
psql -U postgres -d fintechbank -f /tmp/run_with_fintech.sql'

# Executar migrações
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# Verificar
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

---

## 🎯 ALTERNATIVA MAIS SIMPLES (Recomendada)

Esta versão cria um arquivo SQL combinado no host e copia para o container:

```bash
cd API

# Limpar tudo
docker-compose down -v
sleep 5

# Iniciar PostgreSQL
docker-compose up -d database
sleep 15

# Criar banco e schema
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"
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

# Executar migrações
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# Verificar
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT cpf, full_name, email FROM fintech.users WHERE role = 'admin';"
```

---

## 📝 Explicação da Solução

1. **Criar banco e schema**: Cria o banco `fintechbank` e o schema `fintech`

2. **Criar arquivo SQL combinado**: 
   - Adiciona `SET search_path TO fintech, public;` no início
   - Concatena o conteúdo de `schema_pg.sql`
   - Isso faz com que todas as tabelas sejam criadas no schema `fintech`

3. **Executar migrações**: 
   - Agora as migrações encontram as tabelas no schema `fintech` (correto!)

4. **Verificar**: Confirma que tudo foi criado corretamente

---

## ✅ Verificação Completa

```bash
# Listar todas as tabelas
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"

# Ver estrutura da tabela users
docker exec -i pgdb psql -U postgres -d fintechbank -c "\d fintech.users"

# Ver usuário admin
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"

# Contar tabelas criadas
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT COUNT(*) as total_tabelas FROM information_schema.tables WHERE table_schema = 'fintech';"
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

## 🐛 Se Ainda Der Erro

Se ainda der erro de "relation does not exist", verifique:

```bash
# Ver se as tabelas estão no schema public ao invés de fintech
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt public.*"

# Se estiverem no public, movê-las para fintech:
docker exec -i pgdb psql -U postgres -d fintechbank << 'EOF'
ALTER TABLE IF EXISTS public.users SET SCHEMA fintech;
ALTER TABLE IF EXISTS public.invoices SET SCHEMA fintech;
ALTER TABLE IF EXISTS public.transactions SET SCHEMA fintech;
ALTER TABLE IF EXISTS public.pix_contacts SET SCHEMA fintech;
ALTER TABLE IF EXISTS public.pix_keys SET SCHEMA fintech;
ALTER TABLE IF EXISTS public.notifications SET SCHEMA fintech;
ALTER TABLE IF EXISTS public.limit_increase_requests SET SCHEMA fintech;
ALTER TABLE IF EXISTS public.purchased_items SET SCHEMA fintech;
ALTER TABLE IF EXISTS public.installment_plans SET SCHEMA fintech;
EOF
```

