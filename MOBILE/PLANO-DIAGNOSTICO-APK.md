# 🔍 Plano de Diagnóstico e Correção - APK não conecta

## ✅ Confirmação: IP está correto no código

**Verificado:**
- ✅ `MOBILE/src/services/api.ts` linha 7: `const DEV_API_URL = 'http://192.168.0.105:3001';`
- ✅ `MOBILE/src/pages/Login/index.tsx` linha 37: `const url = 'http://192.168.0.105:3001';`
- ✅ IP do PC: `192.168.0.105` (confirmado via ipconfig)

## 🔍 Possíveis Problemas

### 1. **Problema: Health Check usando endpoint errado**
- **Código atual**: `api.get('/health')` com baseURL `http://192.168.0.105:3001/api/v1`
- **Resultado**: Tenta acessar `http://192.168.0.105:3001/api/v1/health`
- **Status**: ✅ Endpoint existe e funciona (testado)

### 2. **Problema: Cache com URL antiga**
- O APK pode ter cacheado uma URL inválida
- **Solução**: Limpar cache do app

### 3. **Problema: Firewall bloqueando conexão**
- Firewall do Windows pode estar bloqueando conexões do celular
- **Solução**: Verificar regras de firewall

### 4. **Problema: Rede Wi-Fi diferente**
- Celular e PC podem estar em redes Wi-Fi diferentes
- **Solução**: Verificar se estão na mesma rede

### 5. **Problema: Timeout muito curto**
- Timeout de 5 segundos pode ser insuficiente
- **Solução**: Aumentar timeout

## 🛠️ Plano de Correção

### Passo 1: Adicionar logs detalhados
Adicionar logs para ver exatamente o que está acontecendo no APK.

### Passo 2: Melhorar tratamento de erros
Mostrar mensagens de erro mais detalhadas para diagnóstico.

### Passo 3: Aumentar timeout
Aumentar timeout para conexões mais lentas.

### Passo 4: Adicionar retry logic
Adicionar tentativas automáticas de conexão.

### Passo 5: Verificar network security config
Garantir que está permitindo conexões HTTP corretamente.

## 📋 Checklist de Diagnóstico

### No Celular (APK):
- [ ] Abrir app
- [ ] Verificar logs (se possível via Android Studio Logcat)
- [ ] Verificar se mostra "Servidor offline"
- [ ] Verificar mensagem de erro específica

### No PC:
- [ ] API está rodando? `curl http://192.168.0.105:3001/api/health`
- [ ] Firewall permite conexões na porta 3001?
- [ ] IP fixo está configurado corretamente?
- [ ] Celular e PC na mesma rede Wi-Fi?

### Testes de Conectividade:
- [ ] Do celular, ping para 192.168.0.105 (se possível)
- [ ] Do celular, tentar acessar http://192.168.0.105:3001/api/health no navegador
- [ ] Verificar se há proxy/VPN ativo no celular

