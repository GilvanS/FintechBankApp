# 🧹 Clean Code - Atributos para Appium

## 🎯 Objetivo

Garantir que todos os elementos interativos tenham os atributos necessários para funcionar perfeitamente com Appium, seguindo princípios de Clean Code.

---

## ✅ Padrão de Atributos por Tipo de Elemento

### Input Fields

Todos os inputs devem ter:
- ✅ `id` - Único e descritivo (ex: `login-cpf-input`)
- ✅ `data-testid` - Para Appium `content-desc` (ex: `login-input-cpf`)
- ✅ `name` - Nome do campo (ex: `cpf`)
- ✅ `placeholder` - Aparece como `text` no Android
- ✅ `aria-label` - Para acessibilidade e `content-desc`
- ✅ `aria-required` - Para validação
- ✅ `title` - Tooltip e ajuda no Appium

**Exemplo:**
```tsx
<input
  id="login-cpf-input"
  data-testid="login-input-cpf"
  name="cpf"
  type="text"
  placeholder="999.999.999-99"
  aria-label="CPF"
  aria-required="true"
  title="CPF - Campo de CPF para login"
/>
```

### Buttons

Todos os botões devem ter:
- ✅ `id` - Único e descritivo (ex: `btn-login-submit`)
- ✅ `data-testid` - Para Appium `content-desc` (ex: `login-submit-button`)
- ✅ `name` - Nome do botão (ex: `btn-login-submit`)
- ✅ `aria-label` - Texto do botão ou descrição
- ✅ `title` - Tooltip e ajuda no Appium

**Exemplo:**
```tsx
<button
  id="btn-login-submit"
  data-testid="login-submit-button"
  name="btn-login-submit"
  aria-label="Entrar"
  title="Entrar - Botão para fazer login"
>
  Entrar
</button>
```

### Links

Todos os links devem ter:
- ✅ `id` - Único e descritivo (ex: `link-signup`)
- ✅ `data-testid` - Para Appium `content-desc` (ex: `login-signup-link`)
- ✅ `name` - Nome do link (ex: `link-signup`)
- ✅ `aria-label` - Texto do link ou descrição
- ✅ `title` - Tooltip e ajuda no Appium

**Exemplo:**
```tsx
<button
  type="button"
  id="link-signup"
  data-testid="login-signup-link"
  name="link-signup"
  aria-label="Cadastre-se"
  title="Cadastre-se - Link para criar nova conta"
>
  Cadastre-se
</button>
```

### Textos e Títulos

Textos importantes devem ter:
- ✅ `id` - Único e descritivo (ex: `login-title`)
- ✅ `data-testid` - Para Appium `content-desc` (ex: `login-title`)
- ✅ `title` - Descrição do elemento

**Exemplo:**
```tsx
<h1
  id="login-title"
  data-testid="login-title"
  title="Fintech - Título da aplicação"
>
  Fintech
</h1>
```

---

## 📋 Mapeamento: HTML → Appium

| Atributo HTML | Android Appium | Como Usar |
|---------------|----------------|-----------|
| `id="login-cpf-input"` | ❌ Não vira `resource-id` no WebView | - |
| `data-testid="login-input-cpf"` | ✅ `content-desc="login-input-cpf"` | `@content-desc` ou `description()` |
| `aria-label="CPF"` | ✅ `content-desc="CPF"` | `@content-desc` ou `description()` |
| `placeholder="999.999.999-99"` | ✅ `text="999.999.999-99"` | `@text` ou `text()` |
| `name="cpf"` | ⚠️ Pode ajudar em alguns casos | - |
| `title="CPF - Campo..."` | ⚠️ Pode aparecer como tooltip | - |
| Texto visível "Entrar" | ✅ `text="Entrar"` | `@text` ou `text()` |

---

## 🎯 Seletores Otimizados - Java Page Object

### Login - Campo CPF

```java
// ✅ MELHOR - Por content-desc (data-testid)
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-cpf']")
private WebElement campoCpf;

// ✅ ALTERNATIVA 1 - Por content-desc (aria-label)
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='CPF']")
private WebElement campoCpfByAriaLabel;

// ✅ ALTERNATIVA 2 - Por placeholder (text)
@AndroidFindBy(xpath = "//android.widget.EditText[@text='999.999.999-99']")
private WebElement campoCpfByPlaceholder;
```

### Login - Campo Senha

```java
// ✅ MELHOR - Por content-desc (data-testid)
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='login-input-password']")
private WebElement campoSenha;

// ✅ ALTERNATIVA 1 - Por content-desc (aria-label)
@AndroidFindBy(xpath = "//android.widget.EditText[@content-desc='Senha']")
private WebElement campoSenhaByAriaLabel;

// ✅ ALTERNATIVA 2 - Por placeholder (text)
@AndroidFindBy(xpath = "//android.widget.EditText[@text='••••••••']")
private WebElement campoSenhaByPlaceholder;
```

### Login - Botão Entrar

```java
// ✅ MELHOR - Por text (texto visível)
@AndroidFindBy(xpath = "//android.widget.Button[@text='Entrar']")
private WebElement btnEntrar;

// ✅ ALTERNATIVA - Por content-desc (data-testid)
@AndroidFindBy(xpath = "//android.widget.Button[@content-desc='login-submit-button']")
private WebElement btnEntrarByDesc;
```

---

## 📝 Checklist de Implementação

Para cada elemento interativo, verifique:

- [ ] `id` único e descritivo presente
- [ ] `data-testid` presente (vira `content-desc`)
- [ ] `aria-label` presente (também vira `content-desc`)
- [ ] `placeholder` presente (inputs) - aparece como `text`
- [ ] `name` presente (inputs e botões)
- [ ] `title` descritivo presente
- [ ] Texto visível nos botões (aparece como `text`)

---

## 🔍 Verificação no Appium Inspector

Após rebuild do APK:

1. **Selecione o elemento** no Appium Inspector
2. **Veja a aba "Atributo" e "Valor"**
3. **Verifique se aparecem:**
   - ✅ `content-desc` (vem de `data-testid` ou `aria-label`)
   - ✅ `text` (vem de `placeholder` ou texto visível)
   - ✅ `name` (se disponível)

---

## ✅ Benefícios do Clean Code

1. **Seletores mais estáveis** - Múltiplas opções de seletores
2. **Melhor manutenibilidade** - Atributos consistentes
3. **Mais confiável** - Fallbacks disponíveis
4. **Documentação automática** - `title` e `aria-label` explicam o elemento
5. **Acessibilidade** - Melhor experiência para todos

---

## 📚 Referências

- [SELETORES-JAVA-PAGE-OBJECT.md](./SELETORES-JAVA-PAGE-OBJECT.md) - Seletores prontos para usar
- [SOLUCAO-XPATH-VERBOSO.md](./SOLUCAO-XPATH-VERBOSO.md) - Solução para XPath verboso

---

**Última atualização:** 2025-01-27  
**Versão:** 1.0.0

