# ✅ IDs Criados para Seleção de Tipo de Chave PIX

## 📋 IDs Implementados

### 1. Botão E-mail na Lista

**ID Principal:** `pix-key-type-email`

**Localização:** Botão clicável na lista dropdown para selecionar tipo "E-mail"

**Atributos:**
- `id`: `pix-key-type-email`
- `data-testid`: `pix-key-type-email`
- `name`: `pix-key-type-email`
- `aria-label`: `Selecionar tipo E-mail`
- `title`: `E-mail`

**Seletores Appium:**
```java
// Por ID
By.id("pix-key-type-email")

// Por content-desc (via aria-label)
By.xpath("//android.widget.Button[@content-desc='pix-key-type-email']")
By.xpath("//android.widget.Button[@content-desc='Selecionar tipo E-mail']")

// Por texto
By.xpath("//android.widget.Button[@text='E-mail']")

// Por UiSelector
MobileBy.AndroidUIAutomator("new UiSelector().description(\"pix-key-type-email\")")
```

---

### 2. Botão CPF na Lista

**ID Principal:** `pix-key-type-cpf`

**Localização:** Botão clicável na lista dropdown para selecionar tipo "CPF"

**Atributos:**
- `id`: `pix-key-type-cpf`
- `data-testid`: `pix-key-type-cpf`
- `name`: `pix-key-type-cpf`
- `aria-label`: `Selecionar tipo CPF`
- `title`: `CPF`

**Seletores Appium:**
```java
// Por ID
By.id("pix-key-type-cpf")

// Por content-desc (via aria-label)
By.xpath("//android.widget.Button[@content-desc='pix-key-type-cpf']")
By.xpath("//android.widget.Button[@content-desc='Selecionar tipo CPF']")

// Por texto
By.xpath("//android.widget.Button[@text='CPF']")

// Por UiSelector
MobileBy.AndroidUIAutomator("new UiSelector().description(\"pix-key-type-cpf\")")
```

---

### 3. Texto E-mail (dentro do botão)

**ID:** `pix-key-type-email-text`

**Localização:** Span com o texto "E-mail" dentro do botão

**Atributos:**
- `id`: `pix-key-type-email-text`
- `data-testid`: `pix-key-type-email-text`
- `aria-label`: `E-mail`

**Seletores Appium:**
```java
By.id("pix-key-type-email-text")
By.xpath("//android.widget.TextView[@content-desc='pix-key-type-email-text']")
By.xpath("//android.widget.TextView[@text='E-mail']")
```

---

### 4. Texto CPF (dentro do botão)

**ID:** `pix-key-type-cpf-text`

**Localização:** Span com o texto "CPF" dentro do botão

**Atributos:**
- `id`: `pix-key-type-cpf-text`
- `data-testid`: `pix-key-type-cpf-text`
- `aria-label`: `CPF`

**Seletores Appium:**
```java
By.id("pix-key-type-cpf-text")
By.xpath("//android.widget.TextView[@content-desc='pix-key-type-cpf-text']")
By.xpath("//android.widget.TextView[@text='CPF']")
```

---

### 5. Check Mark E-mail (quando selecionado)

**ID:** `pix-key-type-email-check`

**Localização:** Ícone de check que aparece quando E-mail está selecionado

**Atributos:**
- `id`: `pix-key-type-email-check`
- `data-testid`: `pix-key-type-email-check`

**Uso:** Para validar se E-mail está selecionado

---

### 6. Check Mark CPF (quando selecionado)

**ID:** `pix-key-type-cpf-check`

**Localização:** Ícone de check que aparece quando CPF está selecionado

**Atributos:**
- `id`: `pix-key-type-cpf-check`
- `data-testid`: `pix-key-type-cpf-check`

**Uso:** Para validar se CPF está selecionado

---

## 🎯 Exemplo de Uso Completo

### Selecionar E-mail

```java
// 1. Abrir dropdown
driver.findElement(By.id("pix-key-type-selector")).click();

// 2. Aguardar dropdown aparecer
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(5));
wait.until(ExpectedConditions.presenceOfElementLocated(By.id("pix-key-type-dropdown")));

// 3. Selecionar E-mail usando ID
driver.findElement(By.id("pix-key-type-email")).click();

// OU por texto
driver.findElement(By.xpath("//android.widget.Button[@text='E-mail']")).click();
```

### Selecionar CPF

```java
// 1. Abrir dropdown
driver.findElement(By.id("pix-key-type-selector")).click();

// 2. Aguardar dropdown aparecer
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(5));
wait.until(ExpectedConditions.presenceOfElementLocated(By.id("pix-key-type-dropdown")));

// 3. Selecionar CPF usando ID
driver.findElement(By.id("pix-key-type-cpf")).click();

// OU por texto
driver.findElement(By.xpath("//android.widget.Button[@text='CPF']")).click();
```

### Validar Seleção

```java
// Verificar se E-mail está selecionado
boolean emailSelected = driver.findElements(By.id("pix-key-type-email-check")).size() > 0;

// Verificar se CPF está selecionado
boolean cpfSelected = driver.findElements(By.id("pix-key-type-cpf-check")).size() > 0;
```

---

## ✅ Resumo dos IDs

| Elemento | ID Principal | Texto Visível | Check Mark |
|----------|--------------|---------------|------------|
| **E-mail** | `pix-key-type-email` | `pix-key-type-email-text` | `pix-key-type-email-check` |
| **CPF** | `pix-key-type-cpf` | `pix-key-type-cpf-text` | `pix-key-type-cpf-check` |

---

## 🔍 Verificação no Appium Inspector

Para verificar se os IDs estão funcionando:

1. Abra o Appium Inspector
2. Navegue até a tela de cadastro de chave PIX
3. Clique no botão seletor para abrir o dropdown
4. Procure pelos elementos com:
   - `resource-id="pix-key-type-email"` ou `content-desc="pix-key-type-email"`
   - `resource-id="pix-key-type-cpf"` ou `content-desc="pix-key-type-cpf"`
   - `text="E-mail"` ou `text="CPF"`

---

**Última atualização:** Janeiro 2025
