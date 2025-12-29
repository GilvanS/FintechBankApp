# 🎯 Seletores Appium para WebView - Solução Completa

## ⚠️ Problema Identificado

No **WebView do Capacitor**, os atributos HTML (`id`, `data-testid`) **NÃO são automaticamente convertidos** para `resource-id` do Android. Isso resulta em XPaths verbosos como:

```
//android.webkit.WebView[@text="Fintech - A nova era da sua vida financeira"]/android.view.View/android.view.View/android.view.View/android.view.View/android.view.View[2]/android.view.View/android.widget.EditText[1]
```

## ✅ Solução: Estratégias de Seletores para WebView

### 1. **UiSelector por Description (RECOMENDADO)** ⭐

O `data-testid` e `aria-label` são convertidos para `content-desc` no Android, que pode ser usado com UiSelector:

```javascript
// ✅ MELHOR OPÇÃO para WebView
await driver.$('-android uiautomator: new UiSelector().description("login-input-cpf")').setValue('12345678900');

// Ou usando aria-label
await driver.$('-android uiautomator: new UiSelector().description("CPF")').setValue('12345678900');
```

### 2. **UiSelector por Texto (Placeholder/Label)**

```javascript
// Por placeholder
await driver.$('-android uiautomator: new UiSelector().text("999.999.999-99")').setValue('12345678900');

// Por label (texto visível)
await driver.$('-android uiautomator: new UiSelector().text("CPF")').click();
```

### 3. **UiSelector por Classe + Instance**

```javascript
// Primeiro EditText (CPF)
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").instance(0)').setValue('12345678900');

// Segundo EditText (Senha)
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").instance(1)').setValue('senha123');
```

### 4. **UiSelector Composto (Mais Confiável)**

```javascript
// Classe + Description
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").description("login-input-cpf")').setValue('12345678900');

// Classe + Text (placeholder)
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").text("999.999.999-99")').setValue('12345678900');
```

## 📋 Seletores por Elemento - Login

### Campo CPF

```javascript
// ✅ Prioridade 1: UiSelector por description (data-testid)
await driver.$('-android uiautomator: new UiSelector().description("login-input-cpf")').setValue('12345678900');

// ✅ Prioridade 2: UiSelector por description (aria-label)
await driver.$('-android uiautomator: new UiSelector().description("CPF")').setValue('12345678900');

// ✅ Prioridade 3: UiSelector por placeholder
await driver.$('-android uiautomator: new UiSelector().text("999.999.999-99")').setValue('12345678900');

// ✅ Prioridade 4: UiSelector por classe + instance
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").instance(0)').setValue('12345678900');

// ⚠️ Último recurso: XPath (evitar)
await driver.$('//android.widget.EditText[@text="999.999.999-99"]').setValue('12345678900');
```

### Campo Senha

```javascript
// ✅ Prioridade 1: UiSelector por description
await driver.$('-android uiautomator: new UiSelector().description("login-input-password")').setValue('senha123');

// ✅ Prioridade 2: UiSelector por description (aria-label)
await driver.$('-android uiautomator: new UiSelector().description("Senha")').setValue('senha123');

// ✅ Prioridade 3: UiSelector por placeholder
await driver.$('-android uiautomator: new UiSelector().text("••••••••")').setValue('senha123');

// ✅ Prioridade 4: UiSelector por classe + instance
await driver.$('-android uiautomator: new UiSelector().className("android.widget.EditText").instance(1)').setValue('senha123');
```

### Botão Entrar

```javascript
// ✅ Prioridade 1: UiSelector por description
await driver.$('-android uiautomator: new UiSelector().description("login-submit-button")').click();

// ✅ Prioridade 2: UiSelector por texto do botão
await driver.$('-android uiautomator: new UiSelector().text("Entrar")').click();

// ✅ Prioridade 3: UiSelector por classe + texto
await driver.$('-android uiautomator: new UiSelector().className("android.widget.Button").text("Entrar")').click();
```

### Link "Esqueci minha senha"

```javascript
// ✅ Prioridade 1: UiSelector por description
await driver.$('-android uiautomator: new UiSelector().description("login-forgot-password-link")').click();

// ✅ Prioridade 2: UiSelector por texto
await driver.$('-android uiautomator: new UiSelector().text("Esqueci minha senha")').click();
```

### Link "Cadastre-se"

```javascript
// ✅ Prioridade 1: UiSelector por description
await driver.$('-android uiautomator: new UiSelector().description("login-signup-link")').click();

// ✅ Prioridade 2: UiSelector por texto
await driver.$('-android uiautomator: new UiSelector().text("Cadastre-se")').click();
```

## 🔧 Como Funciona no WebView

### Atributos HTML → Android

| Atributo HTML | Android | Como Usar no Appium |
|---------------|---------|---------------------|
| `data-testid="login-input-cpf"` | `content-desc="login-input-cpf"` | `UiSelector().description("login-input-cpf")` |
| `aria-label="CPF"` | `content-desc="CPF"` | `UiSelector().description("CPF")` |
| `id="cpf"` | ❌ **NÃO funciona** no WebView | - |
| `placeholder="999.999.999-99"` | `text="999.999.999-99"` | `UiSelector().text("999.999.999-99")` |
| Texto visível | `text="Entrar"` | `UiSelector().text("Entrar")` |

### ⚠️ Importante

- **`id` HTML NÃO vira `resource-id`** no WebView do Capacitor
- **`data-testid` e `aria-label` viram `content-desc`** (usar com `description()`)
- **`placeholder` e texto visível viram `text`** (usar com `text()`)
- **Sempre prefira UiSelector sobre XPath** no WebView

## 📝 Exemplo Completo - Teste de Login

```javascript
describe('Login Screen', () => {
  it('deve fazer login com sucesso', async () => {
    // Preencher CPF
    await driver.$('-android uiautomator: new UiSelector().description("login-input-cpf")').setValue('12345678900');
    
    // Preencher Senha
    await driver.$('-android uiautomator: new UiSelector().description("login-input-password")').setValue('senha123');
    
    // Clicar em Entrar
    await driver.$('-android uiautomator: new UiSelector().description("login-submit-button")').click();
    
    // Aguardar navegação
    await driver.pause(2000);
    
    // Verificar se saiu da tela de login
    const loginScreen = await driver.$('-android uiautomator: new UiSelector().description("login-screen")');
    await expect(loginScreen).not.toBeDisplayed();
  });
});
```

## 🎯 Hierarquia de Prioridade para WebView

1. **UiSelector por description** (`data-testid` / `aria-label`) ⭐ **MELHOR**
2. **UiSelector por texto** (placeholder / texto visível)
3. **UiSelector por classe + instance** (quando não há description)
4. **UiSelector composto** (classe + description / classe + texto)
5. **XPath relativo** (último recurso, evitar)

## ✅ Benefícios

1. **Seletores mais estáveis** - Não dependem da estrutura HTML
2. **Melhor performance** - UiSelector é nativo do Android
3. **Menos verboso** - Não precisa de XPath longo
4. **Mais confiável** - Funciona mesmo com mudanças na estrutura HTML

## 🔍 Debugging

Para verificar quais atributos estão disponíveis no Appium Inspector:

1. Abra o Appium Inspector
2. Selecione o elemento
3. Veja a aba "Atributo" e "Valor"
4. Procure por:
   - `content-desc` (vem de `data-testid` / `aria-label`)
   - `text` (vem de placeholder / texto visível)
   - `class` (tipo do elemento Android)

## 📚 Referências

- [Appium UiAutomator UiSelector](https://github.com/appium/appium-uiautomator2-driver/blob/master/docs/uiautomator-uiselector.md)
- [Appium WebView Guide](https://appium.github.io/appium.io/docs/en/writing-running-appium/web/hybrid/)

