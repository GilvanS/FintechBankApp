# Análise: Usuário 11111111111 parou de funcionar

## 🔍 Problema Identificado

O usuário com CPF `11111111111` está cadastrado no banco de dados, mas não consegue fazer login.

## 📋 Possíveis Causas

### 1. **Usuário Bloqueado (is_blocked = true)**
   - Se o campo `is_blocked` estiver como `true`, o login será bloqueado
   - Código de verificação: `if (user.is_blocked) return ... AUTH_BLOCKED`

### 2. **Senha Hash NULL ou Vazio**
   - Se o campo `password_hash` estiver NULL ou vazio, o `bcrypt.compare()` falhará
   - **CORREÇÃO APLICADA**: Adicionada validação no código de login para detectar esse caso

### 3. **Senha Incorreta**
   - A senha esperada conforme `signupA.json` é: `Senha123`
   - Se a senha no banco foi alterada ou corrompida, o login falhará

### 4. **Muitas Tentativas de Login Falhadas**
   - O campo `login_attempts` pode estar alto, mas não bloqueia o login diretamente
   - Serve apenas como indicador

## 🔧 Soluções

### Solução 1: Script de Correção Automática (Recomendado)

Execute o script Node.js que corrige automaticamente o usuário:

```bash
cd API
node fix-user-11111111111.js
```

Este script irá:
- ✅ Verificar o status atual do usuário
- ✅ Desbloquear o usuário (se estiver bloqueado)
- ✅ Resetar a senha para `Senha123`
- ✅ Limpar tentativas de login
- ✅ Resetar flag de solicitação de reset de senha

### Solução 2: Correção Manual via SQL

Execute a seguinte query no seu banco de dados:

```sql
-- Verificar status atual
SELECT 
    cpf,
    full_name,
    email,
    is_blocked,
    login_attempts,
    CASE 
        WHEN password_hash IS NULL THEN 'NULL'
        WHEN password_hash = '' THEN 'VAZIO'
        ELSE 'DEFINIDO'
    END as password_status
FROM users
WHERE cpf = '11111111111';

-- CORREÇÃO COMPLETA (desbloquear + resetar senha)
-- NOTA: Você precisará gerar um novo hash bcrypt para a senha 'Senha123'
-- Use Node.js: const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('Senha123', 10));

UPDATE users 
SET is_blocked = false,
    login_attempts = 0,
    password_reset_requested = false,
    updated_at = CURRENT_TIMESTAMP
WHERE cpf = '11111111111';
```

### Solução 3: Usar API de Reset de Senha

1. Solicitar reset de senha:
```bash
POST /api/auth/request-password-reset
Body: { "cpf": "11111111111" }
```

2. Redefinir senha (token = últimos 4 dígitos do CPF = "1111"):
```bash
POST /api/auth/reset-password
Body: { 
    "cpf": "11111111111",
    "token": "1111",
    "newPassword": "Senha123"
}
```

### Solução 4: Correção via Admin (se disponível)

Se você tem acesso como administrador, pode:
- Desbloquear o usuário via API admin
- Resetar a senha via API admin

## 🔍 Diagnóstico

### Verificar Status do Usuário

Para verificar o status atual do usuário, use o script de diagnóstico:

```bash
cd API
node check-user.js
```

Este script mostrará:
- ✅ Se o usuário existe
- ✅ Status de bloqueio
- ✅ Número de tentativas de login
- ✅ Se a senha está definida
- ✅ Todos os campos relevantes

### Testar Login

Para testar o login após correção:

```bash
cd API
node test-login.js
```

Ou via curl:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"cpf":"11111111111","password":"Senha123"}'
```

## 📝 Correções Aplicadas no Código

1. **Validação de password_hash no login** (index.cjs linha ~391)
   - Adicionada verificação se `password_hash` existe antes de comparar
   - Retorna erro específico `AUTH_NO_PASSWORD` se a senha não estiver definida
   - Isso ajuda a identificar o problema mais rapidamente

## ✅ Checklist de Verificação

- [ ] Usuário existe no banco de dados
- [ ] `is_blocked` = `false` ou `NULL`
- [ ] `password_hash` não é NULL e não está vazio
- [ ] `password_hash` é um hash bcrypt válido
- [ ] Senha usada no login corresponde ao hash
- [ ] Sem erros de conexão com banco de dados
- [ ] Servidor está rodando e acessível

## 💡 Prevenção

Para evitar esse problema no futuro:

1. **Validação no Signup**: Garantir que sempre seja criado um `password_hash` válido
2. **Validação no Login**: Verificar se `password_hash` existe (já implementado)
3. **Logs**: Os logs do servidor mostrarão problemas específicos durante o login
4. **Monitoramento**: Monitorar tentativas de login falhadas e usuários bloqueados

## 📞 Suporte

Se o problema persistir após tentar as soluções acima:

1. Verifique os logs do servidor durante uma tentativa de login
2. Execute o script de diagnóstico: `node check-user.js`
3. Verifique a conexão com o banco de dados
4. Verifique se o banco de dados não está em modo mock
