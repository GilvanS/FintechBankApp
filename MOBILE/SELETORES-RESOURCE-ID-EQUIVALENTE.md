# 🎯 Seletores Appium - Equivalente a Resource-ID

## ⚠️ Importante: WebView não tem Resource-ID

Em aplicações **WebView (Capacitor)**, elementos HTML **NÃO podem ter `resource-id` nativo**.

**Solução:** Use `content-desc` que funciona **exatamente como `resource-id`**.

## 📋 Tabela de Seletores - Login

| Elemento | HTML | Android | Seletores Java |
|---------|------|---------|----------------|
| **Campo CPF** | `id="login-cpf-input"`<br>`data-testid="login-input-cpf"` | `content-desc="login-input-cpf"` | Ver abaixo |
| **Campo Senha** | `id="login-password-input"`<br>`data-testid="login-input-password"` | `content-desc="login-input-password"` | Ver abaixo |
| **Botão Entrar** | `id="btn-login-submit"`<br>`data-testid="login-submit-button"` | `content-desc="login-submit-button"`<br>`text="Entrar"` | Ver abaixo |
| **Link Esqueci Senha** | `id="link-forgot-password"`<br>`data-testid="login-forgot-password-link"` | `content-desc="login-forgot-password-link"`<br>`text="Esqueci minha senha"` | Ver abaixo |
| **Link Cadastre-se** | `id="link-signup"`<br>`data-testid="login-signup-link"` | `content-desc="login-signup-link"`<br>`text="Cadastre-se"` | Ver abaixo |

## ✅ Seletores Java Prontos

### Campo CPF

```java
// ✅ MELHOR - Por content-desc (XPath)
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-cpf']")
private WebElement campoCpf;

// ✅ ALTERNATIVA 1 - Por content-desc (UiSelector)
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"login-input-cpf\")")
private WebElement campoCpf;

// ✅ ALTERNATIVA 2 - Por placeholder (text)
@AndroidFindBy(xpath = "//android.widget.EditText[@text='999.999.999-99']")
private WebElement campoCpf;
```

### Campo Senha

```java
// ✅ MELHOR - Por content-desc (XPath)
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-password']")
private WebElement campoSenha;

// ✅ ALTERNATIVA 1 - Por content-desc (UiSelector)
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"login-input-password\")")
private WebElement campoSenha;

// ✅ ALTERNATIVA 2 - Por placeholder (text)
@AndroidFindBy(xpath = "//android.widget.EditText[@text='••••••••']")
private WebElement campoSenha;
```

### Botão Entrar

```java
// ✅ MELHOR - Por content-desc (XPath)
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='login-submit-button']")
private WebElement btnEntrar;

// ✅ ALTERNATIVA 1 - Por text
@AndroidFindBy(xpath = "//android.widget.Button[@text='Entrar']")
private WebElement btnEntrar;

// ✅ ALTERNATIVA 2 - Por content-desc (UiSelector)
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"login-submit-button\")")
private WebElement btnEntrar;
```

### Link "Esqueci minha senha"

```java
// ✅ MELHOR - Por content-desc (XPath)
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='login-forgot-password-link']")
private WebElement linkEsqueciSenha;

// ✅ ALTERNATIVA - Por text
@AndroidFindBy(xpath = "//android.widget.Button[@text='Esqueci minha senha']")
private WebElement linkEsqueciSenha;
```

### Link "Cadastre-se"

```java
// ✅ MELHOR - Por content-desc (XPath)
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='login-signup-link']")
private WebElement linkCadastreSe;

// ✅ ALTERNATIVA - Por text
@AndroidFindBy(xpath = "//android.widget.Button[@text='Cadastre-se']")
private WebElement linkCadastreSe;
```

## 📋 Tabela de Seletores - SignUp

| Elemento | HTML | Android | Seletores Java |
|---------|------|---------|----------------|
| **Campo Nome** | `id="signup-fullname-input"`<br>`data-testid="signup-input-fullname"` | `content-desc="signup-input-fullname"` | Ver abaixo |
| **Campo CPF** | `id="signup-cpf-input"`<br>`data-testid="signup-input-cpf"` | `content-desc="signup-input-cpf"` | Ver abaixo |
| **Campo Email** | `id="signup-email-input"`<br>`data-testid="signup-input-email"` | `content-desc="signup-input-email"` | Ver abaixo |
| **Campo Senha** | `id="signup-password-input"`<br>`data-testid="signup-input-password"` | `content-desc="signup-input-password"` | Ver abaixo |
| **Campo Confirmar Senha** | `id="signup-confirm-password-input"`<br>`data-testid="signup-input-confirm-password"` | `content-desc="signup-input-confirm-password"` | Ver abaixo |
| **Botão Cadastrar** | `id="btn-signup-submit"`<br>`data-testid="signup-submit-button"` | `content-desc="signup-submit-button"`<br>`text="Cadastrar"` | Ver abaixo |

## ✅ Seletores Java - SignUp

### Campo Nome Completo

```java
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='signup-input-fullname']")
private WebElement campoNome;
```

### Campo CPF

```java
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='signup-input-cpf']")
private WebElement campoCpf;
```

### Campo Email

```java
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='signup-input-email']")
private WebElement campoEmail;
```

### Campo Senha

```java
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='signup-input-password']")
private WebElement campoSenha;
```

### Campo Confirmar Senha

```java
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='signup-input-confirm-password']")
private WebElement campoConfirmarSenha;
```

### Botão Cadastrar

```java
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='signup-submit-button']")
private WebElement btnCadastrar;
```

## 📋 Tabela de Seletores - PreLoginDashboard

| Elemento | HTML | Android | Seletores Java |
|---------|------|---------|----------------|
| **Botão Entrar** | `id="btn-prelogin-login"`<br>`data-testid="prelogin-login-button"` | `content-desc="prelogin-login-button"`<br>`text="Entre na conta"` | Ver abaixo |
| **Botão Cadastrar** | `id="btn-prelogin-signup"`<br>`data-testid="prelogin-signup-button"` | `content-desc="prelogin-signup-button"`<br>`text="Criar conta"` | Ver abaixo |

## ✅ Seletores Java - PreLoginDashboard

### Botão "Entre na conta"

```java
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='prelogin-login-button']")
private WebElement btnEntrar;
```

### Botão "Criar conta"

```java
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='prelogin-signup-button']")
private WebElement btnCadastrar;
```

## 🎯 Como Usar no Appium Inspector

### 1. Por Content-Desc (Recomendado)

1. Abra o Appium Inspector
2. Selecione o elemento
3. Na seção "Localizar por", escolha `content-desc`
4. O seletor será: `login-input-cpf`

### 2. Por UiSelector

1. Abra o Appium Inspector
2. Selecione o elemento
3. Na seção "Localizar por", escolha `-android uiautomator`
4. O seletor será: `new UiSelector().description("login-input-cpf")`

### 3. Por XPath

1. Abra o Appium Inspector
2. Selecione o elemento
3. Na seção "Localizar por", escolha `xpath`
4. O seletor será: `//android.widget.EditText[@content-desc='login-input-cpf']`

## ✅ Resumo

- ❌ **`resource-id` não existe em WebView**
- ✅ **`content-desc` funciona exatamente como `resource-id`**
- ✅ **Use `@content-desc` ou `description()` no Appium**
- ✅ **Todos os elementos principais têm `data-testid` e `aria-label`**

## 🚀 Próximos Passos

1. **Rebuild do APK:**
   ```powershell
   cd MOBILE
   .\GERAR-APK-DO-ZERO.ps1
   ```

2. **Verificar no Appium Inspector:**
   - `content-desc` deve aparecer como `login-input-cpf`
   - Versão deve ser `4.0.2-20250127`

