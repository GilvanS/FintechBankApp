# ✅ Correções Aplicadas - Conexão APK com API WiFi

## 🔧 Correções no Código

### 1. **api.ts - Ignorar Cache e Testar Conexão**
```typescript
export const initializeApi = async () => {
    // SEMPRE usar a URL padrão no APK (ignorar cache)
    // O cache pode ter URLs antigas ou inválidas
    await setApiBaseUrl(DEV_API_URL);
    
    // Testar conexão imediatamente após configurar
    try {
        const testRes = await api.get('/health', { timeout: 5000 });
        console.log('✅ Conexão inicial OK:', testRes.status);
    } catch (testError: any) {
        console.warn('⚠️ Conexão inicial falhou:', testError.message);
    }
};
```

**Por quê?** O cache pode ter URLs antigas ou inválidas que impedem a conexão.

### 2. **Login/index.tsx - Delay para Evitar Race Condition**
```typescript
useEffect(() => {
    // Aguardar inicialização da API antes de verificar status
    const timer = setTimeout(() => {
        checkServerStatus();
    }, 1000);
    return () => clearTimeout(timer);
}, [checkServerStatus]);
```

**Por quê?** O `checkServerStatus` pode ser executado antes do `initializeApi()` terminar.

### 3. **Timeout Aumentado**
```typescript
const response = await api.get('/health', { 
    timeout: 10000, // Aumentado de 5s para 10s
    validateStatus: (status) => status < 500
});
```

**Por quê?** Conexões WiFi podem ser mais lentas que localhost.

### 4. **Logs Detalhados Adicionados**
- Logs em cada etapa da inicialização
- Logs de erro com detalhes completos
- Logs da URL completa sendo usada

**Por quê?** Facilita diagnóstico de problemas.

## ✅ Configurações Verificadas

### 1. **Network Security Config** ✅
- `cleartextTrafficPermitted="true"` no base-config
- IP específico `192.168.0.105` configurado
- AndroidManifest referenciando o arquivo

### 2. **Capacitor Config** ✅
- `androidScheme: "http"`
- `cleartext: true`

### 3. **API Endpoints** ✅
- `/api/v1/health` funciona corretamente
- CORS configurado para aceitar qualquer origem

## 🧪 Teste Crítico - FAÇA ISSO AGORA

### No navegador do celular:
1. Abra o navegador do celular
2. Digite: `http://192.168.0.105:3001/api/health`
3. Pressione Enter

**Se funcionar**: Problema estava no código → Rebuild APK resolve
**Se não funcionar**: Problema de rede/firewall → Ver seção abaixo

## 🔥 Problemas Comuns e Soluções

### 1. **Firewall Bloqueando** (Mais Comum)
**Sintoma**: Erro `ECONNREFUSED` ou timeout no navegador do celular

**Solução** (PowerShell como Admin):
```powershell
New-NetFirewallRule -DisplayName "API Port 3001" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

**Verificar se já existe**:
```powershell
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*3001*"}
```

### 2. **Rede Wi-Fi Diferente**
**Sintoma**: Timeout ou `ERR_NETWORK`

**Verificar**:
- Celular: Configurações → Wi-Fi → Ver nome da rede
- PC: `ipconfig` → Verificar nome da rede Wi-Fi
- Ambos devem estar na **mesma rede**

### 3. **API Não Está Rodando**
**Sintoma**: `ECONNREFUSED`

**Verificar**:
```powershell
curl http://192.168.0.105:3001/api/health
```

**Iniciar API**:
```powershell
cd API
npm run dev
```

### 4. **IP Mudou**
**Sintoma**: Erro de conexão

**Verificar IP atual**:
```powershell
ipconfig | findstr "IPv4"
```

**Se mudou**: Atualizar no código:
- `MOBILE/src/services/api.ts` linha 7
- `MOBILE/src/pages/Login/index.tsx` linha 37

## 📋 Checklist Antes de Rebuild APK

- [ ] **API está rodando**: `curl http://192.168.0.105:3001/api/health`
- [ ] **Teste no navegador do celular**: `http://192.168.0.105:3001/api/health`
- [ ] **Firewall permite porta 3001** (comando acima)
- [ ] **Celular e PC na mesma rede Wi-Fi**
- [ ] **IP fixo configurado**: `192.168.0.105`

## 🚀 Próximos Passos

1. **FAÇA O TESTE NO NAVEGADOR DO CELULAR PRIMEIRO**
   - Isso vai dizer se o problema é código ou rede

2. **Se funcionar no navegador**:
   ```powershell
   cd MOBILE
   npm run build
   npx cap sync android
   ```
   - Abrir Android Studio
   - Build → Generate Signed Bundle/APK
   - Instalar e testar

3. **Se não funcionar no navegador**:
   - Configurar firewall (comando acima)
   - Verificar rede Wi-Fi
   - Verificar se API está rodando

## 📝 Logs para Diagnóstico

Após instalar o APK, verificar logs (se possível via Android Studio Logcat):
- Procurar por: `🚀 Inicializando API...`
- Procurar por: `✅ BaseURL configurada:`
- Procurar por: `❌ Erro de conexão:`

Os logs vão mostrar exatamente onde está falhando.

