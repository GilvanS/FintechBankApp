# ⚡ Setup Rápido - Banco PostgreSQL

## 🚀 Execute Apenas Uma Vez no Git Bash

```bash
cd API
chmod +x setup-db.sh
./setup-db.sh
```

**Pronto!** O script faz tudo automaticamente:
- Para e remove containers antigos
- Inicia PostgreSQL
- Cria banco e schema
- Executa todos os scripts SQL
- Verifica se está tudo certo

---

## 📝 Depois, configure o `.env`:

```env
DB_PROVIDER=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=pwd123
DB_NAME=fintechbank
DB_SCHEMA=fintech
DB_SSL=false
```

---

## ✅ Verificar se Funcionou

```bash
docker exec -i pgdb psql -U postgres -d fintechbank -c "\dt fintech.*"
```

