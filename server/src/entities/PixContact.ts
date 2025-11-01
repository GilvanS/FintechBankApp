export interface PixContact {
    id: string;
    user_cpf: string;
    contact_key: string;
    contact_name: string;
    daily_limit: number;
    created_at: Date;
}

export interface CreatePixContactRequest {
    user_cpf: string;
    contact_key: string;
    contact_name: string;
    daily_limit?: number;
}