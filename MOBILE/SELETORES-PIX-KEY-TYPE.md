# 🎯 Seletores Appium - Tipo de Chave PIX

## ✅ Elementos Melhorados

Os elementos de seleção de tipo de chave (CPF e E-mail) foram otimizados para facilitar a localização no Appium com identificadores únicos, específicos e menos verbosos.

---

## 📋 Elementos Disponíveis

### 1. Botão Seletor (Dropdown)

**Elemento:** Botão que abre/fecha a lista de tipos de chave

#### Seletores

```java
// ✅ Por ID (mais direto)
@AndroidFindBy(id = "pix-key-type-selector")
private MobileElement pixKeyTypeSelector;

// ✅ Por data-testid (content-desc)
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='pix-key-type-selector']")
private MobileElement pixKeyTypeSelector;

// ✅ Por UiSelector
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"pix-key-type-selector\")")
private MobileElement pixKeyTypeSelector;

// ✅ Por texto visível
@AndroidFindBy(xpath = "//android.widget.Button[contains(@text,'E-mail') or contains(@text,'CPF')]")
private MobileElement pixKeyTypeSelector;
```

#### Atributos
- `id`: `pix-key-type-selector`
- `data-testid`: `pix-key-type-selector`
- `name`: `pix-key-type-selector`
- `aria-label`: Dinâmico (inclui tipo selecionado)

---

### 2. Opção E-mail

**Elemento:** Botão para selecionar tipo "E-mail"

#### Seletores

```java
// ✅ MELHOR - Por ID único
@AndroidFindBy(id = "pix-key-type-email")
private MobileElement pixKeyTypeEmail;

// ✅ Por data-testid (content-desc)
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='pix-key-type-email']")
private MobileElement pixKeyTypeEmail;

// ✅ Por UiSelector
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"pix-key-type-email\")")
private MobileElement pixKeyTypeEmail;

// ✅ Por texto "E-mail"
@AndroidFindBy(xpath = "//android.widget.Button[@text='E-mail']")
private MobileElement pixKeyTypeEmail;

// ✅ Por aria-label
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='Selecionar tipo E-mail']")
private MobileElement pixKeyTypeEmail;
```

#### Atributos
- `id`: `pix-key-type-email`
- `data-testid`: `pix-key-type-email`
- `name`: `pix-key-type-email`
- `aria-label`: `Selecionar tipo E-mail`
- `text`: `E-mail` (visível)

#### Texto Interno

```java
// Texto "E-mail" dentro do botão
@AndroidFindBy(id = "pix-key-type-email-text")
private MobileElement pixKeyTypeEmailText;

// Check mark (quando selecionado)
@AndroidFindBy(id = "pix-key-type-email-check")
private MobileElement pixKeyTypeEmailCheck;
```

---

### 3. Opção CPF

**Elemento:** Botão para selecionar tipo "CPF"

#### Seletores

```java
// ✅ MELHOR - Por ID único
@AndroidFindBy(id = "pix-key-type-cpf")
private MobileElement pixKeyTypeCpf;

// ✅ Por data-testid (content-desc)
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='pix-key-type-cpf']")
private MobileElement pixKeyTypeCpf;

// ✅ Por UiSelector
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"pix-key-type-cpf\")")
private MobileElement pixKeyTypeCpf;

// ✅ Por texto "CPF"
@AndroidFindBy(xpath = "//android.widget.Button[@text='CPF']")
private MobileElement pixKeyTypeCpf;

// ✅ Por aria-label
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='Selecionar tipo CPF']")
private MobileElement pixKeyTypeCpf;
```

#### Atributos
- `id`: `pix-key-type-cpf`
- `data-testid`: `pix-key-type-cpf`
- `name`: `pix-key-type-cpf`
- `aria-label`: `Selecionar tipo CPF`
- `text`: `CPF` (visível)

#### Texto Interno

```java
// Texto "CPF" dentro do botão
@AndroidFindBy(id = "pix-key-type-cpf-text")
private MobileElement pixKeyTypeCpfText;

// Check mark (quando selecionado)
@AndroidFindBy(id = "pix-key-type-cpf-check")
private MobileElement pixKeyTypeCpfCheck;
```

---

### 4. Dropdown Container

**Elemento:** Container da lista dropdown

#### Seletores

```java
// ✅ Por ID
@AndroidFindBy(id = "pix-key-type-dropdown")
private MobileElement pixKeyTypeDropdown;

// ✅ Por data-testid (content-desc)
@AndroidFindBy(xpath = "//android.view.ViewGroup[@content-desc='pix-key-type-dropdown']")
private MobileElement pixKeyTypeDropdown;

// ✅ Por UiSelector
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"pix-key-type-dropdown\")")
private MobileElement pixKeyTypeDropdown;
```

#### Atributos
- `id`: `pix-key-type-dropdown`
- `data-testid`: `pix-key-type-dropdown`
- `name`: `pix-key-type-dropdown`
- `role`: `listbox`

---

## 🎯 Exemplos de Uso

### Exemplo 1: Selecionar Tipo E-mail

```java
// Abrir dropdown
MobileElement selector = driver.findElement(By.id("pix-key-type-selector"));
selector.click();

// Aguardar dropdown aparecer
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(5));
wait.until(ExpectedConditions.presenceOfElementLocated(By.id("pix-key-type-dropdown")));

// Selecionar E-mail
MobileElement emailOption = driver.findElement(By.id("pix-key-type-email"));
emailOption.click();
```

### Exemplo 2: Selecionar Tipo CPF

```java
// Abrir dropdown
driver.findElement(By.id("pix-key-type-selector")).click();

// Aguardar dropdown
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(5));
wait.until(ExpectedConditions.presenceOfElementLocated(By.id("pix-key-type-dropdown")));

// Selecionar CPF
driver.findElement(By.id("pix-key-type-cpf")).click();
```

### Exemplo 3: Usando XPath Simples

```java
// Selecionar E-mail por texto
driver.findElement(By.xpath("//android.widget.Button[@text='E-mail']")).click();

// Selecionar CPF por texto
driver.findElement(By.xpath("//android.widget.Button[@text='CPF']")).click();
```

### Exemplo 4: Usando UiSelector

```java
// Selecionar E-mail
MobileBy.AndroidUIAutomator("new UiSelector().description(\"pix-key-type-email\")").click();

// Selecionar CPF
MobileBy.AndroidUIAutomator("new UiSelector().description(\"pix-key-type-cpf\")").click();
```

---

## 📊 Comparação: Antes vs Depois

### ❌ Antes (Genérico e Verboso)

```java
// Elementos genéricos e repetitivos
@AndroidFindBy(xpath = "//android.view.View[@resource-id='pix-key-value-label']")
private MobileElement elementoGenerico;

// XPath muito verboso
@AndroidFindBy(xpath = "//android.widget.ListView[@resource-id='pix-key-type-dropdown']//android.view.View[@text='pix-key-value-label']")
private MobileElement elementoVerboso;
```

**Problemas:**
- ❌ IDs genéricos (`pix-key-value-label`)
- ❌ XPaths muito verbosos
- ❌ Difícil distinguir entre CPF e Email
- ❌ Elementos repetitivos

### ✅ Depois (Específico e Simples)

```java
// Elementos específicos e únicos
@AndroidFindBy(id = "pix-key-type-email")
private MobileElement pixKeyTypeEmail;

@AndroidFindBy(id = "pix-key-type-cpf")
private MobileElement pixKeyTypeCpf;

// XPaths simples e diretos
@AndroidFindBy(xpath = "//android.widget.Button[@text='E-mail']")
private MobileElement pixKeyTypeEmail;

@AndroidFindBy(xpath = "//android.widget.Button[@text='CPF']")
private MobileElement pixKeyTypeCpf;
```

**Vantagens:**
- ✅ IDs únicos e específicos
- ✅ XPaths simples e diretos
- ✅ Fácil distinguir entre CPF e Email
- ✅ Múltiplas formas de localização

---

## 🎯 Hierarquia de Prioridade para Seletores

1. **Por ID único** (`pix-key-type-email`, `pix-key-type-cpf`) - ⭐ **RECOMENDADO**
2. **Por texto visível** (`E-mail`, `CPF`) - ✅ **SIMPLES E DIRETO**
3. **Por content-desc** (`pix-key-type-email`, `pix-key-type-cpf`) - ✅ **CONFIÁVEL**
4. **Por UiSelector** - ✅ **ALTERNATIVA**
5. **Por XPath complexo** - ⚠️ **ÚLTIMO RECURSO**

---

## 📝 Checklist de Implementação

### Para Testes Appium

- [ ] Usar IDs únicos (`pix-key-type-email`, `pix-key-type-cpf`)
- [ ] Aguardar dropdown aparecer antes de selecionar
- [ ] Validar que o tipo foi selecionado corretamente
- [ ] Usar seletores simples e diretos
- [ ] Evitar XPaths muito verbosos

### Para Manutenção

- [ ] IDs devem ser únicos e descritivos
- [ ] Texto visível deve ser acessível
- [ ] Atributos `aria-label` devem ser específicos
- [ ] `data-testid` deve corresponder ao `id`

---

## 🔍 Validação

### Verificar se Elemento Existe

```java
// Verificar se dropdown está visível
boolean isDropdownVisible = driver.findElement(By.id("pix-key-type-dropdown")).isDisplayed();

// Verificar se opção E-mail existe
boolean emailExists = driver.findElements(By.id("pix-key-type-email")).size() > 0;

// Verificar se opção CPF existe
boolean cpfExists = driver.findElements(By.id("pix-key-type-cpf")).size() > 0;
```

### Verificar Tipo Selecionado

```java
// Verificar texto do seletor
String selectedType = driver.findElement(By.id("pix-key-type-selector-text")).getText();
// Retorna: "E-mail" ou "CPF"

// Verificar se check mark está visível
boolean emailSelected = driver.findElements(By.id("pix-key-type-email-check")).size() > 0;
boolean cpfSelected = driver.findElements(By.id("pix-key-type-cpf-check")).size() > 0;
```

---

## ✅ Resumo

### IDs Únicos
- `pix-key-type-selector` - Botão seletor
- `pix-key-type-email` - Opção E-mail
- `pix-key-type-cpf` - Opção CPF
- `pix-key-type-dropdown` - Container dropdown

### Seletores Recomendados

```java
// ✅ MELHOR - Por ID único
By.id("pix-key-type-email")
By.id("pix-key-type-cpf")

// ✅ ALTERNATIVA - Por texto
By.xpath("//android.widget.Button[@text='E-mail']")
By.xpath("//android.widget.Button[@text='CPF']")

// ✅ ALTERNATIVA - Por content-desc
By.xpath("//android.widget.Button[@content-desc='pix-key-type-email']")
By.xpath("//android.widget.Button[@content-desc='pix-key-type-cpf']")
```

---

**Última atualização:** Janeiro 2025
