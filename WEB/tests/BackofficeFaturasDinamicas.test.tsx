import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import BackofficeInvoiceSection from '../components/Admin/BackofficeInvoiceSection';
import { User } from '../types';

/**
 * O painel do backoffice tinha 3 slots FIXOS (Fat 1/2/3) com meses cravados no
 * código. Massa com 1 fatura mostrava 3; conta nova mostrava faturas que nunca
 * existiram. Medido no banco em 2026-08-11: 72 massas com 1 fatura, 43 com 2,
 * 12 sem nenhuma — nenhuma com 3.
 *
 * Agora o grid renderiza uma coluna por fatura real de creditCard.closedInvoicesList,
 * mais a fatura aberta.
 */

const fatura = (over: Partial<{ id: string; dueDate: string; valorTotal: number; valorPago: number; residual: number; isPaid: boolean }> = {}) => ({
    id: over.id ?? 'inv-1',
    dueDate: over.dueDate ?? '2026-07-19T00:00:00.000Z',
    valorTotal: over.valorTotal ?? 3870.86,
    valorPago: over.valorPago ?? 0,
    residual: over.residual ?? (over.valorTotal ?? 3870.86) - (over.valorPago ?? 0),
    isPaid: over.isPaid ?? false,
    paidAt: null,
});

function makeUser(closedInvoicesList: ReturnType<typeof fatura>[]): User {
    return {
        cpf: '12558823280',
        fullName: 'Cliente Teste',
        email: 't@e.com',
        password: 'x',
        balance: 5000,
        transactions: [],
        isBlocked: false,
        role: 'user',
        pixDailyLimit: 2000,
        pixKeys: [],
        pixContacts: [],
        limitIncreaseRequest: null,
        showStoriesPopup: false,
        purchasedItems: [],
        creditCard: {
            number: '**** 1111',
            dueDate: '08/30',
            invoiceDueDate: '2026-09-20T00:00:00.000Z',
            closedInvoiceDueDate: closedInvoicesList.at(-1)?.dueDate,
            currentInvoice: 851.75,
            closedInvoice: closedInvoicesList.reduce((s, f) => s + (f.isPaid ? 0 : f.valorTotal), 0),
            availableLimit: 1000,
            totalLimit: 5000,
            pointsBalance: 0,
            isBlocked: false,
            transactions: [],
            closedTransactions: [],
            currentInvoiceTotal: 326.06,
            currentInvoiceMinimo: 100,
            closedInvoicesList,
        },
    } as unknown as User;
}

const render_ = (lista: ReturnType<typeof fatura>[]) =>
    render(<BackofficeInvoiceSection searchedUser={makeUser(lista)} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);

beforeEach(() => cleanup());

describe('Backoffice — grid mostra o numero REAL de faturas', () => {
    it('massa com 1 fatura fechada: mostra Fat 1 (fechada) + Fat 2 (aberta), nao 3 slots', () => {
        render_([fatura({ dueDate: '2026-08-05T00:00:00.000Z', valorTotal: 697.57 })]);

        expect(screen.getByText(/Fat 1 · Ago\/26/i)).toBeDefined();
        expect(screen.getByText(/Fat 2 · Aberta/i)).toBeDefined();
        // Nao pode existir um terceiro slot inventado. Casa so o rotulo de slot
        // ("Fat 3 · ..."), nao a mencao "(Fat 3)" do texto explicativo do rodape.
        expect(screen.queryByText(/Fat 3 ·/i)).toBeNull();
    });

    it('massa com 2 faturas fechadas: mostra Fat 1, Fat 2 e Fat 3 (aberta)', () => {
        render_([
            fatura({ id: 'a', dueDate: '2026-07-10T00:00:00.000Z', valorTotal: 3870.86 }),
            fatura({ id: 'b', dueDate: '2026-08-10T00:00:00.000Z', valorTotal: 1305.98 }),
        ]);

        expect(screen.getByText(/Fat 1 · Jul\/26/i)).toBeDefined();
        expect(screen.getByText(/Fat 2 · Ago\/26/i)).toBeDefined();
        expect(screen.getByText(/Fat 3 · Aberta/i)).toBeDefined();
        expect(screen.queryByText(/Fat 4/i)).toBeNull();
    });

    it('conta nova sem fatura fechada: mostra apenas a fatura aberta como Fat 1', () => {
        render_([]);

        expect(screen.getByText(/Fat 1 · Aberta/i)).toBeDefined();
        expect(screen.queryByText(/Fat 2/i)).toBeNull();
    });

    it('rotulo do mes vem da data real da fatura, nao de string fixa', () => {
        render_([fatura({ dueDate: '2026-03-15T00:00:00.000Z' })]);

        expect(screen.getByText(/Fat 1 · Mar\/26/i)).toBeDefined();
        // Os meses antes cravados no codigo nao podem aparecer.
        expect(screen.queryByText(/Mai\/26/i)).toBeNull();
    });

    it('fatura quitada exibe badge PAGA em vez de FECHADA', () => {
        render_([fatura({ valorTotal: 3870.86, valorPago: 3870.86, residual: 0, isPaid: true })]);
        // "PAGA" aparece em varios lugares da tela; aqui interessa o badge do card,
        // que tem o check e nao vem acompanhado de outro texto.
        expect(screen.getAllByText(/PAGA ✅/).length).toBeGreaterThan(0);
    });

    it('saldo credor (pagou a mais) aparece no card da fatura', () => {
        render_([fatura({ valorTotal: 3870.86, valorPago: 5286.06, residual: -1415.20, isPaid: true })]);
        expect(screen.getByText(/saldo credor R\$ 1415\.20/i)).toBeDefined();
    });
});
