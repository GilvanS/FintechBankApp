import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import TransactionReceipt from '../components/TransactionReceipt';

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'u1', fullName: 'Gilvan Sousa', cpf: '11111111111' },
        logout: vi.fn(),
    })
}));

vi.mock('../components/Toast', () => ({
    useToast: () => ({ toast: null, showSuccess: vi.fn(), showError: vi.fn(), hide: vi.fn() }),
    ToastContainer: () => <div data-testid="toast-container" />,
}));

const baseTx = {
    id: 'tx-1234567890',
    date: '2026-08-10T14:30:00.000Z',
    amount: -523.15,
    type: 'SHOP_CREDIT',
    merchant: 'Magazine Luiza',
    description: 'Compra shop (credito)',
};

describe('TransactionReceipt — Art. 52 CDC', () => {
    it('exibe o bloco art. 52 quando jurosTotal > 0 (parcelado com juros)', () => {
        render(
            <TransactionReceipt
                onBack={() => {}}
                transaction={{
                    ...baseTx,
                    // Campos anexados pelo backend via buildJurosPayload (enrichUserCreditCardData)
                    originalAmount: 400,
                    jurosTotal: 123.15,
                    interestRate: 0.05,
                    totalParcelado: 523.15,
                    valorParcela: 40.24,
                    totalParcelas: 13,
                    taxaEfetivaMensal: 0.38,
                    taxaEfetivaAnual: 4.66,
                }}
            />
        );

        expect(screen.getByTestId('receipt-art52')).toBeInTheDocument();
        expect(screen.getByTestId('receipt-art52-original')).toHaveTextContent('R$ 400,00');
        expect(screen.getByTestId('receipt-art52-parcelas')).toHaveTextContent('13x');
        expect(screen.getByTestId('receipt-art52-parcela')).toHaveTextContent('R$ 40,24');
        expect(screen.getByTestId('receipt-art52-juros')).toHaveTextContent('R$ 123,15');
        expect(screen.getByTestId('receipt-art52-juros')).toHaveTextContent('5.0% sobre o total');
        expect(screen.getByTestId('receipt-art52-taxa-mensal')).toHaveTextContent('0.38% a.m.');
        expect(screen.getByTestId('receipt-art52-taxa-anual')).toHaveTextContent('4.66% a.a.');
        expect(screen.getByTestId('receipt-art52-total-com')).toHaveTextContent('R$ 523,15');
    });

    it('NAO exibe o bloco art. 52 quando jurosTotal = 0 (parcelado sem juros / a vista)', () => {
        render(
            <TransactionReceipt
                onBack={() => {}}
                transaction={{
                    ...baseTx,
                    originalAmount: 523.15,
                    jurosTotal: 0,
                    interestRate: 0,
                    totalParcelado: 523.15,
                    valorParcela: 523.15,
                }}
            />
        );

        expect(screen.queryByTestId('receipt-art52')).not.toBeInTheDocument();
    });

    it('exibe o bloco art. 52 com fallback para campos ausentes', () => {
        render(
            <TransactionReceipt
                onBack={() => {}}
                transaction={{
                    ...baseTx,
                    jurosTotal: 50,
                    interestRate: 0.05,
                    totalParcelado: 450,
                    totalParcelas: 12,
                }}
            />
        );

        // Sem originalAmount/valorParcela/taxas → usa fallbacks sem quebrar
        expect(screen.getByTestId('receipt-art52')).toBeInTheDocument();
        expect(screen.getByTestId('receipt-art52-juros')).toHaveTextContent('R$ 50,00');
        expect(screen.getByTestId('receipt-art52-total-com')).toHaveTextContent('R$ 450,00');
    });
});
