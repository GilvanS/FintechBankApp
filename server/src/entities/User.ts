export interface User {
    cpf: string;
    full_name: string;
    email: string;
    password_hash: string;
    balance: number;
    login_attempts: number;
    is_blocked: boolean;
    pix_daily_limit: number;
    password_reset_requested: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface CreateUserRequest {
    cpf: string;
    full_name: string;
    email: string;
    password: string;
}

export interface LoginRequest {
    cpf: string;
    password: string;
}