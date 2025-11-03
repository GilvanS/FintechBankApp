# 🚀 Comandos cURL para Testar a API FintechBankApp

## 📋 FASE 1: DIAGNÓSTICO E PREPARAÇÃO

### 1.1 Health Check
```bash
curl -X GET "http://localhost:3001/api/v1/health"
```

### 1.2 Login do Administrador
```bash
curl -X POST "http://localhost:3001/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"cpf":"00000000000","password":"admin123"}'
```
**Salve o token retornado como ADMIN_TOKEN**

### 1.3 Login do Usuário de Teste
```bash
curl -X POST "http://localhost:3001/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"cpf":"12345678901","password":"123456"}'
```
**Salve o token retornado como USER_TOKEN**

## 📊 FASE 2: VALIDAÇÃO POR CATEGORIA

### 2.1 Endpoints de Diagnóstico (Admin)

#### Verificar Tabelas
```bash
curl -X GET "http://localhost:3001/api/v1/debug/tables" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Debug do Usuário
```bash
curl -X GET "http://localhost:3001/api/v1/debug/user/12345678901" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 2.2 Endpoints de Usuário

#### Consultar Saldo
```bash
curl -X GET "http://localhost:3001/api/v1/users/12345678901/balance" \
  -H "Authorization: Bearer USER_TOKEN"
```

#### Consultar Extrato
```bash
curl -X GET "http://localhost:3001/api/v1/users/12345678901/statement" \
  -H "Authorization: Bearer USER_TOKEN"
```

### 2.3 Endpoints PIX

#### Listar Contatos PIX
```bash
curl -X GET "http://localhost:3001/api/v1/pix/contacts/12345678901" \
  -H "Authorization: Bearer USER_TOKEN"
```

#### Adicionar Contato PIX
```bash
curl -X POST "http://localhost:3001/api/v1/pix/contacts/12345678901" \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"11999887766","name":"João Silva"}'
```

#### Listar Contatos PIX (após adição)
```bash
curl -X GET "http://localhost:3001/api/v1/pix/contacts/12345678901" \
  -H "Authorization: Bearer USER_TOKEN"
```

### 2.4 Endpoints Admin

#### Listar Todos os Usuários
```bash
curl -X GET "http://localhost:3001/api/v1/admin/users" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Consultar Usuário Específico
```bash
curl -X GET "http://localhost:3001/api/v1/admin/users/12345678901" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## 🔧 Como Usar

1. **Inicie o servidor**: `cd server && npm start`
2. **Execute os comandos na ordem**: Comece pela Fase 1, depois Fase 2
3. **Substitua os tokens**: Use os tokens reais obtidos nos logins
4. **Observe os logs**: Verifique o console do servidor para detalhes

## 📝 Exemplo Prático

```bash
# 1. Health Check
curl -X GET "http://localhost:3001/api/v1/health"

# 2. Login Admin (salve o token)
ADMIN_TOKEN=$(curl -s -X POST "http://localhost:3001/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"cpf":"00000000000","password":"admin123"}' | jq -r '.token')

# 3. Login User (salve o token)
USER_TOKEN=$(curl -s -X POST "http://localhost:3001/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"cpf":"12345678901","password":"123456"}' | jq -r '.token')

# 4. Teste um endpoint
curl -X GET "http://localhost:3001/api/v1/users/12345678901/balance" \
  -H "Authorization: Bearer $USER_TOKEN"
```