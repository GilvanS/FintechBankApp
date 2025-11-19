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

---

## Anexo: Conteúdo de `MOBILE/src/data/mockData.ts`

```typescript
import { User, Story, PurchasedItem } from '../types';

const pastDate = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
};

export const MOCK_USERS: User[] = [
    {
        cpf: '11111111111',
        fullName: 'Admin User',
        username: 'admin',
        profileDescription: 'Fintech administrator account.',
        email: 'admin@fintech.com',
        password: 'admin',
        balance: 10000,
        transactions: [],
        isBlocked: false,
        role: 'admin',
        pixDailyLimit: 10000,
        pixKeys: [{type: 'EMAIL', key: 'admin@fintech.com'}],
        pixContacts: [],
        limitIncreaseRequest: null,
        showStoriesPopup: true,
        purchasedItems: [],
        creditCard: {
            number: '**** **** **** 1111',
            dueDate: '10/12',
            invoiceDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 10).toISOString(),
            currentInvoice: 150.75,
            closedInvoice: 0,
            availableLimit: 4849.25,
            totalLimit: 5000,
            pointsBalance: 500,
            isBlocked: false,
            transactions: [],
            closedTransactions: [],
        }
    },
    {
        cpf: '22222222222',
        fullName: 'Beatriz Oliveira',
        username: 'biaoliveira',
        profileDescription: 'Explorando o mundo das finanças.',
        email: 'beatriz@example.com',
        password: '123',
        balance: 2580.50,
        transactions: [
             { id: 'tx-1', type: 'PIX_RECEIVED', amount: 50, date: new Date().toISOString(), description: 'Presente', from: '33333333333', senderName: 'Carlos Souza' },
             { id: 'tx-2', type: 'PAYMENT', amount: -35.90, date: new Date(Date.now() - 86400000 * 2).toISOString(), description: 'Cafeteria' },
        ],
        isBlocked: false,
        role: 'user',
        pixDailyLimit: 2000,
        pixKeys: [{type: 'EMAIL', key: 'beatriz@example.com'}],
        pixContacts: [{name: 'Carlos Souza', key: 'carlos@example.com'}],
        limitIncreaseRequest: null,
        showStoriesPopup: true,
        purchasedItems: [],
        creditCard: {
            number: '**** **** **** 2222',
            dueDate: '20/12',
            invoiceDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 20).toISOString(),
            currentInvoice: 250.75,
            closedInvoice: 830.99,
            availableLimit: 1749.25,
            totalLimit: 2000,
            pointsBalance: 230,
            isBlocked: false,
            transactions: [
                 { id: 'ctx-b-1', date: pastDate(5), merchant: 'Supermercado Pão de Mel', amount: 120.50, type: 'CREDIT' },
                 { id: 'ctx-b-2', date: pastDate(10), merchant: 'Restaurante Sabor Divino', amount: 80.00, type: 'CREDIT' },
                 { id: 'ctx-b-inst-1', date: pastDate(12), merchant: 'Loja de Roupas', amount: 50.25, type: 'CREDIT', installments: '1/3' },
            ],
            closedTransactions: [
                 { id: 'ctx-b-3', date: pastDate(35), merchant: 'Loja de Roupas Chic', amount: 300.00, type: 'CREDIT' },
                 { id: 'ctx-b-4', date: pastDate(40), merchant: 'Uber', amount: 30.99, type: 'CREDIT' },
            ],
        }
    },
    {
        cpf: '33333333333',
        fullName: 'Daniel Costa',
        username: 'danielcosta',
        profileDescription: 'Amante de tecnologia e finanças.',
        email: 'daniel@example.com',
        password: '123',
        balance: 1500.00,
        transactions: [],
        isBlocked: false,
        role: 'user',
        pixDailyLimit: 1500,
        pixKeys: [{ type: 'CPF', key: '33333333333' }],
        pixContacts: [],
        limitIncreaseRequest: null,
        showStoriesPopup: false,
        purchasedItems: [],
        creditCard: {
            number: '**** **** **** 3333',
            dueDate: '05/12',
            invoiceDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5).toISOString(),
            closedInvoiceDueDate: pastDate(5), // 5 days overdue
            currentInvoice: 125.40,
            closedInvoice: 550.25,
            availableLimit: 2449.75,
            totalLimit: 3000,
            pointsBalance: 120,
            isBlocked: false, // Not blocked, just overdue
            transactions: [
                 { id: 'ctx-d-1', date: pastDate(2), merchant: 'Cinema', amount: 60.00, type: 'CREDIT' },
            ],
            closedTransactions: [
                 { id: 'ctx-d-2', date: pastDate(32), merchant: 'Amazon BR', amount: 250.25, type: 'CREDIT' },
                 { id: 'ctx-d-3', date: pastDate(45), merchant: 'Posto Shell', amount: 300.00, type: 'CREDIT' },
            ],
        }
    },
    {
        cpf: '44444444444',
        fullName: 'Fernanda Lima',
        username: 'fernandalima',
        profileDescription: 'Viajando e gerenciando minhas finanças.',
        email: 'fernanda@example.com',
        password: '123',
        balance: 800.75,
        transactions: [],
        isBlocked: false,
        role: 'user',
        pixDailyLimit: 2500,
        pixKeys: [{ type: 'EMAIL', key: 'fernanda@example.com' }],
        pixContacts: [],
        limitIncreaseRequest: null,
        showStoriesPopup: true,
        purchasedItems: [],
        creditCard: {
            number: '**** **** **** 4444',
            dueDate: '15/12',
            invoiceDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15).toISOString(),
            closedInvoiceDueDate: pastDate(35), // 35 days overdue, causing the block
            currentInvoice: 0,
            closedInvoice: 1230.80,
            availableLimit: 769.20,
            totalLimit: 2000,
            pointsBalance: 410,
            isBlocked: true, // Card is blocked
            transactions: [],
            closedTransactions: [
                 { id: 'ctx-f-1', date: pastDate(40), merchant: 'Decolar.com', amount: 980.50, type: 'CREDIT' },
                 { id: 'ctx-f-2', date: pastDate(50), merchant: 'Restaurante', amount: 250.30, type: 'CREDIT' },
            ],
        }
    }
];

export const MOCK_STORIES: Story[] = [
    {
        title: "Segurança em Dobro",
        description: "Ative a verificação em duas etapas e proteja sua conta ainda mais.",
        icon: "🛡️",
        image: "https://images.pexels.com/photos/60504/security-protection-anti-virus-software-60504.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
    },
    {
        title: "Conheça o PIX no Crédito",
        description: "Envie PIX mesmo sem saldo na conta, usando seu limite do cartão de crédito.",
        icon: "💳",
        image: "https://images.pexels.com/photos/50987/money-card-business-credit-card-50987.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
    },
    {
        title: "Novidades no Shop",
        description: "Confira as últimas ofertas e ganhe cashback em suas lojas favoritas.",
        icon: "🛍️",
        image: "https://images.pexels.com/photos/3769747/pexels-photo-3769747.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
    },
    {
        title: "Seu Jornal Financeiro",
        description: "Acesse notícias do mercado financeiro e tome decisões mais inteligentes.",
        icon: "📰",
        url: "#",
        image: "https://images.pexels.com/photos/261621/pexels-photo-261621.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
    }
];

export const MOCK_PRODUCTS: PurchasedItem[] = [
    {
        id: 'prod-1',
        name: 'Smartphone Fintech X',
        description: 'O mais novo smartphone com integração total ao nosso ecossistema. Câmera de 108MP, 256GB de armazenamento e tela Super AMOLED.',
        price: 3999.90,
        imageUrl: 'https://images.pexels.com/photos/404280/pexels-photo-404280.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    },
    {
        id: 'prod-2',
        name: 'Fone de Ouvido Bass+',
        description: 'Cancelamento de ruído ativo, 30 horas de bateria e som de alta fidelidade para você curtir suas músicas e podcasts.',
        price: 799.00,
        imageUrl: 'https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    },
    {
        id: 'prod-3',
        name: 'Smartwatch Connect',
        description: 'Monitore sua saúde, receba notificações e pague por aproximação com seu novo smartwatch. Bateria para 7 dias.',
        price: 1499.90,
        imageUrl: 'https://images.pexels.com/photos/110471/pexels-photo-110471.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    },
    {
        id: 'prod-4',
        name: 'Carregador Portátil 20000mAh',
        description: 'Nunca mais fique sem bateria. Carregue até 3 dispositivos ao mesmo tempo com alta velocidade.',
        price: 250.00,
        imageUrl: 'https://images.pexels.com/photos/133505/pexels-photo-133505.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    },
    {
        id: 'prod-5',
        name: 'Audeze Pro Headphones',
        description: 'Fones de ouvido com qualidade de estúdio para audiófilos. Clareza e graves incomparáveis.',
        price: 499.00,
        imageUrl: 'https://images.pexels.com/photos/1649771/pexels-photo-1649771.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    },
    {
        id: 'prod-6',
        name: 'Apex Smartwatch Gen 2',
        description: 'Monitore sua saúde e conecte-se com estilo. GPS integrado e bateria de longa duração.',
        price: 279.00,
        imageUrl: 'https://images.pexels.com/photos/277406/pexels-photo-277406.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    },
    {
        id: 'prod-7',
        name: 'Momentum Pro Camera',
        description: 'Capture momentos com qualidade profissional. Sensor full-frame de 42MP e vídeo em 4K.',
        price: 1299.00,
        imageUrl: 'https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    },
    {
        id: 'prod-8',
        name: 'Barista Express Coffee Maker',
        description: 'Seu café expresso perfeito em casa. Moedor integrado e controle de temperatura preciso.',
        price: 189.00,
        imageUrl: 'https://images.pexels.com/photos/324028/pexels-photo-324028.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    },
    {
        id: 'prod-9',
        name: 'Minimalist Desk Lamp',
        description: 'Design elegante e iluminação ajustável para seu espaço de trabalho. Baixo consumo de energia.',
        price: 75.00,
        imageUrl: 'https://images.pexels.com/photos/1112598/pexels-photo-1112598.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    },
    {
        id: 'prod-10',
        name: 'Jetset Carry-On Luggage',
        description: 'Viaje com estilo e praticidade. Leve, resistente e com compartimentos inteligentes.',
        price: 150.00,
        imageUrl: 'https://images.pexels.com/photos/2082414/pexels-photo-2082414.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    },
    {
        id: 'prod-11',
        name: 'AeroView 4K Drone',
        description: 'Explore o mundo de cima com imagens incríveis. Compacto, seguro e fácil de pilotar.',
        price: 799.00,
        imageUrl: 'https://images.pexels.com/photos/1034608/pexels-photo-1034608.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    },
    {
        id: 'prod-12',
        name: 'ErgoFlex Office Chair',
        description: 'Conforto e ergonomia para longas horas de trabalho. Múltiplos ajustes para sua postura.',
        price: 350.00,
        imageUrl: 'https://images.pexels.com/photos/2762247/pexels-photo-2762247.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    },
];
```

---

## Anexo: Conteúdo de `MOBILE/src/components/Shop.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { MOCK_PRODUCTS } from '../data/mockData';
import { PurchasedItem } from '../types';
import ProductPage from './ProductPage';

// FIX: Updated ShopProps interface to include all necessary handlers from the parent component.
interface ShopProps {
    onBack: () => void;
    onAddToCart: (item: PurchasedItem) => void;
    onInitiatePurchase: (item: PurchasedItem) => void;
    cartItemCount: number;
    onNavigate: (view: string) => void;
}

type ShopView = 'main' | 'product';

// FIX: Updated component signature to accept new props and removed internal state management for cart and purchase flow.
const Shop: React.FC<ShopProps> = ({ onBack, onAddToCart, onInitiatePurchase, cartItemCount, onNavigate }) => {
    const [view, setView] = useState<ShopView>('main');
    const [selectedProduct, setSelectedProduct] = useState<PurchasedItem | null>(null);
    const [products, setProducts] = useState<PurchasedItem[]>([]);

    useEffect(() => {
        // Shuffle products on mount to give a dynamic feel
        setProducts([...MOCK_PRODUCTS].sort(() => Math.random() - 0.5));
    }, []);

    const handleProductClick = (product: PurchasedItem) => {
        setSelectedProduct(product);
        setView('product');
    };

    if (view === 'product' && selectedProduct) {
        // FIX: Passed down `onInitiatePurchase` and `onAddToCart` from props to ProductPage.
        return <ProductPage product={selectedProduct} onBack={() => setView('main')} onPurchase={onInitiatePurchase} onAddToCart={onAddToCart} />;
    }

    return (
        <div className="bg-background-dark text-white min-h-full flex flex-col">
            <header className="flex items-center justify-between p-4 border-b border-subtle-dark/50">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Fintech Shop</h2>
                {/* FIX: Used `onNavigate` and `cartItemCount` from props to handle navigation and cart badge display. */}
                <button onClick={() => onNavigate('shoppingCart')} className="relative p-2 rounded-full hover:bg-white/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    {cartItemCount > 0 && <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-primary text-background-dark text-xs font-bold">{cartItemCount}</span>}
                </button>
            </header>
            <main className="flex-grow overflow-y-auto no-scrollbar p-4">
                <div className="grid grid-cols-2 gap-4">
                    {products.map(product => (
                        <div key={product.id} onClick={() => handleProductClick(product)} className="bg-surface-dark rounded-lg overflow-hidden cursor-pointer group">
                            <img src={product.imageUrl} alt={product.name} className="w-full h-32 object-cover group-hover:opacity-80 transition-opacity" />
                            <div className="p-3">
                                <h3 className="font-semibold text-white truncate">{product.name}</h3>
                                <p className="text-sm text-primary font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default Shop;
```
