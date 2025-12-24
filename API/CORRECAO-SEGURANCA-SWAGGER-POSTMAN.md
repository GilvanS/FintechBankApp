# Correção de Segurança - Swagger e Postman Collection

## 📋 Resumo

Este documento descreve as correções realizadas para garantir que os endpoints do Swagger e da Postman Collection estejam marcados corretamente com autenticação (security/token).

## ✅ Correções Aplicadas

### Swagger (swagger.yaml)

1. **POST /pix/recipient-info** - ✅ Adicionado `security: bearerAuth`
   - Este endpoint requer autenticação conforme código (`bearerAuth()`)

2. **GET /users/{cpf}/pix-daily-usage** - ✅ Adicionado `security: bearerAuth`
   - Este endpoint requer autenticação conforme código (`bearerAuth()`)

### Postman Collection (postman-collection.json)

1. **POST /pix/recipient-info** (Recipient Info 404) - ✅ Adicionado header `Authorization: Bearer {{token}}`
2. **POST /pix/recipient-info** (Recipient Info 200) - ✅ Adicionado header `Authorization: Bearer {{token}}`

## 📝 Endpoints que NÃO Precisam de Autenticação

Os seguintes endpoints são públicos e **NÃO devem ter** security/token:

- `GET /health` - Health check
- `POST /auth/login` - Login de usuário
- `POST /auth/signup` - Cadastro de usuário
- `POST /auth/request-password-reset` - Solicitar reset de senha
- `POST /auth/reset-password` - Redefinir senha
- `GET /shop/products` - Listar produtos (público)
- `GET /pix/recipient-info` - Consultar destinatário via query params (público)

**Nota:** O `GET /pix/recipient-info` com query params é público, mas o `POST /pix/recipient-info` com body requer autenticação.

## 🔧 Scripts Criados

### 1. `fix-swagger-security.js`
Script para corrigir automaticamente a segurança no Swagger e Postman Collection.

**Uso:**
```bash
node fix-swagger-security.js
```

### 2. `verify-security.js`
Script para verificar e reportar quais endpoints precisam de correção.

**Uso:**
```bash
node verify-security.js
```

## 📊 Como Verificar

Para verificar se todos os endpoints estão corretos:

```bash
cd API
node verify-security.js
```

O script irá reportar:
- ✅ Endpoints que estão corretos
- ❌ Endpoints que precisam de correção (falta ou sobra security/token)

## 🔍 Verificação Manual

### Swagger
Procure por `security:` nos endpoints. Deve ter:
```yaml
security:
  - bearerAuth: []
```

### Postman Collection
Procure por `Authorization` nos headers. Deve ter:
```json
{
  "key": "Authorization",
  "value": "Bearer {{token}}"
}
```

## 📌 Próximos Passos

1. Executar `verify-security.js` periodicamente para garantir consistência
2. Quando adicionar novos endpoints, verificar se precisam de autenticação
3. Atualizar este documento se houver mudanças significativas

## 🔐 Referência de Autenticação

- **Bearer Token**: Todos os endpoints autenticados usam Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`
- **Obtém token**: Fazendo login via `POST /auth/login`
