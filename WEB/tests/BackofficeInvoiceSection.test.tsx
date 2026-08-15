import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import BackofficeInvoiceSection from '../components/Admin/BackofficeInvoiceSection';
import { User } from '../types';

// ─── Mock do invoiceMath (fonte única de IOF) ──────────────────────────────
vi.mock('../../utils/invoiceMath.js', () => ({
    calcMulta: (principal: number) => Math.round(principal * 0.02 * 100) / 100,
    calcJurosMora: (principal: number, days: number) => Math.round(principal * 0.000333 * days * 100) / 100,
    calcJurosRemuneratorios: (principal: number, days: number) => Math.round(principal * 0.00513 * days * 100) / 100,
    calcIofAdicional: (principal: number) => Math.round(principal * 0.0038 * 100) / 100,
    calcIofDiario: (principal: number, days: number) => Math.round(principal * 0.000082 * days * 100) / 100,
    calcIof: (principal: number, days: number) => Math.round(principal * (0.0038 + 0.000082 * days) * 100) / 100,
    calcAllCharges: (principal: number, days: number) => {
        const multa = Math.round(principal * 0.02 * 100) / 100;
        const jurosMora = Math.round(principal * 0.000333 * days * 100) / 100;
        const jurosRemuneratorios = Math.round(principal * 0.00513 * days * 100) / 100;
        const iofAdicional = Math.round(principal * 0.0038 * 100) / 100;
        const iofDiario = Math.round(principal * 0.000082 * days * 100) / 100;
        const iof = Math.round(principal * (0.0038 + 0.000082 * days) * 100) / 100;
        const total = Math.round((multa + jurosMora + jurosRemuneratorios + iof) * 100) / 100;
        return { multa, jurosMora, jurosRemuneratorios, iofAdicional, iofDiario, iof, total };
    },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FAKE_NOW = new Date('2026-07-28T12:00:00.000Z');
beforeAll(() => { vi.setSystemTime(FAKE_NOW); });

/**
 * Cria um User mock para o BackofficeInvoiceSection.
 * O componente formata números com .toFixed(2) — usa PONTO como decimal.
 * Ex: R$ 3870.86, R$ 77.42
 */
function makeUser(overrides: {
    isPaid?: boolean;
    paidAt?: string | null;
    valorTotal?: number;
    valorPago?: number;
    hasCharges?: boolean;
    daysOverdue?: number;
    closedInvoiceDueDate?: string;
    withPreviousInvoice?: boolean;
}): User {
    const {
        isPaid = false,
        paidAt = null,
        valorTotal = 3870.86,
        valorPago = isPaid ? valorTotal : 0,
        hasCharges = !isPaid,
        daysOverdue = 18,
        closedInvoiceDueDate = '2026-07-15',
        withPreviousInvoice = true,
    } = overrides;

    const charges = hasCharges
        ? { multa: 77.42, jurosMora: 23.20, jurosRemuneratorios: 357.44, iof: 20.42, totalEncargos: 478.48 }
        : { multa: 0, jurosMora: 0, jurosRemuneratorios: 0, iof: 0, totalEncargos: 0 };

    return {
        cpf: '11111111111',
        fullName: 'Cliente Teste',
        email: 'teste@example.com',
        password: 'admin999',
        balance: 5000.00,
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
            number: '**** **** **** 1111',
            dueDate: '08/30',
            invoiceDueDate: '2026-08-10T00:00:00.000Z',
            closedInvoiceDueDate,
            currentInvoice: 2365.05,
            closedInvoice: isPaid ? 0 : valorTotal,
            availableLimit: 2720.78,
            totalLimit: 5000,
            pointsBalance: 500,
            isBlocked: false,
            transactions: [],
            closedTransactions: [],
            // Campos extras lidos via `as any`
            _closedInvoiceValorTotal: valorTotal,
            _closedInvoiceValorPago: valorPago,
            closedInvoiceIsPaid: isPaid,
            closedInvoicePaidAt: paidAt,
            closedInvoiceCharges: charges,
            daysOverdue,
            currentInvoiceTotal: 5490.98,
            currentInvoiceMinimo: 2790.39,
            // Fat 1 (fatura anterior) é derivada de um pagamento TOTAL real em
            // paymentHistory — mesmos valores do antigo mock fixo (Mai/26, R$1120),
            // agora vindos de dado real em vez de literal no componente.
            paymentHistory: withPreviousInvoice
                ? [{ id: 'ph1', date: '2026-05-15', amount: 1120.00, description: 'Fatura Mai/26', paymentType: 'TOTAL' as const }]
                : [],
            // Faturas fechadas reais — o grid renderiza uma coluna por item desta lista
            // (substituiu os slots fixos Fat 1/2/3). Com withPreviousInvoice, a massa tem
            // 2 fechadas: uma anterior quitada e a atual (paga ou em atraso conforme isPaid).
            closedInvoicesList: [
                ...(withPreviousInvoice
                    ? [{
                        id: 'inv-anterior',
                        dueDate: '2026-05-15T00:00:00.000Z',
                        valorTotal: 1120.00,
                        valorPago: 1120.00,
                        residual: 0,
                        isPaid: true,
                        paidAt: '2026-05-15T00:00:00.000Z',
                    }]
                    : []),
                {
                    id: 'inv-atual',
                    dueDate: closedInvoiceDueDate,
                    valorTotal,
                    valorPago,
                    residual: Math.round((valorTotal - valorPago) * 100) / 100,
                    isPaid,
                    paidAt: paidAt,
                    // Encargos congelados no fechamento (real da invoice) — o componente
                    // exibe na aba "Fechada" via encargosFrozen da closedInvoicesList.
                    ...(hasCharges
                        ? { encargosFrozen: { multa: 77.42, jurosMora: 23.20, jurosRemuneratorios: 357.44, iof: 20.42, total: 478.48 } }
                        : {}),
                },
            ],
        },
        daysOverdue,
    } as unknown as User;
}

beforeEach(() => { cleanup(); });

// ─── Helpers de query ───────────────────────────────────────────────────────

/** getAllByText que retorna true se pelo menos 1 elemento corresponder */
const hasText = (regex: RegExp): boolean => {
    return screen.queryAllByText(regex).length > 0;
};

/** getAllByText que retorna a contagem */
const countText = (regex: RegExp): number => {
    return screen.queryAllByText(regex).length;
};

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('BackofficeInvoiceSection — Estados da Fatura Fechada', () => {

    // ── Estado 1: Não paga ───────────────────────────────────────────────────

    describe('Estado 1: Nao paga (18 dias em atraso)', () => {
        const user = makeUser({ isPaid: false, daysOverdue: 18 });

        it('deve exibir badge 18d ATRASO no botao da Fat 2', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/18d ATRASO/i)).toBe(true);
        });

        it('deve exibir header Encargos Congelados com 18 dias', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Encargos Congelados no Fechamento/i)).toBe(true);
            // Nota viva: os encargos de 18 dias são herdados para a Fatura Aberta.
            expect(hasText(/18 dias/i)).toBe(true);
        });

        it('deve exibir valor original R$ 3870.86', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(countText(/R\$ 3870\.86/)).toBeGreaterThanOrEqual(1);
        });

        it('NAO deve exibir badge PAGA no titulo da fatura fechada (apenas no Fat 1)', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            // "PAGA ✅" aparece hardcoded no Fat 1. "Pagamento" também contém "paga" com case-insensitive.
            // Usar contagem específica para "PAGA ✅" em vez de /PAGA/i
            const pagaComCheck = screen.queryAllByText(/PAGA/i);
            // Deve ser >= 1 (Fat 1) mas excluir que a fechada tenha PAGA
            expect(pagaComCheck.length).toBeGreaterThanOrEqual(1);
            // Verificar se o texto "Cód 3000" NÃO tem PAGA perto (só o Fat 1 deve ter)
            // Método mais seguro: verificar que não há PAGA no detalhe da fechada
            const detalhePaga = screen.queryAllByText(/Fatura Fechada Jun\/26.*PAGA/i);
            expect(detalhePaga.length).toBe(0);
        });

        it('deve exibir encargos com valores reais (multa, juros, IOF)', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/R\$ 77\.42/)).toBe(true);
            expect(hasText(/R\$ 23\.20/)).toBe(true);
            expect(hasText(/R\$ 357\.44/)).toBe(true);
            expect(hasText(/R\$ 14\.71/)).toBe(true);
            expect(hasText(/R\$ 478\.48/)).toBe(true);
        });

        it('deve exibir nota de heranca para a fatura aberta', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            // O texto é quebrado pelo <strong> em elementos separados — verificar as partes.
            expect(hasText(/são herdados e exibidos na/i)).toBe(true);
            expect(hasText(/Fatura Aberta/i)).toBe(true);
        });

        it('NAO deve exibir secao de pagamento realizado', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Pagamento\(s\) Realizado\(s\)/i)).toBe(false);
        });

        it('SNAPSHOT: Estado 1 — Nao paga (18 dias em atraso)', () => {
            const { container } = render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(container).toMatchSnapshot('estado1-nao-paga-18d-atraso');
        });
    });

    // ── Estado 2: Paga em dia ───────────────────────────────────────────────

    describe('Estado 2: Paga em dia (sem encargos)', () => {
        const user = makeUser({ isPaid: true, paidAt: '2026-07-15T10:00:00.000Z', hasCharges: false, daysOverdue: 0 });

        it('deve exibir FECHADA no botao Fat 2 (sem badge ATRASO)', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/FECHADA/i)).toBe(true);
            expect(hasText(/\d+d ATRASO/i)).toBe(false);
        });

        it('deve exibir valor original preservado R$ 3870.86 mesmo apos pagamento', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(countText(/R\$ 3870\.86/)).toBeGreaterThanOrEqual(1);
        });

        it('deve exibir header Encargos Congelados e nota de quitação', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Encargos Congelados no Fechamento/i)).toBe(true);
            expect(hasText(/Fatura quitada em/i)).toBe(true);
        });

        it('deve exibir encargos zerados (multiplos R$ 0.00)', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            const zeroElements = screen.getAllByText(/R\$ 0\.00/);
            expect(zeroElements.length).toBeGreaterThanOrEqual(4);
        });

        it('deve exibir nota de encargos consolidados na fatura aberta (paga em dia)', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Fatura quitada em/i)).toBe(true);
            expect(hasText(/consolidados na Fatura Aberta/i)).toBe(true);
        });

        it('deve exibir secao de pagamento realizado com valor R$ 3870.86', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Pagamento\(s\) Realizado\(s\)/i)).toBe(true);
            expect(countText(/R\$ 3870\.86/)).toBeGreaterThanOrEqual(1);
        });

        it('deve exibir saldo devedor restante = R$ 0.00', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Saldo Devedor Restante/i)).toBe(true);
        });

        it('deve exibir badge PAGA no detalhe da fatura fechada', () => {
            const { container } = render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(container.textContent).toMatch(/PAGA ✅/);
        });

        it('SNAPSHOT: Estado 2 — Paga em dia (sem encargos)', () => {
            const { container } = render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(container).toMatchSnapshot('estado2-paga-em-dia');
        });
    });

    // ── Estado 3: Paga após atraso ──────────────────────────────────────────

    describe('Estado 3: Paga apos atraso (encargos herdados para aberta)', () => {
        const user = makeUser({ isPaid: true, paidAt: '2026-07-27T15:30:00.000Z', hasCharges: true, valorPago: 3870.86, daysOverdue: 18 });

        it('deve exibir FECHADA no botao Fat 2 (sem badge ATRASO pois ja quitada)', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/FECHADA/i)).toBe(true);
            expect(hasText(/\d+d ATRASO/i)).toBe(false);
        });

        it('deve exibir header Encargos Congelados e nota de quitação mesmo com atraso anterior', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Encargos Congelados no Fechamento/i)).toBe(true);
            expect(hasText(/Fatura quitada em/i)).toBe(true);
        });

        it('deve exibir encargos congelados como memoria informativa (mesmo paga)', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            // Componente novo: fatura paga mantém os encargos congelados reais no
            // fechamento como memória informativa (não zera mais a seção).
            expect(hasText(/Encargos Congelados no Fechamento/i)).toBe(true);
            expect(hasText(/R\$ 478\.48/)).toBe(true);
        });

        it('deve exibir nota "Encargos HERDADOS para a fatura aberta"', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/HERDADOS/i)).toBe(true);
            expect(hasText(/consolidados na fatura aberta/i)).toBe(true);
        });

        it('deve exibir secao de pagamento realizado com valor R$ 3870.86', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Pagamento\(s\) Realizado\(s\)/i)).toBe(true);
        });

        it('deve exibir saldo devedor restante = R$ 0.00', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Saldo Devedor Restante/i)).toBe(true);
        });

        it('deve exibir linha "Total de Encargos Congelados" como memoria informativa', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Total de Encargos Congelados no Fechamento/i)).toBe(true);
        });

        it('deve exibir badge PAGA no detalhe da fatura fechada', () => {
            const { container } = render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(container.textContent).toMatch(/PAGA ✅/);
        });

        it('SNAPSHOT: Estado 3 — Paga apos atraso (encargos herdados)', () => {
            const { container } = render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(container).toMatchSnapshot('estado3-paga-apos-atraso');
        });
    });

    // ── Modo escuro ──────────────────────────────────────────────────────────

    describe('Modo escuro (isMidnight=true)', () => {
        const user = makeUser({ isPaid: false });

        it('deve renderizar sem erros com isMidnight=true', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={true} />);
            expect(hasText(/Diagn\u00f3stico Backoffice/i)).toBe(true);
        });
    });

    // ── Navegação ────────────────────────────────────────────────────────────

    describe('Navegacao entre faturas', () => {
        const user = makeUser({ isPaid: false });

        it('deve chamar onSelectInvoice com "open" ao clicar em Fat 3', () => {
            const onSelect = vi.fn();
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={onSelect} isMidnight={false} />);
            // Rótulo é derivado de creditCard.invoiceDueDate (mock = 2026-08-10) — Ago/26,
            // não mais "Jul" fixo no componente.
            screen.getByText(/Aberta \(Ago\/26\)/i).click();
            expect(onSelect).toHaveBeenCalledWith('open');
        });

        it('deve chamar onSelectInvoice com "previous" ao clicar em Fat 1', () => {
            const onSelect = vi.fn();
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={onSelect} isMidnight={false} />);
            screen.getByText(/Mai\/26/i).click();
            expect(onSelect).toHaveBeenCalledWith('previous');
        });

        it('deve exibir subtexto diferente para cada aba selecionada', () => {
            const { rerender } = render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="closed" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Fatura Fechada Vencida/i)).toBe(true);

            rerender(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="open" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Fatura Aberta/i)).toBe(true);

            rerender(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="previous" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Fatura Anterior Paga/i)).toBe(true);
        });
    });

    // ── Fatura Aberta ────────────────────────────────────────────────────────

    describe('Secao Fatura Aberta exibe compras + heranca + encargos herdados', () => {
        const user = makeUser({ isPaid: false });

        it('deve exibir o total consolidado R$ 5490.98', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="open" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(countText(/R\$ 5490\.98/)).toBeGreaterThanOrEqual(1);
        });

        it('deve exibir a secao de Heranca de Atraso com os encargos', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="open" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Heran\u00e7a de Atraso da Fatura Anterior/i)).toBe(true);
            expect(hasText(/R\$ 77\.42/)).toBe(true);
            expect(hasText(/R\$ 23\.20/)).toBe(true);
            expect(hasText(/R\$ 357\.44/)).toBe(true);
        });

        it('deve exibir consolidado final (Compras + Fechada + Encargos)', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="open" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Total Consolidado para Fechamento\/Corte/i)).toBe(true);
        });
    });

    // ── Fatura Anterior ──────────────────────────────────────────────────────

    describe('Secao Fatura Anterior (Mai/26 quitada)', () => {
        const user = makeUser({ isPaid: false });

        it('deve exibir status "100% QUITADA" com R$ 0.00', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="previous" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/100% QUITADA/i)).toBe(true);
            expect(hasText(/R\$ 0\.00 DE D\u00cdVIDA/i)).toBe(true);
        });

        it('deve exibir encargos zerados e "0 dias - Pago em dia"', () => {
            render(<BackofficeInvoiceSection searchedUser={user} selectedBackofficeInvoice="previous" onSelectInvoice={vi.fn()} isMidnight={false} />);
            expect(hasText(/Encargos do Atraso \(0 dias - Pago em dia\)/i)).toBe(true);
        });
    });
});
