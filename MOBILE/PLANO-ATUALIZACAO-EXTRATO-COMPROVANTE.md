# 📱 Plano de Atualização - Extrato e Comprovante para MOBILE

## 📋 Visão Geral

Este plano documenta todas as atualizações necessárias para portar as funcionalidades de extrato e comprovante do WEB para o MOBILE, incluindo:
- Integração com PostgreSQL através da API
- Componente genérico de comprovante
- Extrato com transações clicáveis
- Busca dinâmica de transações do backend

---

## 🔍 Análise das Diferenças WEB vs MOBILE

### ✅ O que já está no WEB:
1. **TransactionReceipt.tsx** - Componente genérico de comprovante
2. **Statement.tsx** - Com transações clicáveis e busca via API
3. **getUserStatement()** - Implementado em `WEB/services/api.ts` com autenticação
4. Integração com PostgreSQL funcionando

### ❌ O que falta no MOBILE:
1. `getUserStatement()` ainda usa mockApi (linha 602 de `api.ts`)
2. Statement.tsx não busca do backend
3. Não existe TransactionReceipt.tsx
4. Transações não são clicáveis
5. Statement não tem loading state
6. Statement não atualiza após PIX/compras

---

## 📝 Plano de Implementação

### FASE 1: Atualização do Serviço de API
**Objetivo:** Conectar o MOBILE ao backend PostgreSQL

#### 1.1 Implementar `getUserStatement` no `api.ts`
- **Arquivo:** `MOBILE/src/services/api.ts`
- **Ação:** Remover do mockApi e implementar chamada real à API
- **Endpoint:** `GET /users/:cpf/statement`
- **Headers:** Incluir `Authorization: Bearer {token}`
- **Retorno:** `{ success: boolean, transactions?: Transaction[] }`

**Código base:**
```typescript
export async function getUserStatement(cpf: string): Promise<{ success: boolean; message?: string; transactions?: Transaction[] }> {
    try {
        const res = await api.get(`/users/${cpf}/statement`, {
            headers: getAuthHeaders('none'),
        });
        const data = res.data;
        if (data?.success && data?.transactions) {
            return { success: true, transactions: data.transactions };
        }
        return { success: false, message: data?.message || 'Falha ao buscar extrato.' };
    } catch (error: any) {
        if (error?.response?.status === 401) {
            localStorage.removeItem('authToken');
            await Preferences.remove({ key: 'token' });
            return { success: false, message: 'Token inválido ou expirado. Faça login novamente.' };
        }
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao buscar extrato.' };
    }
}
```

#### 1.2 Remover `getUserStatement` do mockApi
- **Arquivo:** `MOBILE/src/services/api.ts` (linha 602)
- **Ação:** Remover da lista de exports do mockApi

---

### FASE 2: Criar Componente TransactionReceipt
**Objetivo:** Comprovante genérico para todos os tipos de transação

#### 2.1 Criar `TransactionReceipt.tsx`
- **Arquivo:** `MOBILE/src/components/TransactionReceipt.tsx`
- **Base:** Copiar de `WEB/components/TransactionReceipt.tsx`
- **Adaptações necessárias:**
  - Verificar se `Toast` existe no MOBILE
  - Verificar paths de imports
  - Manter compatibilidade com estilos do MOBILE

#### 2.2 Verificar dependências
- **Toast:** Verificar se `MOBILE/src/components/Toast.tsx` existe
- **Types:** Confirmar que `Transaction` type está completo

---

### FASE 3: Atualizar Componente Statement
**Objetivo:** Extrato com busca dinâmica e transações clicáveis

#### 3.1 Adicionar busca via API
- **Arquivo:** `MOBILE/src/components/Statement.tsx`
- **Mudanças:**
  - Adicionar `useEffect` para buscar extrato quando montar
  - Adicionar `isLoading` state
  - Buscar transações do backend ao invés de usar `user.transactions`

#### 3.2 Tornar transações clicáveis
- Converter `<div>` em `<button>`
- Adicionar `onClick` para abrir comprovante
- Adicionar state `selectedTransaction`

#### 3.3 Adicionar navegação para comprovante
- Renderizar `TransactionReceipt` quando `selectedTransaction` estiver definido
- Permitir voltar para o extrato

#### 3.4 Melhorar experiência do usuário
- Adicionar estado de loading
- Adicionar tratamento de erros
- Adicionar fallback para transações locais se API falhar

---

### FASE 4: Integração com Outros Componentes
**Objetivo:** Atualizar extrato após transações

#### 4.1 Atualizar após PIX
- **Arquivo:** `MOBILE/src/components/Pix.tsx` (se existir)
- **Ou:** Verificar onde PIX é processado
- **Ação:** Chamar `getUserStatement()` após PIX bem-sucedido

#### 4.2 Atualizar após Compras
- **Arquivo:** `MOBILE/src/pages/Home/index.tsx` (linha 189)
- **Ação:** Garantir que `getUserStatement()` é chamado após compras

#### 4.3 Atualizar no Dashboard
- **Arquivo:** `MOBILE/src/components/Dashboard.tsx` (linha 126)
- **Ação:** Verificar se o refresh do extrato está funcionando corretamente

---

### FASE 5: Verificações e Ajustes Finais
**Objetivo:** Garantir compatibilidade e qualidade

#### 5.1 Verificar tipos TypeScript
- Confirmar que `Transaction` type inclui todos os campos necessários:
  - `recipientName?`
  - `senderName?`
  - `toKey?`
  - `merchant?`
  - `category?`
  - `installments?`

#### 5.2 Testar fluxos principais
- [ ] Login e carregar extrato
- [ ] Efetuar PIX e verificar no extrato
- [ ] Efetuar compra e verificar no extrato
- [ ] Clicar em transação e ver comprovante
- [ ] Compartilhar comprovante
- [ ] Voltar do comprovante para extrato

#### 5.3 Verificar estilos mobile
- Garantir que componentes estão responsivos
- Verificar uso correto de classes Tailwind mobile
- Testar em diferentes tamanhos de tela

---

## 📂 Estrutura de Arquivos

### Arquivos a Criar:
```
MOBILE/src/components/
  └── TransactionReceipt.tsx (NOVO)
```

### Arquivos a Modificar:
```
MOBILE/src/services/
  └── api.ts
       ├── Implementar getUserStatement (REAL)
       └── Remover do mockApi exports

MOBILE/src/components/
  └── Statement.tsx
       ├── Adicionar busca via API
       ├── Adicionar loading state
       ├── Tornar transações clicáveis
       └── Adicionar navegação para comprovante

MOBILE/src/components/Pix.tsx (ou onde PIX é processado)
  └── Atualizar extrato após PIX

MOBILE/src/pages/Home/index.tsx
  └── Garantir atualização do extrato após compras
```

---

## 🔧 Detalhes Técnicos

### Endpoint da API
```
GET /users/:cpf/statement
Headers: Authorization: Bearer {token}
Response: {
  success: boolean,
  transactions?: Transaction[]
}
```

### Tipos de Transação Suportados
- `PIX_SENT`
- `PIX_RECEIVED`
- `PIX_CREDIT_SENT`
- `DEPOSIT`
- `PAYMENT`
- `SHOP_DEBIT`
- `CASHBACK_CREDIT`
- `POINTS_EARNED`

### Campos do Transaction (Verificar se todos existem)
```typescript
interface Transaction {
    id: string;
    type: string;
    amount: number;
    date: string;
    description: string;
    to?: string;
    from?: string;
    recipientName?: string;
    senderName?: string;
    toKey?: string;
    merchant?: string;
    category?: string;
    installments?: string;
    totalInstallments?: number;
    currentInstallment?: number;
}
```

---

## ✅ Checklist de Implementação

### Preparação
- [ ] Fazer backup do código atual
- [ ] Verificar se API backend está funcionando com PostgreSQL
- [ ] Confirmar que endpoint `/users/:cpf/statement` está disponível

### Fase 1: API
- [ ] Implementar `getUserStatement()` em `api.ts`
- [ ] Remover `getUserStatement` do mockApi exports
- [ ] Testar chamada à API manualmente

### Fase 2: Componentes
- [ ] Criar `TransactionReceipt.tsx`
- [ ] Verificar e ajustar imports
- [ ] Testar componente isoladamente

### Fase 3: Statement
- [ ] Adicionar busca via API no `Statement.tsx`
- [ ] Adicionar estado de loading
- [ ] Tornar transações clicáveis
- [ ] Integrar com `TransactionReceipt`

### Fase 4: Integrações
- [ ] Atualizar extrato após PIX
- [ ] Atualizar extrato após compras
- [ ] Verificar refresh no Dashboard

### Fase 5: Testes
- [ ] Testar login e carregar extrato
- [ ] Testar PIX e aparecer no extrato
- [ ] Testar compra e aparecer no extrato
- [ ] Testar clique em transação
- [ ] Testar compartilhar comprovante
- [ ] Testar navegação comprovante ↔ extrato

### Build e Deploy
- [ ] Build do APK de teste
- [ ] Testar APK em dispositivo físico
- [ ] Verificar performance
- [ ] Gerar APK final

---

## 🚀 Próximos Passos

1. **Iniciar pela Fase 1** - Implementar `getUserStatement` no API service
2. **Seguir para Fase 2** - Criar componente de comprovante
3. **Avanzar para Fase 3** - Atualizar Statement
4. **Finalizar com Fases 4 e 5** - Integrações e testes

---

## 📝 Notas Importantes

### PostgreSQL
- A API já está configurada para PostgreSQL
- O endpoint `/users/:cpf/statement` já retorna transações normalizadas
- Não é necessário modificar o backend

### Compatibilidade
- Manter compatibilidade com código existente
- Não quebrar funcionalidades existentes
- Usar fallback para mockApi se necessário

### Performance
- Considerar cache de transações se necessário
- Implementar paginação no futuro se houver muitas transações
- Otimizar re-renders desnecessários

---

## 🔗 Referências

- `WEB/components/TransactionReceipt.tsx` - Componente base
- `WEB/components/Statement.tsx` - Implementação de referência
- `WEB/services/api.ts` - Implementação de `getUserStatement`
- `API/index.cjs` - Endpoint `/users/:cpf/statement`

---

**Última atualização:** 2025-01-XX
**Versão:** 1.0.0

