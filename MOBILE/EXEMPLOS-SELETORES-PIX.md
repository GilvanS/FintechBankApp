# 📱 Exemplos de Seletores - Tela PIX

## 🎯 Tela: Área PIX

### 📍 Informações Gerais

- **Componente:** `Pix.tsx`
- **Rota:** `/pix`
- **Última atualização:** 2025-01-27

---

## 🎨 Elementos Principais

### 1. Input Chave PIX

**Descrição:** Campo para inserir chave PIX (CPF, e-mail, etc.)

**Implementação:**
```tsx
<input 
    id="pix-key"
    data-testid="pix-input-key"
    type="text"
    placeholder="Digite CPF, celular, e-mail, etc."
    aria-label="Chave PIX"
    aria-required="true"
/>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const pixKeyInput = '~pix-input-key';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const pixKeyInput = '-android uiautomator: new UiSelector().description("pix-input-key")';
   // OU por placeholder
   const pixKeyInput = '-android uiautomator: new UiSelector().textContains("Digite CPF")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.EditText[@content-desc="pix-input-key"]
   // OU relativo
   //android.view.ViewGroup[.//android.widget.TextView[@text="Chave PIX"]]//android.widget.EditText
   ```

**Exemplo de Uso:**
```javascript
// Appium/WebDriverIO
await driver.$('~pix-input-key').setValue('12345678900');

// Selenium
driver.findElement(By.id('pix-input-key')).sendKeys('12345678900');
```

---

### 2. Input Valor

**Descrição:** Campo para inserir valor da transferência

**Implementação:**
```tsx
<input 
    id="pix-amount"
    data-testid="pix-input-amount"
    type="text"
    placeholder="0,00"
    aria-label="Valor"
    aria-required="true"
/>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const pixAmountInput = '~pix-input-amount';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const pixAmountInput = '-android uiautomator: new UiSelector().description("pix-input-amount")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.EditText[@content-desc="pix-input-amount"]
   ```

---

### 3. Input Descrição (Opcional)

**Descrição:** Campo opcional para descrição da transferência

**Implementação:**
```tsx
<input 
    id="pix-description"
    data-testid="pix-input-description"
    type="text"
    placeholder="Ex: Pagamento do aluguel"
    aria-label="Descrição (Opcional)"
/>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const pixDescriptionInput = '~pix-input-description';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const pixDescriptionInput = '-android uiautomator: new UiSelector().description("pix-input-description")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.EditText[@content-desc="pix-input-description"]
   ```

---

### 4. Toggle PIX no Crédito

**Descrição:** Switch para ativar/desativar PIX no crédito

**Implementação:**
```tsx
<input 
    id="pix-credit-toggle"
    data-testid="pix-credit-toggle"
    type="checkbox"
    checked={useCredit}
    aria-label="Usar PIX no crédito"
/>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const creditToggle = '~pix-credit-toggle';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const creditToggle = '-android uiautomator: new UiSelector().description("pix-credit-toggle")';
   // OU por texto próximo
   const creditToggle = '-android uiautomator: new UiSelector().text("PIX no Crédito")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.Switch[@content-desc="pix-credit-toggle"]
   // OU relativo
   //android.view.ViewGroup[.//android.widget.TextView[@text="PIX no Crédito"]]//android.widget.Switch
   ```

---

### 5. Botão Continuar

**Descrição:** Botão para continuar com a transferência

**Implementação:**
```tsx
<button 
    id="btn-pix-submit"
    data-testid="pix-submit-button"
    type="submit"
    aria-label="Continuar"
>
    Continuar
</button>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const submitButton = '~pix-submit-button';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const submitButton = '-android uiautomator: new UiSelector().description("pix-submit-button")';
   // OU por texto
   const submitButton = '-android uiautomator: new UiSelector().text("Continuar")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.Button[@content-desc="pix-submit-button"]
   // OU
   //android.widget.Button[@text="Continuar"]
   ```

---

### 6. Botão Voltar

**Descrição:** Botão para voltar à tela anterior

**Implementação:**
```tsx
<button 
    id="btn-pix-back"
    data-testid="pix-back-button"
    onClick={onBack}
    aria-label="Voltar"
>
    <span className="material-symbols-outlined">arrow_back</span>
</button>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const backButton = '~pix-back-button';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const backButton = '-android uiautomator: new UiSelector().description("pix-back-button")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.Button[@content-desc="pix-back-button"]
   ```

---

### 7. Tab Transferir

**Descrição:** Aba para acessar a tela de transferência

**Implementação:**
```tsx
<button 
    id="btn-pix-tab-transfer"
    data-testid="pix-tab-transfer"
    role="tab"
    aria-selected={subView === 'transfer'}
>
    Transferir
</button>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const transferTab = '~pix-tab-transfer';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const transferTab = '-android uiautomator: new UiSelector().text("Transferir")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.Button[@text="Transferir"]
   ```

---

### 8. Tab Meus Contatos

**Descrição:** Aba para acessar lista de contatos

**Implementação:**
```tsx
<button 
    id="btn-pix-tab-contacts"
    data-testid="pix-tab-contacts"
    role="tab"
>
    Meus Contatos
</button>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const contactsTab = '~pix-tab-contacts';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const contactsTab = '-android uiautomator: new UiSelector().text("Meus Contatos")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.Button[@text="Meus Contatos"]
   ```

---

### 9. Mensagem de Erro

**Descrição:** Mensagem exibida quando há erro na transferência

**Implementação:**
```tsx
<div 
    className="pix-error-message"
    data-testid="pix-error-message"
    role="alert"
    aria-live="assertive"
>
    {transferError || localError}
</div>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const errorMessage = '~pix-error-message';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const errorMessage = '-android uiautomator: new UiSelector().description("pix-error-message")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.view.ViewGroup[@content-desc="pix-error-message"]//android.widget.TextView
   ```

---

## 🎨 Elementos da Tela de Confirmação

### 10. Modal de Confirmação

**Descrição:** Modal exibido para confirmar os dados da transferência

**Implementação:**
```tsx
<div 
    className="pix-confirmation-modal"
    data-testid="pix-confirmation-modal"
    id="pix-confirmation-modal"
    role="dialog"
    aria-modal="true"
>
    {/* Conteúdo */}
</div>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const confirmationModal = '~pix-confirmation-modal';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const confirmationModal = '-android uiautomator: new UiSelector().description("pix-confirmation-modal")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.view.ViewGroup[@content-desc="pix-confirmation-modal"]
   ```

---

### 11. Valor na Confirmação

**Descrição:** Valor exibido na tela de confirmação

**Implementação:**
```tsx
<p 
    data-testid="pix-confirmation-amount-value"
    id="pix-confirmation-amount-value"
>
    {amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</p>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const confirmationAmount = '~pix-confirmation-amount-value';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const confirmationAmount = '-android uiautomator: new UiSelector().description("pix-confirmation-amount-value")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.TextView[@content-desc="pix-confirmation-amount-value"]
   ```

---

### 12. Botão Confirmar Transferência

**Descrição:** Botão para confirmar a transferência na tela de confirmação

**Implementação:**
```tsx
<button 
    id="btn-pix-confirmation-confirm"
    data-testid="pix-confirmation-confirm-button"
    onClick={onConfirm}
    aria-label="Confirmar Transferência"
>
    Confirmar Transferência
</button>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const confirmButton = '~pix-confirmation-confirm-button';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const confirmButton = '-android uiautomator: new UiSelector().text("Confirmar Transferência")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.Button[@text="Confirmar Transferência"]
   ```

---

## 🎨 Elementos do Modal de Sucesso

### 13. Modal de Sucesso

**Descrição:** Modal exibido após transferência bem-sucedida

**Implementação:**
```tsx
<div 
    className="pix-success-modal"
    data-testid="pix-success-modal"
    id="pix-success-modal"
    role="dialog"
    aria-modal="true"
>
    {/* Conteúdo */}
</div>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const successModal = '~pix-success-modal';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const successModal = '-android uiautomator: new UiSelector().description("pix-success-modal")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.view.ViewGroup[@content-desc="pix-success-modal"]
   ```

---

### 14. Botão Fechar (Modal de Sucesso)

**Descrição:** Botão para fechar o modal de sucesso

**Implementação:**
```tsx
<button 
    id="btn-pix-success-close"
    data-testid="pix-success-close-button"
    onClick={onClose}
    aria-label="Fechar"
>
    Fechar
</button>
```

**Seletores (ordem de prioridade):**

1. **ID (Preferencial)**
   ```javascript
   const closeButton = '~pix-success-close-button';
   ```

2. **-android uiautomator (Fallback 1)**
   ```javascript
   const closeButton = '-android uiautomator: new UiSelector().text("Fechar")';
   ```

3. **XPath (Fallback 2)**
   ```xpath
   //android.widget.Button[@text="Fechar"]
   ```

---

## 🔄 Fluxos de Teste

### Fluxo 1: Transferência PIX Bem-Sucedida

**Passos:**
1. Localizar input chave PIX usando `~pix-input-key`
2. Preencher com chave válida
3. Localizar input valor usando `~pix-input-amount`
4. Preencher com valor válido
5. Clicar no botão "Continuar" usando `~pix-submit-button`
6. Validar modal de confirmação usando `~pix-confirmation-modal`
7. Clicar em "Confirmar Transferência" usando `~pix-confirmation-confirm-button`
8. Validar modal de sucesso usando `~pix-success-modal`
9. Clicar em "Fechar" usando `~pix-success-close-button`

**Código:**
```javascript
test('deve realizar transferência PIX com sucesso', async () => {
    // Preencher chave PIX
    await driver.$('~pix-input-key').setValue('12345678900');
    
    // Preencher valor
    await driver.$('~pix-input-amount').setValue('50000'); // R$ 500,00
    
    // Clicar em continuar
    await driver.$('~pix-submit-button').click();
    
    // Validar modal de confirmação
    const confirmationModal = await driver.$('~pix-confirmation-modal');
    await expect(confirmationModal).toBeDisplayed();
    
    // Confirmar transferência
    await driver.$('~pix-confirmation-confirm-button').click();
    
    // Validar modal de sucesso
    const successModal = await driver.$('~pix-success-modal');
    await expect(successModal).toBeDisplayed();
    
    // Fechar modal
    await driver.$('~pix-success-close-button').click();
});
```

---

### Fluxo 2: Transferência com Erro

**Passos:**
1. Preencher chave PIX inválida
2. Preencher valor
3. Clicar em continuar
4. Validar mensagem de erro usando `~pix-error-message`

**Código:**
```javascript
test('deve exibir erro ao tentar transferir com chave inválida', async () => {
    // Preencher chave inválida
    await driver.$('~pix-input-key').setValue('00000000000');
    
    // Preencher valor
    await driver.$('~pix-input-amount').setValue('10000'); // R$ 100,00
    
    // Clicar em continuar
    await driver.$('~pix-submit-button').click();
    
    // Validar mensagem de erro
    const errorMessage = await driver.$('~pix-error-message');
    await expect(errorMessage).toBeDisplayed();
    await expect(errorMessage).toHaveText(expect.stringContaining('não encontrada'));
});
```

---

### Fluxo 3: Navegação entre Tabs

**Passos:**
1. Clicar na tab "Meus Contatos" usando `~pix-tab-contacts`
2. Validar que a lista de contatos é exibida
3. Clicar na tab "Transferir" usando `~pix-tab-transfer`
4. Validar que o formulário de transferência é exibido

**Código:**
```javascript
test('deve navegar entre tabs PIX', async () => {
    // Ir para tab de contatos
    await driver.$('~pix-tab-contacts').click();
    
    // Validar que está na tela de contatos
    const contactsList = await driver.$('~pix-contacts-list');
    await expect(contactsList).toBeDisplayed();
    
    // Voltar para tab de transferência
    await driver.$('~pix-tab-transfer').click();
    
    // Validar que está na tela de transferência
    const transferForm = await driver.$('~pix-transfer-form');
    await expect(transferForm).toBeDisplayed();
});
```

---

## ✅ Checklist de Implementação

- [x] Todos os elementos interativos têm `data-testid`
- [x] IDs seguem o padrão de nomenclatura (`pix-[tipo]-[identificador]`)
- [x] Seletores alternativos documentados
- [x] Testes validam seletores funcionando
- [x] Documentação atualizada

---

**Última atualização:** 2025-01-27  
**Versão:** 1.0.0

