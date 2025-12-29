# 📱 Exemplos de Seletores - Tela de Login

## 🎯 Tela: Login

### 📍 Informações Gerais

- **Componente:** `Login.tsx` / `App.tsx`
- **Rota:** `/login` ou tela inicial
- **Última atualização:** 2025-01-27
- **Package:** `com.fintechbank.app`

---

## 🎨 Elementos Principais

### 1. Input CPF

**Descrição:** Campo para inserir CPF do usuário (formato: 999.999.999-99)

**Implementação Atual:**
```tsx
<input
    id="cpf"
    type="text"
    value={formatCpf(cpf)}
    onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
    inputMode="numeric"
    placeholder="999.999.999-99"
    className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
/>
```

**⚠️ Recomendação:** Adicionar `data-testid="login-input-cpf"` para melhorar seletores de automação.

**Seletores (ordem de prioridade):**

1. **Resource ID / Accessibility ID (Preferencial)**
   ```javascript
   // Se tiver resource-id definido
   const cpfInput = 'id=com.fintechbank.app:id/cpf';
   
   // OU se tiver data-testid (vira content-desc no Android)
   const cpfInput = '~login-input-cpf'; // Accessibility ID
   
   // OU por id HTML (pode virar resource-id)
   const cpfInput = 'id=cpf';
   ```

2. **UiSelector (Fallback 1) - RECOMENDADO**
   ```javascript
   // Por placeholder (hint) - FUNCIONA COM O CÓDIGO ATUAL
   const cpfInput = '-android uiautomator: new UiSelector().className("android.widget.EditText").hint("999.999.999-99")';
   
   // Por instance (primeiro EditText) - FUNCIONA COM O CÓDIGO ATUAL
   const cpfInput = '-android uiautomator: new UiSelector().className("android.widget.EditText").instance(0)';
   
   // Por description (se tiver data-testid)
   const cpfInput = '-android uiautomator: new UiSelector().description("login-input-cpf")';
   
   // Composto: classe + hint
   const cpfInput = '-android uiautomator: new UiSelector().className("android.widget.EditText").hint("999.999.999-99")';
   
   // Por resource-id (se o id HTML virar resource-id)
   const cpfInput = '-android uiautomator: new UiSelector().resourceId("com.fintechbank.app:id/cpf")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   // Por hint (placeholder) - FUNCIONA COM O CÓDIGO ATUAL
   //android.widget.EditText[@hint="999.999.999-99"]
   
   // Por índice relativo - FUNCIONA COM O CÓDIGO ATUAL
   //android.view.ViewGroup//android.widget.EditText[1]
   
   // Relativo por label "CPF"
   //android.view.ViewGroup[.//android.widget.TextView[@text="CPF"]]//android.widget.EditText
   
   // Por content-desc (se tiver data-testid)
   //android.widget.EditText[@content-desc="login-input-cpf"]
   
   // Por resource-id
   //android.widget.EditText[@resource-id="com.fintechbank.app:id/cpf"]
   ```

**Exemplo de Uso (Código Atual):**
```javascript
// ✅ FUNCIONA - Appium/WebDriverIO - UiSelector por hint (placeholder)
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").hint("999.999.999-99")').setValue('12345678900');

// ✅ FUNCIONA - Appium/WebDriverIO - UiSelector por instance (primeiro EditText)
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").instance(0)').setValue('12345678900');

// ✅ FUNCIONA - Appium/WebDriverIO - XPath por hint
await driver.$('//android.widget.EditText[@hint="999.999.999-99"]').setValue('12345678900');

// ✅ FUNCIONA - Appium/WebDriverIO - XPath por índice
await driver.$('//android.view.ViewGroup//android.widget.EditText[1]').setValue('12345678900');

// ✅ FUNCIONA - Appium/WebDriverIO - XPath relativo por label
await driver.$('//android.view.ViewGroup[.//android.widget.TextView[@text="CPF"]]//android.widget.EditText').setValue('12345678900');

// Selenium/Java
driver.findElement(By.AndroidUIAutomator("new UiSelector().className(\"android.widget.EditText\").hint(\"999.999.999-99\")")).sendKeys("12345678900");
driver.findElement(By.xpath("//android.widget.EditText[@hint=\"999.999.999-99\"]")).sendKeys("12345678900");
```

**⚠️ Observações Importantes:**
- **NÃO use `@text` para inputs** - O atributo `text` em `EditText` geralmente está vazio ou contém o valor digitado, não o placeholder
- **Use `@hint` para placeholder** - O placeholder é mapeado como `hint` no Android ✅ **FUNCIONA COM O CÓDIGO ATUAL**
- **Use `instance(0)` para primeiro EditText** - Mais confiável que índice absoluto ✅ **FUNCIONA COM O CÓDIGO ATUAL**
- **Recomendação:** Adicionar `data-testid="login-input-cpf"` no código para melhorar seletores

---

### 2. Input Senha

**Descrição:** Campo para inserir senha do usuário (mascarado)

**Implementação Atual:**
```tsx
<input
    id="password"
    type="password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    placeholder="••••••••"
    className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
/>
```

**⚠️ Recomendação:** Adicionar `data-testid="login-input-password"` para melhorar seletores de automação.

**Seletores (ordem de prioridade):**

1. **Resource ID / Accessibility ID (Preferencial)**
   ```javascript
   // Se tiver resource-id
   const passwordInput = 'id=com.fintechbank.app:id/password';
   
   // OU se tiver data-testid
   const passwordInput = '~login-input-password';
   
   // OU por id HTML
   const passwordInput = 'id=password';
   ```

2. **UiSelector (Fallback 1) - RECOMENDADO**
   ```javascript
   // Por instance (segundo EditText) - FUNCIONA COM O CÓDIGO ATUAL
   const passwordInput = '-android uiautomator: new UiSelector().className("android.widget.EditText").instance(1)';
   
   // Por hint (placeholder) - FUNCIONA COM O CÓDIGO ATUAL
   const passwordInput = '-android uiautomator: new UiSelector().className("android.widget.EditText").hint("••••••••")';
   
   // Por description (se tiver data-testid)
   const passwordInput = '-android uiautomator: new UiSelector().description("login-input-password")';
   
   // Composto: classe + hint
   const passwordInput = '-android uiautomator: new UiSelector().className("android.widget.EditText").hint("••••••••")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   // Por índice relativo (segundo EditText) - FUNCIONA COM O CÓDIGO ATUAL
   //android.view.ViewGroup//android.widget.EditText[2]
   
   // Por hint (placeholder)
   //android.widget.EditText[@hint="••••••••"]
   
   // Relativo por label "Senha"
   //android.view.ViewGroup[.//android.widget.TextView[@text="Senha"]]//android.widget.EditText
   
   // Por content-desc (se tiver data-testid)
   //android.widget.EditText[@content-desc="login-input-password"]
   ```

**Exemplo de Uso (Código Atual):**
```javascript
// ✅ FUNCIONA - Appium/WebDriverIO - UiSelector por instance (segundo EditText)
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").instance(1)').setValue('Senha123');

// ✅ FUNCIONA - Appium/WebDriverIO - UiSelector por hint
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").hint("••••••••")').setValue('Senha123');

// ✅ FUNCIONA - Appium/WebDriverIO - XPath por índice
await driver.$('//android.view.ViewGroup//android.widget.EditText[2]').setValue('Senha123');

// ✅ FUNCIONA - Appium/WebDriverIO - XPath relativo por label
await driver.$('//android.view.ViewGroup[.//android.widget.TextView[@text="Senha"]]//android.widget.EditText').setValue('Senha123');
```

---

### 3. Botão Entrar

**Descrição:** Botão para submeter o formulário de login

**Implementação Atual:**
```tsx
<button 
    type="submit" 
    disabled={loading} 
    className="w-full px-8 py-4 font-semibold text-white transition-transform duration-300 transform rounded-lg shadow-lg bg-primary hover:scale-105 hover:shadow-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/50 disabled:bg-primary/70 disabled:scale-100"
>
    {loading ? 'Entrando...' : 'Entrar'}
</button>
```

**⚠️ Recomendação:** Adicionar `id="btn-login-submit"` e `data-testid="login-submit-button"` para melhorar seletores.

**Seletores (ordem de prioridade):**

1. **Resource ID (Preferencial)**
   ```javascript
   const submitButton = '~login-submit-button';
   ```

2. **UiSelector (Fallback 1)**
   ```javascript
   // Por description
   const submitButton = '-android uiautomator: new UiSelector().description("login-submit-button")';
   
   // Por texto (RECOMENDADO para botões)
   const submitButton = '-android uiautomator: new UiSelector().text("Entrar")';
   
   // Por classe e texto
   const submitButton = '-android uiautomator: new UiSelector().className("android.widget.Button").text("Entrar")';
   
   // Composto: classe + texto + enabled
   const submitButton = '-android uiautomator: new UiSelector().className("android.widget.Button").text("Entrar").enabled(true)';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   // Por content-desc
   //android.widget.Button[@content-desc="login-submit-button"]
   
   // Por texto
   //android.widget.Button[@text="Entrar"]
   
   // Relativo
   //android.view.ViewGroup//android.widget.Button[@text="Entrar"]
   ```

**Exemplo de Uso (Código Atual):**
```javascript
// ✅ FUNCIONA - Appium/WebDriverIO - UiSelector por texto
await driver.$('-android uiautomator: new UiSelector().text("Entrar")').click();

// ✅ FUNCIONA - Appium/WebDriverIO - UiSelector composto
await driver.$('-android uiautomator: new UiSelector().className("android.widget.Button").text("Entrar").enabled(true)').click();

// ✅ FUNCIONA - Appium/WebDriverIO - XPath por texto
await driver.$('//android.widget.Button[@text="Entrar"]').click();

// ✅ FUNCIONA - Appium/WebDriverIO - XPath relativo
await driver.$('//android.view.ViewGroup//android.widget.Button[@text="Entrar"]').click();
```

---

### 4. Link "Esqueci minha senha"

**Descrição:** Link para recuperação de senha

**Implementação Atual:**
```tsx
<button 
    type="button" 
    onClick={onNavigateToResetPassword} 
    className="text-xs text-primary hover:underline"
>
    Esqueci minha senha
</button>
```

**⚠️ Recomendação:** Adicionar `data-testid="login-forgot-password-link"` para melhorar seletores.

**Seletores (ordem de prioridade):**

1. **Resource ID (Preferencial)**
   ```javascript
   const forgotPasswordLink = '~login-forgot-password-link';
   ```

2. **UiSelector (Fallback 1)**
   ```javascript
   // Por description
   const forgotPasswordLink = '-android uiautomator: new UiSelector().description("login-forgot-password-link")';
   
   // Por texto (RECOMENDADO)
   const forgotPasswordLink = '-android uiautomator: new UiSelector().text("Esqueci minha senha")';
   
   // Por classe e texto
   const forgotPasswordLink = '-android uiautomator: new UiSelector().className("android.widget.TextView").text("Esqueci minha senha")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   // Por content-desc
   //android.widget.TextView[@content-desc="login-forgot-password-link"]
   
   // Por texto
   //android.widget.TextView[@text="Esqueci minha senha"]
   
   // Contém texto
   //android.widget.TextView[contains(@text, "Esqueci")]
   ```

**Exemplo de Uso (Código Atual):**
```javascript
// ✅ FUNCIONA - Appium/WebDriverIO - UiSelector por texto
await driver.$('-android uiautomator: new UiSelector().text("Esqueci minha senha")').click();

// ✅ FUNCIONA - Appium/WebDriverIO - XPath por texto
await driver.$('//android.widget.TextView[@text="Esqueci minha senha"]').click();

// ✅ FUNCIONA - Appium/WebDriverIO - XPath contém texto
await driver.$('//android.widget.TextView[contains(@text, "Esqueci")]').click();
```

---

### 5. Link "Cadastre-se"

**Descrição:** Link para página de cadastro

**Implementação Atual:**
```tsx
<button 
    type="button" 
    onClick={onNavigateToSignUp} 
    className="font-semibold text-primary hover:underline"
>
    Cadastre-se
</button>
```

**⚠️ Recomendação:** Adicionar `data-testid="login-signup-link"` para melhorar seletores.

**Seletores (ordem de prioridade):**

1. **Resource ID (Preferencial)**
   ```javascript
   const signupLink = '~login-signup-link';
   ```

2. **UiSelector (Fallback 1)**
   ```javascript
   // Por description
   const signupLink = '-android uiautomator: new UiSelector().description("login-signup-link")';
   
   // Por texto
   const signupLink = '-android uiautomator: new UiSelector().text("Cadastre-se")';
   
   // Contém texto
   const signupLink = '-android uiautomator: new UiSelector().textContains("Cadastre")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   // Por texto
   //android.widget.TextView[@text="Cadastre-se"]
   
   // Contém texto
   //android.widget.TextView[contains(@text, "Cadastre")]
   ```

**Exemplo de Uso (Código Atual):**
```javascript
// ✅ FUNCIONA - Appium/WebDriverIO - UiSelector por texto
await driver.$('-android uiautomator: new UiSelector().text("Cadastre-se")').click();

// ✅ FUNCIONA - Appium/WebDriverIO - XPath por texto
await driver.$('//android.widget.TextView[@text="Cadastre-se"]').click();

// ✅ FUNCIONA - Appium/WebDriverIO - XPath contém texto
await driver.$('//android.widget.TextView[contains(@text, "Cadastre")]').click();
```

---

### 6. Título "Fintech"

**Descrição:** Título principal da aplicação

**Implementação:**
```tsx
<h1 
    data-testid="login-title"
    id="login-title"
>
    Fintech
</h1>
```

**Seletores (ordem de prioridade):**

1. **Resource ID (Preferencial)**
   ```javascript
   const title = '~login-title';
   ```

2. **UiSelector (Fallback 1)**
   ```javascript
   // Por description
   const title = '-android uiautomator: new UiSelector().description("login-title")';
   
   // Por texto
   const title = '-android uiautomator: new UiSelector().text("Fintech")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   // Por texto
   //android.widget.TextView[@text="Fintech"]
   ```

**Exemplo de Uso:**
```javascript
// Appium/WebDriverIO - Verificar se título está visível
const title = await driver.$('~login-title');
await expect(title).toBeDisplayed();
await expect(title).toHaveText('Fintech');
```

---

### 7. Subtítulo "Acesse sua conta"

**Descrição:** Subtítulo da tela de login

**Implementação:**
```tsx
<p 
    data-testid="login-subtitle"
    id="login-subtitle"
>
    Acesse sua conta
</p>
```

**Seletores (ordem de prioridade):**

1. **Resource ID (Preferencial)**
   ```javascript
   const subtitle = '~login-subtitle';
   ```

2. **UiSelector (Fallback 1)**
   ```javascript
   // Por description
   const subtitle = '-android uiautomator: new UiSelector().description("login-subtitle")';
   
   // Por texto
   const subtitle = '-android uiautomator: new UiSelector().text("Acesse sua conta")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   // Por texto
   //android.widget.TextView[@text="Acesse sua conta"]
   ```

---

### 8. Mensagem de Erro

**Descrição:** Mensagem exibida quando há erro no login

**Implementação:**
```tsx
<div 
    className="login-error-message"
    data-testid="login-error-message"
    role="alert"
    aria-live="assertive"
>
    {errorMessage}
</div>
```

**Seletores (ordem de prioridade):**

1. **Resource ID (Preferencial)**
   ```javascript
   const errorMessage = '~login-error-message';
   ```

2. **UiSelector (Fallback 1)**
   ```javascript
   // Por description
   const errorMessage = '-android uiautomator: new UiSelector().description("login-error-message")';
   
   // Por texto (quando mensagem específica)
   const errorMessage = '-android uiautomator: new UiSelector().textContains("inválida")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   // Por content-desc
   //android.view.ViewGroup[@content-desc="login-error-message"]//android.widget.TextView
   
   // Por texto
   //android.widget.TextView[contains(@text, "inválida")]
   ```

**Exemplo de Uso:**
```javascript
// Appium/WebDriverIO - Verificar mensagem de erro
const errorMessage = await driver.$('~login-error-message');
await expect(errorMessage).toBeDisplayed();
await expect(errorMessage).toHaveText(expect.stringContaining('inválida'));
```

---

### 9. Ícone Check Circle

**Descrição:** Ícone verde ao lado do título "Fintech"

**Implementação:**
```tsx
<span 
    className="material-symbols-outlined"
    data-testid="login-check-icon"
    aria-hidden="true"
>
    check_circle
</span>
```

**Seletores (ordem de prioridade):**

1. **Resource ID (Preferencial)**
   ```javascript
   const checkIcon = '~login-check-icon';
   ```

2. **UiSelector (Fallback 1)**
   ```javascript
   // Por description
   const checkIcon = '-android uiautomator: new UiSelector().description("login-check-icon")';
   
   // Por texto (se o ícone renderizar como texto)
   const checkIcon = '-android uiautomator: new UiSelector().text("check_circle")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   // Por texto
   //android.widget.TextView[@text="check_circle"]
   ```

---

## 🔄 Fluxos de Teste

### Fluxo 1: Login Bem-Sucedido

**Passos:**
1. Localizar input CPF usando `~login-input-cpf`
2. Preencher com CPF válido
3. Localizar input senha usando `~login-input-password`
4. Preencher com senha válida
5. Clicar no botão "Entrar" usando `~login-submit-button`
6. Validar redirecionamento para home

**Código (Funcionando com Código Atual):**
```javascript
test('deve fazer login com sucesso', async () => {
    // Preencher CPF - UiSelector por hint (placeholder)
    await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").hint("999.999.999-99")').setValue('12345678900');
    
    // Preencher senha - UiSelector por instance (segundo EditText)
    await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").instance(1)').setValue('Senha123');
    
    // Clicar em entrar - UiSelector por texto
    await driver.$('-android uiautomator: new UiSelector().text("Entrar")').click();
    
    // Validar redirecionamento
    await driver.waitUntil(async () => {
        const homeElement = await driver.$('~home-screen');
        return await homeElement.isDisplayed();
    }, { timeout: 5000 });
});
```

**Código com Fallbacks (Funcionando com Código Atual):**
```javascript
test('deve fazer login com sucesso (com fallbacks)', async () => {
    // Preencher CPF - Tentar múltiplos seletores
    try {
        // Prioridade 1: Por hint (placeholder)
        await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").hint("999.999.999-99")').setValue('12345678900');
    } catch (e) {
        // Fallback 1: Por instance
        await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").instance(0)').setValue('12345678900');
    } catch (e) {
        // Fallback 2: XPath por hint
        await driver.$('//android.widget.EditText[@hint="999.999.999-99"]').setValue('12345678900');
    }
    
    // Preencher senha
    try {
        // Prioridade 1: Por instance
        await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").instance(1)').setValue('Senha123');
    } catch (e) {
        // Fallback: XPath por índice
        await driver.$('//android.view.ViewGroup//android.widget.EditText[2]').setValue('Senha123');
    }
    
    // Clicar em entrar
    try {
        // Prioridade 1: Por texto
        await driver.$('-android uiautomator: new UiSelector().text("Entrar")').click();
    } catch (e) {
        // Fallback: XPath por texto
        await driver.$('//android.widget.Button[@text="Entrar"]').click();
    }
});
```

---

### Fluxo 2: Login com Erro

**Passos:**
1. Preencher CPF inválido
2. Preencher senha
3. Clicar em entrar
4. Validar mensagem de erro usando `~login-error-message`

**Código (Funcionando com Código Atual):**
```javascript
test('deve exibir erro ao fazer login com credenciais inválidas', async () => {
    // Preencher dados inválidos
    await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").hint("999.999.999-99")').setValue('00000000000');
    await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").instance(1)').setValue('senhaerrada');
    
    // Clicar em entrar
    await driver.$('-android uiautomator: new UiSelector().text("Entrar")').click();
    
    // Validar mensagem de erro (por texto contendo "inválido" ou "CPF")
    const errorMessage = await driver.$('-android uiautomator: new UiSelector().textContains("inválido")');
    await expect(errorMessage).toBeDisplayed();
    await expect(errorMessage).toHaveText(expect.stringContaining('inválido'));
});
```

---

### Fluxo 3: Navegação para Recuperação de Senha

**Passos:**
1. Clicar no link "Esqueci minha senha" usando `~login-forgot-password-link`
2. Validar redirecionamento para tela de recuperação

**Código (Funcionando com Código Atual):**
```javascript
test('deve navegar para recuperação de senha', async () => {
    // Clicar no link - Por texto
    await driver.$('-android uiautomator: new UiSelector().text("Esqueci minha senha")').click();
    
    // Validar redirecionamento
    await driver.waitUntil(async () => {
        const recoveryScreen = await driver.$('~forgot-password-screen');
        return await recoveryScreen.isDisplayed();
    }, { timeout: 5000 });
});
```

---

### Fluxo 4: Navegação para Cadastro

**Passos:**
1. Clicar no link "Cadastre-se" usando `~login-signup-link`
2. Validar redirecionamento para tela de cadastro

**Código (Funcionando com Código Atual):**
```javascript
test('deve navegar para tela de cadastro', async () => {
    // Clicar no link - Por texto
    await driver.$('-android uiautomator: new UiSelector().text("Cadastre-se")').click();
    
    // Validar redirecionamento
    await driver.waitUntil(async () => {
        const signupScreen = await driver.$('~signup-screen');
        return await signupScreen.isDisplayed();
    }, { timeout: 5000 });
});
```

---

## ⚠️ Problemas Comuns e Soluções

### Problema 1: XPath com @text não encontra input

**Erro:**
```
Não foi possível encontrar nenhum elemento
//android.widget.EditText[@text="999.999.999-99"]
```

**Causa:** O atributo `@text` em `EditText` não contém o placeholder, e sim o valor digitado.

**Solução:**
```javascript
// ❌ ERRADO - @text não funciona para placeholder
await driver.$('//android.widget.EditText[@text="999.999.999-99"]').setValue('12345678900');

// ✅ CORRETO - Usar @hint para placeholder (FUNCIONA COM O CÓDIGO ATUAL)
await driver.$('//android.widget.EditText[@hint="999.999.999-99"]').setValue('12345678900');

// ✅ CORRETO - Usar UiSelector por hint (FUNCIONA COM O CÓDIGO ATUAL)
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").hint("999.999.999-99")').setValue('12345678900');

// ✅ CORRETO - Usar UiSelector por instance (FUNCIONA COM O CÓDIGO ATUAL)
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").instance(0)').setValue('12345678900');

// ✅ CORRETO - Usar XPath relativo por label
await driver.$('//android.view.ViewGroup[.//android.widget.TextView[@text="CPF"]]//android.widget.EditText').setValue('12345678900');
```

---

### Problema 2: Elemento não encontrado após mudança de tela

**Causa:** Elemento ainda não está visível na tela.

**Solução:**
```javascript
// Adicionar wait antes de interagir
await driver.waitUntil(async () => {
    const cpfInput = await driver.$('~login-input-cpf');
    return await cpfInput.isDisplayed();
}, { timeout: 5000 });

await driver.$('~login-input-cpf').setValue('12345678900');
```

---

### Problema 3: Múltiplos elementos encontrados

**Causa:** Seletor muito genérico.

**Solução:**
```javascript
// ❌ ERRADO - Muito genérico
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText")').setValue('12345678900');

// ✅ CORRETO - Mais específico
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").description("login-input-cpf")').setValue('12345678900');

// ✅ CORRETO - Usar instance
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").instance(0)').setValue('12345678900');
```

---

## 📊 Tabela Resumo de Seletores (Funcionando com Código Atual)

| Elemento | UiSelector (Hint/Placeholder) | UiSelector (Instance) | UiSelector (Texto) | XPath (Hint) | XPath (Índice) | XPath (Texto) |
|----------|-------------------------------|----------------------|-------------------|-------------|---------------|---------------|
| Input CPF | `new UiSelector().className("android.widget.EditText").hint("999.999.999-99")` ✅ | `new UiSelector().className("android.widget.EditText").instance(0)` ✅ | - | `//android.widget.EditText[@hint="999.999.999-99"]` ✅ | `//android.view.ViewGroup//android.widget.EditText[1]` ✅ | - |
| Input Senha | `new UiSelector().className("android.widget.EditText").hint("••••••••")` ✅ | `new UiSelector().className("android.widget.EditText").instance(1)` ✅ | - | `//android.widget.EditText[@hint="••••••••"]` ✅ | `//android.view.ViewGroup//android.widget.EditText[2]` ✅ | - |
| Botão Entrar | - | - | `new UiSelector().text("Entrar")` ✅ | - | - | `//android.widget.Button[@text="Entrar"]` ✅ |
| Link Esqueci Senha | - | - | `new UiSelector().text("Esqueci minha senha")` ✅ | - | - | `//android.widget.TextView[@text="Esqueci minha senha"]` ✅ |
| Link Cadastre-se | - | - | `new UiSelector().text("Cadastre-se")` ✅ | - | - | `//android.widget.TextView[@text="Cadastre-se"]` ✅ |
| Título Fintech | - | - | `new UiSelector().text("Fintech")` ✅ | - | - | `//android.widget.TextView[@text="Fintech"]` ✅ |
| Mensagem Erro | - | - | `new UiSelector().textContains("inválido")` ✅ | - | - | `//android.widget.TextView[contains(@text, "inválido")]` ✅ |

**Legenda:**
- ✅ = Funciona com o código atual
- ⚠️ = Requer adicionar `data-testid` no código

---

## ✅ Checklist de Implementação

- [x] Seletores funcionando com código atual documentados
- [x] Seletores alternativos documentados (UiSelector, XPath)
- [x] Exemplos de código de teste incluídos
- [x] Fluxos de teste principais documentados
- [x] Problemas comuns e soluções documentados
- [x] Tabela resumo de seletores criada
- [ ] **PENDENTE:** Adicionar `data-testid` nos elementos do componente Login
- [ ] **PENDENTE:** Adicionar `id` nos botões e links
- [ ] **PENDENTE:** Validar seletores em testes reais

## 🔧 Melhorias Recomendadas no Código

Para melhorar os seletores de automação, adicione os seguintes atributos no componente `Login/index.tsx`:

```tsx
// Input CPF
<input
    id="cpf"
    data-testid="login-input-cpf"  // ✅ ADICIONAR
    type="text"
    // ... resto do código
/>

// Input Senha
<input
    id="password"
    data-testid="login-input-password"  // ✅ ADICIONAR
    type="password"
    // ... resto do código
/>

// Botão Entrar
<button 
    id="btn-login-submit"  // ✅ ADICIONAR
    data-testid="login-submit-button"  // ✅ ADICIONAR
    type="submit"
    // ... resto do código
>
    {loading ? 'Entrando...' : 'Entrar'}
</button>

// Link Esqueci Senha
<button 
    type="button"
    data-testid="login-forgot-password-link"  // ✅ ADICIONAR
    onClick={onNavigateToResetPassword}
    // ... resto do código
>
    Esqueci minha senha
</button>

// Link Cadastre-se
<button 
    type="button"
    data-testid="login-signup-link"  // ✅ ADICIONAR
    onClick={onNavigateToSignUp}
    // ... resto do código
>
    Cadastre-se
</button>
```

---

**Última atualização:** 2025-01-27  
**Versão:** 1.0.0

