# ✅ Checklist de Implementação - Extrato e Comprovante MOBILE

## 📋 Checklist Detalhado

### 🔧 FASE 1: API Service
**Arquivo:** `MOBILE/src/services/api.ts`

- [ ] **1.1** Implementar função `getUserStatement()` real
  - [ ] Criar função com axios.get
  - [ ] Endpoint: `/users/:cpf/statement`
  - [ ] Headers: Authorization Bearer token
  - [ ] Tratamento de erro 401 (token expirado)
  - [ ] Retorno: `{ success: boolean, transactions?: Transaction[] }`

- [ ] **1.2** Remover do mockApi exports
  - [ ] Remover `getUserStatement` da linha 602
  - [ ] Garantir que função real seja exportada

- [ ] **1.3** Testar função
  - [ ] Testar chamada manualmente
  - [ ] Verificar retorno correto
  - [ ] Verificar tratamento de erros

---

### 🎨 FASE 2: Componente TransactionReceipt
**Arquivo:** `MOBILE/src/components/TransactionReceipt.tsx` (NOVO)

- [ ] **2.1** Criar arquivo
  - [ ] Copiar base de `WEB/components/TransactionReceipt.tsx`
  - [ ] Ajustar imports para MOBILE
  - [ ] Importar Toast corretamente

- [ ] **2.2** Verificar compatibilidade
  - [ ] Toast: `useToast()` existe e funciona
  - [ ] Types: Transaction tem todos os campos
  - [ ] Estilos: Compatíveis com mobile

- [ ] **2.3** Testar componente
  - [ ] Renderizar isoladamente
  - [ ] Testar com diferentes tipos de transação
  - [ ] Testar compartilhamento

---

### 📱 FASE 3: Atualizar Statement Component
**Arquivo:** `MOBILE/src/components/Statement.tsx`

- [ ] **3.1** Adicionar imports necessários
  - [ ] `useEffect` do React
  - [ ] `getUserStatement` do api.ts
  - [ ] `TransactionReceipt` component

- [ ] **3.2** Adicionar estados
  - [ ] `const [transactions, setTransactions] = useState<Transaction[]>([])`
  - [ ] `const [isLoading, setIsLoading] = useState(true)`
  - [ ] `const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)`

- [ ] **3.3** Implementar busca via API
  - [ ] `useEffect` para buscar ao montar componente
  - [ ] Buscar quando `user.cpf` mudar
  - [ ] Atualizar `transactions` state
  - [ ] Gerenciar `isLoading` state

- [ ] **3.4** Adicionar loading state
  - [ ] Mostrar "Carregando..." quando `isLoading === true`
  - [ ] Esconder lista durante carregamento

- [ ] **3.5** Tornar transações clicáveis
  - [ ] Converter `<div>` em `<button>` para cada transação
  - [ ] Adicionar `onClick={() => setSelectedTransaction(tx)}`
  - [ ] Adicionar cursor pointer
  - [ ] Manter estilos visuais

- [ ] **3.6** Integrar comprovante
  - [ ] Renderizar condicionalmente `TransactionReceipt`
  - [ ] Se `selectedTransaction` existe, mostrar comprovante
  - [ ] `onBack={() => setSelectedTransaction(null)}`
  - [ ] Esconder lista quando comprovante está aberto

- [ ] **3.7** Fallback e tratamento de erros
  - [ ] Se API falhar, usar `user.transactions` como fallback
  - [ ] Tratar erros silenciosamente (não quebrar UI)
  - [ ] Log de erros no console para debug

---

### 🔄 FASE 4: Integrações
**Objetivo:** Atualizar extrato após transações

#### 4.1 Atualizar após PIX
**Arquivo:** `MOBILE/src/components/Pix.tsx` (ou onde PIX é processado)

- [ ] Localizar onde PIX é confirmado/sucedido
- [ ] Após sucesso, chamar `getUserStatement(user.cpf)`
- [ ] Atualizar estado do usuário com novas transações

#### 4.2 Atualizar após Compras
**Arquivo:** `MOBILE/src/pages/Home/index.tsx`

- [ ] Verificar linha ~189 onde compra atualiza extrato
- [ ] Garantir que `getUserStatement()` está sendo chamado
- [ ] Verificar se está funcionando para compras no débito

#### 4.3 Verificar Dashboard
**Arquivo:** `MOBILE/src/components/Dashboard.tsx`

- [ ] Verificar useEffect linha ~126
- [ ] Confirmar que refresh do extrato funciona
- [ ] Testar ao entrar na view 'statement'

---

### 🧪 FASE 5: Testes

#### 5.1 Testes Funcionais
- [ ] **Login e Extrato**
  - [ ] Fazer login
  - [ ] Acessar extrato
  - [ ] Verificar se transações carregam
  - [ ] Verificar loading state

- [ ] **PIX**
  - [ ] Efetuar PIX enviado
  - [ ] Verificar se aparece no extrato
  - [ ] Efetuar PIX recebido
  - [ ] Verificar se aparece no extrato

- [ ] **Compras**
  - [ ] Efetuar compra no débito
  - [ ] Verificar se aparece no extrato
  - [ ] Efetuar compra no crédito
  - [ ] Verificar se aparece (se aplicável)

- [ ] **Comprovante**
  - [ ] Clicar em transação PIX
  - [ ] Verificar comprovante PIX
  - [ ] Clicar em transação de compra
  - [ ] Verificar comprovante de compra
  - [ ] Testar outros tipos de transação

- [ ] **Navegação**
  - [ ] Voltar do comprovante para extrato
  - [ ] Navegar entre extrato e outras telas
  - [ ] Verificar que dados persistem

- [ ] **Compartilhamento**
  - [ ] Tentar compartilhar comprovante
  - [ ] Verificar se funciona (Web Share API)
  - [ ] Verificar fallback (copiar para clipboard)

#### 5.2 Testes de UI/UX
- [ ] Loading states aparecem corretamente
- [ ] Erros não quebram a interface
- [ ] Transições suaves entre telas
- [ ] Responsividade em diferentes tamanhos de tela
- [ ] Performance adequada (sem lag)

#### 5.3 Testes de Integração
- [ ] API conecta corretamente
- [ ] Autenticação funciona
- [ ] Dados são atualizados após transações
- [ ] Sincronização entre telas funciona

---

### 📦 FASE 6: Build e Deploy

- [ ] **Build de Desenvolvimento**
  - [ ] `npm run build`
  - [ ] Verificar se build é bem-sucedido
  - [ ] Verificar warnings (se houver)

- [ ] **Teste Local**
  - [ ] Testar no navegador (dev mode)
  - [ ] Verificar console por erros
  - [ ] Testar funcionalidades principais

- [ ] **Build APK de Teste**
  - [ ] Gerar APK de desenvolvimento
  - [ ] Instalar em dispositivo físico
  - [ ] Testar todas as funcionalidades
  - [ ] Verificar conectividade com API

- [ ] **Correções**
  - [ ] Corrigir bugs encontrados
  - [ ] Re-testar após correções

- [ ] **Build APK Final**
  - [ ] Build de produção
  - [ ] Assinar APK (se necessário)
  - [ ] Testar APK final
  - [ ] Preparar para distribuição

---

## 🔍 Verificações Adicionais

### TypeScript
- [ ] Sem erros de tipo
- [ ] Todos os imports corretos
- [ ] Types compatíveis entre WEB e MOBILE

### Performance
- [ ] Sem memory leaks
- [ ] Re-renders otimizados
- [ ] API calls não excessivas

### Acessibilidade
- [ ] Botões têm labels adequados
- [ ] Navegação por teclado funciona (se aplicável)
- [ ] Contraste adequado

---

## 📝 Documentação

- [ ] Atualizar README se necessário
- [ ] Documentar mudanças no código
- [ ] Atualizar changelog

---

## ✅ Critérios de Conclusão

A implementação está completa quando:

1. ✅ `getUserStatement()` conecta ao backend PostgreSQL
2. ✅ Extrato busca e exibe transações do backend
3. ✅ Transações são clicáveis
4. ✅ Comprovante genérico funciona para todos os tipos
5. ✅ Extrato atualiza após PIX e compras
6. ✅ Todos os testes passam
7. ✅ APK builda sem erros
8. ✅ APK testado em dispositivo físico funciona

---

**Status:** 🔴 Não iniciado  
**Última atualização:** 2025-01-XX





