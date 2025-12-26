# 🎯 Guia de Locators para Testes Automatizados

Este documento descreve todos os tipos de locators disponíveis nos componentes do FintechBankApp para facilitar testes automatizados com diferentes ferramentas.

## 📋 Tipos de Locators Implementados

### 1. **data-testid** (Padrão - Todas as ferramentas)
- **Selenium**: `By.cssSelector('[data-testid="..."]')`
- **Cypress**: `cy.get('[data-testid="..."]')`
- **Playwright**: `page.getByTestId('...')`
- **Appium**: Suportado via `testID` (React Native)

### 2. **data-cy** (Cypress)
- **Cypress**: `cy.get('[data-cy="..."]')` ou `cy.getByCy('...')`

### 3. **data-playwright** (Playwright)
- **Playwright**: `page.locator('[data-playwright="..."]')`

### 4. **id** (Selenium, Playwright)
- **Selenium**: `By.id('...')`
- **Playwright**: `page.locator('#...')`
- **JavaScript**: `document.getElementById('...')`

### 5. **name** (Selenium, Formulários)
- **Selenium**: `By.name('...')`
- **Playwright**: `page.locator('[name="..."]')`

### 6. **className** (Classes específicas para testes)
- **Selenium**: `By.className('test-...')`
- **Cypress**: `cy.get('.test-...')`
- **Playwright**: `page.locator('.test-...')`

### 7. **aria-label** (Acessibilidade e Appium)
- **Selenium**: `By.cssSelector('[aria-label="..."]')`
- **Playwright**: `page.getByLabel('...')`
- **Appium**: `driver.findElement(By.accessibilityId('...'))`

### 8. **role** (Semântica)
- **Playwright**: `page.getByRole('button', { name: '...' })`
- **Selenium**: `By.cssSelector('[role="..."]')`

## 🗺️ Mapa de Locators por Componente

### PreLoginDashboard

#### Página Principal
```javascript
// Selenium
driver.findElement(By.id("prelogin-dashboard"))
driver.findElement(By.cssSelector('[data-testid="prelogin-dashboard"]'))

// Cypress
cy.get('[data-cy="prelogin-dashboard"]')
cy.get('#prelogin-dashboard')

// Playwright
page.getByTestId('prelogin-dashboard')
page.locator('#prelogin-dashboard')
page.locator('[data-playwright="prelogin-dashboard"]')
```

#### Botões de Ação
```javascript
// PIX e Transferir
data-testid="prelogin-action-pix"
id="btn-pix"
name="action-pix"
className="test-action-button"

// Pagar
data-testid="prelogin-action-pay"
id="btn-pay"
name="action-pay"

// Extrato
data-testid="prelogin-action-statement"
id="btn-statement"
name="action-statement"

// Cartões
data-testid="prelogin-action-cards"
id="btn-cards"
name="action-cards"

// Marketplace
data-testid="prelogin-action-marketplace"
id="btn-marketplace"
name="action-marketplace"
```

#### Botões CTA
```javascript
// Login
id="btn-login"
name="login-button"
data-testid="prelogin-login-button"
data-cy="prelogin-login-button"
data-playwright="prelogin-login-button"
className="test-login-button"

// SignUp
id="btn-signup"
name="signup-button"
data-testid="prelogin-signup-button"
data-cy="prelogin-signup-button"
data-playwright="prelogin-signup-button"
className="test-signup-button"
```

### Login

#### Campos de Formulário
```javascript
// CPF
id="login-cpf"
name="cpf"
data-testid="login-input-cpf"
data-cy="login-input-cpf"
data-playwright="login-input-cpf"
className="test-input-cpf"

// Senha
id="login-password"
name="password"
data-testid="login-input-password"
data-cy="login-input-password"
data-playwright="login-input-password"
className="test-input-password"
```

#### Botões
```javascript
// Submit
id="btn-login-submit"
name="login-submit"
data-testid="login-submit-button"
data-cy="login-submit-button"
data-playwright="login-submit-button"
className="test-submit-button"

// Esqueci minha senha
id="btn-forgot-password"
name="forgot-password"
data-testid="login-forgot-password-button"
data-cy="login-forgot-password-button"
data-playwright="login-forgot-password-button"
className="test-forgot-password"
```

### SignUp

#### Campos de Formulário
```javascript
// Nome Completo
id="signup-fullname"
name="fullname"
data-testid="signup-input-fullname"
data-cy="signup-input-fullname"
data-playwright="signup-input-fullname"
className="test-input-fullname"

// E-mail
id="signup-email"
name="email"
data-testid="signup-input-email"
data-cy="signup-input-email"
data-playwright="signup-input-email"
className="test-input-email"

// CPF
id="signup-cpf"
name="cpf"
data-testid="signup-input-cpf"
data-cy="signup-input-cpf"
data-playwright="signup-input-cpf"
className="test-input-cpf"

// Senha
id="signup-password"
name="password"
data-testid="signup-input-password"
data-cy="signup-input-password"
data-playwright="signup-input-password"
className="test-input-password"

// Confirmar Senha
id="signup-confirm-password"
name="confirm-password"
data-testid="signup-input-confirm-password"
data-cy="signup-input-confirm-password"
data-playwright="signup-input-confirm-password"
className="test-input-confirm-password"
```

### PasswordModal

```javascript
// Modal Overlay
id="password-modal-overlay"
data-testid="password-modal-overlay"
data-cy="password-modal-overlay"
data-playwright="password-modal-overlay"
className="test-modal-overlay"

// Input
id="password-modal-input"
name="password"
data-testid="password-modal-input"
data-cy="password-modal-input"
data-playwright="password-modal-input"
className="test-input-password"

// Botão Cancelar
id="btn-modal-cancel"
name="modal-cancel"
data-testid="password-modal-cancel-button"
data-cy="password-modal-cancel-button"
data-playwright="password-modal-cancel-button"
className="test-cancel-button"

// Botão Confirmar
id="btn-modal-confirm"
name="modal-confirm"
data-testid="password-modal-confirm-button"
data-cy="password-modal-confirm-button"
data-playwright="password-modal-confirm-button"
className="test-confirm-button"
```

## 📱 Appium (Mobile)

Para Appium, os locators são os mesmos do web, mas também podemos usar:

```javascript
// Por accessibilityLabel (aria-label)
driver.findElement(By.accessibilityId('Acessar minha conta'))

// Por testID (data-testid)
driver.findElement(By.id('prelogin-login-button'))
```

## 🎨 Classes CSS para Testes

Todas as classes começam com `test-` para facilitar seleção:

- `test-login-page`
- `test-signup-page`
- `test-prelogin-page`
- `test-input-cpf`
- `test-input-password`
- `test-submit-button`
- `test-action-button`
- `test-modal-overlay`
- `test-modal`
- `test-cancel-button`
- `test-confirm-button`

## 📝 Exemplos de Uso por Ferramenta

### Selenium (Java)
```java
// Por ID
WebElement loginButton = driver.findElement(By.id("btn-login"));

// Por data-testid
WebElement loginButton = driver.findElement(By.cssSelector("[data-testid='prelogin-login-button']"));

// Por name
WebElement cpfField = driver.findElement(By.name("cpf"));

// Por className
WebElement submitButton = driver.findElement(By.className("test-submit-button"));
```

### Cypress
```javascript
// Por data-cy (recomendado)
cy.get('[data-cy="prelogin-login-button"]').click();

// Por data-testid
cy.get('[data-testid="login-input-cpf"]').type('11111111111');

// Por ID
cy.get('#btn-login').click();

// Por className
cy.get('.test-submit-button').click();
```

### Playwright
```javascript
// Por testId (recomendado)
await page.getByTestId('prelogin-login-button').click();

// Por role e label
await page.getByRole('button', { name: 'Acessar minha conta' }).click();

// Por label
await page.getByLabel('CPF').fill('11111111111');

// Por data-playwright
await page.locator('[data-playwright="login-input-cpf"]').fill('11111111111');

// Por ID
await page.locator('#btn-login').click();
```

### Appium (Mobile)
```javascript
// Por accessibilityLabel
driver.findElement(By.accessibilityId('Acessar minha conta')).click();

// Por ID (testID)
driver.findElement(By.id('prelogin-login-button')).click();

// Por XPath (usando data-testid)
driver.findElement(By.xpath('//*[@data-testid="login-input-cpf"]')).sendKeys('11111111111');
```

## ✅ Boas Práticas

1. **Prioridade de Locators:**
   - 1º: `data-testid` / `data-cy` / `data-playwright` (mais estáveis)
   - 2º: `id` (único e estável)
   - 3º: `name` (para formulários)
   - 4º: `aria-label` (acessibilidade)
   - 5º: `className` com prefixo `test-`

2. **Evitar:**
   - Classes CSS de estilo (podem mudar)
   - XPath complexos baseados em estrutura HTML
   - Seletores por texto (podem mudar com traduções)

3. **Padrão de Nomenclatura:**
   - `{page}-{element-type}-{name}`
   - Exemplo: `login-input-cpf`, `prelogin-login-button`

## 🔍 Ferramentas de Debug

Use o DevTools do navegador para testar locators:

```javascript
// Console do navegador
document.querySelector('[data-testid="prelogin-login-button"]')
document.getElementById('btn-login')
document.querySelector('.test-submit-button')
```




