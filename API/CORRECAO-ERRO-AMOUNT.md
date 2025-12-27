# 🔧 Correção do Erro "column amount does not exist"

## ❌ Problema

O script `schema_invoice_lifecycle.sql` estava tentando usar uma coluna `amount` que não existe na tabela `invoices`:

```sql
UPDATE "fintech"."invoices"
SET valor_total = COALESCE(amount, 0)
WHERE valor_total IS NULL;
```

## ✅ Correção

Removi a referência à coluna `amount` inexistente. Agora o script define `valor_total = 0` para registros NULL:

```sql
UPDATE "fintech"."invoices"
SET valor_total = 0
WHERE valor_total IS NULL;
```

## 🚀 Execute Novamente

O arquivo `schema_invoice_lifecycle.sql` foi corrigido. Você pode executar novamente:

```bash
cd API
docker exec -i pgdb psql -U postgres -d fintechbank < schema_invoice_lifecycle.sql
```

Ou execute o script completo novamente:

```bash
cd API
chmod +x INSTALAR-COMPLETO.sh
./INSTALAR-COMPLETO.sh
```

