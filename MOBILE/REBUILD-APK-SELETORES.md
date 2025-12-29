# 🔄 Rebuild APK para Atualizar Seletores

## ⚠️ Importante

**As mudanças no código HTML só aparecem no Appium após reconstruir o APK!**

O código já está atualizado com:
- ✅ `data-testid="login-input-cpf"` 
- ✅ `aria-label="CPF"`
- ✅ `title="CPF"`

Mas o **APK atual ainda tem o código antigo**. Você precisa reconstruir!

## 🚀 Passos Rápidos

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

### 4. Gerar APK Debug
1. No Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Aguardar build completar
3. APK estará em: `MOBILE/android/app/build/outputs/apk/debug/app-debug.apk`

### 5. Instalar APK no Celular

**Via USB (ADB):**
```powershell
adb install MOBILE/android/app/build/outputs/apk/debug/app-debug.apk
```

**Ou manualmente:**
1. Copiar APK para celular
2. Instalar no celular

## ✅ Como Verificar se Funcionou

### 1. Abrir Appium Inspector
1. Conectar celular via USB
2. Abrir Appium Desktop
3. Iniciar sessão
4. Abrir Inspector

### 2. Selecionar Campo CPF
1. No Inspector, selecione o campo CPF
2. Veja a aba **"Atributo" e "Valor"**
3. Procure por **`content-desc`**

### 3. Verificar Atributos

**✅ Se funcionou, você verá:**
```
content-desc: "login-input-cpf"  ou  "CPF"
```

**❌ Se não funcionou, você verá:**
```
content-desc: (vazio ou não existe)
```

### 4. Usar o Seletor no Appium

**Se `content-desc` aparecer, use:**
```javascript
// ✅ Funcionará!
await driver.$('-android uiautomator: new UiSelector().description("login-input-cpf")').setValue('12345678900');

// Ou
await driver.$('-android uiautomator: new UiSelector().description("CPF")').setValue('12345678900');
```

## 🔍 Por que ainda vejo `android.view.View`?

**Isso é normal no WebView!** O WebView do Capacitor sempre cria uma estrutura com `android.view.View` genéricos. 

**O importante é:**
- ✅ O `EditText` ter `content-desc` (vem de `data-testid` ou `aria-label`)
- ✅ Usar UiSelector em vez de XPath
- ✅ Não depender da estrutura de `android.view.View`

## 📋 Checklist

- [ ] Executei `npm run build`
- [ ] Executei `npx cap sync android`
- [ ] Gerei novo APK no Android Studio
- [ ] Instalei o novo APK no celular
- [ ] Abri Appium Inspector
- [ ] Verifiquei que o campo CPF tem `content-desc`
- [ ] Testei o seletor UiSelector

## ⚠️ Se Ainda Não Funcionar

### 1. Verificar se o Build Incluiu as Mudanças

**Verificar arquivo compilado:**
```powershell
# Verificar se o arquivo foi atualizado
Get-Item MOBILE/dist/**/*.html | Select-Object LastWriteTime
```

### 2. Limpar Cache do Build

```powershell
cd MOBILE
# Limpar build anterior
Remove-Item -Recurse -Force dist
Remove-Item -Recurse -Force android/app/build

# Rebuild completo
npm run build
npx cap sync android
```

### 3. Verificar no Código Fonte

**Confirmar que os atributos estão no código:**
```powershell
# Verificar se data-testid está presente
Select-String -Path "MOBILE/src/pages/Login/index.tsx" -Pattern "data-testid=\"login-input-cpf\""
```

**Deve retornar:**
```
MOBILE/src/pages/Login/index.tsx:241:            data-testid="login-input-cpf"
```

## 🎯 Comandos Completos (Copy-Paste)

```powershell
# 1. Ir para pasta MOBILE
cd MOBILE

# 2. Build
npm run build

# 3. Sync Capacitor
npx cap sync android

# 4. Abrir Android Studio
npx cap open android

# 5. (No Android Studio) Build → Build APK(s)

# 6. Instalar via ADB (após build)
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## 📚 Documentação Relacionada

- [COMO-USAR-SELETORES-WEBVIEW.md](./COMO-USAR-SELETORES-WEBVIEW.md) - Como usar os seletores
- [SELETORES-WEBVIEW-APPIUM.md](./SELETORES-WEBVIEW-APPIUM.md) - Documentação completa
- [REBUILD-APK.md](./REBUILD-APK.md) - Guia geral de rebuild

