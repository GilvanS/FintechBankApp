# 🚀 Solução Rápida - Problemas de Conexão

## Problema 1: Porta 3001 em Uso

### Solução Imediata:

1. **Pare o preview do mobile** que está usando a porta 3001:
   - Pressione `Ctrl+C` no terminal onde está rodando `npm run preview`
   - Ou execute o script: `.\API\kill-port-3001.ps1`

2. **Inicie a API primeiro** (porta 3001):
   ```powershell
   cd API
   npm run dev
   ```

3. **Depois inicie o preview do mobile** (porta 3002):
   ```powershell
   cd MOBILE
   npm run preview
   ```

### Ordem Correta de Inicialização:

1. ✅ **API primeiro**: `cd API && npm run dev` (porta 3001)
2. ✅ **Mobile depois**: `cd MOBILE && npm run preview` (porta 3002)

## Problema 2: Schema Duplicado no Databricks

### Solução:

Configure o schema para usar `default` ao invés de `fintechbank`:

**Crie/edite o arquivo `API/.env`:**
```env
DATABRICKS_SCHEMA=default
```

Ou configure via PowerShell antes de iniciar:
```powershell
$env:DATABRICKS_SCHEMA = "default"
cd API
npm run dev
```

### Verificação:

Após configurar, você deve ver nos logs:
```
📋 Catalog configurado: fintechbank
📋 Schema configurado: default
✅ Usando catálogo: fintechbank
```

**NÃO deve aparecer mais:**
```
⚠️  ATENÇÃO: Catalog e Schema são iguais...
```

## Problema 3: Erro "Servidor offline" no Mobile

### Verificações:

1. ✅ API está rodando na porta 3001?
2. ✅ Preview do mobile está rodando na porta 3002?
3. ✅ Ambos estão na mesma rede Wi-Fi?
4. ✅ IP fixo configurado no Windows? (veja `CONFIG-IP-FIXO-WINDOWS.md`)

### Teste de Conexão:

No mobile, acesse: `http://192.168.0.105:3001/api/health`

Deve retornar: `{"status":"ok"}`

## Checklist Rápido

- [ ] Porta 3001 liberada (API)
- [ ] Porta 3002 disponível (Preview Mobile)
- [ ] Schema configurado como `default` no `.env`
- [ ] API iniciada primeiro (`cd API && npm run dev`)
- [ ] Preview iniciado depois (`cd MOBILE && npm run preview`)
- [ ] IP fixo configurado no Windows (192.168.0.105)
- [ ] Mobile e PC na mesma rede Wi-Fi

## Comandos Rápidos

```powershell
# 1. Liberar porta 3001
.\API\kill-port-3001.ps1

# 2. Configurar schema
$env:DATABRICKS_SCHEMA = "default"

# 3. Iniciar API
cd API
npm run dev

# 4. Em outro terminal, iniciar preview
cd MOBILE
npm run preview
```

## URLs de Acesso

- **API**: http://192.168.0.105:3001
- **Swagger**: http://192.168.0.105:3001/api-docs
- **Mobile Preview**: http://192.168.0.105:3002
- **Health Check**: http://192.168.0.105:3001/api/health

