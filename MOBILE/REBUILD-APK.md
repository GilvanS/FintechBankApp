# 🚀 Rebuild APK - Guia Completo

## ✅ Confirmação: Rede e API Funcionam!

O teste no navegador do celular (`http://192.168.0.105:3001/api/health`) funcionou, então:
- ✅ Rede Wi-Fi está OK
- ✅ Firewall está OK
- ✅ API está acessível
- ✅ O problema estava no código do APK

As correções aplicadas devem resolver o problema!

## 📋 Passos para Rebuild APK

### 1. Build do Projeto
```powershell
cd MOBILE
npm run build
```

### 2. Sincronizar com Capacitor
```powershell
npx cap sync android
```

### 3. Abrir no Android Studio
```powershell
npx cap open android
```

Ou abrir manualmente:
- Abrir Android Studio
- File → Open → `MOBILE/android`

### 4. Gerar APK

#### Opção A: APK Debug (Mais Rápido)
1. Build → Build Bundle(s) / APK(s) → Build APK(s)
2. Aguardar build completar
3. APK estará em: `MOBILE/android/app/build/outputs/apk/debug/app-debug.apk`

#### Opção B: APK Release (Produção)
1. Build → Generate Signed Bundle / APK
2. Selecionar "APK"
3. Criar/Selecionar keystore
4. Preencher informações
5. Selecionar "release" build variant
6. Finish

### 5. Instalar APK no Celular

#### Via USB (ADB):
```powershell
# Conectar celular via USB com depuração USB ativada
adb install MOBILE/android/app/build/outputs/apk/debug/app-debug.apk
```

#### Via Transferência Manual:
1. Copiar APK para celular (via USB, email, etc)
2. No celular: Configurações → Segurança → Permitir fontes desconhecidas
3. Abrir o arquivo APK no celular
4. Instalar

## ✅ Verificações Após Instalar

1. **Abrir o app**
2. **Verificar status do servidor** (deve mostrar "online" - bolinha verde)
3. **Tentar fazer login**

## 🔍 Se Ainda Não Conectar

### Verificar Logs (Android Studio Logcat):
1. Conectar celular via USB
2. Abrir Android Studio
3. View → Tool Windows → Logcat
4. Filtrar por: `fintech` ou `API` ou `🔍` ou `❌`
5. Procurar por:
   - `🚀 Inicializando API...`
   - `✅ BaseURL configurada: http://192.168.0.105:3001/api/v1`
   - `❌ Erro de conexão:` (se houver)

### Verificar Cache do App:
Se ainda não funcionar, pode ser cache antigo:
1. Configurações → Apps → Fintech Bank App
2. Armazenamento → Limpar dados
3. Desinstalar e reinstalar APK

## 📝 Correções Aplicadas no Código

### 1. Cache Ignorado
- `initializeApi()` sempre usa URL padrão, ignora cache antigo

### 2. Race Condition Corrigida
- Delay antes de verificar status do servidor

### 3. Teste de Conexão Inicial
- Testa conexão imediatamente após configurar baseURL

### 4. Logs Detalhados
- Facilita diagnóstico de problemas

## 🎯 Comandos Rápidos

```powershell
# 1. Build
cd MOBILE
npm run build

# 2. Sync
npx cap sync android

# 3. Abrir Android Studio
npx cap open android

# 4. (Opcional) Instalar via ADB após build
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## ⚠️ Importante

- **Certifique-se que a API está rodando** antes de testar o APK
- **Celular e PC devem estar na mesma rede Wi-Fi**
- **IP do PC deve ser `192.168.0.105`** (verificar com `ipconfig` se necessário)

