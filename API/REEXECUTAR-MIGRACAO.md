# 🔧 Reexecutar Migração Corrigida

## ✅ O arquivo já foi corrigido!

O erro foi corrigido no arquivo `schema_invoice_lifecycle.sql`. Agora você precisa executar novamente:

## 🚀 Executar o Script Corrigido

```bash
cd API

# Executar o script corrigido
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
```

---

## 🔍 Se Ainda Der Erro

Se a coluna `valor_total` já foi criada mas com problemas, você pode corrigir manualmente:

```bash
# Conectar ao banco
docker exec -it pgdb psql -U postgres -d fintechbank

# No psql, executar:
UPDATE fintech.invoices SET valor_total = 0 WHERE valor_total IS NULL;
ALTER TABLE fintech.invoices ALTER COLUMN valor_total SET NOT NULL;

# Sair
\q
```

---

## ✅ Verificar se Funcionou

```bash
docker exec -i pgdb psql -U postgres -d fintechbank -c "\d fintech.invoices"
```

Você deve ver a coluna `valor_total` listada.

