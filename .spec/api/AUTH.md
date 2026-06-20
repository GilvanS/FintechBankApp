# Spec: Auth

**Arquivo de implementação:** `API/index.cjs` (rotas `/auth/*`)
**Status:** Implementado

## Endpoints

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/auth/signup` | — | Cadastro de novo usuário |
| POST | `/auth/login` | — | Login, retorna JWT |
| POST | `/auth/logout` | — | Logout (invalida sessão client-side) |
| POST | `/auth/request-password-reset` | — | Solicita reset de senha |
| POST | `/auth/reset-password` | — | Redefine senha com token |

## Regras

### Signup
- CPF único — erro 409 se já existe
- Password: hash bcrypt
- Role default: `'user'`
- `account_status` default: `'adimplente'`
- Campos obrigatórios: `cpf`, `fullName`, `email`, `password`

### Login
- Rate limiting: `loginLimiter` (previne brute force)
- Retorna: `{ token: "Bearer <jwt>", user: { cpf, fullName, role, ... } }`
- JWT payload: `{ cpf, role }`
- JWT secret: obrigatoriamente `process.env.JWT_SECRET`

### Middleware `bearerAuth()`
- Extrai `Authorization: Bearer <token>`
- Seta `req.user = { cpf, role }`
- 401 se token inválido/expirado

### Admin check
- `authenticateAdmin` verifica `req.user.role === 'admin'`

## Schema de entrada (signup)

```json
{
  "cpf": "12345678901",
  "fullName": "Nome Completo",
  "email": "user@email.com",
  "password": "senha123"
}
```

## Resposta de login

```json
{
  "token": "eyJ...",
  "user": {
    "cpf": "12345678901",
    "fullName": "Nome Completo",
    "role": "user",
    "balance": 0,
    "accountStatus": "adimplente"
  }
}
```
