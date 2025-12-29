# 🔍 Como Verificar se o APK Foi Atualizado

## ⚠️ Problema

No Appium Inspector, você ainda vê apenas 2 seletores:
1. `-android uiautomator`: `new UiSelector().className("android.widget.EditText").instance(0)`
2. `xpath`: `//android.webkit.WebView[...]` (verboso)

**Isso indica que o APK NÃO foi atualizado com as mudanças!**

---

## ✅ O Que Deveria Aparecer

Após rebuild do APK, você deveria ver no Appium Inspector:

### Campo CPF

**Localizar por:**
1. `-android uiautomator`: `new UiSelector().description("login-input-cpf")`
2. `-android uiautomator`: `new UiSelector().description("CPF")`
3. `-android uiautomator`: `new UiSelector().text("999.999.999-99")`
4. `xpath`: `//android.widget.EditText[@content-desc='login-input-cpf']`
5. `xpath`: `//android.widget.EditText[@content-desc='CPF']`
6. `xpath`: `//android.widget.EditText[@text='999.999.999-99']`

---

## 🔍 Como Verificar

### 1. Verificar Código Fonte

**Campo CPF deve ter:**
```tsx
<input
  id="login-cpf-input"
  data-testid="login-input-cpf"  ✅ DEVE ESTAR
  name="cpf"
  placeholder="999.999.999-99"     ✅ DEVE ESTAR
  aria-label="CPF"                ✅ DEVE ESTAR
  ...
/>
```

**Verificar no código:**
```powershell
# Verificar se data-testid está presente
Select-String -Path "MOBILE/src/pages/Login/index.tsx" -Pattern "data-testid=\"login-input-cpf\""

# Deve retornar:
# MOBILE/src/pages/Login/index.tsx:244:            data-testid="login-input-cpf"
```

### 2. Verificar Build

**Verificar se o build foi executado:**
```powershell
# Verificar data de modificação do dist
Get-Item MOBILE/dist/index.html | Select-Object LastWriteTime

# Deve ser recente (hoje)
```

### 3. Verificar APK Instalado

**Verificar versão do APK:**
```powershell
# Verificar quando o APK foi gerado
Get-Item MOBILE/android/app/build/outputs/apk/debug/app-debug.apk | Select-Object LastWriteTime

# Deve ser DEPOIS do build
```

### 4. Verificar no Appium Inspector

**Após instalar novo APK:**
1. Abra Appium Inspector
2. Selecione o campo CPF
3. Veja a aba "Atributo" e "Valor"
4. **Procure por:**
   - ✅ `content-desc: "login-input-cpf"` (vem de `data-testid`)
   - ✅ `content-desc: "CPF"` (vem de `aria-label`)
   - ✅ `text: "999.999.999-99"` (vem de `placeholder`)

**Se NÃO aparecer, o APK não foi atualizado!**

---

## 🚀 Passos para Atualizar APK

### 1. Build do Projeto
```powershell
cd MOBILE
npm run build
```

**Verificar se build foi bem-sucedido:**
- Deve criar arquivos em `MOBILE/dist/`
- Verificar data de modificação

### 2. Sincronizar Capacitor
```powershell
npx cap sync android
```

**Verificar:**
- Deve copiar arquivos para `MOBILE/android/app/src/main/assets/public/`

### 3. Abrir Android Studio
```powershell
npx cap open android
```

### 4. Gerar APK Debug
1. No Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Aguardar build completar
3. Verificar data de modificação do APK

### 5. Desinstalar APK Antigo
```powershell
# Desinstalar versão antiga
adb uninstall com.fintechbank.app
```

### 6. Instalar Novo APK
```powershell
# Instalar novo APK
adb install MOBILE/android/app/build/outputs/apk/debug/app-debug.apk
```

### 7. Verificar no Appium Inspector
1. Abrir Appium Inspector
2. Conectar dispositivo
3. Selecionar campo CPF
4. **Verificar se aparecem os novos seletores**

---

## ✅ Checklist

- [ ] Código fonte tem `data-testid="login-input-cpf"` ✅
- [ ] Código fonte tem `placeholder="999.999.999-99"` ✅
- [ ] Código fonte tem `aria-label="CPF"` ✅
- [ ] `npm run build` foi executado ✅
- [ ] `npx cap sync android` foi executado ✅
- [ ] APK foi gerado no Android Studio ✅
- [ ] APK antigo foi desinstalado ✅
- [ ] Novo APK foi instalado ✅
- [ ] Appium Inspector mostra `content-desc` ✅
- [ ] Appium Inspector mostra `text` (placeholder) ✅

---

## 🔍 Verificação Rápida

**Execute estes comandos para verificar:**

```powershell
# 1. Verificar código
Select-String -Path "MOBILE/src/pages/Login/index.tsx" -Pattern "data-testid=\"login-input-cpf\""

# 2. Verificar build
Get-Item MOBILE/dist/index.html | Select-Object LastWriteTime

# 3. Verificar APK
Get-Item MOBILE/android/app/build/outputs/apk/debug/app-debug.apk | Select-Object LastWriteTime

# 4. Verificar se APK está instalado
adb shell dumpsys package com.fintechbank.app | Select-String "versionName"
```

---

## ⚠️ Se Ainda Não Funcionar

### 1. Limpar Build Anterior

```powershell
cd MOBILE

# Limpar dist
Remove-Item -Recurse -Force dist

# Limpar build Android
Remove-Item -Recurse -Force android/app/build

# Rebuild completo
npm run build
npx cap sync android
```

### 2. Limpar Cache do App no Celular

```powershell
# Limpar dados do app
adb shell pm clear com.fintechbank.app

# Desinstalar
adb uninstall com.fintechbank.app

# Reinstalar
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### 3. Verificar no Appium Inspector

**Se ainda não aparecer `content-desc`:**
- O WebView pode não estar expondo os atributos corretamente
- Pode ser necessário usar apenas `text` (placeholder) ou `instance()`

---

**Última atualização:** 2025-01-27

