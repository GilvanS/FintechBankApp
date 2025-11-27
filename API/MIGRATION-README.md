# 🔄 Scripts de Migração - Valores Padrão de Signup

Este documento descreve como atualizar os schemas do banco de dados para garantir que novos usuários sejam cadastrados com os limites corretos.

## 📋 Valores Padrão

- **Limite de Débito (PIX)**: R$ 2.000,00
- **Limite Total de Crédito**: R$ 5.000,00
- **Limite Disponível de Crédito**: R$ 5.000,00

## 🚀 Como Executar

### Opção 1: Migração Automática (Recomendado)

A migração é executada **automaticamente** quando você inicia a API pela primeira vez após esta atualização. A função `initializeDatabase()` no `index.cjs` já foi atualizada para aplicar as mudanças.

**Apenas reinicie a API:**
```bash
npm start
```

### Opção 2: Script de Migração Manual (PostgreSQL)

Para executar manualmente a migração no PostgreSQL:

```bash
cd API
npm run migrate:signup
```

Ou execute o script diretamente:
```bash
node run-migration-signup-defaults.js
```

### Opção 3: Script SQL Manual (PostgreSQL)

Execute diretamente no seu banco PostgreSQL:

```bash
psql -U seu_usuario -d seu_banco -f migration_update_signup_defaults.sql
```

Ou copie e cole o conteúdo de `migration_update_signup_defaults.sql` no seu cliente SQL.

### Opção 4: Script SQL Manual (Databricks)

Execute o script `migration_update_signup_defaults_databricks.sql` no seu workspace Databricks.

## 📝 O que os Scripts Fazem

### 1. Adicionar Colunas (se não existirem)
- `credit_card_total_limit` (DECIMAL 15,2)
- `credit_card_available_limit` (DECIMAL 15,2)
- `credit_card_points_balance` (INTEGER)
- `credit_card_is_blocked` (BOOLEAN)

### 2. Atualizar Valores DEFAULT
- `pix_daily_limit`: 2000.00 (antes 1000.00)
- `credit_card_total_limit`: 5000.00
- `credit_card_available_limit`: 5000.00

### 3. Atualizar Usuários Existentes
Atualiza usuários existentes que não têm limites de crédito definidos, aplicando os valores padrão.

## ✅ Verificação

Após executar a migração, verifique se os valores estão corretos:

### PostgreSQL
```sql
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns
WHERE table_schema = 'fintech' 
AND table_name = 'users'
AND column_name IN (
    'pix_daily_limit',
    'credit_card_total_limit',
    'credit_card_available_limit'
)
ORDER BY column_name;
```

### Databricks
```sql
DESCRIBE TABLE users;
```

### Teste com Novo Usuário

1. Cadastre um novo usuário via API:
```bash
POST /api/v1/auth/signup
{
  "fullName": "Teste User",
  "cpf": "12345678901",
  "email": "teste@example.com",
  "password": "Senha123"
}
```

2. Verifique no banco:
```sql
SELECT 
    cpf,
    pix_daily_limit,
    credit_card_total_limit,
    credit_card_available_limit
FROM fintech.users
WHERE cpf = '12345678901';
```

**Valores esperados:**
- `pix_daily_limit`: `2000.00`
- `credit_card_total_limit`: `5000.00`
- `credit_card_available_limit`: `5000.00`

## 🔍 Estrutura dos Arquivos

- `migration_update_signup_defaults.sql` - Script SQL para PostgreSQL
- `migration_update_signup_defaults_databricks.sql` - Script SQL para Databricks
- `run-migration-signup-defaults.js` - Script Node.js para executar migração automaticamente
- `index.cjs` - Já atualizado com migração automática na inicialização

## ⚠️ Notas Importantes

1. **Backup**: Sempre faça backup do banco de dados antes de executar migrações em produção.

2. **PostgreSQL**: Os DEFAULTs são aplicados automaticamente nas colunas.

3. **Databricks**: Como o Databricks não suporta DEFAULTs da mesma forma, os valores são aplicados no código da API (`index.cjs`). A migração SQL apenas cria/atualiza as colunas.

4. **Usuários Existentes**: A migração atualiza apenas usuários que não têm valores definidos. Para atualizar todos os usuários existentes, você pode executar:
   ```sql
   UPDATE fintech.users
   SET 
       pix_daily_limit = 2000.00,
       credit_card_total_limit = 5000.00,
       credit_card_available_limit = 5000.00
   WHERE pix_daily_limit < 2000.00 
      OR credit_card_total_limit IS NULL
      OR credit_card_available_limit IS NULL;
   ```

## 🐛 Troubleshooting

### Erro: "column does not exist"
- Execute a migração completa primeiro
- Verifique se está usando o schema correto (`fintech`)

### Erro: "permission denied"
- Verifique as permissões do usuário do banco
- Execute com um usuário com privilégios de ALTER TABLE

### Erro: "table does not exist"
- Execute primeiro o script `schema_pg.sql` ou `schema.sql` para criar as tabelas

## 📞 Suporte

Se encontrar problemas, verifique:
1. Logs da API durante a inicialização
2. Mensagens de erro do banco de dados
3. Estrutura atual das tabelas com `DESCRIBE TABLE` ou `information_schema`

