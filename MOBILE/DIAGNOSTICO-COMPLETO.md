# 🔍 Diagnóstico Completo - APK não conecta com WiFi

## ✅ Confirmações

### IP está correto no código:
- ✅ `api.ts` linha 7: `const DEV_API_URL = 'http://192.168.0.105:3001';`
- ✅ `Login/index.tsx` linha 37: `const url = 'http://192.168.0.105:3001';`
- ✅ IP do PC: `192.168.0.105` (confirmado)

### Endpoints funcionam:
- ✅ `http://192.168.0.105:3001/api/health` - OK
- ✅ `http://192.168.0.105:3001/api/v1/health` - OK

## 🔍 Possíveis Problemas Identificados

### 1. **Problema: Cache com URL inválida**
**Solução aplicada**: `initializeApi()` agora ignora cache e sempre usa URL padrão

### 2. **Problema: Race Condition**
**Solução aplicada**: Adicionado delay antes de verificar status do servidor

### 3. **Problema: Network Security Config**
**Solução aplicada**: Melhorado `network_security_config.xml` com base-config

### 4. **Problema: Timeout muito curto**
**Solução aplicada**: Aumentado de 5s para 10s

## 🛠️ Correções Aplicadas

### 1. **initializeApi() - Ignora Cache**
```typescript
// SEMPRE usar a URL padrão no APK (ignorar cache)
// O cache pode ter URLs antigas ou inválidas
await setApiBaseUrl(DEV_API_URL);
```

### 2. **Teste de Conexão Inicial**
```typescript
// Testar conexão imediatamente após configurar
const testRes = await api.get('/health', { timeout: 5000 });
```

### 3. **Delay no checkServerStatus**
```typescript
// Aguardar inicialização da API antes de verificar
setTimeout(() => {
  checkServerStatus();
}, 1000);
```

### 4. **Network Security Config Melhorado**
- Adicionado `base-config cleartextTrafficPermitted="true"`
- Adicionado IP específico `192.168.0.105`

## 📋 Checklist de Diagnóstico

### No Celular (APK):
1. [ ] Abrir app
2. [ ] Verificar logs via Android Studio Logcat
3. [ ] Procurar por:
   - `🚀 Inicializando API...`
   - `✅ BaseURL configurada: http://192.168.0.105:3001/api/v1`
   - `❌ Erro de conexão:` (se houver)

### Teste de Conectividade Básica:
1. [ ] **No navegador do celular**, acesse: `http://192.168.0.105:3001/api/health`
   - Se funcionar: Problema está no código do APK
   - Se não funcionar: Problema de rede/firewall

### No PC:
1. [ ] API está rodando? `curl http://192.168.0.105:3001/api/health`
2. [ ] Firewall permite porta 3001?
3. [ ] IP fixo configurado? `ipconfig`
4. [ ] Celular e PC na mesma rede Wi-Fi?

## 🔧 Comandos de Diagnóstico

### Verificar Firewall (PowerShell como Admin):
```powershell
# Ver regras existentes
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*3001*"}

# Criar regra se não existir
New-NetFirewallRule -DisplayName "API Port 3001" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

### Verificar se API está acessível:
```powershell
# Testar do próprio PC
curl http://192.168.0.105:3001/api/health

# Testar de outro dispositivo na mesma rede
# (usar navegador do celular)
```

### Ver logs do APK (Android Studio):
1. Conecte celular via USB
2. Abra Android Studio
3. View → Tool Windows → Logcat
4. Filtre por: `fintech` ou `API` ou `🔍` ou `❌`

## 🚨 Problemas Comuns

### 1. **Firewall bloqueando**
**Sintoma**: Erro `ECONNREFUSED` ou `ERR_NETWORK`
**Solução**: Criar regra de firewall (comando acima)

### 2. **Rede Wi-Fi diferente**
**Sintoma**: Timeout ou `ERR_NETWORK`
**Solução**: Verificar se celular e PC estão na mesma rede

### 3. **IP mudou**
**Sintoma**: Erro de conexão
**Solução**: Verificar IP atual: `ipconfig` e atualizar no código se necessário

### 4. **API não está rodando**
**Sintoma**: `ECONNREFUSED`
**Solução**: Iniciar API: `cd API && npm run dev`

## 📝 Próximos Passos

1. **Rebuild APK** com as correções:
   ```powershell
   cd MOBILE
   npm run build
   npx cap sync android
   ```

2. **Gerar novo APK** no Android Studio

3. **Testar conectividade básica** primeiro (navegador do celular)

4. **Instalar APK** e verificar logs

5. **Se ainda não funcionar**, usar logs detalhados para identificar problema específico

