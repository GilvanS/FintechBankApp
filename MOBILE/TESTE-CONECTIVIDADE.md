# 🧪 Teste de Conectividade - APK

## Teste 1: Verificar se API está acessível do celular

### No celular (navegador):
1. Abra o navegador do celular
2. Acesse: `http://192.168.0.105:3001/api/health`
3. **Resultado esperado**: JSON com `{"success":true,...}`

**Se funcionar**: O problema está no código do APK
**Se não funcionar**: Problema de rede/firewall

## Teste 2: Verificar logs do APK

### Via Android Studio Logcat:
1. Conecte o celular via USB
2. Abra Android Studio
3. Vá em View → Tool Windows → Logcat
4. Filtre por: `fintech` ou `API`
5. Procure por logs que começam com:
   - `🔍 Verificando status da API em:`
   - `✅ BaseURL configurada:`
   - `❌ Erro de conexão:`

## Teste 3: Verificar IP do PC

### No PC (PowerShell):
```powershell
ipconfig | findstr "IPv4"
```
**Deve mostrar**: `192.168.0.105`

## Teste 4: Verificar Firewall

### No PC (PowerShell como Admin):
```powershell
# Verificar regras de firewall para porta 3001
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*3001*"}

# Se não houver regra, criar uma:
New-NetFirewallRule -DisplayName "API Port 3001" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

## Teste 5: Ping do celular para PC

### No celular:
- Se tiver app de terminal ou ping: `ping 192.168.0.105`
- Ou use app de rede para verificar conectividade

## 🔧 Correções Aplicadas

1. ✅ **Logs detalhados adicionados** - Agora mostra exatamente o que está acontecendo
2. ✅ **Timeout aumentado** - De 5s para 10s
3. ✅ **Mensagens de erro melhoradas** - Mostra código de erro específico
4. ✅ **Validação de status** - Aceita respostas 4xx como válidas

## 📱 Próximos Passos

1. **Rebuild do APK** com as correções:
   ```powershell
   cd MOBILE
   npm run build
   npx cap sync android
   ```

2. **Instalar novo APK** no celular

3. **Verificar logs** no Logcat do Android Studio

4. **Testar conectividade** do navegador do celular primeiro

