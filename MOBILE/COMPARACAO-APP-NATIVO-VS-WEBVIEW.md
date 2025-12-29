# 🔍 Comparação: App Nativo vs WebView

## 📊 Exemplo: App Nativo (Alura Esporte)

No Appium Inspector, você vê:

### Campo Input Usuário

**Localizar por:**
- `id`: `br.com.alura.aluraesporte:id/input_usuario`
- `-android uiautomator`: `new UiSelector().resourceId("br.com.alura.aluraesporte:id/input_usuario")`
- `xpath`: `//android.widget.EditText[@resource-id="br.com.alura.aluraesporte:id/input_usuario"]`

**Por que funciona?**
- O `resource-id` é definido no XML do Android:
```xml
<EditText
    android:id="@+id/input_usuario"
    android:hint="Id do usuário"
    ...
/>
```

---

## 📊 Nosso App: WebView (Capacitor)

No Appium Inspector, você verá:

### Campo CPF - Login

**Localizar por:**
- `id`: ❌ **Não disponível** (WebView não tem resource-id nativo)
- `-android uiautomator`: ✅ `new UiSelector().description("login-input-cpf")`
- `xpath`: ✅ `//android.widget.EditText[@content-desc="login-input-cpf"]`

**Por que funciona assim?**
- No WebView, `data-testid` vira `content-desc` no Android
- `id` HTML **NÃO vira** `resource-id` automaticamente

---

## 🎯 Seletores Java - Comparação

### App Nativo (Exemplo Alura)

```java
// ✅ Por resource-id (direto)
@AndroidFindBy(id = "br.com.alura.aluraesporte:id/input_usuario")
private WebElement campoUsuario;

// ✅ Por resource-id (xpath)
@AndroidFindBy(xpath = "//android.widget.EditText[@resource-id='br.com.alura.aluraesporte:id/input_usuario']")
private WebElement campoUsuario;

// ✅ Por resource-id (UiSelector)
MobileBy.AndroidUIAutomator("new UiSelector().resourceId(\"br.com.alura.aluraesporte:id/input_usuario\")")
```

### WebView (Nosso App)

```java
// ✅ Por content-desc (xpath) - MELHOR
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-cpf']")
private WebElement campoCpf;

// ✅ Por content-desc (UiSelector) - ALTERNATIVA
MobileBy.AndroidUIAutomator("new UiSelector().description(\"login-input-cpf\")")

// ✅ Por placeholder (text) - FALLBACK
@AndroidFindBy(xpath = "//android.widget.EditText[@text='999.999.999-99']")
private WebElement campoCpfByPlaceholder;
```

---

## 📋 Mapeamento Completo

### App Nativo
| XML Android | Appium | Java |
|-------------|--------|------|
| `android:id="@+id/input_usuario"` | `resource-id="br.com.alura.aluraesporte:id/input_usuario"` | `@AndroidFindBy(id = "...")` |

### WebView (Capacitor)
| HTML | Android | Appium | Java |
|------|---------|--------|------|
| `id="login-cpf-input"` | ❌ Não aparece | - | - |
| `data-testid="login-input-cpf"` | ✅ `content-desc="login-input-cpf"` | `@content-desc` | `@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-cpf']")` |
| `aria-label="CPF"` | ✅ `content-desc="CPF"` | `@content-desc` | `@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='CPF']")` |
| `placeholder="999.999.999-99"` | ✅ `text="999.999.999-99"` | `@text` | `@AndroidFindBy(xpath = "//android.widget.EditText[@text='999.999.999-99']")` |

---

## ✅ Seletores Prontos - Nosso App

### Login - Campo CPF

```java
// ✅ MELHOR - Por content-desc (data-testid)
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-cpf']")
private WebElement campoCpf;

// ✅ ALTERNATIVA 1 - Por content-desc (aria-label)
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='CPF']")
private WebElement campoCpfByAriaLabel;

// ✅ ALTERNATIVA 2 - Por placeholder (text)
@AndroidFindBy(xpath = "//android.widget.EditText[@text='999.999.999-99']")
private WebElement campoCpfByPlaceholder;

// ✅ ALTERNATIVA 3 - UiSelector
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"login-input-cpf\")")
private WebElement campoCpfByUiSelector;
```

### Login - Campo Senha

```java
// ✅ MELHOR - Por content-desc (data-testid)
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-password']")
private WebElement campoSenha;

// ✅ ALTERNATIVA 1 - Por content-desc (aria-label)
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='Senha']")
private WebElement campoSenhaByAriaLabel;

// ✅ ALTERNATIVA 2 - Por placeholder (text)
@AndroidFindBy(xpath = "//android.widget.EditText[@text='••••••••']")
private WebElement campoSenhaByPlaceholder;
```

### Login - Botão Entrar

```java
// ✅ MELHOR - Por text (texto visível)
@AndroidFindBy(xpath = "//android.widget.Button[@text='Entrar']")
private WebElement btnEntrar;

// ✅ ALTERNATIVA 1 - Por content-desc (data-testid)
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='login-submit-button']")
private WebElement btnEntrarByDesc;

// ✅ ALTERNATIVA 2 - UiSelector por text
@AndroidFindBy(uiAutomator = "new UiSelector().text(\"Entrar\")")
private WebElement btnEntrarByUiSelector;
```

---

## 🎯 Resumo

### App Nativo
- ✅ Tem `resource-id` nativo
- ✅ Seletores mais diretos: `@AndroidFindBy(id = "...")`
- ✅ XPath simples: `@resource-id="..."`

### WebView (Capacitor)
- ❌ Não tem `resource-id` nativo
- ✅ Usa `content-desc` (vem de `data-testid` ou `aria-label`)
- ✅ Usa `text` (vem de `placeholder` ou texto visível)
- ✅ Seletores: `@content-desc` ou `@text`

---

## 📚 Documentação Relacionada

- [SELETORES-JAVA-PAGE-OBJECT.md](./SELETORES-JAVA-PAGE-OBJECT.md) - Seletores prontos para usar
- [ATRIBUTOS-APPIUM-CLEAN-CODE.md](./ATRIBUTOS-APPIUM-CLEAN-CODE.md) - Padrão de atributos

---

**Última atualização:** 2025-01-27

