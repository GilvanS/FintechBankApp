# Atualização dos Valores Padrão no Cadastro

Este documento descreve as atualizações feitas para garantir que novos usuários sejam cadastrados com os limites corretos.

## Valores Padrão Definidos

### Limite de Débito (PIX)
- **Valor**: R$ 2.000,00
- **Campo no banco**: `pix_daily_limit`
- **Valor padrão**: `2000.00`

### Limite de Crédito (Cartão de Crédito)
- **Limite Total**: R$ 5.000,00
  - **Campo no banco**: `credit_card_total_limit`
  - **Valor padrão**: `5000.00`
- **Limite Disponível**: R$ 5.000,00
  - **Campo no banco**: `credit_card_available_limit`
  - **Valor padrão**: `5000.00`

## Onde os Valores são Aplicados

### 1. Código da API (`index.cjs`)
No endpoint `/auth/signup` (linha ~308-313), os valores padrão são definidos:

```javascript
const defaultPixDailyLimit = 2000.00; // Limite diário de PIX: R$ 2.000,00
const defaultCreditCardTotalLimit = 5000.00; // Limite total do cartão: R$ 5.000,00
const defaultCreditCardAvailableLimit = 5000.00; // Limite disponível do cartão: R$ 5.000,00
```

Esses valores são aplicados no INSERT quando um novo usuário é cadastrado (linha ~331).

### 2. Schemas SQL
Os schemas SQL foram atualizados para refletir os valores padrão corretos:

- **`schema_pg.sql`** (PostgreSQL):
  - `pix_daily_limit DECIMAL(15,2) DEFAULT 2000.00`
  - `credit_card_available_limit DECIMAL(15,2) DEFAULT 5000.00`
  - `credit_card_total_limit DECIMAL(15,2) DEFAULT 5000.00`

- **`schema.sql`** (Databricks):
  - `pix_daily_limit DECIMAL(15,2) DEFAULT 2000.00`
  - Nota: Databricks não suporta DEFAULTs da mesma forma, então os valores são aplicados no código

### 3. Swagger (`swagger.yaml`)
A documentação já está atualizada e descreve corretamente os valores padrão:

```yaml
**Valores padrão definidos automaticamente ao cadastrar:**
- Limite diário PIX: R$ 2.000,00
- Limite total do cartão de crédito: R$ 5.000,00
- Limite disponível do cartão de crédito: R$ 5.000,00
```

## Verificação

Para verificar se os valores estão sendo aplicados corretamente:

1. **Cadastre um novo usuário** via endpoint `/auth/signup`
2. **Verifique no banco de dados**:
   ```sql
   SELECT cpf, pix_daily_limit, credit_card_total_limit, credit_card_available_limit 
   FROM users 
   WHERE cpf = '<CPF_DO_NOVO_USUARIO>';
   ```

3. **Valores esperados**:
   - `pix_daily_limit`: `2000.00`
   - `credit_card_total_limit`: `5000.00`
   - `credit_card_available_limit`: `5000.00`

## Histórico de Mudanças

- ✅ Código da API já estava correto
- ✅ Swagger já estava documentado corretamente
- ✅ Schemas SQL atualizados para refletir os valores corretos
- ✅ Repositório `usersRepo.js` também usa os valores corretos no seed

