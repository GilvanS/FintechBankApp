# Log de Alterações: Integração da Funcionalidade de Loja no Aplicativo Móvel

Este documento resume as etapas e modificações realizadas para portar a seção "Shop" da aplicação web para o aplicativo móvel, incluindo a refatoração do sistema de navegação para garantir uma integração coesa.

---

## 1. Análise e Criação Inicial dos Componentes

**Objetivo:** Replicar a funcionalidade da loja da web no ambiente móvel.

- **Análise da Aplicação Web:** A investigação da pasta `WEB/` revelou que a loja utilizava dados de produtos mockados (`mockData.ts`) e era composta por dois componentes principais: `Shop.tsx` (vitrine) e `ProductPage.tsx` (detalhes do produto).
- **Criação da Estrutura de Dados Móvel:**
    - Criado `MOBILE/src/types.ts` para definir as interfaces de dados.
    - Criado `MOBILE/src/data/mockData.ts` para armazenar os dados dos produtos, replicando a abordagem da web.
- **Criação dos Componentes da Loja Móvel:**
    - Criado `MOBILE/src/components/Shop.tsx`: Uma vitrine de produtos utilizando `FlatList` para exibir os itens.
    - Criado `MOBILE/src/components/ProductPage.tsx`: Uma tela de detalhes para exibir informações completas de um produto selecionado.

*Nota: A implementação inicial destes componentes utilizou hooks (`useNavigation`, `useRoute`) do `@react-navigation/native`, que mais tarde se mostraram incompatíveis com a arquitetura de roteamento do projeto.*

---

## 2. Diagnóstico e Refatoração do Sistema de Navegação

**Objetivo:** Integrar as novas telas da loja à navegação principal e resolver a incompatibilidade de roteamento.

- **Diagnóstico:**
    - A análise de `MOBILE/src/App.tsx` revelou que o aplicativo utiliza o `@ionic/react-router` para a navegação principal, e não o `@react-navigation/native`.
    - O arquivo `MOBILE/src/pages/Home/index.tsx` gerenciava a exibição das seções internas (Home, Cartões, etc.) por meio de um controle de estado (`useState`), uma abordagem que não suportava o aninhamento de rotas necessário para a navegação da loja.

- **Plano de Refatoração:** Substituir o sistema de navegação baseado em estado por um roteador aninhado (`IonRouterOutlet`) para criar um fluxo de navegação robusto e unificado.

- **Execução da Refatoração:**
    1.  **`MOBILE/src/App.tsx`:** A propriedade `exact` foi removida da rota `/home`, permitindo o funcionamento de rotas aninhadas (ex: `/home/shop`).
    2.  **`MOBILE/src/pages/Home/index.tsx`:** O componente foi reescrito para:
        - Utilizar o `<IonRouterOutlet>` para gerenciar as telas internas.
        - Definir rotas aninhadas (`/home/shop`, `/home/cards`, etc.) e adicionar uma nova rota para a página de detalhes do produto: `/home/product/:id`.
        - Atualizar a barra de navegação (`BottomNavBar`) para usar `history.push` em vez de `setState`.
        - Ocultar a `BottomNavBar` na página de detalhes do produto para uma melhor experiência do usuário.

---

## 3. Adaptação dos Componentes da Loja ao Novo Roteamento

**Objetivo:** Fazer com que os componentes `Shop.tsx` e `ProductPage.tsx` utilizem o sistema de roteamento correto.

- **`MOBILE/src/components/Shop.tsx`:**
    - Removidas todas as importações e hooks do `@react-navigation/native`.
    - Adicionado o hook `useHistory` do `react-router-dom`.
    - A função de clique no produto foi atualizada para navegar para a rota `/home/product/:id`, passando o ID do produto como parâmetro na URL.

- **`MOBILE/src/components/ProductPage.tsx`:**
    - Removidos os hooks do `@react-navigation/native`.
    - Adicionados os hooks `useParams` (para obter o ID do produto da URL) e `useHistory` (para o botão "Voltar") do `react-router-dom`.
    - Implementada a lógica para buscar os dados do produto no `MOCK_PRODUCTS` com base no ID recebido.

---

## Conclusão

A funcionalidade da loja foi integrada com sucesso ao aplicativo móvel. O fluxo de navegação, desde a vitrine até a página de detalhes do produto, está totalmente funcional e alinhado com a arquitetura de roteamento principal do aplicativo. As alterações garantem uma experiência de usuário coesa e preparam o terreno para futuras expansões da seção de compras.

---

## Anexo: Conteúdo de `MOBILE/src/types.ts`

```typescript
export interface Transaction {
    id: string;
    type: 'PIX_SENT' | 'PIX_RECEIVED' | 'DEPOSIT' | 'PAYMENT' | 'PIX_CREDIT_SENT' | 'SHOP_DEBIT' | 'CASHBACK_CREDIT' | 'POINTS_EARNED';
    amount: number;
    date: string;
    description: string;
    to?: string;
    from?: string;
    recipientName?: string;
    senderName?: string;
}

export interface CardTransaction {
    id: string;
    date: string;
    merchant: string;
    amount: number;
    type: 'CREDIT' | 'PAYMENT' | 'INVOICE_INSTALLMENT';
    installments?: string;
    totalInstallments?: number;
    currentInstallment?: number;
}

export interface CreditCard {
    number: string;
    dueDate: string;
    invoiceDueDate: string;
    closedInvoiceDueDate?: string; // Added to track due date for closed invoices
    currentInvoice: number;
    closedInvoice: number;
    availableLimit: number;
    totalLimit: number;
    pointsBalance: number;
    isBlocked: boolean;
    transactions: CardTransaction[];
    closedTransactions: CardTransaction[];
}

export interface PixKey {
    type: 'CPF' | 'EMAIL';
    key: string;
}

export interface PixContact {
    name: string;
    key: string;
}

export interface PasswordResetRequest {
    cpf: string;
    status: 'pending' | 'approved' | 'denied';
}

export interface LimitIncreaseRequest {
    cpf: string;
    amount: number;
    status: 'pending' | 'approved' | 'denied';
}

export interface Story {
    title: string;
    description: string;
    icon?: string;
    image?: string;
    url?: string;
}

export interface AppNotification {
    id: number;
    message: string;
    created_at: string;
    is_read: boolean;
}

export interface PurchasedItem {
    id: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    quantity?: number;
    purchaseDate?: string;
    pointsEarned?: number;
}

export interface FixedIncomeProduct {
    id: string;
    name: string;
    issuer: string;
    yield: string;
    minInvestment: number;
    liquidity: string;
}

export interface User {
    cpf: string;
    fullName: string;
    username?: string;
    profileDescription?: string;
    email: string;
    password: string; // This would be hashed in a real app
    balance: number;
    transactions: Transaction[];
    isBlocked: boolean;
    role: 'user' | 'admin';
    pixDailyLimit: number;
    pixKeys: PixKey[];
    pixContacts: PixContact[];
    limitIncreaseRequest: LimitIncreaseRequest | null;
    showStoriesPopup: boolean;
    purchasedItems: PurchasedItem[];
    creditCard: CreditCard;
}
```
