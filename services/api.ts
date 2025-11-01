const API_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001';

export async function signUp(data: { fullName: string; cpf: string; email: string; password: string; }): Promise<{ success: boolean; message: string; }> {
    try {
        const res = await fetch(`${API_URL}/api/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cpf: data.cpf,
                full_name: data.fullName,
                email: data.email,
                password: data.password
            })
        });

        if (res.ok) {
            return { success: true, message: 'Usuario criado com sucesso' };
        }
        const err = await res.json().catch(() => ({ error: 'Erro inesperado' }));
        return { success: false, message: err.error || 'Erro ao cadastrar' };
    } catch (e: any) {
        return { success: false, message: 'Falha de conexao com a API' };
    }
}

export async function login(cpf: string, password: string): Promise<{ success: boolean; message: string; token?: string; user?: any; }> {
    try {
        const res = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf, password })
        });

        const body = await res.json().catch(() => null);
        if (res.ok) {
            return { success: true, message: 'Login realizado com sucesso', token: body?.token, user: body?.user };
        }
        return { success: false, message: body?.error || 'CPF ou senha invalidos' };
    } catch {
        return { success: false, message: 'Falha de conexao com a API' };
    }
}