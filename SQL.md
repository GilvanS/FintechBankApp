# Documentação de Scripts e Consultas SQL — Fintech Bank App

**Arquivo:** `SQL.md`  
**Banco de Dados:** PostgreSQL (`schema: fintech`)  
**Tabelas Principais:** `fintech.users`, `fintech.cards`, `fintech.invoices`

---

## 1. Ordenação de Usuários por Data e Hora (`created_at` / `updated_at`)

### 📅 1.1 Do Mais Recente para o Mais Antigo (Ordem Decrescente — `DESC`)
Utilize esta consulta para listar os últimos usuários cadastrados via Gerador de Massa 360° ou Cadastro no topo:

```sql
SELECT 
    u.cpf,
    u.full_name,
    u.email,
    u.role,
    u.card_brand,
    u.created_at,
    u.updated_at
FROM fintech.users AS u
ORDER BY u.created_at DESC;
```

---

### 📜 1.2 Do Mais Antigo para o Mais Recente (Ordem Crescente — `ASC`)
Utilize esta consulta para listar a base histórica desde o primeiro usuário cadastrado:

```sql
SELECT 
    u.cpf,
    u.full_name,
    u.email,
    u.role,
    u.created_at
FROM fintech.users AS u
ORDER BY u.created_at ASC;
```

---

### 🔄 1.3 Pela Data da Última Atualização (`updated_at DESC`)
Para identificar quais usuários tiveram dados, saldo ou status alterados recentemente:

```sql
SELECT 
    u.cpf,
    u.full_name,
    u.balance,
    u.card_is_activated,
    u.updated_at
FROM fintech.users AS u
ORDER BY u.updated_at DESC;
```

---

## 2. Consultas de Cartões de Crédito (`fintech.cards`)

### 💳 2.1 Listar Cartões de um Usuário com Detalhes das Bandeiras
```sql
SELECT 
    c.id,
    c.user_cpf,
    c.card_number,
    c.card_type,
    UPPER(c.card_brand) AS bandeira,
    c.bin,
    c.expiry,
    c.cvv,
    c.is_activated,
    c.created_at
FROM fintech.cards AS c
WHERE c.user_cpf = '11111111111'
ORDER BY c.created_at DESC;
```

---

### 🏷️ 2.2 Agrupamento e Contagem de Cartões por Bandeira
```sql
SELECT 
    UPPER(c.card_brand) AS bandeira,
    c.card_type,
    COUNT(*) AS total_emitido
FROM fintech.cards AS c
GROUP BY c.card_brand, c.card_type
ORDER BY total_emitido DESC;
```

---

## 3. Consultas de Adimplência e Inadimplência (`users`)

### ⚠️ 3.1 Listar Usuários com Faturas Vencidas / Em Atraso
```sql
SELECT 
    u.cpf,
    u.full_name,
    u.days_overdue,
    u.overdue_status,
    u.credit_card_total_limit,
    u.credit_card_available_limit
FROM fintech.users AS u
WHERE u.days_overdue > 0 OR u.overdue_status = 'EM_ATRASO'
ORDER BY u.days_overdue DESC;
```

---

## 4. Execução de Scripts via Terminal (Node.js)

Se preferir executar diretamente do terminal sem abrir a interface de banco:

```bash
# Listar usuários ordenados por data de criação (Mais Recente Primeiro)
node API/scripts/list-users-sorted.cjs DESC

# Listar usuários ordenados por data de criação (Mais Antigo Primeiro)
node API/scripts/list-users-sorted.cjs ASC

# Listar por data de atualização
node API/scripts/list-users-sorted.cjs DESC updated
```

---

## 5. Dica de Atalho no DBeaver / DataGrip

Para ordenar sem digitar SQL:
1. Abra a tabela `fintech.users` na aba **Dados**.
2. Clique no título da coluna `created_at`.
3. Clique no ícone de seta (`↓` para `DESC`, `↑` para `ASC`).
