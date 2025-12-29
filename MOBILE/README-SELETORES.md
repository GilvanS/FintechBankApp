# 📱 Documentação de Seletores Mobile - Índice

## 🎯 Visão Geral

Esta documentação fornece guias completos para criar e manter seletores robustos para testes automatizados no aplicativo mobile FintechBankApp.

---

## 📚 Documentos Disponíveis

### 1. [SELETORES-JAVA-APPIUM.md](./SELETORES-JAVA-APPIUM.md) ☕ **PARA JAVA**
**Seletores Java Otimizados para Appium**

Seletores Java prontos para usar, evitando XPath verboso e `instance()` frágil.

**Contém:**
- ✅ Seletores Java otimizados (UiSelector)
- ✅ Exemplos completos de código Java
- ✅ Todos os seletores para Login, SignUp, PreLoginDashboard
- ✅ Métodos helper opcionais
- ✅ Evita XPath verboso e `instance()`

**Quando usar:** **LEIA PRIMEIRO** se você está usando Java para Appium.

---

### 2. [COMO-USAR-SELETORES-WEBVIEW.md](./COMO-USAR-SELETORES-WEBVIEW.md) 🚀 **LEIA PRIMEIRO (JS/TS)**
**Solução para XPath Verboso no WebView**

**⚠️ PROBLEMA:** XPaths muito longos como:
```
//android.webkit.WebView/.../android.view.View[2]/android.widget.EditText[1]
```

**✅ SOLUÇÃO:** Use **UiSelector** em vez de XPath no WebView do Capacitor.

Este documento mostra:
- ✅ Como usar UiSelector para WebView
- ✅ Mapeamento HTML → Appium (data-testid, aria-label, placeholder)
- ✅ Exemplos práticos para Login e SignUp
- ✅ Todos os seletores prontos para usar

**Quando usar:** **LEIA PRIMEIRO** se você está tendo problemas com XPath verboso no Appium.

---

### 2. [SELETORES-WEBVIEW-APPIUM.md](./SELETORES-WEBVIEW-APPIUM.md) 📖 **GUIA COMPLETO**
**Documentação Completa para WebView**

Guia completo e detalhado sobre seletores Appium para WebView:
- ✅ Por que XPath é verboso no WebView
- ✅ Estratégias de seletores (UiSelector, description, text)
- ✅ Todos os seletores documentados (Login, SignUp)
- ✅ Exemplos completos de testes
- ✅ Debugging e troubleshooting

**Quando usar:** Leia para entender completamente como funcionam os seletores no WebView.

---

### 3. [APPIUM-SELETORES-ANDROID.md](./APPIUM-SELETORES-ANDROID.md) ⭐
**Guia Completo para Appium Android (Nativo)**

Este é o documento **PRINCIPAL** para automação com Appium em apps nativos. Contém:
- ✅ Hierarquia de prioridade específica para Appium
- ✅ Resource ID, Accessibility ID, UiSelector, UiScrollable
- ✅ Exemplos práticos com código Appium/WebDriverIO
- ✅ Melhores práticas baseadas na documentação oficial
- ✅ Troubleshooting comum

**Quando usar:** Para apps nativos Android (não WebView).

> **Referência:** [Appium UiAutomator UiSelector Guide](https://github.com/appium/appium-uiautomator2-driver/blob/master/docs/uiautomator-uiselector.md)

---

### 2. [SELETORES-MOBILE-BOAS-PRATICAS.md](./SELETORES-MOBILE-BOAS-PRATICAS.md)
**Guia Geral de Melhores Práticas**

Guia geral para seletores mobile (não específico de Appium). Contém:
- ✅ Hierarquia de prioridade para seletores
- ✅ Padrões de nomenclatura
- ✅ Exemplos de uso de IDs, XPath e UiSelector
- ✅ Estrutura de nomenclatura por tipo de elemento
- ✅ Checklist de implementação

**Quando usar:** Leia este documento para entender padrões gerais de seletores.

---

### 2. [TEMPLATE-SELETORES-MOBILE.md](./TEMPLATE-SELETORES-MOBILE.md)
**Template Reutilizável para Documentação**

Template padronizado para documentar seletores de cada tela do aplicativo.

**Quando usar:** 
- Ao criar documentação para uma nova tela
- Ao atualizar documentação de uma tela existente
- Para manter consistência na documentação

**Como usar:**
1. Copie o template
2. Preencha com os seletores da tela
3. Documente fluxos de teste
4. Adicione ao repositório

---

### 3. [EXEMPLOS-SELETORES-PIX.md](./EXEMPLOS-SELETORES-PIX.md)
**Exemplo Prático Completo - Tela PIX**

Exemplo completo e detalhado de como documentar seletores de uma tela específica, usando a tela PIX como referência.

**Quando usar:**
- Como referência ao documentar outras telas
- Para entender o padrão esperado
- Para ver exemplos práticos de implementação

**Contém:**
- ✅ Todos os elementos da tela PIX documentados
- ✅ Seletores com 3 níveis de prioridade cada
- ✅ Exemplos de código de teste
- ✅ Fluxos de teste completos

---

## 🚀 Início Rápido

### ⚠️ Problema com XPath Verboso?

**Se você está vendo XPaths muito longos no Appium:**
1. **Leia primeiro:** [COMO-USAR-SELETORES-WEBVIEW.md](./COMO-USAR-SELETORES-WEBVIEW.md) 🚀
2. **Guia completo:** [SELETORES-WEBVIEW-APPIUM.md](./SELETORES-WEBVIEW-APPIUM.md)

### Para Desenvolvedores

1. **Leia primeiro:** [COMO-USAR-SELETORES-WEBVIEW.md](./COMO-USAR-SELETORES-WEBVIEW.md) 🚀
2. **Veja exemplo:** [EXEMPLOS-SELETORES-PIX.md](./EXEMPLOS-SELETORES-PIX.md)
3. **Use template:** [TEMPLATE-SELETORES-MOBILE.md](./TEMPLATE-SELETORES-MOBILE.md) para documentar sua tela

### Para QA/Testes (Appium)

1. **Leia primeiro:** [COMO-USAR-SELETORES-WEBVIEW.md](./COMO-USAR-SELETORES-WEBVIEW.md) 🚀
2. **Guia completo:** [SELETORES-WEBVIEW-APPIUM.md](./SELETORES-WEBVIEW-APPIUM.md)
3. **Entenda padrões:** [SELETORES-MOBILE-BOAS-PRATICAS.md](./SELETORES-MOBILE-BOAS-PRATICAS.md)
4. **Veja exemplos:** [EXEMPLOS-SELETORES-PIX.md](./EXEMPLOS-SELETORES-PIX.md)
5. **Use seletores:** Consulte a documentação específica de cada tela

---

## 📋 Checklist de Implementação por Tela

Ao documentar uma nova tela, certifique-se de:

- [ ] Ler o guia de melhores práticas
- [ ] Usar o template padronizado
- [ ] Documentar todos os elementos interativos
- [ ] Fornecer 3 níveis de seletores (ID, UIAutomator, XPath)
- [ ] Incluir exemplos de código de teste
- [ ] Documentar fluxos de teste principais
- [ ] Seguir padrão de nomenclatura
- [ ] Validar que os seletores funcionam

---

## 🎯 Hierarquia de Prioridade (Resumo)

1. **ID único** (`data-testid` ou `id` HTML) - **PREFERENCIAL**
2. **-android uiautomator** - Para elementos nativos Android
3. **XPath relativo** - Quando IDs não estão disponíveis
4. **XPath absoluto** - Último recurso (evitar)

---

## 📐 Padrão de Nomenclatura (Resumo)

```
[componente]-[tipo]-[identificador]
```

**Exemplos:**
- `pix-input-key` - Input de chave PIX
- `pix-submit-button` - Botão de enviar
- `login-input-cpf` - Input de CPF no login
- `home-balance-card` - Card de saldo na home

---

## 📝 Telas Documentadas

- ✅ [Login](./EXEMPLOS-SELETORES-LOGIN.md) - Tela de Login (CPF, Senha, Botões, Links)
- ✅ [PIX](./EXEMPLOS-SELETORES-PIX.md) - Transferência PIX
- ⏳ Home/Dashboard - Pendente
- ⏳ Perfil - Pendente
- ⏳ Extrato - Pendente
- ⏳ Shop - Pendente

---

## 🔄 Atualizações

- **2025-01-27 (v3.0):** Solução para XPath Verboso no WebView 🚀
  - ⭐ Novo: [COMO-USAR-SELETORES-WEBVIEW.md](./COMO-USAR-SELETORES-WEBVIEW.md) - Guia rápido
  - ⭐ Novo: [SELETORES-WEBVIEW-APPIUM.md](./SELETORES-WEBVIEW-APPIUM.md) - Guia completo
  - ✅ Solução: Use UiSelector em vez de XPath no WebView
  - ✅ Mapeamento: HTML (data-testid, aria-label) → Appium (description, text)
  - ✅ Exemplos: Todos os seletores para Login e SignUp
  - ✅ Estrutura HTML simplificada para reduzir profundidade da árvore

- **2025-01-27 (v2.1):** Documentação da tela de Login
  - ✅ Novo: Exemplos completos de seletores para Login
  - ✅ Inclui: CPF, Senha, Botões, Links, Mensagens de erro
  - ✅ Todos os tipos de seletores: Resource ID, Accessibility ID, UiSelector, XPath
  - ✅ Fluxos de teste completos
  - ✅ Seletores funcionando com código atual documentados

- **2025-01-27 (v2.0):** Documentação atualizada para Appium
  - ⭐ Novo: Guia completo Appium Android
  - Atualizado: UiSelector e UiScrollable detalhados
  - Melhorado: Exemplos práticos com código Appium
  - Referência oficial do Appium adicionada

- **2025-01-27 (v1.0):** Documentação inicial criada
  - Guia de melhores práticas
  - Template reutilizável
  - Exemplo completo (PIX)

---

## 📞 Suporte

Para dúvidas ou sugestões sobre seletores:
1. Consulte primeiro a documentação
2. Verifique exemplos existentes
3. Entre em contato com a equipe de QA/Desenvolvimento

---

**Última atualização:** 2025-01-27  
**Versão:** 1.0.0

