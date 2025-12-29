# 📱 Guia de Melhores Práticas - Seletores Mobile

## 🎯 Objetivo

Este documento define as melhores práticas para criar seletores robustos e manuteníveis para testes automatizados no aplicativo mobile FintechBankApp, utilizando **IDs**, **xpath** e **-android uiautomator**.

---

## 📋 Índice

1. [Hierarquia de Prioridade](#hierarquia-de-prioridade)
2. [IDs (data-testid)](#ids-data-testid)
3. [XPath](#xpath)
4. [-android uiautomator](#-android-uiautomator)
5. [Estrutura de Nomenclatura](#estrutura-de-nomenclatura)
6. [Exemplos Práticos](#exemplos-práticos)
7. [Padrões por Tipo de Elemento](#padrões-por-tipo-de-elemento)
8. [Checklist de Implementação](#checklist-de-implementação)

---

## 🎯 Hierarquia de Prioridade (Appium Android)

Use esta ordem de prioridade ao criar seletores para **Appium**:

1. **Resource ID** (`resource-id` Android) - **PREFERENCIAL** ⚡
2. **Accessibility ID** (`content-desc` ou `data-testid`) - **RECOMENDADO** ✅
3. **UiSelector (UiAutomator)** - Para elementos nativos Android sem ID
4. **XPath relativo** - Quando outras opções não estão disponíveis
5. **XPath absoluto** - Último recurso (evitar) ❌

> **Referência:** [Appium UiAutomator UiSelector Guide](https://github.com/appium/appium-uiautomator2-driver/blob/master/docs/uiautomator-uiselector.md)

---

## 🆔 IDs (data-testid)

### ✅ Boas Práticas

- Use `data-testid` para elementos interativos
- IDs devem ser únicos e descritivos
- Siga o padrão: `componente-tipo-acao`

### 📝 Padrão de Nomenclatura

```
[componente]-[tipo]-[identificador]
```

**Exemplos:**
- `pix-input-key` - Input de chave PIX
- `pix-input-amount` - Input de valor
- `btn-pix-submit` - Botão de enviar
- `pix-success-modal` - Modal de sucesso
- `pix-error-message` - Mensagem de erro

### 💻 Implementação no React

```tsx
// ✅ BOM - ID único e descritivo
<input 
    id="pix-key"
    data-testid="pix-input-key"
    className="..."
    placeholder="Digite CPF, celular, e-mail, etc."
/>

// ✅ BOM - Botão com ID claro
<button 
    id="btn-pix-submit"
    data-testid="pix-submit-button"
    type="submit"
>
    Continuar
</button>

// ❌ RUIM - ID genérico ou sem ID
<input className="input-field" />
<button>Enviar</button>
```

### 🔍 Uso em Testes

```javascript
// Appium/WebDriverIO
await driver.$('~pix-input-key').setValue('12345678900');
await driver.$('~pix-submit-button').click();

// Selenium
driver.findElement(By.id('pix-input-key')).sendKeys('12345678900');
driver.findElement(By.id('btn-pix-submit')).click();
```

---

## 📍 XPath

### ✅ Quando Usar

- Elementos sem ID disponível
- Navegação em estruturas complexas
- Seletores relativos para elementos dinâmicos

### 📝 Padrões Recomendados

#### 1. XPath por Texto (quando necessário)

```xpath
// ✅ BOM - Texto exato
//android.widget.TextView[@text="Entrar"]

// ✅ BOM - Contém texto
//android.widget.TextView[contains(@text, "Transferência")]

// ❌ EVITAR - Texto muito genérico
//android.widget.TextView[@text="OK"]
```

#### 2. XPath por Atributos

```xpath
// ✅ BOM - Por classe e atributo
//android.widget.EditText[@enabled="true" and @clickable="true"]

// ✅ BOM - Por índice relativo (quando necessário)
//android.view.ViewGroup/android.widget.EditText[1]

// ❌ EVITAR - Índices absolutos longos
//android.view.View[1]/android.view.View[2]/android.view.View[3]/android.widget.Button
```

#### 3. XPath Relativo (Recomendado)

```xpath
// ✅ BOM - Relativo a um elemento conhecido
//android.view.ViewGroup[.//android.widget.TextView[@text="Enviar PIX"]]//android.widget.EditText

// ✅ BOM - Ancestral com atributo
//android.widget.EditText[@hint="Digite CPF"]/ancestor::android.view.ViewGroup[1]

// ❌ EVITAR - Caminhos muito longos
//android.view.View[1]/android.view.View[2]/android.view.View[3]/android.view.View[4]/android.widget.Button
```

### 💻 Exemplos Práticos

```javascript
// XPath para input de CPF dentro de um formulário específico
const cpfInputXpath = '//android.view.ViewGroup[.//android.widget.TextView[@text="CPF"]]//android.widget.EditText';

// XPath para botão "Continuar" em modal de confirmação
const continueButtonXpath = '//android.view.ViewGroup[@content-desc="pix-confirmation-modal"]//android.widget.Button[@text="Continuar"]';

// XPath relativo para mensagem de erro
const errorMessageXpath = '//android.view.ViewGroup[contains(@content-desc, "pix-error")]//android.widget.TextView';
```

---

## 🤖 UiSelector (UiAutomator) - Appium Android

### ✅ Quando Usar

- Elementos nativos Android sem ID
- Seletores mais estáveis e performáticos que XPath
- Performance nativa do framework UiAutomator
- **Recomendado pelo Appium para Android**

> **Referência Oficial:** [Appium UiAutomator UiSelector Guide](https://github.com/appium/appium-uiautomator2-driver/blob/master/docs/uiautomator-uiselector.md)

### 📝 Padrões Recomendados

#### 1. Por Texto

```javascript
// ✅ BOM - Texto exato
'-android uiautomator: new UiSelector().text("Entrar")'

// ✅ BOM - Contém texto
'-android uiautomator: new UiSelector().textContains("Transferência")'

// ✅ BOM - Texto que começa com
'-android uiautomator: new UiSelector().textStartsWith("Enviar")'

// ✅ BOM - Texto que corresponde a regex
'-android uiautomator: new UiSelector().textMatches(".*PIX.*")'
```

#### 2. Por Descrição (content-desc/resource-id)

```javascript
// ✅ BOM - Por content-desc (mais estável)
'-android uiautomator: new UiSelector().description("pix-input-key")'

// ✅ BOM - Contém descrição
'-android uiautomator: new UiSelector().descriptionContains("pix")'

// ✅ BOM - Por resource-id (RECOMENDADO quando disponível)
'-android uiautomator: new UiSelector().resourceId("com.fintechbank.app:id/pix-input-key")'

// ✅ BOM - Contém resource-id
'-android uiautomator: new UiSelector().resourceIdMatches(".*pix-input.*")'
```

#### 3. Por Classe e Atributos

```javascript
// ✅ BOM - Por classe
'-android uiautomator: new UiSelector().className("android.widget.EditText")'

// ✅ BOM - Por classe e atributos combinados
'-android uiautomator: new UiSelector().className("android.widget.Button").enabled(true).clickable(true)'

// ✅ BOM - Por instance (PREFERIR sobre index - mais confiável)
'-android uiautomator: new UiSelector().className("android.widget.EditText").instance(0)'

// ⚠️ EVITAR - index é menos confiável que instance
'-android uiautomator: new UiSelector().className("android.widget.EditText").index(0)'
```

#### 4. Seletores Compostos (Múltiplas Condições)

```javascript
// ✅ BOM - Múltiplas condições
'-android uiautomator: new UiSelector().className("android.widget.Button").text("Continuar").enabled(true).clickable(true)'

// ✅ BOM - Filho de elemento
'-android uiautomator: new UiSelector().className("android.view.ViewGroup").childSelector(new UiSelector().text("Enviar PIX"))'

// ✅ BOM - Descendente
'-android uiautomator: new UiSelector().className("android.view.ViewGroup").childSelector(new UiSelector().className("android.widget.EditText"))'

// ✅ BOM - Filho por índice
'-android uiautomator: new UiSelector().childSelector(new UiSelector().className("android.widget.Button").instance(0))'
```

#### 5. UiScrollable (Para Elementos em Scroll)

```javascript
// ✅ BOM - Scroll até encontrar elemento (retorna o elemento)
'-android uiautomator: new UiScrollable(new UiSelector().scrollable(true).instance(0)).scrollIntoView(new UiSelector().text("Tabs"))'

// ✅ BOM - Buscar filho em scrollable por texto
'-android uiautomator: new UiScrollable(new UiSelector().scrollable(true).instance(0)).getChildByText(new UiSelector().className("android.widget.TextView"), "Transferir")'

// ✅ BOM - Buscar filho em scrollable por descrição
'-android uiautomator: new UiScrollable(new UiSelector().scrollable(true).instance(0)).getChildByDescription(new UiSelector().className("android.widget.Button"), "pix-contacts-list")'

// ✅ BOM - Scroll até elemento específico
'-android uiautomator: new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().description("pix-contacts-list"))'
```

#### 6. Seletores Avançados

```javascript
// ✅ BOM - Por coordenadas (quando necessário)
'-android uiautomator: new UiSelector().bounds(new Rect(100, 200, 300, 400))'

// ✅ BOM - Por contagem de filhos
'-android uiautomator: new UiSelector().childCount(3)'

// ✅ BOM - Por profundidade na árvore
'-android uiautomator: new UiSelector().depth(2)'

// ✅ BOM - Por checkable/checked
'-android uiautomator: new UiSelector().checkable(true).checked(false)'

// ✅ BOM - Por focusable/focused
'-android uiautomator: new UiSelector().focusable(true).focused(false)'
```

### 💻 Exemplos Práticos para Appium

```javascript
// Appium/WebDriverIO - Por descrição
await driver.$('-android uiautomator: new UiSelector().description("pix-input-key")').setValue('12345678900');

// Appium/WebDriverIO - Por texto
await driver.$('-android uiautomator: new UiSelector().text("Continuar")').click();

// Appium/WebDriverIO - Por resource-id (RECOMENDADO)
await driver.$('-android uiautomator: new UiSelector().resourceId("com.fintechbank.app:id/pix-submit-button")').click();

// Appium/WebDriverIO - Composto
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").description("pix-input-amount")').setValue('50000');

// Appium/WebDriverIO - Scroll até elemento
await driver.$('-android uiautomator: new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text("Meus Contatos"))').click();

// Appium/WebDriverIO - Por instance (mais confiável que index)
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").instance(0)').setValue('12345678900');

// Selenium/Java
driver.findElement(By.AndroidUIAutomator("new UiSelector().description(\"pix-input-key\")")).sendKeys("12345678900");
driver.findElement(By.AndroidUIAutomator("new UiSelector().text(\"Continuar\")")).click();
```

### 🎯 Melhores Práticas UiSelector

1. **Prefira `instance()` sobre `index()`** - Mais confiável e estável
2. **Use `resourceId()` quando disponível** - Mais rápido e estável
3. **Combine múltiplas condições** - Mais específico e menos propenso a erros
4. **Use `UiScrollable` para elementos em scroll** - Melhor que scroll manual
5. **Evite seletores muito genéricos** - Podem encontrar múltiplos elementos
6. **Use `textMatches()` para padrões complexos** - Mais flexível que `textContains()`

---

## 📐 Estrutura de Nomenclatura

### Componentes Principais

| Tipo | Prefixo | Exemplo |
|------|---------|---------|
| Input/EditText | `input-` ou `pix-input-` | `pix-input-key`, `input-cpf` |
| Button | `btn-` | `btn-pix-submit`, `btn-pix-back` |
| Modal/Dialog | `[componente]-modal` | `pix-success-modal`, `pix-confirmation-modal` |
| Mensagem | `[componente]-message` | `pix-error-message`, `pix-success-message` |
| Label/TextView | `[componente]-label` | `pix-amount-label`, `pix-key-label` |
| Container/ViewGroup | `[componente]-container` | `pix-transfer-card`, `pix-tabs` |

### Sufixos por Ação

| Ação | Sufixo | Exemplo |
|------|--------|---------|
| Submit/Enviar | `-submit` | `pix-submit-button` |
| Cancelar | `-cancel` | `pix-cancel-button` |
| Fechar | `-close` | `pix-success-close-button` |
| Confirmar | `-confirm` | `pix-confirmation-confirm-button` |
| Voltar | `-back` | `pix-back-button` |

### Estrutura Completa

```
[contexto]-[tipo]-[identificador]-[ação?]
```

**Exemplos:**
- `pix-input-key` - Input de chave PIX
- `pix-input-amount` - Input de valor
- `pix-submit-button` - Botão de enviar
- `pix-success-modal-overlay` - Overlay do modal de sucesso
- `pix-confirmation-amount-value` - Valor na tela de confirmação

---

## 💡 Exemplos Práticos

### Exemplo 1: Formulário de Transferência PIX

```tsx
// ✅ IMPLEMENTAÇÃO NO REACT
<div className="pix-transfer-form" data-testid="pix-transfer-form">
    <label htmlFor="pix-key">Chave PIX</label>
    <input 
        id="pix-key"
        data-testid="pix-input-key"
        type="text"
        placeholder="Digite CPF, celular, e-mail, etc."
    />
    
    <label htmlFor="pix-amount">Valor</label>
    <input 
        id="pix-amount"
        data-testid="pix-input-amount"
        type="text"
        placeholder="0,00"
    />
    
    <button 
        id="btn-pix-submit"
        data-testid="pix-submit-button"
        type="submit"
    >
        Continuar
    </button>
</div>
```

```javascript
// ✅ SELETORES PARA TESTES

// Prioridade 1: ID
const pixKeyInput = '~pix-input-key';
const pixAmountInput = '~pix-input-amount';
const submitButton = '~pix-submit-button';

// Prioridade 2: -android uiautomator (fallback)
const pixKeyInputUIAutomator = '-android uiautomator: new UiSelector().description("pix-input-key")';
const submitButtonUIAutomator = '-android uiautomator: new UiSelector().text("Continuar")';

// Prioridade 3: XPath (último recurso)
const pixKeyInputXpath = '//android.widget.EditText[@content-desc="pix-input-key"]';
const submitButtonXpath = '//android.view.ViewGroup[.//android.widget.TextView[@text="Enviar PIX"]]//android.widget.Button[@text="Continuar"]';
```

### Exemplo 2: Modal de Sucesso

```tsx
// ✅ IMPLEMENTAÇÃO NO REACT
<div 
    className="pix-success-modal"
    data-testid="pix-success-modal"
    id="pix-success-modal"
>
    <h2 data-testid="pix-success-title">Transferência realizada com sucesso!</h2>
    
    <div data-testid="pix-success-details">
        <span data-testid="pix-success-amount-value">
            R$ 500,00
        </span>
    </div>
    
    <button 
        id="btn-pix-success-close"
        data-testid="pix-success-close-button"
        onClick={onClose}
    >
        Fechar
    </button>
</div>
```

```javascript
// ✅ SELETORES PARA TESTES

// Prioridade 1: ID
const successModal = '~pix-success-modal';
const successTitle = '~pix-success-title';
const successAmount = '~pix-success-amount-value';
const closeButton = '~pix-success-close-button';

// Prioridade 2: -android uiautomator
const successModalUIAutomator = '-android uiautomator: new UiSelector().description("pix-success-modal")';
const closeButtonUIAutomator = '-android uiautomator: new UiSelector().text("Fechar")';

// Prioridade 3: XPath
const successModalXpath = '//android.view.ViewGroup[@content-desc="pix-success-modal"]';
const closeButtonXpath = '//android.widget.Button[@text="Fechar"]';
```

### Exemplo 3: Tabs de Navegação

```tsx
// ✅ IMPLEMENTAÇÃO NO REACT
<div className="pix-tabs" data-testid="pix-tabs" role="tablist">
    <button 
        id="btn-pix-tab-transfer"
        data-testid="pix-tab-transfer"
        role="tab"
        aria-selected={subView === 'transfer'}
    >
        Transferir
    </button>
    <button 
        id="btn-pix-tab-contacts"
        data-testid="pix-tab-contacts"
        role="tab"
    >
        Meus Contatos
    </button>
</div>
```

```javascript
// ✅ SELETORES PARA TESTES

// Prioridade 1: ID
const transferTab = '~pix-tab-transfer';
const contactsTab = '~pix-tab-contacts';

// Prioridade 2: -android uiautomator
const transferTabUIAutomator = '-android uiautomator: new UiSelector().text("Transferir")';
const contactsTabUIAutomator = '-android uiautomator: new UiSelector().text("Meus Contatos")';

// Prioridade 3: XPath
const transferTabXpath = '//android.widget.Button[@text="Transferir"]';
const contactsTabXpath = '//android.widget.Button[@text="Meus Contatos"]';
```

---

## 🎨 Padrões por Tipo de Elemento

### Input/EditText

```tsx
// ✅ PADRÃO RECOMENDADO
<input 
    id="pix-key"
    data-testid="pix-input-key"
    type="text"
    placeholder="Digite CPF, celular, e-mail, etc."
    aria-label="Chave PIX"
    aria-required="true"
/>
```

**Seletores:**
- ID: `~pix-input-key`
- UIAutomator: `-android uiautomator: new UiSelector().description("pix-input-key")`
- XPath: `//android.widget.EditText[@content-desc="pix-input-key"]`

### Button

```tsx
// ✅ PADRÃO RECOMENDADO
<button 
    id="btn-pix-submit"
    data-testid="pix-submit-button"
    type="submit"
    aria-label="Continuar"
>
    Continuar
</button>
```

**Seletores:**
- ID: `~pix-submit-button`
- UIAutomator: `-android uiautomator: new UiSelector().description("pix-submit-button")`
- XPath: `//android.widget.Button[@content-desc="pix-submit-button"]`

### Modal/Dialog

```tsx
// ✅ PADRÃO RECOMENDADO
<div 
    className="pix-success-modal"
    data-testid="pix-success-modal"
    id="pix-success-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="pix-success-title"
>
    {/* Conteúdo */}
</div>
```

**Seletores:**
- ID: `~pix-success-modal`
- UIAutomator: `-android uiautomator: new UiSelector().description("pix-success-modal")`
- XPath: `//android.view.ViewGroup[@content-desc="pix-success-modal"]`

### Mensagem de Erro/Sucesso

```tsx
// ✅ PADRÃO RECOMENDADO
<div 
    className="pix-error-message"
    data-testid="pix-error-message"
    role="alert"
    aria-live="assertive"
>
    Mensagem de erro
</div>
```

**Seletores:**
- ID: `~pix-error-message`
- UIAutomator: `-android uiautomator: new UiSelector().description("pix-error-message")`
- XPath: `//android.view.ViewGroup[@content-desc="pix-error-message"]//android.widget.TextView`

### Lista/RecyclerView

```tsx
// ✅ PADRÃO RECOMENDADO
<div 
    className="pix-contacts-list"
    data-testid="pix-contacts-list"
    role="list"
>
    {contacts.map((contact, index) => (
        <div 
            key={contact.id}
            data-testid={`pix-contact-item-${index}`}
            role="listitem"
        >
            {contact.name}
        </div>
    ))}
</div>
```

**Seletores:**
- ID: `~pix-contacts-list`
- UIAutomator: `-android uiautomator: new UiSelector().description("pix-contacts-list")`
- XPath: `//android.view.ViewGroup[@content-desc="pix-contacts-list"]`

---

## ✅ Checklist de Implementação

### Para Cada Tela/Componente

- [ ] **IDs únicos** definidos para elementos interativos
- [ ] **data-testid** adicionado em todos os elementos testáveis
- [ ] **aria-label** ou **aria-labelledby** para acessibilidade
- [ ] **role** apropriado (button, dialog, alert, etc.)
- [ ] Nomenclatura segue o padrão: `[componente]-[tipo]-[identificador]`
- [ ] Seletores alternativos documentados (UIAutomator, XPath)
- [ ] Testes validam seletores funcionando

### Para Elementos Específicos

#### Inputs
- [ ] `id` e `data-testid` definidos
- [ ] `aria-label` ou `aria-required` quando necessário
- [ ] Placeholder descritivo

#### Botões
- [ ] `id` e `data-testid` definidos
- [ ] `aria-label` descritivo
- [ ] Texto do botão claro e único

#### Modais
- [ ] `role="dialog"` e `aria-modal="true"`
- [ ] `aria-labelledby` apontando para o título
- [ ] Botão de fechar identificado

#### Mensagens
- [ ] `role="alert"` para erros
- [ ] `aria-live` apropriado
- [ ] ID único para cada tipo de mensagem

---

## 🚀 Próximos Passos

1. **Auditar componentes existentes** e adicionar IDs onde faltam
2. **Documentar seletores** de cada tela em arquivo separado
3. **Criar helpers** de seletores reutilizáveis
4. **Validar seletores** em testes automatizados
5. **Manter documentação** atualizada conforme novas telas são criadas

---

## 📚 Referências

- [Appium Selectors](https://appium.io/docs/en/2.1/guides/element-finding/)
- [Android UIAutomator](https://developer.android.com/training/testing/ui-automator)
- [XPath Syntax](https://www.w3schools.com/xml/xpath_syntax.asp)
- [WebDriverIO Mobile Selectors](https://webdriver.io/docs/selectors/)

---

## 📝 Notas Importantes

1. **Sempre priorize IDs** - São mais rápidos e estáveis
2. **Evite XPath absolutos** - Quebram facilmente com mudanças na UI
3. **Use UIAutomator** - Quando IDs não estão disponíveis em elementos nativos
4. **Documente seletores alternativos** - Para casos de fallback
5. **Teste seletores regularmente** - Valide que ainda funcionam após mudanças

---

**Última atualização:** 2025-01-27  
**Versão:** 1.0.0

