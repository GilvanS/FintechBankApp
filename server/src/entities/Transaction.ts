export interface Transaction {
    id: string;
    type: string;
    amount: number;
    description: string;
    from_cpf: string;
    to_cpf: string;
    to_key: string;
    created_at: Date;
}

export interface CreateTransactionRequest {
    type: string;
    amount: number;
    description: string;
    from_cpf: string;
    to_cpf: string;
    to_key: string;
}

export interface PixTransactionRequest {
    fromCpf: string;
    toKey: string;
    amount: number;
    description: string;
}