
import { User, CardTransaction } from '../types';

const generateCardTransactions = (): CardTransaction[] => {
    const merchants = ['Uber', 'iFood', 'Amazon', 'Netflix', 'Spotify', 'Padaria Pão Quente', 'Supermercado Dia'];
    const transactions: CardTransaction[] = [];
    for (let i = 0; i < 15; i++) {
        transactions.push({
            id: `ctx-${Date.now()}-${i}`,
            date: new Date(Date.now() - i * 2 * 86400000).toISOString(),
            merchant: merchants[Math.floor(Math.random() * merchants.length)],
            amount: parseFloat((Math.random() * 100 + 10).toFixed(2)),
            type: 'CREDIT',
            installments: Math.random() > 0.8 ? `1/${Math.ceil(Math.random() * 5 + 1)}` : undefined
        });
    }
    return transactions;
};

export const MOCK_USERS: User[] = [
  {
    cpf: '11111111111',
    password: 'admin',
    fullName: 'Admin User',
    email: 'admin@fintech.com',
    balance: 10000,
    transactions: [],
    isBlocked: false,
    role: 'admin',
    pixDailyLimit: 5000,
    pixKeys: [{ type: 'EMAIL', key: 'admin@fintech.com' }],
    pixContacts: [],
    limitIncreaseRequest: null,
    showStoriesPopup: true,
    username: 'admin_user',
    profileDescription: 'I am the administrator of this demo application.',
    purchasedItems: [
        { id: 'prod-a1', name: 'Smartwatch Pro X', price: 899.90, imageUrl: 'https://i.imgur.com/sC5I7oG.png' },
        { id: 'prod-a2', name: 'Câmera de Segurança Inteligente', price: 299.00, imageUrl: 'https://i.imgur.com/G5g3fA0.png' }
    ],
    creditCard: {
        number: '**** **** **** 1234',
        dueDate: '10/11',
        invoiceDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 10).toISOString(),
        currentInvoice: 250.75,
        closedInvoice: 1230.50,
        availableLimit: 4749.25,
        totalLimit: 6000,
        pointsBalance: 5230,
        isBlocked: false,
        transactions: generateCardTransactions().slice(0, 5),
        closedTransactions: generateCardTransactions().slice(5, 10),
    }
  },
  {
    cpf: '22222222222',
    password: 'password',
    fullName: 'João da Silva',
    email: 'joao@example.com',
    balance: 2500.85,
    transactions: [
        { id: 'tx1', type: 'PIX_RECEIVED', amount: 500, date: new Date(Date.now() - 86400000).toISOString(), from: 'Maria Souza', senderName: 'Maria S.', description: 'Aluguel' },
        { id: 'tx2', type: 'PIX_SENT', amount: -150.25, date: new Date(Date.now() - 172800000).toISOString(), to: 'Supermercado', recipientName: 'Supermercado Top', description: 'Compras' }
    ],
    isBlocked: false,
    role: 'user',
    pixDailyLimit: 2000,
    pixKeys: [{ type: 'CPF', key: '22222222222' }],
    pixContacts: [
        { name: 'Maria Souza', key: 'maria@example.com' },
        { name: 'Carlos Pereira', key: '33333333333' }
    ],
    limitIncreaseRequest: null,
    showStoriesPopup: true,
    username: 'joao.silva',
    profileDescription: 'Fintech app user since 2023! Loving the experience.',
    purchasedItems: [
        { id: 'prod-j1', name: 'Fone de Ouvido Bluetooth TWS', price: 199.90, imageUrl: 'https://i.imgur.com/8KW344e.png' },
        { id: 'prod-j2', name: 'Carregador Portátil 10000mAh', price: 99.00, imageUrl: 'https://i.imgur.com/cBuw22s.png' }
    ],
    creditCard: {
        number: '**** **** **** 5678',
        dueDate: '25/10',
        invoiceDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 25).toISOString(),
        currentInvoice: 120.30,
        closedInvoice: 450.80,
        availableLimit: 1879.70,
        totalLimit: 2000,
        pointsBalance: 1200,
        isBlocked: false,
        transactions: generateCardTransactions().slice(0, 3),
        closedTransactions: generateCardTransactions().slice(3, 8),
    }
  },
  {
    cpf: '99999999999',
    password: 'pwd999',
    fullName: 'Maria Teste',
    email: 'maria@teste.com',
    balance: 5000,
    transactions: [
        { id: 'tx-m1', type: 'PIX_RECEIVED', amount: 1200, date: new Date(Date.now() - 2 * 86400000).toISOString(), from: 'Empresa X', senderName: 'Empresa X', description: 'Pagamento Freelance' },
        { id: 'tx-m2', type: 'PIX_SENT', amount: -350.50, date: new Date(Date.now() - 3 * 86400000).toISOString(), to: 'Loja Online', recipientName: 'Loja Online', description: 'Compra de Roupas' }
    ],
    isBlocked: false,
    role: 'user',
    pixDailyLimit: 1500,
    pixKeys: [{ type: 'EMAIL', key: 'maria@teste.com' }],
    pixContacts: [
        { name: 'João da Silva', key: '22222222222' }
    ],
    limitIncreaseRequest: null,
    showStoriesPopup: false,
    username: 'maria.teste',
    profileDescription: 'Usuário de teste para a aplicação Fintech.',
    purchasedItems: [
        { id: 'prod-m1', name: 'Smartwatch Fitness Tracker X2', price: 399.00, imageUrl: 'https://i.imgur.com/sC5I7oG.png' },
    ],
    creditCard: {
        number: '**** **** **** 9999',
        dueDate: '20/11',
        invoiceDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 20).toISOString(),
        currentInvoice: 450.75,
        closedInvoice: 800.00,
        availableLimit: 2549.25,
        totalLimit: 3000,
        pointsBalance: 2500,
        isBlocked: false,
        transactions: generateCardTransactions().slice(0, 4),
        closedTransactions: generateCardTransactions().slice(4, 9),
    }
  }
];
