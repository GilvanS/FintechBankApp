# ☕ Seletores Java Appium - Otimizados

## 🎯 Objetivo

Seletores Java otimizados para Appium, evitando XPath verboso e `instance()` frágil.

---

## ⚠️ Problema Atual

**Seletores verbosos que você está usando:**
```java
// ❌ Muito verboso - XPath
driver.findElement(By.xpath("//android.webkit.WebView[@text=\"Fintech - A nova era da sua vida financeira\"]/android.view.View/android.view.View/android.view.View/android.view.View/android.view.View[2]/android.view.View/android.widget.EditText[1]"));

// ❌ Frágil - instance() pode mudar
driver.findElement(MobileBy.AndroidUIAutomator("new UiSelector().className(\"android.widget.EditText\").instance(0)"));
```

---

## ✅ Solução: Seletores Otimizados

### 1. Campo CPF - Login

**✅ RECOMENDADO - Por description (content-desc):**
```java
// Opção 1: Por data-testid (MELHOR)
WebElement cpfInput = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"login-input-cpf\")"
));
cpfInput.sendKeys("12345678900");

// Opção 2: Por aria-label
WebElement cpfInput = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"CPF\")"
));
cpfInput.sendKeys("12345678900");
```

**✅ ALTERNATIVA - Por placeholder:**
```java
WebElement cpfInput = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().text(\"999.999.999-99\")"
));
cpfInput.sendKeys("12345678900");
```

**✅ MAIS CONFIÁVEL - Classe + Description:**
```java
WebElement cpfInput = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().className(\"android.widget.EditText\").description(\"login-input-cpf\")"
));
cpfInput.sendKeys("12345678900");
```

---

### 2. Campo Senha - Login

**✅ RECOMENDADO - Por description:**
```java
// Opção 1: Por data-testid (MELHOR)
WebElement passwordInput = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"login-input-password\")"
));
passwordInput.sendKeys("senha123");

// Opção 2: Por aria-label
WebElement passwordInput = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"Senha\")"
));
passwordInput.sendKeys("senha123");
```

**✅ ALTERNATIVA - Por placeholder:**
```java
WebElement passwordInput = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().text(\"••••••••\")"
));
passwordInput.sendKeys("senha123");
```

**✅ MAIS CONFIÁVEL - Classe + Description:**
```java
WebElement passwordInput = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().className(\"android.widget.EditText\").description(\"login-input-password\")"
));
passwordInput.sendKeys("senha123");
```

---

### 3. Botão Entrar

**✅ RECOMENDADO:**
```java
// Por description
WebElement entrarButton = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"login-submit-button\")"
));
entrarButton.click();

// Ou por texto
WebElement entrarButton = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().text(\"Entrar\")"
));
entrarButton.click();
```

---

## 📋 Todos os Seletores - Login

### Campos de Input

```java
// CPF
WebElement cpfInput = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"login-input-cpf\")"
));

// Senha
WebElement passwordInput = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"login-input-password\")"
));
```

### Botões e Links

```java
// Botão Entrar
WebElement entrarButton = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"login-submit-button\")"
));

// Link Esqueci Senha
WebElement forgotPasswordLink = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"login-forgot-password-link\")"
));

// Link Cadastre-se
WebElement signupLink = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"login-signup-link\")"
));

// Botão Voltar
WebElement backButton = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"login-back-button\")"
));
```

### Mensagens

```java
// Mensagem de Erro
WebElement errorMessage = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"login-error-message\")"
));
```

---

## 📋 Todos os Seletores - SignUp

### Campos de Input

```java
// Nome Completo
WebElement fullNameInput = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"signup-input-fullname\")"
));

// CPF
WebElement cpfInput = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"signup-input-cpf\")"
));

// Email
WebElement emailInput = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"signup-input-email\")"
));

// Senha
WebElement passwordInput = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"signup-input-password\")"
));

// Confirmar Senha
WebElement confirmPasswordInput = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"signup-input-confirm-password\")"
));
```

### Botões

```java
// Botão Cadastrar
WebElement signupButton = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"signup-submit-button\")"
));

// Botão Voltar
WebElement backButton = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"signup-back-button\")"
));

// Link Login
WebElement loginLink = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"signup-login-link\")"
));
```

---

## 📋 Todos os Seletores - PreLoginDashboard

```java
// Botão Entre na conta
WebElement loginButton = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"prelogin-login-button\")"
));

// Botão Abra uma conta
WebElement signupButton = driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"prelogin-signup-button\")"
));
```

---

## 💻 Exemplo Completo - Teste de Login

```java
import io.appium.java_client.MobileBy;
import io.appium.java_client.android.AndroidDriver;
import org.openqa.selenium.WebElement;

public class LoginTest {
    
    public void testLogin() {
        // Preencher CPF
        WebElement cpfInput = driver.findElement(MobileBy.AndroidUIAutomator(
            "new UiSelector().description(\"login-input-cpf\")"
        ));
        cpfInput.sendKeys("12345678900");
        
        // Preencher Senha
        WebElement passwordInput = driver.findElement(MobileBy.AndroidUIAutomator(
            "new UiSelector().description(\"login-input-password\")"
        ));
        passwordInput.sendKeys("senha123");
        
        // Clicar em Entrar
        WebElement entrarButton = driver.findElement(MobileBy.AndroidUIAutomator(
            "new UiSelector().description(\"login-submit-button\")"
        ));
        entrarButton.click();
        
        // Aguardar navegação
        Thread.sleep(2000);
    }
}
```

---

## 🎯 Hierarquia de Prioridade (Java)

1. **UiSelector().description()** - Por `data-testid` ou `aria-label` ⭐ **MELHOR**
2. **UiSelector().text()** - Por placeholder ou texto visível
3. **UiSelector().className().description()** - Classe + description (mais confiável)
4. **XPath relativo** - Apenas se necessário
5. **XPath absoluto** - ❌ **EVITAR**
6. **instance()** - ❌ **EVITAR** (frágil)

---

## 🔍 Mapeamento: HTML → Java Appium

| HTML | Android | Java Appium |
|------|---------|-------------|
| `data-testid="login-input-cpf"` | `content-desc="login-input-cpf"` | `UiSelector().description("login-input-cpf")` |
| `aria-label="CPF"` | `content-desc="CPF"` | `UiSelector().description("CPF")` |
| `placeholder="999.999.999-99"` | `text="999.999.999-99"` | `UiSelector().text("999.999.999-99")` |
| Texto visível "Entrar" | `text="Entrar"` | `UiSelector().text("Entrar")` |

---

## ⚠️ Por que Evitar `instance()`?

**❌ PROBLEMA:**
```java
// Se a ordem dos campos mudar, instance(0) pode apontar para outro campo!
driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().className(\"android.widget.EditText\").instance(0)"
));
```

**✅ SOLUÇÃO:**
```java
// Sempre use description() ou text() para identificar unicamente
driver.findElement(MobileBy.AndroidUIAutomator(
    "new UiSelector().description(\"login-input-cpf\")"
));
```

---

## 📝 Métodos Helper (Opcional)

Para facilitar o uso, crie métodos helper:

```java
public class AppiumHelpers {
    
    private AndroidDriver driver;
    
    public AppiumHelpers(AndroidDriver driver) {
        this.driver = driver;
    }
    
    public WebElement findByDescription(String description) {
        return driver.findElement(MobileBy.AndroidUIAutomator(
            "new UiSelector().description(\"" + description + "\")"
        ));
    }
    
    public WebElement findByText(String text) {
        return driver.findElement(MobileBy.AndroidUIAutomator(
            "new UiSelector().text(\"" + text + "\")"
        ));
    }
    
    public WebElement findByClassNameAndDescription(String className, String description) {
        return driver.findElement(MobileBy.AndroidUIAutomator(
            "new UiSelector().className(\"" + className + "\").description(\"" + description + "\")"
        ));
    }
}
```

**Uso:**
```java
AppiumHelpers helper = new AppiumHelpers(driver);

// CPF
WebElement cpfInput = helper.findByDescription("login-input-cpf");
cpfInput.sendKeys("12345678900");

// Senha
WebElement passwordInput = helper.findByDescription("login-input-password");
passwordInput.sendKeys("senha123");
```

---

## ✅ Checklist

- [x] Seletores otimizados criados
- [x] Evita XPath verboso
- [x] Evita `instance()` frágil
- [x] Usa `description()` (content-desc)
- [x] Exemplos Java completos
- [x] Métodos helper opcionais

---

## 🚀 Próximos Passos

1. **Rebuild APK** para incluir os novos atributos
2. **Testar seletores** no Appium Inspector
3. **Usar os seletores** nos seus testes Java
4. **Evitar XPath** e `instance()`

---

**Última atualização:** 2025-01-27  
**Versão:** 1.0.0

