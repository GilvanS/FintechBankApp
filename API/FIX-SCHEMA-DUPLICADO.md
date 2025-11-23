# Correção do Schema Duplicado no Databricks

## Problema Identificado

O sistema está usando o mesmo nome para **catalog** e **schema** (`fintechbank`), o que causa duplicação nas queries:
- ❌ `fintechbank`.`fintechbank`.`users` (duplicado)
- ✅ `fintechbank`.`default`.`users` (correto)

## Solução Recomendada

### Opção 1: Usar Schema 'default' (Recomendado)

Configure a variável de ambiente `DATABRICKS_SCHEMA` para usar `default`:

**No Windows (PowerShell):**
```powershell
$env:DATABRICKS_SCHEMA = "default"
```

**Ou crie/edite o arquivo `.env` na pasta `API/`:**
```env
DATABRICKS_SCHEMA=default
```

### Opção 2: Usar um Schema Diferente do Catalog

Se você quiser usar um schema personalizado, use um nome diferente do catalog:

```env
DATABRICKS_CATALOG=fintechbank
DATABRICKS_SCHEMA=fintechbank_schema
```

## Correção Aplicada no Código

O método `fq()` já foi corrigido para evitar duplicação quando catalog e schema são iguais:

```javascript
fq(tableName) {
    // Evitar duplicação se catalog e schema forem iguais
    if (this.catalog === this.schema) {
        return `\`${this.catalog}\`.\`${tableName}\``;
    }
    return `\`${this.catalog}\`.\`${this.schema}\`.\`${tableName}\``;
}
```

**Mas é melhor usar schema 'default' para evitar problemas futuros!**

## Verificação

Após configurar, reinicie a API e verifique os logs:

```
📋 Catalog configurado: fintechbank
📋 Schema configurado: default
✅ Usando catálogo: fintechbank
```

Você **NÃO** deve ver mais o aviso:
```
⚠️  ATENÇÃO: Catalog e Schema são iguais...
```

## Criar Schema 'default' no Databricks (se necessário)

Se o schema 'default' não existir no seu catalog, você pode criá-lo:

```sql
CREATE SCHEMA IF NOT EXISTS fintechbank.default;
```

Ou use o schema que já existe no catalog.

