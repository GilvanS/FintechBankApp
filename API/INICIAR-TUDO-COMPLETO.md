# 🚀 Iniciar TUDO (PostgreSQL + pgAdmin)

## ✅ Comandos para Iniciar Tudo

```bash
cd API

# Iniciar TODOS os serviços (database + pgadmin)
docker-compose up -d

# OU iniciar separadamente
docker-compose up -d database
docker-compose up -d pgadmin
```

---

## 🔍 Verificar se Está Rodando

```bash
# Ver containers rodando
docker ps

# Deve mostrar:
# - pgdb (postgres)
# - pgadmin (pgAdmin)

# Ver serviços do docker-compose
docker-compose ps
```

---

## 🌐 Acessar pgAdmin

Depois de iniciar, acesse no navegador:

- **URL**: http://localhost:16543
- **Email**: admin@test.com
- **Senha**: pwd123

---

## 🔗 Conectar ao Banco PostgreSQL no pgAdmin

1. Clique com botão direito em "Servers" → "Register" → "Server"
2. Na aba **"General"**:
   - **Name**: FintechBankApp
3. Na aba **"Connection"**:
   - **Host name/address**: `pgdb` (nome do container Docker)
   - **Port**: `5432`
   - **Maintenance database**: `postgres`
   - **Username**: `postgres`
   - **Password**: `pwd123`
   - **Save password**: ✅ (marcar se quiser)
4. Clique em **"Save"**

---

## 📋 Comandos Úteis

```bash
# Parar tudo
docker-compose down

# Parar e remover volumes (apaga dados)
docker-compose down -v

# Reiniciar tudo
docker-compose restart

# Ver logs do pgAdmin
docker-compose logs pgadmin

# Ver logs do PostgreSQL
docker-compose logs database
```

