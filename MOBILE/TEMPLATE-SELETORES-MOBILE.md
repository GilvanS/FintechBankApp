# 📋 Template de Seletores Mobile - Por Tela

## 🎯 Como Usar Este Template

1. Copie este template para cada nova tela
2. Preencha os seletores conforme a hierarquia de prioridade
3. Documente seletores alternativos (fallback)
4. Valide que os seletores funcionam nos testes

---

## 📱 [NOME DA TELA]

### 📍 Informações Gerais

- **Componente:** `[NomeDoComponente.tsx]`
- **Rota:** `[caminho-da-rota]`
- **Última atualização:** `[data]`

---

### 🎨 Elementos Principais

#### 1. [Nome do Elemento] - [Tipo]

**Descrição:** [Descrição do elemento e sua função]

**Implementação:**
```tsx
// Código React do elemento
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const selector = '~[data-testid]';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const selector = '-android uiautomator: new UiSelector().description("[data-testid]")';
   // OU
   const selector = '-android uiautomator: new UiSelector().text("[texto]")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.[Tipo][@content-desc="[data-testid]"]
   // OU
   //android.view.ViewGroup[.//android.widget.TextView[@text="[texto]"]]//android.widget.[Tipo]
   ```

**Exemplo de Uso:**
```javascript
// Appium/WebDriverIO
await driver.$('~[data-testid]').click();

// Selenium
driver.findElement(By.id('[data-testid]')).click();
```

---

#### 2. [Próximo Elemento]

[Repetir estrutura acima para cada elemento]

---

### 🔄 Fluxos de Teste

#### Fluxo 1: [Nome do Fluxo]

**Passos:**
1. Localizar `[elemento]` usando `~[data-testid]`
2. Interagir com `[ação]`
3. Validar `[resultado esperado]`

**Código:**
```javascript
// Exemplo de teste
test('deve [descrição do teste]', async () => {
    const elemento = await driver.$('~[data-testid]');
    await elemento.click();
    // Validações...
});
```

---

### ✅ Checklist de Implementação

- [ ] Todos os elementos interativos têm `data-testid`
- [ ] IDs seguem o padrão de nomenclatura
- [ ] Seletores alternativos documentados
- [ ] Testes validam seletores funcionando
- [ ] Documentação atualizada

---

## 📝 Exemplo Completo: Tela de Login

### 📍 Informações Gerais

- **Componente:** `Login.tsx`
- **Rota:** `/login`
- **Última atualização:** 2025-01-27

---

### 🎨 Elementos Principais

#### 1. Input CPF

**Descrição:** Campo de entrada para CPF do usuário

**Implementação:**
```tsx
<input 
    id="login-cpf"
    data-testid="login-input-cpf"
    type="text"
    placeholder="000.000.000-00"
    aria-label="CPF"
    aria-required="true"
/>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const cpfInput = '~login-input-cpf';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const cpfInput = '-android uiautomator: new UiSelector().description("login-input-cpf")';
   // OU por placeholder
   const cpfInput = '-android uiautomator: new UiSelector().text("000.000.000-00")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.EditText[@content-desc="login-input-cpf"]
   // OU
   //android.view.ViewGroup[.//android.widget.TextView[@text="CPF"]]//android.widget.EditText
   ```

**Exemplo de Uso:**
```javascript
// Appium/WebDriverIO
await driver.$('~login-input-cpf').setValue('12345678900');

// Selenium
driver.findElement(By.id('login-input-cpf')).sendKeys('12345678900');
```

---

#### 2. Input Senha

**Descrição:** Campo de entrada para senha do usuário

**Implementação:**
```tsx
<input 
    id="login-password"
    data-testid="login-input-password"
    type="password"
    placeholder="Digite sua senha"
    aria-label="Senha"
    aria-required="true"
/>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const passwordInput = '~login-input-password';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const passwordInput = '-android uiautomator: new UiSelector().description("login-input-password")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.EditText[@content-desc="login-input-password"]
   ```

---

#### 3. Botão Entrar

**Descrição:** Botão para submeter o formulário de login

**Implementação:**
```tsx
<button 
    id="btn-login-submit"
    data-testid="login-submit-button"
    type="submit"
    aria-label="Entrar"
>
    Entrar
</button>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const submitButton = '~login-submit-button';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const submitButton = '-android uiautomator: new UiSelector().description("login-submit-button")';
   // OU por texto
   const submitButton = '-android uiautomator: new UiSelector().text("Entrar")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.Button[@content-desc="login-submit-button"]
   // OU
   //android.widget.Button[@text="Entrar"]
   ```

---

#### 4. Link "Esqueci minha senha"

**Descrição:** Link para recuperação de senha

**Implementação:**
```tsx
<a 
    id="link-forgot-password"
    data-testid="login-forgot-password-link"
    href="/forgot-password"
    aria-label="Esqueci minha senha"
>
    Esqueci minha senha
</a>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const forgotPasswordLink = '~login-forgot-password-link';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const forgotPasswordLink = '-android uiautomator: new UiSelector().text("Esqueci minha senha")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.TextView[@text="Esqueci minha senha"]
   ```

---

### 🔄 Fluxos de Teste

#### Fluxo 1: Login Bem-Sucedido

**Passos:**
1. Localizar input CPF usando `~login-input-cpf`
2. Preencher com CPF válido
3. Localizar input senha usando `~login-input-password`
4. Preencher com senha válida
5. Clicar no botão "Entrar" usando `~login-submit-button`
6. Validar redirecionamento para home

**Código:**
```javascript
test('deve fazer login com sucesso', async () => {
    // Preencher CPF
    const cpfInput = await driver.$('~login-input-cpf');
    await cpfInput.setValue('12345678900');
    
    // Preencher senha
    const passwordInput = await driver.$('~login-input-password');
    await passwordInput.setValue('Senha123');
    
    // Clicar em entrar
    const submitButton = await driver.$('~login-submit-button');
    await submitButton.click();
    
    // Validar redirecionamento
    await driver.waitUntil(async () => {
        const homeElement = await driver.$('~home-screen');
        return await homeElement.isDisplayed();
    }, { timeout: 5000 });
});
```

---

#### Fluxo 2: Login com Erro

**Passos:**
1. Preencher CPF inválido
2. Preencher senha
3. Clicar em entrar
4. Validar mensagem de erro usando `~login-error-message`

**Código:**
```javascript
test('deve exibir erro ao fazer login com credenciais inválidas', async () => {
    // Preencher dados inválidos
    await driver.$('~login-input-cpf').setValue('00000000000');
    await driver.$('~login-input-password').setValue('senhaerrada');
    
    // Clicar em entrar
    await driver.$('~login-submit-button').click();
    
    // Validar mensagem de erro
    const errorMessage = await driver.$('~login-error-message');
    await expect(errorMessage).toBeDisplayed();
    await expect(errorMessage).toHaveText(expect.stringContaining('inválida'));
});
```

---

### ✅ Checklist de Implementação

- [x] Todos os elementos interativos têm `data-testid`
- [x] IDs seguem o padrão de nomenclatura (`login-[tipo]-[identificador]`)
- [x] Seletores alternativos documentados
- [x] Testes validam seletores funcionando
- [x] Documentação atualizada

---

## 🎯 Padrões de Nomenclatura por Tela

### Login
- Prefixo: `login-`
- Exemplos: `login-input-cpf`, `login-submit-button`, `login-error-message`

### PIX
- Prefixo: `pix-`
- Exemplos: `pix-input-key`, `pix-submit-button`, `pix-success-modal`

### Home/Dashboard
- Prefixo: `home-` ou `dashboard-`
- Exemplos: `home-balance-card`, `home-transactions-list`

### Perfil
- Prefixo: `profile-`
- Exemplos: `profile-edit-button`, `profile-save-button`

### Extrato
- Prefixo: `statement-`
- Exemplos: `statement-transaction-item`, `statement-filter-button`

---

## 📚 Referências

- Ver documento principal: `SELETORES-MOBILE-BOAS-PRATICAS.md`
- Padrões de nomenclatura: Seção "Estrutura de Nomenclatura"
- Hierarquia de prioridade: Seção "Hierarquia de Prioridade"

---

**Template criado em:** 2025-01-27  
**Versão:** 1.0.0

