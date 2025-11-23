# ✅ Checklist para Gerar APK - Comunicação com Backend

## ✅ Configurações Verificadas

### 1. API URL no Mobile
- ✅ **Configurado**: `http://192.168.0.105:3001` (URL absoluta para APK)
- ✅ **Detecção automática**: Se porta 3002 → usa proxy, senão → usa URL absoluta
- ✅ **Localização**: `MOBILE/src/services/api.ts` linha 15

### 2. Capacitor Config
- ✅ **HTTP habilitado**: `androidScheme: "http"` e `cleartext: true`
- ✅ **Arquivo**: `MOBILE/capacitor.config.json`

### 3. Android Network Security
- ✅ **HTTP permitido**: `cleartextTrafficPermitted="true"`
- ✅ **IP configurado**: `192.168.0.0` incluído (cobre 192.168.0.105)
- ✅ **Arquivo**: `MOBILE/android/app/src/main/res/xml/network_security_config.xml`

### 4. Android Manifest
- ✅ **Permissão Internet**: `<uses-permission android:name="android.permission.INTERNET" />`
- ✅ **Network Security Config**: Configurado
- ✅ **Arquivo**: `MOBILE/android/app/src/main/AndroidManifest.xml`

### 5. API Backend (CORS)
- ✅ **CORS configurado**: `origin: '*'` (aceita qualquer origem)
- ✅ **Headers permitidos**: `Authorization`, `Content-Type`
- ✅ **Arquivo**: `API/index.cjs` linha 244-256

## 🚀 Comandos para Gerar APK

### 1. Build do Mobile
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

### 4. Gerar APK no Android Studio
- Build → Build Bundle(s) / APK(s) → Build APK(s)
- Ou: Build → Generate Signed Bundle / APK

## 🔍 Verificações Finais

### Antes de Gerar APK:
- [ ] API está rodando em `http://192.168.0.105:3001`
- [ ] IP fixo configurado no Windows (192.168.0.105)
- [ ] Firewall permite conexões na porta 3001
- [ ] Mobile e PC na mesma rede Wi-Fi

### Após Instalar APK:
- [ ] Abrir app no celular
- [ ] Verificar logs (se possível) - deve mostrar: `Usando API URL de desenvolvimento: http://192.168.0.105:3001`
- [ ] Testar login
- [ ] Verificar se consegue conectar com a API

## 📝 Notas Importantes

1. **IP Fixo**: O PC deve ter IP fixo `192.168.0.105` para funcionar sempre
2. **Rede Wi-Fi**: Mobile e PC devem estar na mesma rede
3. **API Rodando**: A API deve estar rodando antes de testar o APK
4. **CORS**: A API está configurada para aceitar requisições de qualquer origem

## 🐛 Troubleshooting

### Se não conectar:
1. Verificar se API está rodando: `curl http://192.168.0.105:3001/api/health`
2. Verificar IP do PC: `ipconfig` (deve ser 192.168.0.105)
3. Verificar se mobile e PC estão na mesma rede
4. Verificar firewall do Windows
5. Verificar logs do app no Android Studio (Logcat)

### Logs Úteis:
- No app: Console.log mostrará a URL da API sendo usada
- Na API: Logs mostrarão as requisições recebidas

