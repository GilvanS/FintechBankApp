export interface User {
    id: string;
    name: string;
    email: string;
    balance: number;
    showStoriesPopup?: boolean;
    invoices: Invoice[];
    creditCard: {
        limit: number;
    };
}

export interface Invoice {
    id: string;
    userId: string;
    month: string;
    year: number;
    amount: number;
    status: 'open' | 'closed' | 'paid';
    dueDate: string;
    items: Transaction[];
}

export interface Transaction {
    id: string;
    description: string;
    amount: number;
    date: string;
    category: string;
}

export interface PurchasedItem {
    id: string;
    name: string;
    price: number;
    image: string;
    quantity?: number;
}

// A definição de View foi movida para cá para ser uma fonte única de verdade em toda a aplicação.
export type View = 'home' | 'cards' | 'products' | 'profile' | 'pix' | 'shop' | 'statement' | 'shoppingCart' | 'currentInvoice' | 'closedInvoice';
