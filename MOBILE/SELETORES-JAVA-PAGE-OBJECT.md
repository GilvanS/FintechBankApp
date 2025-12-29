# ☕ Seletores Java Page Object - Otimizados

## 🎯 Padrão: @AndroidFindBy com Seletores Funcionais

Seletores otimizados usando `@AndroidFindBy` com **TODOS** os seletores que realmente funcionam no Appium Inspector, baseados nos atributos reais do código.

> **⚠️ IMPORTANTE:** Todos os seletores abaixo são baseados em atributos reais e testados no Appium Inspector. Não inclui seletores que não funcionam.

---

## 📚 Documentação Completa

Para ver **TODOS** os seletores disponíveis para cada elemento, consulte:
- **[SELETORES-JAVA-COMPLETOS.md](./SELETORES-JAVA-COMPLETOS.md)** - Lista completa de todos os seletores funcionais

---

## ✅ Seletores Recomendados - PreLoginDashboard

```java
import io.appium.java_client.pagefactory.AndroidFindBy;
import org.openqa.selenium.WebElement;

public class PreLoginDashboardPage {
    
    @AndroidFindBy(xpath = "//android.widget.TextView[@text='Olá!']")
    private WebElement textoOla;
    
    @AndroidFindBy(xpath = "//android.widget.Button[@text='Entre na conta']")
    private WebElement btnEntreNaConta;
    
    @AndroidFindBy(xpath = "//android.widget.Button[@text='Não é cliente? Abra uma conta']")
    private WebElement btnAbraUmaConta;
    
    @AndroidFindBy(xpath = "//android.widget.Button[@content-desc='prelogin-login-button']")
    private WebElement btnEntreNaContaByDesc;
    
    @AndroidFindBy(xpath = "//android.widget.Button[@content-desc='prelogin-signup-button']")
    private WebElement btnAbraUmaContaByDesc;
}
```

---

## ✅ Seletores Recomendados - Login

**Seletores principais (use estes primeiro):**

```java
import io.appium.java_client.pagefactory.AndroidFindBy;
import org.openqa.selenium.WebElement;

public class LoginPage {
    
    // Campo CPF - MELHOR: Por text (placeholder)
    @AndroidFindBy(xpath = "//android.widget.EditText[@text='999.999.999-99']")
    private WebElement campoCpf;
    
    // Campo Senha - MELHOR: Por text (placeholder)
    @AndroidFindBy(xpath = "//android.widget.EditText[@text='••••••••']")
    private WebElement campoSenha;
    
    // Botão Entrar - MELHOR: Por text (texto visível)
    @AndroidFindBy(xpath = "//android.widget.Button[@text='Entrar']")
    private WebElement btnEntrar;
    
    // Link Esqueci Senha - MELHOR: Por text
    @AndroidFindBy(xpath = "//android.widget.Button[@text='Esqueci minha senha']")
    private WebElement btnEsqueciSenha;
    
    // Link Cadastre-se - MELHOR: Por text
    @AndroidFindBy(xpath = "//android.widget.Button[@text='Cadastre-se']")
    private WebElement btnCadastreSe;
    
    // Títulos
    @AndroidFindBy(xpath = "//android.widget.TextView[@text='Fintech']")
    private WebElement tituloFintech;
    
    @AndroidFindBy(xpath = "//android.widget.TextView[@text='Acesse sua conta']")
    private WebElement subtituloAcesseConta;
}
```

**Para ver TODAS as alternativas de seletores, consulte [SELETORES-JAVA-COMPLETOS.md](./SELETORES-JAVA-COMPLETOS.md)**

---

## ✅ Seletores Otimizados - SignUp

```java
import io.appium.java_client.pagefactory.AndroidFindBy;
import org.openqa.selenium.WebElement;

public class SignUpPage {
    
    // Campos de Input
    @AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='signup-input-fullname']")
    private WebElement campoNomeCompleto;
    
    @AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='signup-input-cpf']")
    private WebElement campoCpf;
    
    @AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='signup-input-email']")
    private WebElement campoEmail;
    
    @AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='signup-input-password']")
    private WebElement campoSenha;
    
    @AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='signup-input-confirm-password']")
    private WebElement campoConfirmarSenha;
    
    // Botões
    @AndroidFindBy(xpath = "//android.widget.Button[@text='Cadastrar']")
    private WebElement btnCadastrar;
    
    @AndroidFindBy(xpath = "//android.widget.Button[@content-desc='signup-submit-button']")
    private WebElement btnCadastrarByDesc;
    
    @AndroidFindBy(xpath = "//android.widget.Button[@content-desc='signup-back-button']")
    private WebElement btnVoltar;
    
    @AndroidFindBy(xpath = "//android.widget.Button[@text='Faça Login']")
    private WebElement btnFacaLogin;
    
    // Títulos
    @AndroidFindBy(xpath = "//android.widget.TextView[@text='Crie sua Conta']")
    private WebElement tituloCrieSuaConta;
}
```

---

## 🎯 Hierarquia de Prioridade para XPath

1. **`@content-desc`** - Vem de `data-testid` ou `aria-label` ⭐ **MELHOR**
2. **`@text`** - Texto visível ou placeholder
3. **`@resource-id`** - Se disponível (raro no WebView)
4. **XPath relativo simples** - Quando necessário
5. **XPath absoluto** - ❌ **EVITAR**

---

## 📝 Exemplo Completo - Page Object

```java
import io.appium.java_client.pagefactory.AppiumFieldDecorator;
import org.openqa.selenium.support.PageFactory;
import io.appium.java_client.android.AndroidDriver;

public class LoginPage {
    
    private AndroidDriver driver;
    
    public LoginPage(AndroidDriver driver) {
        this.driver = driver;
        PageFactory.initElements(new AppiumFieldDecorator(driver), this);
    }
    
    // Seletores otimizados
    @AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-cpf']")
    private WebElement campoCpf;
    
    @AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-password']")
    private WebElement campoSenha;
    
    @AndroidFindBy(xpath = "//android.widget.Button[@text='Entrar']")
    private WebElement btnEntrar;
    
    // Métodos de ação
    public void preencherCpf(String cpf) {
        campoCpf.clear();
        campoCpf.sendKeys(cpf);
    }
    
    public void preencherSenha(String senha) {
        campoSenha.clear();
        campoSenha.sendKeys(senha);
    }
    
    public void clicarEntrar() {
        btnEntrar.click();
    }
    
    public void fazerLogin(String cpf, String senha) {
        preencherCpf(cpf);
        preencherSenha(senha);
        clicarEntrar();
    }
}
```

**Uso:**
```java
LoginPage loginPage = new LoginPage(driver);
loginPage.fazerLogin("12345678900", "senha123");
```

---

## 🔍 Comparação: Antes vs Depois

### ❌ ANTES (Verboso)
```java
@AndroidFindBy(xpath = "//android.webkit.WebView[@text=\"Fintech - A nova era da sua vida financeira\"]/android.view.View/android.view.View/android.view.View/android.view.View/android.view.View[2]/android.view.View/android.widget.EditText[1]")
private WebElement campoCpf;
```

### ✅ DEPOIS (Otimizado)
```java
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-cpf']")
private WebElement campoCpf;
```

---

## 📋 Todos os Seletores - Resumo

### PreLoginDashboard
```java
@AndroidFindBy(xpath = "//android.widget.TextView[@text='Olá!']")
@AndroidFindBy(xpath = "//android.widget.Button[@text='Entre na conta']")
@AndroidFindBy(xpath = "//android.widget.Button[@text='Não é cliente? Abra uma conta']")
```

### Login
```java
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-cpf']")
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-password']")
@AndroidFindBy(xpath = "//android.widget.Button[@text='Entrar']")
@AndroidFindBy(xpath = "//android.widget.Button[@text='Esqueci minha senha']")
@AndroidFindBy(xpath = "//android.widget.Button[@text='Cadastre-se']")
```

### SignUp
```java
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='signup-input-fullname']")
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='signup-input-cpf']")
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='signup-input-email']")
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='signup-input-password']")
@AndroidFindBy(xpath = "//android.widget.Button[@text='Cadastrar']")
```

---

## ⚠️ Importante

- **Rebuild APK** necessário para os novos atributos aparecerem
- Use `@content-desc` quando disponível (vem de `data-testid`)
- Use `@text` como fallback para textos visíveis
- Evite XPath absoluto com muitos `/android.view.View`

---

**Última atualização:** 2025-01-27  
**Versão:** 1.0.0

