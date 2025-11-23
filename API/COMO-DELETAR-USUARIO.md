# 🗑️ Como Deletar um Usuário para Testar Cadastro Novamente

## ✅ Situação Atual

O usuário `88888888888` já existe no banco de dados. O cadastro funcionou, mas o app pode ter recebido um timeout.

## 🔧 Opção 1: Tentar Fazer Login (Recomendado)

**Tente fazer login primeiro:**
- CPF: `88888888888`
- Senha: `admin999`

Se funcionar, o cadastro está OK! ✅

## 🗑️ Opção 2: Deletar Usuário via API (Admin)

Se você quiser testar o cadastro novamente, pode deletar o usuário:

### Via Swagger/Postman:

1. **Fazer login como admin:**
   - POST `/api/v1/auth/login`
   - Body: `{ "cpf": "99999999999", "password": "admin999" }`
   - Copiar o `token` da resposta

2. **Deletar usuário:**
   - DELETE `/api/v1/debug/user/88888888888`
   - Header: `Authorization: Bearer {token}`

### Via cURL:

```bash
# 1. Login como admin
curl -X POST http://192.168.0.105:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"cpf":"99999999999","password":"admin999"}'

# 2. Copiar o token da resposta e usar aqui:
curl -X DELETE http://192.168.0.105:3001/api/v1/debug/user/88888888888 \
  -H "Authorization: Bearer {SEU_TOKEN_AQUI}"
```

## 🗑️ Opção 3: Deletar Direto no Databricks

Se você tem acesso ao Databricks, pode executar:

```sql
DELETE FROM `fintechbank`.`default`.`users` WHERE cpf = '88888888888';
```

## 📝 Resumo

**O cadastro funcionou!** O usuário foi criado. O problema pode ter sido apenas um timeout na resposta HTTP.

**Recomendação:** Tente fazer login primeiro. Se funcionar, está tudo OK! ✅

