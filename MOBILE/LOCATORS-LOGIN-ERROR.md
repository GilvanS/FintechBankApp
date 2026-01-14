# 📍 Locators para Mensagem de Erro de Login

Este documento lista todas as estratégias de localização disponíveis para o elemento de mensagem de erro na tela de login.

## 🎯 Elemento: Mensagem de Erro de Login

### Estrutura do Elemento

O componente `StatusMessage` com `type="error"` renderiza uma mensagem de erro com múltiplos atributos para facilitar a localização em testes automatizados.

---

## 🔍 Estratégias de Localização

### 1. **Por ID (Mais Rápido)**

```java
// Appium/WebDriver
driver.findElement(By.id("login-error-message"));

// Selenium WebDriver
WebElement errorMsg = driver.findElement(By.id("login-error-message"));
```

### 2. **Por Data-TestID**

```java
// Appium
driver.findElement(AppiumBy.accessibilityId("login-error-message"));

// Selenium com XPath
driver.findElement(By.xpath("//*[@data-testid='login-error-message']"));

// Cypress (se aplicável)
cy.get('[data-testid="login-error-message"]');
```

### 3. **Por Data-CY (Cypress)**

```java
// XPath
driver.findElement(By.xpath("//*[@data-cy='login-error-message']"));
```

### 4. **Por Data-Playwright**

```java
// XPath
driver.findElement(By.xpath("//*[@data-playwright='login-error-message']"));
```

### 5. **Por Name Attribute**

```java
driver.findElement(By.name("login-error-message"));
```

### 6. **Por Classe CSS**

```java
// Classe específica
driver.findElement(By.className("login-error-message"));

// Múltiplas classes
driver.findElement(By.cssSelector(".login-status-message.login-error-message"));
```

### 7. **Por Role (Acessibilidade)**

```java
// XPath com role
driver.findElement(By.xpath("//*[@role='alert' and contains(@class, 'login-error-message')]"));
```

### 8. **Por Texto da Mensagem**

```java
// XPath com texto parcial
driver.findElement(By.xpath("//*[contains(text(), 'CPF deve ter 11 numeros')]"));

// XPath com texto exato
driver.findElement(By.xpath("//*[text()='CPF deve ter 11 numeros']"));

// Por atributo data-message
driver.findElement(By.xpath("//*[@data-message='CPF deve ter 11 numeros']"));
```

### 9. **Por Tipo de Mensagem**

```java
// Por atributo data-message-type
driver.findElement(By.xpath("//*[@data-message-type='error']"));
```

### 10. **Por Ícone (Material Symbols)**

```java
// Localizar pelo ícone de erro
driver.findElement(By.xpath("//*[@data-testid='login-error-message-icon']"));
```

### 11. **Por Texto do Elemento Filho**

```java
// Localizar pelo texto dentro do elemento
driver.findElement(By.xpath("//*[@id='login-error-message']//*[@data-testid='login-error-message-text']"));
```

### 12. **Android UI Automator**

```java
// Por resource-id
driver.findElement(AppiumBy.androidUIAutomator(
    "new UiSelector().resourceId(\"login-error-message\")"
));

// Por texto
driver.findElement(AppiumBy.androidUIAutomator(
    "new UiSelector().textContains(\"CPF deve ter\")"
));

// Por descrição
driver.findElement(AppiumBy.androidUIAutomator(
    "new UiSelector().description(\"Mensagem de erro\")"
));
```

### 13. **iOS Predicate String**

```swift
// Por accessibility identifier
driver.findElement(AppiumBy.iOSNsPredicateString(
    "identifier == 'login-error-message'"
));

// Por label
driver.findElement(AppiumBy.iOSNsPredicateString(
    "label CONTAINS 'CPF deve ter'"
));
```

### 14. **XPath Completo (Mais Robusto)**

```java
// XPath com múltiplas condições
driver.findElement(By.xpath(
    "//div[@id='login-error-message' and @role='alert' and contains(@class, 'login-error-message')]"
));

// XPath com texto e atributos
driver.findElement(By.xpath(
    "//*[@data-testid='login-error-message' and @data-message-type='error' and contains(text(), 'CPF')]"
));
```

### 15. **CSS Selector**

```java
// Por ID
driver.findElement(By.cssSelector("#login-error-message"));

// Por classe
driver.findElement(By.cssSelector(".login-error-message"));

// Por atributo
driver.findElement(By.cssSelector("[data-testid='login-error-message']"));

// Combinado
driver.findElement(By.cssSelector(
    "#login-error-message.login-status-message[role='alert']"
));
```

---

## 📋 Atributos Disponíveis no Elemento

| Atributo | Valor | Uso |
|----------|-------|-----|
| `id` | `login-error-message` | Localização direta por ID |
| `data-testid` | `login-error-message` | Testes automatizados |
| `data-cy` | `login-error-message` | Cypress |
| `data-playwright` | `login-error-message` | Playwright |
| `name` | `login-error-message` | Localização por nome |
| `role` | `alert` | Acessibilidade |
| `aria-live` | `assertive` | Acessibilidade |
| `aria-atomic` | `true` | Acessibilidade |
| `aria-label` | `Mensagem de erro` | Acessibilidade |
| `data-message` | `[texto da mensagem]` | Localização por conteúdo |
| `data-message-type` | `error` | Localização por tipo |
| `class` | `login-status-message login-error-message` | Estilização e localização |

---

## 🎯 Elementos Filhos

### Texto da Mensagem

```java
// ID
driver.findElement(By.id("login-error-message-text"));

// Data-testid
driver.findElement(By.xpath("//*[@data-testid='login-error-message-text']"));

// Por texto
driver.findElement(By.xpath("//*[@id='login-error-message']//span[contains(text(), 'CPF')]"));
```

### Ícone

```java
// ID
driver.findElement(By.id("login-error-message-icon"));

// Data-testid
driver.findElement(By.xpath("//*[@data-testid='login-error-message-icon']"));
```

### Botão Fechar

```java
// ID
driver.findElement(By.id("login-error-message-close"));

// Data-testid
driver.findElement(By.xpath("//*[@data-testid='login-error-message-close']"));
```

---

## 💡 Recomendações de Uso

### Prioridade de Localização (do mais rápido ao mais lento)

1. **Por ID** - Mais rápido e direto
2. **Por Data-TestID** - Padrão para testes
3. **Por Name** - Alternativa simples
4. **Por CSS Selector** - Bom para web
5. **Por XPath** - Mais flexível, mas mais lento
6. **Por Texto** - Útil quando outros falham

### Exemplo de Implementação Robusta

```java
public WebElement getLoginErrorMessage(WebDriver driver) {
    // Tentar múltiplas estratégias em ordem de prioridade
    try {
        return driver.findElement(By.id("login-error-message"));
    } catch (NoSuchElementException e1) {
        try {
            return driver.findElement(By.xpath("//*[@data-testid='login-error-message']"));
        } catch (NoSuchElementException e2) {
            try {
                return driver.findElement(By.xpath("//*[@role='alert' and contains(@class, 'login-error-message')]"));
            } catch (NoSuchElementException e3) {
                return driver.findElement(By.xpath("//*[contains(text(), 'CPF deve ter')]"));
            }
        }
    }
}
```

### Exemplo com Espera Explícita

```java
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(30));

// Esperar por ID
WebElement errorMsg = wait.until(
    ExpectedConditions.visibilityOfElementLocated(By.id("login-error-message"))
);

// Ou esperar por qualquer atributo
WebElement errorMsg = wait.until(
    ExpectedConditions.visibilityOfElementLocated(
        By.xpath("//*[@data-testid='login-error-message' or @id='login-error-message']")
    )
);
```

---

## ✅ Validações Comuns

### Verificar se a mensagem está visível

```java
WebElement errorMsg = driver.findElement(By.id("login-error-message"));
assertTrue(errorMsg.isDisplayed(), "Mensagem de erro deve estar visível");
```

### Verificar o texto da mensagem

```java
WebElement errorMsg = driver.findElement(By.id("login-error-message"));
String text = errorMsg.findElement(By.id("login-error-message-text")).getText();
assertEquals("CPF deve ter 11 numeros", text);
```

### Verificar se contém texto específico

```java
WebElement errorMsg = driver.findElement(By.id("login-error-message"));
String text = errorMsg.getText();
assertTrue(text.contains("CPF deve ter"), "Mensagem deve conter 'CPF deve ter'");
```

---

## 🔧 Troubleshooting

### Problema: Timeout ao localizar elemento

**Soluções:**
1. Verificar se o elemento está sendo renderizado (adicionar logs)
2. Aumentar o timeout da espera explícita
3. Tentar localização por texto se outros métodos falharem
4. Verificar se há múltiplos elementos com o mesmo ID (não deveria acontecer)

### Problema: Elemento encontrado mas não visível

**Soluções:**
1. Usar `ExpectedConditions.visibilityOfElementLocated()` em vez de `presenceOfElementLocated()`
2. Verificar se há sobreposição de elementos (z-index)
3. Verificar se o elemento está dentro de um container oculto

---

**Última atualização:** Janeiro 2025
