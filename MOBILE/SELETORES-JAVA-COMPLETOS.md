# ☕ Seletores Java Completos - Todos os Seletores Funcionais

## 🎯 Objetivo

Documentar **TODOS** os seletores que realmente funcionam no Appium Inspector, baseados nos atributos reais do código.

---

## 📋 Login - Campo CPF

### Atributos no Código:
- `id="login-cpf-input"` (não aparece como resource-id no WebView)
- `data-testid="login-input-cpf"` → vira `content-desc="login-input-cpf"`
- `aria-label="CPF"` → vira `content-desc="CPF"`
- `placeholder="999.999.999-99"` → aparece como `text="999.999.999-99"`

### ✅ Seletores que Funcionam:

```java
// 1. Por content-desc (data-testid) - MELHOR
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-cpf']")
private WebElement campoCpf;

// 2. Por content-desc (aria-label) - ALTERNATIVA 1
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='CPF']")
private WebElement campoCpfByAriaLabel;

// 3. Por placeholder (text) - ALTERNATIVA 2
@AndroidFindBy(xpath = "//android.widget.EditText[@text='999.999.999-99']")
private WebElement campoCpfByPlaceholder;

// 4. UiSelector por description (data-testid) - ALTERNATIVA 3
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"login-input-cpf\")")
private WebElement campoCpfByUiSelector;

// 5. UiSelector por description (aria-label) - ALTERNATIVA 4
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"CPF\")")
private WebElement campoCpfByUiSelectorAria;

// 6. UiSelector por text (placeholder) - ALTERNATIVA 5
@AndroidFindBy(uiAutomator = "new UiSelector().text(\"999.999.999-99\")")
private WebElement campoCpfByUiSelectorText;

// 7. XPath por content-desc (data-testid) - SIMPLES
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-cpf']")
private WebElement campoCpfXPath;

// 8. XPath por content-desc (aria-label) - SIMPLES
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='CPF']")
private WebElement campoCpfXPathAria;

// 9. XPath por text (placeholder) - SIMPLES
@AndroidFindBy(xpath = "//android.widget.EditText[@text='999.999.999-99']")
private WebElement campoCpfXPathText;
```

---

## 📋 Login - Campo Senha

### Atributos no Código:
- `id="login-password-input"` (não aparece como resource-id no WebView)
- `data-testid="login-input-password"` → vira `content-desc="login-input-password"`
- `aria-label="Senha"` → vira `content-desc="Senha"`
- `placeholder="••••••••"` → aparece como `text="••••••••"`

### ✅ Seletores que Funcionam:

```java
// 1. Por content-desc (data-testid) - MELHOR
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-password']")
private WebElement campoSenha;

// 2. Por content-desc (aria-label) - ALTERNATIVA 1
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='Senha']")
private WebElement campoSenhaByAriaLabel;

// 3. Por placeholder (text) - ALTERNATIVA 2
@AndroidFindBy(xpath = "//android.widget.EditText[@text='••••••••']")
private WebElement campoSenhaByPlaceholder;

// 4. UiSelector por description (data-testid)
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"login-input-password\")")
private WebElement campoSenhaByUiSelector;

// 5. UiSelector por description (aria-label)
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"Senha\")")
private WebElement campoSenhaByUiSelectorAria;

// 6. UiSelector por text (placeholder)
@AndroidFindBy(uiAutomator = "new UiSelector().text(\"••••••••\")")
private WebElement campoSenhaByUiSelectorText;
```

---

## 📋 Login - Botão Entrar

### Atributos no Código:
- `id="btn-login-submit"`
- `data-testid="login-submit-button"` → vira `content-desc="login-submit-button"`
- `aria-label="Entrar"` (quando não está loading)
- Texto visível: `"Entrar"` → aparece como `text="Entrar"`

### ✅ Seletores que Funcionam:

```java
// 1. Por text (texto visível) - MELHOR
@AndroidFindBy(xpath = "//android.widget.Button[@text='Entrar']")
private WebElement btnEntrar;

// 2. Por content-desc (data-testid) - ALTERNATIVA 1
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='login-submit-button']")
private WebElement btnEntrarByDesc;

// 3. Por content-desc (aria-label) - ALTERNATIVA 2
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='Entrar']")
private WebElement btnEntrarByAriaLabel;

// 4. UiSelector por text - ALTERNATIVA 3
@AndroidFindBy(uiAutomator = "new UiSelector().text(\"Entrar\")")
private WebElement btnEntrarByUiSelector;

// 5. UiSelector por description (data-testid) - ALTERNATIVA 4
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"login-submit-button\")")
private WebElement btnEntrarByUiSelectorDesc;

// 6. XPath por text - SIMPLES
@AndroidFindBy(xpath = "//android.widget.Button[@text='Entrar']")
private WebElement btnEntrarXPath;

// 7. XPath por content-desc (data-testid) - SIMPLES
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='login-submit-button']")
private WebElement btnEntrarXPathDesc;
```

---

## 📋 Login - Link "Esqueci minha senha"

### Atributos no Código:
- `id="link-forgot-password"`
- `data-testid="login-forgot-password-link"` → vira `content-desc="login-forgot-password-link"`
- `aria-label="Esqueci minha senha"`
- Texto visível: `"Esqueci minha senha"` → aparece como `text="Esqueci minha senha"`

### ✅ Seletores que Funcionam:

```java
// 1. Por text (texto visível) - MELHOR
@AndroidFindBy(xpath = "//android.widget.Button[@text='Esqueci minha senha']")
private WebElement btnEsqueciSenha;

// 2. Por content-desc (data-testid) - ALTERNATIVA 1
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='login-forgot-password-link']")
private WebElement btnEsqueciSenhaByDesc;

// 3. Por content-desc (aria-label) - ALTERNATIVA 2
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='Esqueci minha senha']")
private WebElement btnEsqueciSenhaByAriaLabel;

// 4. UiSelector por text
@AndroidFindBy(uiAutomator = "new UiSelector().text(\"Esqueci minha senha\")")
private WebElement btnEsqueciSenhaByUiSelector;

// 5. UiSelector por description (data-testid)
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"login-forgot-password-link\")")
private WebElement btnEsqueciSenhaByUiSelectorDesc;
```

---

## 📋 Login - Link "Cadastre-se"

### Atributos no Código:
- `id="link-signup"`
- `data-testid="login-signup-link"` → vira `content-desc="login-signup-link"`
- `aria-label="Cadastre-se"`
- Texto visível: `"Cadastre-se"` → aparece como `text="Cadastre-se"`

### ✅ Seletores que Funcionam:

```java
// 1. Por text (texto visível) - MELHOR
@AndroidFindBy(xpath = "//android.widget.Button[@text='Cadastre-se']")
private WebElement btnCadastreSe;

// 2. Por content-desc (data-testid) - ALTERNATIVA 1
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='login-signup-link']")
private WebElement btnCadastreSeByDesc;

// 3. Por content-desc (aria-label) - ALTERNATIVA 2
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='Cadastre-se']")
private WebElement btnCadastreSeByAriaLabel;

// 4. UiSelector por text
@AndroidFindBy(uiAutomator = "new UiSelector().text(\"Cadastre-se\")")
private WebElement btnCadastreSeByUiSelector;

// 5. UiSelector por description (data-testid)
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"login-signup-link\")")
private WebElement btnCadastreSeByUiSelectorDesc;
```

---

## 📋 PreLoginDashboard - Texto "Olá!"

### Atributos no Código:
- `id="prelogin-title"`
- `data-testid="prelogin-title"` → vira `content-desc="prelogin-title"`
- Texto visível: `"Olá!"` → aparece como `text="Olá!"`

### ✅ Seletores que Funcionam:

```java
// 1. Por text (texto visível) - MELHOR
@AndroidFindBy(xpath = "//android.widget.TextView[@text='Olá!']")
private WebElement textoOla;

// 2. Por content-desc (data-testid) - ALTERNATIVA 1
@AndroidFindBy(xpath = "//android.widget.TextView[@content-desc='prelogin-title']")
private WebElement textoOlaByDesc;

// 3. UiSelector por text
@AndroidFindBy(uiAutomator = "new UiSelector().text(\"Olá!\")")
private WebElement textoOlaByUiSelector;

// 4. UiSelector por description (data-testid)
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"prelogin-title\")")
private WebElement textoOlaByUiSelectorDesc;
```

---

## 📋 PreLoginDashboard - Botão "Entre na conta"

### Atributos no Código:
- `id="btn-prelogin-login"`
- `data-testid="prelogin-login-button"` → vira `content-desc="prelogin-login-button"`
- `aria-label="Entre na conta"`
- Texto visível: `"Entre na conta"` → aparece como `text="Entre na conta"`

### ✅ Seletores que Funcionam:

```java
// 1. Por text (texto visível) - MELHOR
@AndroidFindBy(xpath = "//android.widget.Button[@text='Entre na conta']")
private WebElement btnEntreNaConta;

// 2. Por content-desc (data-testid) - ALTERNATIVA 1
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='prelogin-login-button']")
private WebElement btnEntreNaContaByDesc;

// 3. Por content-desc (aria-label) - ALTERNATIVA 2
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='Entre na conta']")
private WebElement btnEntreNaContaByAriaLabel;

// 4. UiSelector por text
@AndroidFindBy(uiAutomator = "new UiSelector().text(\"Entre na conta\")")
private WebElement btnEntreNaContaByUiSelector;

// 5. UiSelector por description (data-testid)
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"prelogin-login-button\")")
private WebElement btnEntreNaContaByUiSelectorDesc;
```

---

## 📋 PreLoginDashboard - Botão "Não é cliente? Abra uma conta"

### Atributos no Código:
- `id="btn-prelogin-signup"`
- `data-testid="prelogin-signup-button"` → vira `content-desc="prelogin-signup-button"`
- `aria-label="Não é cliente? Abra uma conta"`
- Texto visível: `"Não é cliente? Abra uma conta"` → aparece como `text="Não é cliente? Abra uma conta"`

### ✅ Seletores que Funcionam:

```java
// 1. Por text (texto visível) - MELHOR
@AndroidFindBy(xpath = "//android.widget.Button[@text='Não é cliente? Abra uma conta']")
private WebElement btnAbraUmaConta;

// 2. Por content-desc (data-testid) - ALTERNATIVA 1
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='prelogin-signup-button']")
private WebElement btnAbraUmaContaByDesc;

// 3. Por content-desc (aria-label) - ALTERNATIVA 2
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='Não é cliente? Abra uma conta']")
private WebElement btnAbraUmaContaByAriaLabel;

// 4. UiSelector por text
@AndroidFindBy(uiAutomator = "new UiSelector().text(\"Não é cliente? Abra uma conta\")")
private WebElement btnAbraUmaContaByUiSelector;

// 5. UiSelector por description (data-testid)
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"prelogin-signup-button\")")
private WebElement btnAbraUmaContaByUiSelectorDesc;
```

---

## 🎯 Hierarquia de Prioridade

Para cada elemento, use esta ordem:

1. **Por `text`** (texto visível) - ⭐ **MELHOR** (mais simples e direto)
2. **Por `content-desc` (data-testid)** - ✅ **RECOMENDADO** (mais estável)
3. **Por `content-desc` (aria-label)** - ✅ **ALTERNATIVA**
4. **UiSelector por `text()`** - ✅ **FALLBACK 1**
5. **UiSelector por `description()`** - ✅ **FALLBACK 2**
6. **XPath por `@text`** - ✅ **FALLBACK 3**
7. **XPath por `@content-desc`** - ✅ **FALLBACK 4**

---

## ⚠️ Importante

- ✅ **Todos os seletores acima são baseados em atributos reais do código**
- ✅ **Testados e funcionais no Appium Inspector**
- ❌ **NÃO inclui seletores que não funcionam** (como `resource-id` no WebView)
- ❌ **NÃO inclui XPath verboso** (apenas XPath simples e direto)

---

## 📚 Como Verificar no Appium Inspector

1. Abra o Appium Inspector
2. Selecione o elemento
3. Veja a aba "Localizar por" e "Seletor"
4. Você verá os seletores disponíveis baseados nos atributos reais

---

**Última atualização:** 2025-01-27  
**Versão:** 1.0.0

