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
        cards: [
            {
                id: 'card-1111-phys',
                type: 'PHYSICAL',
                brand: 'MASTERCARD',
                name: 'Volt Black Physical',
                cardNumberMasked: '**** **** **** 1111',
                expirationDate: '08/30',
                isBlocked: false,
                limit: 5000,
                dueDay: 10,
            },
            {
                id: 'card-1111-virt',
                type: 'VIRTUAL',
                brand: 'VISA',
                name: 'Volt Digital Recurring',
                cardNumberMasked: '**** **** **** 8822',
                expirationDate: '12/28',
                isBlocked: false,
                limit: 2500,
                dueDay: 10,
            }
        ],
        creditCard: {
            number: '**** **** **** 1111',
            dueDate: '10/12',
            invoiceDueDate: pastDate(7),
            currentInvoice: 2365.05,
            closedInvoice: 3870.86,
            availableLimit: 2740.68,
            totalLimit: 5000,
            pointsBalance: 500,
            isBlocked: false,
            transactions: [
                { id: 'ctx-1111-1', date: pastDate(2), merchant: 'MERCADO LIVRE', amount: 177.45, type: 'CREDIT', category: 'shopping', installments: '3/10', currentInstallment: 3, totalInstallments: 10, totalAmount: 1774.50, cardNumber: '**** **** **** 1111', authorizationCode: 'AUT-984721' },
                { id: 'ctx-1111-2', date: pastDate(3), merchant: '[SIM] Pet Volt', amount: 191.36, type: 'CREDIT', category: 'shopping', cardNumber: '**** **** **** 1111', authorizationCode: 'AUT-102948' },
                { id: 'ctx-1111-3', date: pastDate(3), merchant: '[SIM] Gamer Store', amount: 188.35, type: 'CREDIT', category: 'shopping', cardNumber: '**** **** **** 1111', authorizationCode: 'AUT-883921' },
                { id: 'ctx-1111-4', date: pastDate(3), merchant: '[SIM] Volt Market', amount: 105.11, type: 'CREDIT', category: 'shopping', cardNumber: '**** **** **** 1111', authorizationCode: 'AUT-492019' },
                { id: 'ctx-1111-5', date: pastDate(5), merchant: 'Coco Bambu Restaurante', amount: 240.00, type: 'CREDIT', category: 'refeicao', cardNumber: '**** **** **** 1111', authorizationCode: 'AUT-773921' },
                { id: 'ctx-1111-6', date: pastDate(7), merchant: 'Posto Shell Combustível', amount: 150.00, type: 'CREDIT', category: 'mobilidade', cardNumber: '**** **** **** 1111', authorizationCode: 'AUT-119382' },
                { id: 'ctx-1111-7', date: pastDate(8), merchant: 'Supercell Games', amount: 19.90, type: 'CREDIT', category: 'outros', installments: 'Faturado no Crédito', cardNumber: '**** **** **** 1111', authorizationCode: 'AUT-339201' },
                { id: 'ctx-1111-8', date: pastDate(10), merchant: 'Amazon.com.br Eletrônicos', amount: 299.00, type: 'CREDIT', category: 'shopping', installments: '2/5', currentInstallment: 2, totalInstallments: 5, totalAmount: 1495.00, cardNumber: '**** **** **** 1111', authorizationCode: 'AUT-554932' },
                { id: 'ctx-1111-9', date: pastDate(12), merchant: 'Uber * Viagem Urbana', amount: 42.80, type: 'CREDIT', category: 'mobilidade', cardNumber: '**** **** **** 1111', authorizationCode: 'AUT-663920' },
                { id: 'ctx-1111-10', date: pastDate(14), merchant: 'iFood * Restaurante Japones', amount: 89.90, type: 'CREDIT', category: 'refeicao', cardNumber: '**** **** **** 1111', authorizationCode: 'AUT-992018' },
            ],
            closedTransactions: [
                { id: 'ctx-1111-closed-0', date: pastDate(32), merchant: 'Smartphone Fintech X', amount: 3599.91, type: 'CREDIT', category: 'shopping', cardNumber: '**** **** **** 1435', authorizationCode: 'AUT-203533' },
                { id: 'ctx-1111-closed-1', date: pastDate(35), merchant: 'ErgoFlex Office Chair', amount: 70.00, type: 'CREDIT', category: 'shopping', cardNumber: '**** **** **** 1435', authorizationCode: 'AUT-449102' },
                { id: 'ctx-1111-closed-2', date: pastDate(36), merchant: 'Minimalist Desk Lamp', amount: 6.25, type: 'CREDIT', category: 'shopping', cardNumber: '**** **** **** 1435', authorizationCode: 'AUT-331092' },
                { id: 'ctx-1111-closed-3', date: pastDate(38), merchant: 'AeroView 4K Drone', amount: 79.90, type: 'CREDIT', category: 'shopping', cardNumber: '**** **** **** 1435', authorizationCode: 'AUT-771920' },
                { id: 'ctx-1111-closed-4', date: pastDate(39), merchant: 'Minimalist Desk Lamp', amount: 15.00, type: 'CREDIT', category: 'shopping', cardNumber: '**** **** **** 1435', authorizationCode: 'AUT-881920' },
                { id: 'ctx-1111-closed-5', date: pastDate(40), merchant: 'Compra shop', amount: 99.80, type: 'CREDIT', category: 'shopping', cardNumber: '**** **** **** 1435', authorizationCode: 'AUT-551029' },
                { id: 'ctx-1111-closed-6', date: pastDate(45), merchant: 'Fast Shop Eletrônicos', amount: 120.00, type: 'CREDIT', category: 'shopping', installments: '1/10', currentInstallment: 1, totalInstallments: 10, totalAmount: 1200.00, cardNumber: '**** **** **** 1435', authorizationCode: 'AUT-883920' },
            ],
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
        category: 'Acessórios',
        cashback: '7% de Cashback'
    },
    {
        id: 'prod-4',
        name: 'Carregador Portátil 20000mAh',
        description: 'Nunca mais fique sem bateria. Carregue até 3 dispositivos ao mesmo tempo com alta velocidade.',
        price: 250.00,
        imageUrl: 'https://images.pexels.com/photos/133505/pexels-photo-133505.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        category: 'Acessórios',
        cashback: '5% de Cashback'
    },
    {
        id: 'prod-5',
        name: 'Audeze Pro Headphones',
        description: 'Fones de ouvido com qualidade de estúdio para audiófilos. Clareza e graves incomparáveis.',
        price: 499.00,
        imageUrl: 'https://images.pexels.com/photos/1649771/pexels-photo-1649771.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        category: 'Áudio',
        cashback: '12% de Cashback'
    },
    {
        id: 'prod-6',
        name: 'Apex Smartwatch Gen 2',
        description: 'Monitore sua saúde e conecte-se com estilo. GPS integrado e bateria de longa duração.',
        price: 279.00,
        imageUrl: 'https://images.pexels.com/photos/277406/pexels-photo-277406.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        category: 'Acessórios',
        cashback: '7% de Cashback'
    },
    {
        id: 'prod-7',
        name: 'Momentum Pro Camera',
        description: 'Capture momentos com qualidade profissional. Sensor full-frame de 42MP e vídeo em 4K.',
        price: 1299.00,
        imageUrl: 'https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        category: 'Fotografia',
        cashback: '6% de Cashback'
    },
    {
        id: 'prod-8',
        name: 'Barista Express Coffee Maker',
        description: 'Seu café expresso perfeito em casa. Moedor integrado e controle de temperatura preciso.',
        price: 189.00,
        imageUrl: 'https://images.pexels.com/photos/324028/pexels-photo-324028.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        category: 'Eletroportáteis',
        cashback: '5% de Cashback'
    },
    {
        id: 'prod-9',
        name: 'Minimalist Desk Lamp',
        description: 'Design elegante e iluminação ajustável para seu espaço de trabalho. Baixo consumo de energia.',
        price: 75.00,
        imageUrl: 'https://images.pexels.com/photos/1112598/pexels-photo-1112598.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        category: 'Iluminação',
        cashback: '4% de Cashback'
    },
    {
        id: 'prod-10',
        name: 'Jetset Carry-On Luggage',
        description: 'Viaje com estilo e praticidade. Leve, resistente e com compartimentos inteligentes.',
        price: 150.00,
        imageUrl: 'https://images.pexels.com/photos/5945559/pexels-photo-5945559.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        category: 'Viagem',
        cashback: '5% de Cashback'
    },
    {
        id: 'prod-11',
        name: 'AeroView 4K Drone',
        description: 'Explore o mundo de cima com imagens incríveis. Compacto, seguro e fácil de pilotar.',
        price: 799.00,
        imageUrl: 'https://images.pexels.com/photos/1034608/pexels-photo-1034608.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        category: 'Drones',
        cashback: '10% de Cashback'
    },
    {
        id: 'prod-12',
        name: 'ErgoFlex Office Chair',
        description: 'Conforto e ergonomia para longas horas de trabalho. Múltiplos ajustes para sua postura.',
        price: 350.00,
        imageUrl: 'https://images.pexels.com/photos/2762247/pexels-photo-2762247.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        category: 'Móveis',
        cashback: '5% de Cashback'
    },
    {
        id: 'prod_1',
        name: 'Smartphone Fintech X',
        description: 'O smartphone mais inteligente para suas finanças. Tela OLED de 120Hz, processador de última geração e segurança bancária por hardware integrada.',
        price: 3999.90,
        imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=600',
        category: 'Eletrônicos',
        cashback: '8% de Cashback'
    },
    {
        id: 'prod_2',
        name: 'Momentum Pro Camera',
        description: 'Capture todos os seus momentos inesquecíveis em resolução 4K com o sensor ultra-sensível e autofoco inteligente baseado em inteligência artificial.',
        price: 1299.00,
        imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=600',
        category: 'Fotografia',
        cashback: '6% de Cashback'
    },
    {
        id: 'prod_3',
        name: 'AeroView 4K Drone',
        description: 'Estabilidade perfeita e transmissão em tempo real. Voe alto e grave takes cinemáticos incríveis com facilidade de controle automático.',
        price: 799.00,
        imageUrl: 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?auto=format&fit=crop&q=80&w=600',
        category: 'Drones',
        cashback: '10% de Cashback'
    },
    {
        id: 'prod_4',
        name: 'ErgoFlex Office Chair',
        description: 'Design ergonômico premiado para longas horas de produtividade ou jogos. Ajuste lombar dinâmico e materiais respiráveis de alta qualidade.',
        price: 350.00,
        imageUrl: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&q=80&w=600',
        category: 'Móveis',
        cashback: '5% de Cashback'
    },
    {
        id: 'prod_5',
        name: 'Audeze Pro Headphones',
        description: 'Áudio de estúdio de alta fidelidade e cancelamento de ruído ativo inteligente. Experimente cada nota com perfeição e imersão completa.',
        price: 499.00,
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600',
        category: 'Áudio',
        cashback: '12% de Cashback'
    },
    {
        id: 'prod_6',
        name: 'Minimalist Desk Lamp',
        description: 'Luminária minimalista com ajuste de temperatura de cor inteligente e base de carregamento rápido sem fio integrada para seu smartphone.',
        price: 75.00,
        imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&q=80&w=600',
        category: 'Iluminação',
        cashback: '4% de Cashback'
    },
    {
        id: 'prod_7',
        name: 'Fone de Ouvido Bass+',
        description: 'Graves profundos e bateria que dura a semana toda. Ideal para treinos intensos com proteção IPX7 contra água e suor.',
        price: 199.00,
        imageUrl: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&q=80&w=600',
        category: 'Áudio',
        cashback: '10% de Cashback'
    },
    {
        id: 'prod_8',
        name: 'Apex Smartwatch Gen 2',
        description: 'Monitore seus batimentos, sono e exercícios diários. Notificações do celular diretamente no seu pulso em uma tela de alta definição.',
        price: 279.00,
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600',
        category: 'Acessórios',
        cashback: '7% de Cashback'
    },
    {
        id: 'prod_9',
        name: 'Jetset Carry-On Luggage',
        description: 'Mala de bordo ultraleve e extremamente resistente. Rodinhas 360 graus ultra-silenciosas e compartimento inteligente de fácil acesso.',
        price: 180.00,
        imageUrl: 'https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?auto=format&fit=crop&q=80&w=600',
        category: 'Viagem',
        cashback: '5% de Cashback'
    },
];