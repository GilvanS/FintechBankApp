# 🚀 Como Iniciar pgAdmin no Docker Desktop

## 🔍 Problema

O `localhost:16543` (pgAdmin) não aparece no Docker Desktop.

## ✅ Solução

O pgAdmin precisa ser iniciado separadamente no docker-compose:

```bash
cd API

# Iniciar apenas o pgAdmin
docker-compose up -d pgadmin

# OU iniciar tudo (database + pgadmin)
docker-compose up -d
```

---

## 📋 Comandos Úteis

```bash
# Ver containers rodando
docker ps

# Ver todos os serviços
docker-compose ps

# Iniciar todos os serviços
docker-compose up -d

# Parar todos
docker-compose down

# Ver logs do pgAdmin
docker-compose logs pgadmin
```

---

## 🌐 Acessar pgAdmin

Depois de iniciar, acesse:

- **URL**: http://localhost:16543
- **Email**: admin@test.com
- **Senha**: pwd123

---

## 🔗 Conectar ao Banco PostgreSQL

No pgAdmin:

1. Clique com botão direito em "Servers" → "Register" → "Server"
2. Na aba "General":
   - **Name**: FintechBankApp
3. Na aba "Connection":
   - **Host name/address**: pgdb (nome do container)
   - **Port**: 5432
   - **Maintenance database**: postgres
   - **Username**: postgres
   - **Password**: pwd123
4. Clique em "Save"

