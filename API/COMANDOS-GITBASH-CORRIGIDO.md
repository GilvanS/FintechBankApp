# 🚀 Comandos Corrigidos para Git Bash (Com Schema 'fintech')

## ⚠️ Problema Identificado

Os scripts `schema_invoice_lifecycle.sql` e `migration_update_signup_defaults.sql` esperam que as tabelas estejam no schema `fintech`, mas o `schema_pg.sql` cria as tabelas no schema `public` por padrão.

## ✅ Solução: Criar Tabelas no Schema 'fintech'

### Opção 1: Executar schema_pg.sql com search_path (Recomendado)

```bash
cd API

# Parar e remover tudo
docker-compose down -v
sleep 5

# Iniciar PostgreSQL
docker-compose up -d database
sleep 15

# Criar banco de dados
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"

# Criar schema 'fintech'
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Executar schema_pg.sql com search_path para usar schema 'fintech'
docker exec -i pgdb bash -c "psql -U postgres -d fintechbank << 'EOF'
SET search_path TO fintech, public;
$(cat schema_pg.sql)
EOF"

# Agora executar as migrações (elas já esperam schema 'fintech')
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# Verificar
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

### Opção 2: Usar Arquivo Temporário (Mais Simples)

```bash
cd API

# Parar e remover tudo
docker-compose down -v
sleep 5

# Iniciar PostgreSQL
docker-compose up -d database
sleep 15

# Criar banco e schema
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Criar arquivo temporário com SET search_path + schema_pg.sql
echo "SET search_path TO fintech, public;" > temp_schema_with_fintech.sql
cat schema_pg.sql >> temp_schema_with_fintech.sql

# Copiar para container e executar
docker cp temp_schema_with_fintech.sql pgdb:/tmp/temp_schema.sql
docker exec -i pgdb psql -U postgres -d fintechbank -f /tmp/temp_schema.sql

# Remover arquivo temporário
rm temp_schema_with_fintech.sql

# Executar migrações
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# Verificar
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

### Opção 3: Entrar no psql Interativo (Mais Seguro)

```bash
cd API

# Parar e remover tudo
docker-compose down -v
sleep 5

# Iniciar PostgreSQL
docker-compose up -d database
sleep 15

# Criar banco e schema
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Entrar no psql interativo
docker exec -it pgdb psql -U postgres -d fintechbank
```

No prompt do psql que abrir, execute:
```sql
-- Definir schema padrão
SET search_path TO fintech, public;

-- Executar schema_pg.sql
\i /tmp/schema_pg.sql

-- Mas primeiro, copiar o arquivo para dentro do container (em outro terminal bash):
-- docker cp schema_pg.sql pgdb:/tmp/schema_pg.sql

-- Ou executar direto do diretório local se tiver acesso:
\i schema_pg.sql

-- Sair
\q
```

Depois, executar as migrações:
```bash
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# Verificar
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

---

## 🎯 Solução Mais Simples (Copiar e Colar)

```bash
cd API

# Limpar e recriar
docker-compose down -v
sleep 5
docker-compose up -d database
sleep 15

# Criar banco e schema
docker exec -i pgdb psql -U postgres -c "CREATE DATABASE fintechbank;"
docker exec -i pgdb psql -U postgres -d fintechbank -c "CREATE SCHEMA IF NOT EXISTS fintech;"

# Copiar schema_pg.sql para container
docker cp schema_pg.sql pgdb:/tmp/

# Executar com search_path no schema fintech
docker exec -i pgdb psql -U postgres -d fintechbank << 'EOF'
SET search_path TO fintech, public;
\i /tmp/schema_pg.sql
EOF

# Executar migrações
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
docker exec -i pgdb psql -U postgres -d fintechbank < migration_update_signup_defaults.sql

# Verificar
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

---

## 🔄 Alternativa: Usar Schema 'public' (Mais Simples)

Se preferir usar o schema `public` ao invés de `fintech`, você precisaria editar os arquivos de migração, mas a solução mais fácil é criar as tabelas no schema `fintech` como mostrado acima.

---

## ✅ Verificar se Funcionou

```bash
# Ver tabelas no schema fintech
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"

# Ver usuário admin
docker exec -i pgdb psql -U postgres -d fintechbank -c "SELECT cpf, full_name, email, role FROM fintech.users WHERE role = 'admin';"
```

