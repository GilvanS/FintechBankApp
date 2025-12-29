# 🚀 Como Usar Seletores no Appium para WebView

## ⚠️ Problema: XPath Verboso

O Appium está gerando XPaths muito longos como:
```
//android.webkit.WebView[@text="Fintech - A nova era da sua vida financeira"]/android.view.View/android.view.View/android.view.View/android.view.View/android.view.View[2]/android.view.View/android.widget.EditText[1]
```

## ✅ Solução: Use UiSelector em vez de XPath

No **WebView do Capacitor**, os atributos HTML não viram `resource-id` automaticamente. Use **UiSelector** com `description()` ou `text()`.

## 📝 Exemplos Práticos

### Campo CPF - Login

**❌ EVITAR (XPath verboso):**
```javascript
await driver.$('//android.webkit.WebView/.../android.widget.EditText[1]').setValue('12345678900');
```

**✅ USAR (UiSelector por description):**
```javascript
// Opção 1: Por data-testid (RECOMENDADO)
await driver.$('-android uiautomator: new UiSelector().description("login-input-cpf")').setValue('12345678900');

// Opção 2: Por aria-label
await driver.$('-android uiautomator: new UiSelector().description("CPF")').setValue('12345678900');

// Opção 3: Por placeholder
await driver.$('-android uiautomator: new UiSelector().text("999.999.999-99")').setValue('12345678900');
```

### Campo Senha - Login

```javascript
// ✅ Por description (data-testid)
await driver.$('-android uiautomator: new UiSelector().description("login-input-password")').setValue('senha123');

// ✅ Por description (aria-label)
await driver.$('-android uiautomator: new UiSelector().description("Senha")').setValue('senha123');

// ✅ Por placeholder
await driver.$('-android uiautomator: new UiSelector().text("••••••••")').setValue('senha123');
```

### Botão Entrar

```javascript
// ✅ Por description (data-testid)
await driver.$('-android uiautomator: new UiSelector().description("login-submit-button")').click();

// ✅ Por texto do botão
await driver.$('-android uiautomator: new UiSelector().text("Entrar")').click();
```

## 🎯 Mapeamento: HTML → Appium

| No Código HTML | No Appium (Android) | Como Usar |
|----------------|---------------------|-----------|
| `data-testid="login-input-cpf"` | `content-desc="login-input-cpf"` | `UiSelector().description("login-input-cpf")` |
| `aria-label="CPF"` | `content-desc="CPF"` | `UiSelector().description("CPF")` |
| `placeholder="999.999.999-99"` | `text="999.999.999-99"` | `UiSelector().text("999.999.999-99")` |
| Texto visível "Entrar" | `text="Entrar"` | `UiSelector().text("Entrar")` |

## 📋 Todos os Seletores - Tela Login

```javascript
// CPF
await driver.$('-android uiautomator: new UiSelector().description("login-input-cpf")').setValue('12345678900');

// Senha
await driver.$('-android uiautomator: new UiSelector().description("login-input-password")').setValue('senha123');

// Botão Entrar
await driver.$('-android uiautomator: new UiSelector().description("login-submit-button")').click();

// Link Esqueci Senha
await driver.$('-android uiautomator: new UiSelector().description("login-forgot-password-link")').click();

// Link Cadastre-se
await driver.$('-android uiautomator: new UiSelector().description("login-signup-link")').click();
```

## 📋 Todos os Seletores - Tela SignUp

```javascript
// Nome Completo
await driver.$('-android uiautomator: new UiSelector().description("signup-input-fullname")').setValue('João Silva');

// CPF
await driver.$('-android uiautomator: new UiSelector().description("signup-input-cpf")').setValue('12345678900');

// Email
await driver.$('-android uiautomator: new UiSelector().description("signup-input-email")').setValue('joao@email.com');

// Senha
await driver.$('-android uiautomator: new UiSelector().description("signup-input-password")').setValue('senha123');

// Confirmar Senha
await driver.$('-android uiautomator: new UiSelector().description("signup-input-confirm-password")').setValue('senha123');

// Botão Cadastrar
await driver.$('-android uiautomator: new UiSelector().description("signup-submit-button")').click();
```

## 🔍 Como Verificar no Appium Inspector

1. Abra o Appium Inspector
2. Selecione o elemento (ex: campo CPF)
3. Veja a aba "Atributo" e "Valor"
4. Procure por:
   - **`content-desc`** = use `UiSelector().description("valor")`
   - **`text`** = use `UiSelector().text("valor")`
   - **`class`** = use `UiSelector().className("valor")`

## ✅ Vantagens do UiSelector

1. ✅ **Mais rápido** - Nativo do Android
2. ✅ **Mais estável** - Não depende da estrutura HTML
3. ✅ **Menos verboso** - Não precisa de XPath longo
4. ✅ **Mais confiável** - Funciona mesmo com mudanças na estrutura

## 📚 Documentação Completa

Veja `SELETORES-WEBVIEW-APPIUM.md` para documentação completa com todos os seletores e estratégias.

