# 🔧 Como Usar o Accessibility Plugin

## 📋 Visão Geral

O `AccessibilityPlugin` foi criado para mapear elementos HTML (`id`, `data-testid`) para `contentDescription` nativo no Android, permitindo que o Appium encontre elementos usando `accessibility id` ou `content-desc`.

## ✅ O que foi implementado

### 1. Plugin TypeScript (`src/plugins/AccessibilityPlugin.ts`)
- Interface TypeScript para o plugin
- Implementação web para desenvolvimento

### 2. Plugin Java Nativo (`android/app/src/main/java/com/fintechbank/app/plugins/AccessibilityPlugin.java`)
- Injeta JavaScript na WebView
- Mapeia `id`/`data-testid` → `aria-label` → `contentDescription` (Android)
- Usa `AccessibilityNodeInfo` do Android

### 3. Integração na Tela de Login
- Plugin inicializado quando a tela carrega
- Todos os elementos são processados automaticamente

## 🚀 Como Funciona

### Fluxo de Funcionamento

1. **Inicialização:**
   - Quando a tela de Login carrega, o plugin é inicializado
   - JavaScript é injetado na WebView para processar elementos

2. **Processamento de Elementos:**
   - Plugin busca todos os elementos com `id` ou `data-testid`
   - Define `aria-label` baseado em `data-testid` (prioridade) ou `id`
   - Android mapeia `aria-label` → `contentDescription` → `content-desc` no XML

3. **Resultado no Appium:**
   ```xml
   <android.widget.EditText 
       content-desc="login-input-cpf"  <!-- ✅ Aparece -->
       hint="login-input-cpf"           <!-- ✅ Aparece -->
   />
   ```

## 📝 Uso no Código

### Na Tela de Login

O plugin já está integrado automaticamente:

```typescript
// src/pages/Login/index.tsx
import AccessibilityPlugin from '../../plugins/AccessibilityPlugin';

useEffect(() => {
  const initAccessibility = async () => {
    await AccessibilityPlugin.initialize();
    await AccessibilityPlugin.enhanceAllElements();
  };
  initAccessibility();
}, []);
```

### Em Outras Telas

Para usar em outras telas, adicione:

```typescript
import AccessibilityPlugin from '../plugins/AccessibilityPlugin';

useEffect(() => {
  AccessibilityPlugin.initialize().then(() => {
    AccessibilityPlugin.enhanceAllElements();
  });
}, []);
```

## 🎯 Seletores no Appium

### Antes (Verboso)
```java
@AndroidFindBy(xpath = "//android.webkit.WebView[@text='Fintech - A nova era da sua vida financeira']/android.view.View/android.view.View/android.view.View/android.view.View/android.view.View[2]/android.view.View/android.widget.EditText[1]")
private WebElement campoCpf;
```

### Depois (Limpo)
```java
// ✅ Por content-desc (accessibility id)
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-cpf']")
private WebElement campoCpf;

// ✅ Por UiSelector
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"login-input-cpf\")")
private WebElement campoCpf;

// ✅ Por hint (também funciona)
@AndroidFindBy(xpath = "//android.widget.EditText[@hint='login-input-cpf']")
private WebElement campoCpf;
```

## 🔍 Verificação no Appium Inspector

### O que verificar:

1. **Abra o Appium Inspector**
2. **Conecte ao dispositivo/emulador**
3. **Navegue até a tela de Login**
4. **Inspecione os elementos:**

   **Campo CPF:**
   ```xml
   <android.widget.EditText 
       content-desc="login-input-cpf"  <!-- ✅ Deve aparecer -->
       hint="login-input-cpf"           <!-- ✅ Deve aparecer -->
   />
   ```

   **Campo Senha:**
   ```xml
   <android.widget.EditText 
       content-desc="login-input-password"  <!-- ✅ Deve aparecer -->
       hint="login-input-password"           <!-- ✅ Deve aparecer -->
   />
   ```

   **Botão Entrar:**
   ```xml
   <android.widget.Button 
       text="login-submit-button"  <!-- ✅ Deve aparecer -->
       content-desc="login-submit-button"  <!-- ✅ Deve aparecer -->
   />
   ```

## ⚠️ Troubleshooting

### Problema: `content-desc` não aparece no XML

**Solução:**
1. Verifique se o plugin foi inicializado (veja logs do console)
2. Rebuild o APK: `.\GERAR-APK-DO-ZERO.ps1`
3. Use `hint` ou `description()` mesmo que `content-desc` não apareça (funciona!)

### Problema: Plugin não funciona

**Solução:**
1. Verifique se o plugin está registrado no Capacitor
2. Verifique os logs do Android: `adb logcat | grep Accessibility`
3. Certifique-se de que `WebView.setWebContentsDebuggingEnabled(true)` está no `MainActivity.java`

### Problema: Elementos não são encontrados

**Solução:**
1. Verifique se os elementos têm `id` ou `data-testid`
2. Aguarde alguns segundos após carregar a tela (elementos dinâmicos)
3. Use `enhanceAllElements()` novamente se necessário

## 📚 Referências

- [Capacitor Plugin Development](https://capacitorjs.com/docs/plugins)
- [Android AccessibilityNodeInfo](https://developer.android.com/reference/android/view/accessibility/AccessibilityNodeInfo)
- [Appium WebView Documentation](https://appium.github.io/appium.io/docs/en/writing-running-appium/web/hybrid/)

