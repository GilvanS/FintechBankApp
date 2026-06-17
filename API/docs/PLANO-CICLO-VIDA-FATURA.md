# 📋 Plano de Implementação: Ciclo de Vida da Fatura

## 📊 Análise da Situação Atual

### ✅ O que já existe:
1. **Tabela `invoices`** com campos básicos:
   - `id`, `cpf`, `status`, `due_date`, `created_at`, `updated_at`
   
2. **Campo `credit_card_invoice_due_date`** na tabela `users`:
   - Define a data de vencimento da fatura do cartão
   - Usado para calcular fatura aberta/fechada

3. **Status de fatura manual (Admin)**:
   - Admin pode alterar status via `/admin/invoices/:cpf/:invoiceId/status`
   - Status disponíveis: `FECHADA`, `ABERTA`, `FECHADA_COM_ATRASO`, `BLOQUEADA`

### ❌ O que falta:
1. **Validação automática de vencimento** - Não há função que verifica e atualiza status de ABERTA para VENCIDA automaticamente
2. **Calendário de vencimentos configurável** - Não há sistema para usuário configurar dia de vencimento do cartão
3. **Contagem de dias em atraso** - Não há rastreamento de quantos dias a fatura está vencida
4. **Bloqueio automático por atraso** - Não há bloqueio automático após X dias de atraso
5. **Campo `data_pagamento`** - Não há na tabela invoices para rastrear quando foi pago

---

## 🎯 Plano de Implementação

### FASE 1: Atualizar Schema do Banco de Dados

#### 1.1 Atualizar tabela `invoices`
Adicionar campos necessários:
- `valor_total` (DECIMAL) - Valor total da fatura
- `data_pagamento` (TIMESTAMP, NULL) - Data em que foi pago
- `dias_atraso` (INTEGER, DEFAULT 0) - Quantidade de dias em atraso
- `valor_juros` (DECIMAL, DEFAULT 0) - Juros acumulados por atraso
- `valor_multa` (DECIMAL, DEFAULT 0) - Multa por atraso
- `valor_total_com_encargos` (DECIMAL) - Valor total incluindo juros e multas

#### 1.2 Criar tabela `card_due_date_calendar` (Calendário de Vencimentos)
Para permitir que usuários configurem o dia de vencimento do cartão:
```sql
CREATE TABLE card_due_date_calendar (
    id VARCHAR(255) PRIMARY KEY,
    cpf VARCHAR(11) NOT NULL,
    day_of_month INTEGER NOT NULL, -- Dia do mês (1-31)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cpf) -- Um usuário tem apenas uma configuração ativa
);
```

#### 1.3 Adicionar campos na tabela `users`
- `credit_card_due_day` (INTEGER) - Dia do mês de vencimento (1-31, ex: 15 = dia 15 de cada mês)
- `invoice_last_closed_date` (TIMESTAMP) - Data da última fatura fechada
- `days_overdue` (INTEGER, DEFAULT 0) - Dias em atraso da fatura atual

---

### FASE 2: Implementar Função de Validação de Vencimento

#### 2.1 Criar função `checkInvoiceOverdue`
Função que:
1. Busca todas as faturas com status `ABERTA`
2. Compara `due_date` com data atual
3. Atualiza status para `VENCIDA` se passou a data
4. Calcula dias em atraso
5. Atualiza campo `dias_atraso`

#### 2.2 Integrar validação nos endpoints
- Chamar `checkInvoiceOverdue` sempre que:
  - Buscar dados do usuário (`/users/me`)
  - Buscar fatura (`/users/:cpf/invoices/:id`)
  - Pagar fatura (`/cards/invoice/pay`)

#### 2.3 Criar job/cron diário (opcional)
- Executar validação automática uma vez por dia
- Atualizar status de todas as faturas vencidas

---

### FASE 3: Implementar Calendário de Vencimentos

#### 3.1 Endpoint para configurar dia de vencimento
- `PUT /users/me/card-due-day`
  - Permite usuário configurar dia de vencimento (1-31)
  - Atualiza `credit_card_due_day` na tabela users

#### 3.2 Lógica de cálculo automático de vencimento
- Quando criar nova fatura, usar `credit_card_due_day` para calcular próxima data
- Calcular `due_date` baseado no mês seguinte ao fechamento

---

### FASE 4: Sistema de Bloqueio por Atraso

#### 4.1 Regras de bloqueio
- **7 dias em atraso**: Bloquear cartão automaticamente
- **30 dias em atraso**: Bloqueio permanente (requer pagamento total + juros)
- **Desbloqueio**: Apenas após pagamento da fatura vencida

#### 4.2 Função `checkAndBlockOverdueCards`
- Verifica faturas com status `VENCIDA`
- Calcula dias em atraso
- Bloqueia cartão se >= 7 dias
- Atualiza status para `BLOQUEADA` se >= 30 dias

---

### FASE 5: Cálculo de Juros e Multas

#### 5.1 Regras de encargos
- **Juros**: 1% ao mês (proporcional por dia)
- **Multa**: 2% do valor total após vencimento
- **Máximo**: 10% do valor original em encargos

#### 5.2 Função `calculateOverdueCharges`
- Calcula juros proporcionais aos dias
- Aplica multa de 2%
- Atualiza campos na tabela invoices

---

## 🗄️ Schema Proposto

### Tabela `invoices` (Atualizada)
```sql
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(255) PRIMARY KEY,
    cpf VARCHAR(11) NOT NULL,
    status VARCHAR(50) NOT NULL, -- ABERTA | VENCIDA | FECHADA | FECHADA_COM_ATRASO | BLOQUEADA
    valor_total DECIMAL(15,2) NOT NULL,
    valor_total_com_encargos DECIMAL(15,2),
    due_date TIMESTAMP NOT NULL,
    data_pagamento TIMESTAMP NULL,
    dias_atraso INTEGER DEFAULT 0,
    valor_juros DECIMAL(15,2) DEFAULT 0.00,
    valor_multa DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cpf_status (cpf, status),
    INDEX idx_due_date (due_date)
);
```

### Tabela `card_due_date_calendar` (Nova)
```sql
CREATE TABLE IF NOT EXISTS card_due_date_calendar (
    id VARCHAR(255) PRIMARY KEY,
    cpf VARCHAR(11) NOT NULL UNIQUE,
    day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Campos adicionais na tabela `users`
```sql
ALTER TABLE users ADD COLUMN credit_card_due_day INTEGER DEFAULT 15; -- Dia 15 por padrão
ALTER TABLE users ADD COLUMN invoice_last_closed_date TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN days_overdue INTEGER DEFAULT 0;
```

---

## 🔄 Fluxo de Validação de Vencimento

### Fluxo Diário Automático
```
1. Job diário executa `checkInvoiceOverdue()` às 00:00
2. Busca faturas com status='ABERTA' E due_date < hoje
3. Para cada fatura encontrada:
   a. Calcula dias_atraso = hoje - due_date
   b. Atualiza status para 'VENCIDA'
   c. Calcula juros e multas
   d. Atualiza valor_total_com_encargos
4. Se dias_atraso >= 7:
   a. Bloqueia cartão (credit_card_is_blocked = true)
5. Se dias_atraso >= 30:
   a. Mantém bloqueio
   b. Status pode ser alterado para 'BLOQUEADA' (manual ou automático)
```

### Fluxo ao Consultar Fatura
```
1. Usuário consulta fatura via /users/me
2. Sistema executa checkInvoiceOverdue() para aquele CPF
3. Retorna status atualizado (ABERTA ou VENCIDA)
4. Calcula e retorna dias_atraso
```

---

## 📝 Endpoints a Criar/Atualizar

### Novos Endpoints
1. `PUT /users/me/card-due-day`
   - Permite usuário configurar dia de vencimento (1-31)
   
2. `GET /users/me/invoice-status`
   - Retorna status atual da fatura com validação automática
   - Inclui dias em atraso, juros, multas

3. `POST /admin/invoices/check-overdue` (Admin)
   - Força validação de todas as faturas
   - Retorna relatório de faturas atualizadas

### Endpoints a Atualizar
1. `GET /users/me`
   - Adicionar chamada para `checkInvoiceOverdue()`
   - Retornar `daysOverdue` no objeto creditCard

2. `POST /cards/invoice/pay`
   - Validar vencimento antes de pagar
   - Aplicar juros/multas se vencida
   - Atualizar `data_pagamento`

---

## 🧪 Testes Necessários

### Testes Unitários
1. Teste de cálculo de dias em atraso
2. Teste de transição ABERTA -> VENCIDA
3. Teste de cálculo de juros e multas
4. Teste de bloqueio automático (7 dias)
5. Teste de cálculo de próxima data de vencimento

### Testes de Integração
1. Fluxo completo: criação -> vencimento -> pagamento
2. Fluxo com bloqueio automático
3. Configuração de dia de vencimento pelo usuário

---

## 📅 Cronograma de Implementação

### Sprint 1: Schema e Estrutura
- [ ] Atualizar schema da tabela `invoices`
- [ ] Criar tabela `card_due_date_calendar`
- [ ] Adicionar campos na tabela `users`
- [ ] Criar scripts de migração

### Sprint 2: Validação de Vencimento
- [ ] Implementar função `checkInvoiceOverdue()`
- [ ] Integrar validação em endpoints existentes
- [ ] Criar endpoint de configuração de dia de vencimento

### Sprint 3: Bloqueio e Encargos
- [ ] Implementar bloqueio automático
- [ ] Implementar cálculo de juros e multas
- [ ] Criar endpoints de consulta de status

### Sprint 4: Testes e Documentação
- [ ] Testes unitários
- [ ] Testes de integração
- [ ] Atualizar Swagger
- [ ] Documentação de uso

---

## 🔍 Considerações Importantes

1. **Performance**: Validação automática deve ser eficiente para não impactar consultas
2. **Consistência**: Garantir que múltiplas validações simultâneas não causem race conditions
3. **Auditoria**: Log de todas as transições de status
4. **Notificações**: Enviar notificação quando fatura vencida ou cartão bloqueado
5. **Recuperação**: Permitir desbloqueio após pagamento mesmo com atraso

