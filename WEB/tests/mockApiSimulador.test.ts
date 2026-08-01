import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adminAcquirerSimulate, initializeMockUsers } from '../services/mockApi';

// Mock localStorage
const localStorageMock = (function () {
    let store: Record<string, string> = {};
    return {
        getItem(key: string) {
            return store[key] || null;
        },
        setItem(key: string, value: string) {
            store[key] = value.toString();
        },
        clear() {
            store = {};
        },
        removeItem(key: string) {
            delete store[key];
        }
    };
})();

Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
});

describe('mockApi - adminAcquirerSimulate', () => {
    beforeEach(async () => {
        localStorage.clear();
        await initializeMockUsers();
    });

    it('should simulate a transaction using the fallback logic when an unknown card is provided', async () => {
        // A massa que o usuário tentou
        const payload = {
            cardNumber: '5981147510881435',
            cvv: '111',
            expiry: '0731',
            pin: '9898',
            amount: 100.00,
            type: 'CREDIT' as const,
            installments: 12,
            description: 'mercado livre'
        };

        const result = await adminAcquirerSimulate(payload);

        // Deve passar com sucesso porque o fallback aplica na conta do admin ou do primeiro user
        expect(result.success).toBe(true);
        expect(result.message).toBe('Transação aprovada com sucesso!');

        // Verifica se a transação foi para o banco mock (localStorage)
        const storeStr = localStorage.getItem('fintech_app_data');
        expect(storeStr).toBeTruthy();
        
        const store = JSON.parse(storeStr!);
        
        // Como '5981147510881435' não bate com nenhum usuário do MOCK_USERS,
        // ele vai cair no fallback (usuário admin)
        const adminUser = store.users.find((u: any) => u.role === 'admin') || store.users[0];
        
        // Verifica se a transaction foi adicionada (12 parcelas)
        expect(adminUser.creditCard.transactions.length).toBeGreaterThanOrEqual(12);
        
        // A primeira transação inserida (posição 0) será a última parcela inserida (mês 12)
        // Mas podemos simplesmente procurar uma que tenha a descrição certa
        const hasMercadoLivre = adminUser.creditCard.transactions.some((tx: any) => tx.merchant === 'mercado livre');
        expect(hasMercadoLivre).toBe(true);
        
        // Verifica o valor da parcela (100 / 12 = 8.3333...)
        const firstTx = adminUser.creditCard.transactions.find((tx: any) => tx.merchant === 'mercado livre');
        expect(firstTx.amount).toBeCloseTo(100.00 / 12);
    });
});
