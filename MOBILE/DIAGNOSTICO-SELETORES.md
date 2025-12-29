# 🔍 Diagnóstico: Por Que os Seletores Não Aparecem

## ⚠️ Situação Atual

No Appium Inspector, você vê apenas:
1. `-android uiautomator`: `new UiSelector().className("android.widget.EditText").instance(0)`
2. `xpath`: `//android.webkit.WebView[...]` (verboso)

**Isso significa que o APK instalado NÃO tem as atualizações!**

---

## ✅ Verificação do Código

### Campo CPF - Código Atual

```tsx
<input
  id="login-cpf-input"                    ✅ Presente
  data-testid="login-input-cpf"           ✅ Presente
  name="cpf"                              ✅ Presente
  placeholder="999.999.999-99"            ✅ Presente
  aria-label="CPF"                        ✅ Presente
  ...
/>
```

**✅ O código está CORRETO!**

### Campo Senha - Código Atual

```tsx
<input
  id="login-password-input"               ✅ Presente
  data-testid="login-input-password"      ✅ Presente
  name="password"                         ✅ Presente
  placeholder="••••••••"                  ✅ Presente
  aria-label="Senha"                      ✅ Presente
  ...
/>
```

**✅ O código está CORRETO!**

---

## 🔍 Por Que Não Aparece no Appium?

### 1. APK Não Foi Atualizado

**Sintomas:**
- Appium Inspector mostra apenas `instance(0)` e XPath verboso
- Não aparece `content-desc` ou `text` (placeholder)

**Solução:**
1. Rebuild completo do APK
2. Desinstalar APK antigo
3. Instalar novo APK

### 2. WebView Não Está Expondo Atributos

**Possível causa:**
- Capacitor pode não estar convertendo `data-testid` para `content-desc` corretamente
- WebView pode precisar de configuração adicional

**Solução:**
- Verificar se `data-testid` aparece no HTML compilado
- Verificar se o WebView está habilitado para acessibilidade

---

## 🚀 Passos para Resolver

### Passo 1: Verificar Build

```powershell
cd MOBILE

# Verificar se dist existe e é recente
Get-Item dist/index.html | Select-Object LastWriteTime

# Se não existir ou for antigo, fazer build
npm run build
```

### Passo 2: Verificar HTML Compilado

```powershell
# Verificar se data-testid está no HTML compilado
Select-String -Path "dist/**/*.html" -Pattern "data-testid=\"login-input-cpf\""

# Deve retornar o atributo
```

### Passo 3: Sincronizar Capacitor

```powershell
npx cap sync android
```

### Passo 4: Gerar APK no Android Studio

1. Abrir Android Studio
2. Build → Build APK(s)
3. Verificar data de modificação do APK

### Passo 5: Desinstalar APK Antigo

```powershell
adb uninstall com.fintechbank.app
```

### Passo 6: Instalar Novo APK

```powershell
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Passo 7: Verificar no Appium Inspector

1. Abrir Appium Inspector
2. Conectar dispositivo
3. Selecionar campo CPF
4. **Verificar se aparecem:**
   - `content-desc: "login-input-cpf"` ✅
   - `content-desc: "CPF"` ✅
   - `text: "999.999.999-99"` ✅

---

## 🔍 Verificação Rápida

Execute estes comandos:

```powershell
# 1. Verificar código fonte
cd MOBILE
Select-String -Path "src/pages/Login/index.tsx" -Pattern "data-testid=\"login-input-cpf\""

# 2. Verificar build
if (Test-Path "dist/index.html") {
    Write-Host "✅ Build existe"
    Get-Item "dist/index.html" | Select-Object LastWriteTime
} else {
    Write-Host "❌ Build NÃO existe - execute: npm run build"
}

# 3. Verificar APK
if (Test-Path "android/app/build/outputs/apk/debug/app-debug.apk") {
    Write-Host "✅ APK existe"
    Get-Item "android/app/build/outputs/apk/debug/app-debug.apk" | Select-Object LastWriteTime
} else {
    Write-Host "❌ APK NÃO existe - gere no Android Studio"
}
```

---

## ⚠️ Se Ainda Não Funcionar

### Possível Problema: WebView Não Converte Atributos

No WebView do Capacitor, pode ser necessário:

1. **Verificar se o HTML compilado tem os atributos:**
```powershell
# Verificar HTML compilado
Get-Content dist/index.html | Select-String "data-testid"
```

2. **Verificar configuração do Capacitor:**
- Verificar `capacitor.config.json`
- Verificar se há configurações de acessibilidade

3. **Usar apenas seletores que funcionam:**
- Se `content-desc` não aparecer, usar apenas `text` (placeholder)
- Se `text` não aparecer, usar `instance()` como fallback

---

## 📋 Seletores que DEVEM Funcionar

Após rebuild do APK, estes seletores DEVEM aparecer:

### Campo CPF

```java
// 1. Por content-desc (data-testid)
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-cpf']")

// 2. Por content-desc (aria-label)
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='CPF']")

// 3. Por placeholder (text)
@AndroidFindBy(xpath = "//android.widget.EditText[@text='999.999.999-99']")

// 4. UiSelector por description
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"login-input-cpf\")")

// 5. UiSelector por text
@AndroidFindBy(uiAutomator = "new UiSelector().text(\"999.999.999-99\")")
```

---

## ✅ Conclusão

**O código está correto!** O problema é que o APK não foi atualizado.

**Próximos passos:**
1. ✅ Verificar código (já está correto)
2. ⏳ Rebuild APK completo
3. ⏳ Desinstalar APK antigo
4. ⏳ Instalar novo APK
5. ⏳ Verificar no Appium Inspector

---

**Última atualização:** 2025-01-27

