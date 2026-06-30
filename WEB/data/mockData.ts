import { User, Story, PurchasedItem } from '../types';

const pastDate = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
};

export const MOCK_USERS: User[] = [
    {
        cpf: '11111111111',
        fullName: 'Gilvan Sousa',
        username: 'gilvansousa',
        profileDescription: 'Cliente Fintech.',
        email: 'gilvan@example.co',
        password: 'admin999',
        balance: 5000,
        transactions: [
            { id: 'rec-1-1', type: 'PAYMENT', amount: -45.90, date: pastDate(5), description: 'Netflix' },
            { id: 'rec-1-2', type: 'PAYMENT', amount: -45.90, date: pastDate(35), description: 'Netflix' },
            { id: 'rec-1-3', type: 'PAYMENT', amount: -45.90, date: pastDate(65), description: 'Netflix' },
            { id: 'rec-2-1', type: 'PAYMENT', amount: -21.90, date: pastDate(10), description: 'Spotify' },
            { id: 'rec-2-2', type: 'PAYMENT', amount: -21.90, date: pastDate(40), description: 'Spotify' },
            { id: 'rec-2-3', type: 'PAYMENT', amount: -21.90, date: pastDate(70), description: 'Spotify' },
        ],
        isBlocked: false,
        role: 'user',
        pixDailyLimit: 2000,
        pixKeys: [{type: 'EMAIL', key: 'gilvan@example.co'}],
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
        fullName: 'Sheila Sousa',
        username: 'sheilasousa',
        profileDescription: 'Cliente Fintech.',
        email: 'sheila@test.com',
        password: 'admin999',
        balance: 5000,
        transactions: [
             { id: 'tx-1', type: 'PIX_RECEIVED', amount: 50, date: new Date().toISOString(), description: 'Presente', from: '33333333333', senderName: 'Carlos Souza' },
             { id: 'tx-2', type: 'PAYMENT', amount: -35.90, date: new Date(Date.now() - 86400000 * 2).toISOString(), description: 'Cafeteria' },
             { id: 'rec-3-1', type: 'PAYMENT', amount: -55.90, date: pastDate(3), description: 'Netflix Premium' },
             { id: 'rec-3-2', type: 'PAYMENT', amount: -55.90, date: pastDate(33), description: 'Netflix Premium' },
             { id: 'rec-4-1', type: 'PAYMENT', amount: -39.90, date: pastDate(15), description: 'Amazon Prime' },
             { id: 'rec-4-2', type: 'PAYMENT', amount: -39.90, date: pastDate(45), description: 'Amazon Prime' },
        ],
        isBlocked: false,
        role: 'user',
        pixDailyLimit: 2000,
        pixKeys: [{type: 'EMAIL', key: 'sheila@test.com'}],
        pixContacts: [],
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
        fullName: 'Jean Sousa',
        username: 'jeansousa',
        profileDescription: 'Cliente Fintech.',
        email: 'jean@test.com',
        password: 'admin999',
        balance: 5000,
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
        cpf: '99999999999',
        fullName: 'admin',
        username: 'admin',
        profileDescription: 'Administrador Fintech.',
        email: 'admin@test.com',
        password: 'admin999',
        balance: 5000,
        transactions: [
            { id: 'rec-5-1', type: 'PAYMENT', amount: -27.90, date: pastDate(2), description: 'HBO Max' },
            { id: 'rec-5-2', type: 'PAYMENT', amount: -27.90, date: pastDate(32), description: 'HBO Max' },
            { id: 'rec-5-3', type: 'PAYMENT', amount: -27.90, date: pastDate(62), description: 'HBO Max' },
            { id: 'rec-6-1', type: 'PAYMENT', amount: -19.90, date: pastDate(12), description: 'Spotify' },
            { id: 'rec-6-2', type: 'PAYMENT', amount: -19.90, date: pastDate(42), description: 'Spotify' },
        ],
        isBlocked: false,
        role: 'admin',
        pixDailyLimit: 10000,
        pixKeys: [{ type: 'EMAIL', key: 'admin@test.com' }],
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
        id: 'prod-pet',
        name: 'Plano Pet Premium',
        description: 'Cobertura completa para o seu pet. Consultas, exames, vacinas e emergências 24h em toda a rede credenciada.',
        price: 99.90,
        imageUrl: 'https://images.pexels.com/photos/245035/pexels-photo-245035.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        category: 'Planos',
        cashback: '20% de Cashback'
    },
    {
        id: 'prod-1',
        name: 'Smartphone Fintech X',
        description: 'O mais novo smartphone com integração total ao nosso ecossistema. Câmera de 108MP, 256GB de armazenamento e tela Super AMOLED.',
        price: 3999.90,
        imageUrl: 'https://images.pexels.com/photos/404280/pexels-photo-404280.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        category: 'Eletrônicos',
        cashback: '10% de Cashback'
    },
    {
        id: 'prod-2',
        name: 'Fone de Ouvido Bass+',
        description: 'Cancelamento de ruído ativo, 30 horas de bateria e som de alta fidelidade para você curtir suas músicas e podcasts.',
        price: 799.00,
        imageUrl: 'https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        category: 'Áudio',
        cashback: '5% de Cashback'
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
        imageUrl: 'https://images.pexels.com/photos/5945559/pexels-photo-5945559.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
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