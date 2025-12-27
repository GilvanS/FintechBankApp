# ✅ Comando Correto para Reexecutar Migração

## ❌ Erro

Você está executando o comando na pasta errada! O arquivo `schema_invoice_lifecycle.sql` está na pasta `API`.

## ✅ Solução

Navegue para a pasta `API` primeiro:

```bash
cd API
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
```

---

## 🔍 Ou Use Caminho Completo

Se preferir ficar na raiz do projeto:

```bash
docker exec -i pgdb psql -U postgres -d fintechbank < API/schema_invoice_lifecycle.sql
```

---

## ✅ Verificar se Está no Diretório Correto

```bash
# Ver onde está
pwd

# Deve mostrar: .../FintechBankApp/API

# Verificar se o arquivo existe
ls schema_invoice_lifecycle.sql
```

