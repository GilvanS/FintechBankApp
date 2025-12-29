# 🤖 Appium Seletores Android - Guia Completo

## 🎯 Objetivo

Este documento fornece um guia completo e prático para criar seletores robustos no **Appium** para automação de testes Android, focando em **UiSelector** e **UiScrollable** do framework UiAutomator.

> **Referência Oficial:** [Appium UiAutomator UiSelector Guide](https://github.com/appium/appium-uiautomator2-driver/blob/master/docs/uiautomator-uiselector.md)

---

## 📋 Índice

1. [Hierarquia de Prioridade](#hierarquia-de-prioridade)
2. [Resource ID](#resource-id)
3. [Accessibility ID](#accessibility-id)
4. [UiSelector](#uiselector)
5. [UiScrollable](#uiscrollable)
6. [Exemplos Práticos](#exemplos-práticos)
7. [Melhores Práticas](#melhores-práticas)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Hierarquia de Prioridade

Use esta ordem de prioridade ao criar seletores para **Appium Android**:

1. **Resource ID** (`resource-id`) - **PREFERENCIAL** ⚡ Mais rápido e estável
2. **Accessibility ID** (`content-desc` ou `data-testid`) - **RECOMENDADO** ✅
3. **UiSelector (UiAutomator)** - Para elementos nativos sem ID
4. **XPath relativo** - Quando outras opções não estão disponíveis
5. **XPath absoluto** - Último recurso (evitar) ❌

---

## 🆔 Resource ID

### ✅ Quando Usar

- **SEMPRE que disponível** - É o seletor mais rápido e estável
- Elementos nativos Android com `resource-id` definido
- Performance nativa do framework Android

### 📝 Formato

```javascript
// Formato: com.fintechbank.app:id/element_id
const resourceId = 'com.fintechbank.app:id/pix-input-key';
```

### 💻 Uso no Appium

```javascript
// Appium/WebDriverIO
await driver.$('id=com.fintechbank.app:id/pix-input-key').setValue('12345678900');

// OU usando accessibility id (se resource-id não estiver disponível)
await driver.$('~pix-input-key').setValue('12345678900');

// Selenium/Java
driver.findElement(By.id("com.fintechbank.app:id/pix-input-key")).sendKeys("12345678900");
```

### 🔧 Como Adicionar Resource ID no React Native/Capacitor

```tsx
// React Native
<TextInput
    testID="pix-input-key"
    nativeID="pix-input-key" // Para Android resource-id
/>

// Capacitor/Ionic React
<input 
    id="pix-key"
    data-testid="pix-input-key"
    // O Capacitor converte data-testid para content-desc no Android
/>
```

---

## 🏷️ Accessibility ID

### ✅ Quando Usar

- Quando `resource-id` não está disponível
- Elementos com `content-desc` ou `data-testid`
- Melhor para acessibilidade e testes

### 📝 Formato

```javascript
// Usando ~ para accessibility id
const accessibilityId = '~pix-input-key';
```

### 💻 Uso no Appium

```javascript
// Appium/WebDriverIO
await driver.$('~pix-input-key').setValue('12345678900');
await driver.$('~pix-submit-button').click();

// Selenium/Java
driver.findElement(MobileBy.AccessibilityId("pix-input-key")).sendKeys("12345678900");
```

---

## 🤖 UiSelector

### ✅ Quando Usar

- Elementos nativos Android sem ID
- Seletores mais estáveis que XPath
- Performance nativa do framework UiAutomator
- **Recomendado pelo Appium para consultas complexas**

### 📝 Métodos Principais

#### Por Texto

```javascript
// Texto exato
'-android uiautomator: new UiSelector().text("Entrar")'

// Contém texto
'-android uiautomator: new UiSelector().textContains("Transferência")'

// Texto que começa com
'-android uiautomator: new UiSelector().textStartsWith("Enviar")'

// Texto que corresponde a regex
'-android uiautomator: new UiSelector().textMatches(".*PIX.*")'
```

#### Por Descrição/Resource ID

```javascript
// Por content-desc
'-android uiautomator: new UiSelector().description("pix-input-key")'

// Contém descrição
'-android uiautomator: new UiSelector().descriptionContains("pix")'

// Por resource-id (RECOMENDADO)
'-android uiautomator: new UiSelector().resourceId("com.fintechbank.app:id/pix-input-key")'

// Resource-id com regex
'-android uiautomator: new UiSelector().resourceIdMatches(".*pix-input.*")'
```

#### Por Classe

```javascript
// Por classe
'-android uiautomator: new UiSelector().className("android.widget.EditText")'

// Por classe com atributos
'-android uiautomator: new UiSelector().className("android.widget.Button").enabled(true).clickable(true)'

// Por instance (PREFERIR sobre index)
'-android uiautomator: new UiSelector().className("android.widget.EditText").instance(0)'

// ⚠️ EVITAR - index é menos confiável
'-android uiautomator: new UiSelector().className("android.widget.EditText").index(0)'
```

#### Seletores Compostos

```javascript
// Múltiplas condições
'-android uiautomator: new UiSelector().className("android.widget.Button").text("Continuar").enabled(true)'

// Filho de elemento
'-android uiautomator: new UiSelector().className("android.view.ViewGroup").childSelector(new UiSelector().text("Enviar PIX"))'

// Descendente
'-android uiautomator: new UiSelector().className("android.view.ViewGroup").childSelector(new UiSelector().className("android.widget.EditText"))'
```

#### Atributos Adicionais

```javascript
// Por checkable/checked
'-android uiautomator: new UiSelector().checkable(true).checked(false)'

// Por focusable/focused
'-android uiautomator: new UiSelector().focusable(true).focused(false)'

// Por contagem de filhos
'-android uiautomator: new UiSelector().childCount(3)'

// Por profundidade
'-android uiautomator: new UiSelector().depth(2)'
```

### 💻 Exemplos Práticos

```javascript
// Appium/WebDriverIO - Por texto
await driver.$('-android uiautomator: new UiSelector().text("Continuar")').click();

// Appium/WebDriverIO - Por resource-id
await driver.$('-android uiautomator: new UiSelector().resourceId("com.fintechbank.app:id/pix-submit-button")').click();

// Appium/WebDriverIO - Composto
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").description("pix-input-amount")').setValue('50000');

// Appium/WebDriverIO - Por instance
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").instance(0)').setValue('12345678900');

// Selenium/Java
driver.findElement(By.AndroidUIAutomator("new UiSelector().text(\"Continuar\")")).click();
```

---

## 📜 UiScrollable

### ✅ Quando Usar

- Elementos dentro de listas/scrolls
- Elementos que precisam ser rolados para ficar visíveis
- **Melhor que scroll manual** - Performance nativa

### 📝 Métodos Principais

#### scrollIntoView

```javascript
// Scroll até encontrar elemento (retorna o elemento)
'-android uiautomator: new UiScrollable(new UiSelector().scrollable(true).instance(0)).scrollIntoView(new UiSelector().text("Tabs"))'

// Scroll até elemento por descrição
'-android uiautomator: new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().description("pix-contacts-list"))'
```

#### getChildByText

```javascript
// Buscar filho em scrollable por texto
'-android uiautomator: new UiScrollable(new UiSelector().scrollable(true).instance(0)).getChildByText(new UiSelector().className("android.widget.TextView"), "Transferir")'

// Buscar filho em scrollable por texto (com scroll)
'-android uiautomator: new UiScrollable(new UiSelector().scrollable(true)).getChildByText(new UiSelector().className("android.widget.Button"), "Meus Contatos", true)'
```

#### getChildByDescription

```javascript
// Buscar filho em scrollable por descrição
'-android uiautomator: new UiScrollable(new UiSelector().scrollable(true).instance(0)).getChildByDescription(new UiSelector().className("android.widget.Button"), "pix-contacts-list")'
```

### 💻 Exemplos Práticos

```javascript
// Appium/WebDriverIO - Scroll até elemento
await driver.$('-android uiautomator: new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text("Meus Contatos"))').click();

// Appium/WebDriverIO - Buscar filho em scroll
const contact = await driver.$('-android uiautomator: new UiScrollable(new UiSelector().scrollable(true)).getChildByText(new UiSelector().className("android.widget.TextView"), "João Silva")');
await contact.click();

// Selenium/Java
WebElement element = driver.findElement(By.AndroidUIAutomator(
    "new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text(\"Tabs\"))"
));
element.click();
```

---

## 💡 Exemplos Práticos Completos

### Exemplo 1: Formulário PIX

```javascript
// Prioridade 1: Resource ID
await driver.$('id=com.fintechbank.app:id/pix-input-key').setValue('12345678900');

// Prioridade 2: Accessibility ID
await driver.$('~pix-input-key').setValue('12345678900');

// Prioridade 3: UiSelector
await driver.$('-android uiautomator: new UiSelector().description("pix-input-key")').setValue('12345678900');

// Prioridade 4: XPath (último recurso)
await driver.$('//android.widget.EditText[@content-desc="pix-input-key"]').setValue('12345678900');
```

### Exemplo 2: Botão com Múltiplas Condições

```javascript
// UiSelector composto - mais específico e estável
await driver.$('-android uiautomator: new UiSelector().className("android.widget.Button").text("Continuar").enabled(true).clickable(true)').click();
```

### Exemplo 3: Elemento em Scroll

```javascript
// Scroll até encontrar elemento
await driver.$('-android uiautomator: new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text("Meus Contatos"))').click();

// Buscar filho em scroll
const contact = await driver.$('-android uiautomator: new UiScrollable(new UiSelector().scrollable(true)).getChildByText(new UiSelector().className("android.widget.TextView"), "João Silva")');
await contact.click();
```

### Exemplo 4: Lista de Elementos

```javascript
// Usar instance para pegar elemento específico
await driver.$('-android uiautomator: new UiSelector().className("android.widget.TextView").instance(0)').click();

// OU buscar por texto específico
await driver.$('-android uiautomator: new UiSelector().text("Transferir")').click();
```

---

## 🎯 Melhores Práticas

### ✅ DO (Faça)

1. **Prefira Resource ID** - Sempre que disponível
2. **Use `instance()` sobre `index()`** - Mais confiável
3. **Combine múltiplas condições** - Mais específico
4. **Use UiScrollable para scrolls** - Melhor que scroll manual
5. **Documente seletores alternativos** - Para fallback
6. **Valide seletores regularmente** - Após mudanças na UI

### ❌ DON'T (Não Faça)

1. **Não use XPath absoluto** - Quebra facilmente
2. **Não use `index()`** - Prefira `instance()`
3. **Não use seletores muito genéricos** - Podem encontrar múltiplos elementos
4. **Não ignore Resource ID** - É o mais rápido
5. **Não faça scroll manual** - Use UiScrollable

---

## 🔧 Troubleshooting

### Problema: Elemento não encontrado

**Soluções:**
1. Verifique se o elemento está visível na tela
2. Use `UiScrollable` se o elemento está em scroll
3. Adicione `wait` antes de buscar o elemento
4. Verifique se o `resource-id` ou `content-desc` está correto

```javascript
// Adicionar wait
await driver.waitUntil(async () => {
    const element = await driver.$('~pix-input-key');
    return await element.isDisplayed();
}, { timeout: 5000 });
```

### Problema: Múltiplos elementos encontrados

**Soluções:**
1. Use seletores mais específicos
2. Combine múltiplas condições
3. Use `instance()` para pegar elemento específico

```javascript
// Mais específico
'-android uiautomator: new UiSelector().className("android.widget.Button").text("Continuar").enabled(true)'

// OU usar instance
'-android uiautomator: new UiSelector().className("android.widget.Button").instance(0)'
```

### Problema: Elemento em scroll não encontrado

**Soluções:**
1. Use `UiScrollable.scrollIntoView()`
2. Use `getChildByText()` ou `getChildByDescription()`

```javascript
// Scroll até elemento
await driver.$('-android uiautomator: new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text("Meus Contatos"))').click();
```

---

## 📚 Referências

- [Appium UiAutomator UiSelector Guide](https://github.com/appium/appium-uiautomator2-driver/blob/master/docs/uiautomator-uiselector.md)
- [Android UiSelector Documentation](https://developer.android.com/reference/androidx/test/uiautomator/UiSelector)
- [Android UiScrollable Documentation](https://developer.android.com/reference/androidx/test/uiautomator/UiScrollable)
- [Appium Find Elements](https://appium.github.io/appium.io/docs/en/commands/element/find-elements/)

---

**Última atualização:** 2025-01-27  
**Versão:** 1.0.0

