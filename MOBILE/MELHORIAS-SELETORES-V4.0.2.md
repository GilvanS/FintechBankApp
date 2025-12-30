# 🎯 Melhorias nos Seletores - Versão 4.0.2

## ✅ Mudanças Realizadas

**Versão:** `4.0.2-20250127`  
**Build:** `20250127`  
**Data:** 27 de Janeiro de 2025

### 1. **Remoção COMPLETA do atributo `title` dos inputs**

O `title` estava sendo concatenado no `hint` do Android, causando:
```
hint="login-input-cpf CPF - Campo de CPF para login"
```

**Solução:** Removido `title` de TODOS os inputs em Login e SignUp.

### 2. **`aria-label` igual ao `data-testid`**

Para garantir que o `hint` contenha apenas o `data-testid`:

**Antes:**
```tsx
<input
  data-testid="login-input-cpf"
  aria-label="CPF"  // ❌ Diferente
  title="CPF - Campo de CPF para login"  // ❌ Concatena no hint
/>
```

**Depois:**
```tsx
<input
  data-testid="login-input-cpf"
  aria-label="login-input-cpf"  // ✅ Igual ao data-testid
  // title removido
/>
```

### 3. **Versão atualizada para 4.0.2**

- `AppVersion.ts`: `4.0.2-20250127`
- `package.json`: `4.0.2-20250127`
- `build.gradle`: `versionCode 20250128`, `versionName "4.0.2-20250127"`

## 📋 Resultado Esperado no XML

### Campo CPF (Login)

**Antes:**
```xml
<android.widget.EditText 
  hint="login-input-cpf CPF - Campo de CPF para login"
  text=""
/>
```

**Depois (Esperado):**
```xml
<android.widget.EditText 
  hint="login-input-cpf"
  text="999.999.999-99"  <!-- placeholder quando vazio -->
/>
```

### Campo Senha (Login)

**Antes:**
```xml
<android.widget.EditText 
  hint="login-input-password Senha - Campo de senha para login"
  text=""
/>
```

**Depois (Esperado):**
```xml
<android.widget.EditText 
  hint="login-input-password"
  text="••••••••"  <!-- placeholder quando vazio -->
/>
```

## ✅ Seletores que Funcionarão

### 1. Por `hint` (data-testid) ⭐ MELHOR

```java
// Campo CPF
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"login-input-cpf\")")
private WebElement campoCpf;

// Campo Senha
@AndroidFindBy(uiAutomator = "new UiSelector().description(\"login-input-password\")")
private WebElement campoSenha;
```

### 2. Por `text` (placeholder) ⭐ ALTERNATIVA

```java
// Campo CPF
@AndroidFindBy(xpath = "//android.widget.EditText[@text='999.999.999-99']")
private WebElement campoCpf;

// Campo Senha
@AndroidFindBy(xpath = "//android.widget.EditText[@text='••••••••']")
private WebElement campoSenha;
```

### 3. Por `text` (botões) ⭐ FUNCIONA

```java
// Botão Entrar
@AndroidFindBy(xpath = "//android.widget.Button[@text='login-submit-button']")
private WebElement btnEntrar;
```

## 🚀 Próximos Passos

1. **Rebuild do APK:**
   ```powershell
   cd MOBILE
   .\GERAR-APK-DO-ZERO.ps1
   ```

2. **Verificar no Appium Inspector:**
   - Versão deve ser `4.0.2-20250127`
   - `hint` deve conter apenas `login-input-cpf` (sem concatenação)
   - `text` deve mostrar o placeholder quando o campo está vazio

## 📝 Arquivos Modificados

- ✅ `src/pages/Login/index.tsx` - Removido `title` dos inputs
- ✅ `src/SignUp.tsx` - Removido `title` dos inputs, `aria-label` igual ao `data-testid`
- ✅ `src/utils/AppVersion.ts` - Versão `4.0.2-20250127`
- ✅ `package.json` - Versão `4.0.2-20250127`
- ✅ `android/app/build.gradle` - `versionCode 20250128`, `versionName "4.0.2-20250127"`

## ⚠️ Importante

- O `hint` deve aparecer limpo: apenas `login-input-cpf` (sem concatenação)
- O `placeholder` deve aparecer como `text` quando o campo está vazio
- Os botões já funcionam com `text` (data-testid aparece como text)
- Use `description()` ou `descriptionContains()` para buscar pelo `hint`

## ✅ Verificação

Após rebuild, no Appium Inspector:

1. **Campo CPF:**
   - `hint="login-input-cpf"` ✅ (sem concatenação)
   - `text="999.999.999-99"` ✅ (placeholder)

2. **Campo Senha:**
   - `hint="login-input-password"` ✅ (sem concatenação)
   - `text="••••••••"` ✅ (placeholder)

3. **Versão do App:**
   - `4.0.2-20250127` ✅

