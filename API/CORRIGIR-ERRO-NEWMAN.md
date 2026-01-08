# 🔧 Corrigir Erro do Newman

## ❌ Erro Encontrado

```
newman: could not find "cli html json" reporter
```

## 🔍 Causa

O comando `-r cli,html,json` não funciona corretamente. A sintaxe está incorreta ou o `newman-reporter-html` não está instalado corretamente.

## ✅ Soluções

### Solução 1: Usar Script Node.js (Recomendado)

O script `run-newman-tests.js` já está configurado corretamente e usa apenas o reporter CLI (que vem com o Newman):

```bash
cd API
node run-newman-tests.js
```

ou

```bash
npm run test:api
```

### Solução 2: Usar Script PowerShell

```powershell
cd API
.\test-api-completo.ps1
```

ou

```powershell
.\test-newman.ps1
```

### Solução 3: Newman CLI com Sintaxe Correta

Se quiser usar o Newman CLI diretamente, use apenas o reporter CLI:

```bash
cd API
npx newman run postman-collection.json -e postman-environment.json
```

### Solução 4: Instalar Reporter HTML (Opcional)

Se quiser gerar relatórios HTML, instale o reporter:

```bash
cd API
npm install newman-reporter-html --save-dev --legacy-peer-deps
```

Depois, edite `run-newman-tests.js` e descomente as linhas dos reporters HTML/JSON.

## 🎯 Recomendação

**Use o script Node.js** (`node run-newman-tests.js`) que já está configurado e funciona sem problemas adicionais.
