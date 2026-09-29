import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuditSection from '../components/Admin/AuditSection';

// Mock do contexto de tema (mesmo padrão dos outros testes de Admin).
vi.mock('../contexts/AppStateContext', () => ({
    useAppState: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));

// Mocks das funções da API — vi.hoisted para poder reconfigurar por teste.
const { apiMock } = vi.hoisted(() => ({
    apiMock: {
        adminAuditConsistency: vi.fn(),
        adminAuditDoubleCount: vi.fn(),
        adminAuditCsvConsistency: vi.fn(),
        adminAuditCicloDessincronizado: vi.fn(),
        adminFixOrphanInstallments: vi.fn(),
        adminFixChargesProactive: vi.fn(),
        adminFixInstallmentPlans: vi.fn(),
        adminFixCicloDessincronizado: vi.fn(),
    },
}));

vi.mock('../services/api', () => apiMock);

const CONSISTENCY_OK = {
    success: true,
    summary: {
        totalScanned: 52,
        usersConsistent: 52,
        usersDesatualizados: 0,
        invoicesConsistent: 52,
        invoicesDesatualizadas: 0,
        totalInvoices: 52,
    },
    details: [],
    tip: '✅ 100% consistente — nenhuma ação necessária.',
};

const DOUBLE_COUNT_WITH_ISSUES = {
    success: true,
    scanned: 7,
    withPayments: 7,
    discrepancies: 3,
    details: [],
    tip: 'Execute node scripts/audit_completo.js --fix --confirm para corrigir discrepâncias.',
};

describe('AuditSection — aba Auditoria', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiMock.adminAuditConsistency.mockResolvedValue(CONSISTENCY_OK);
        apiMock.adminAuditDoubleCount.mockResolvedValue(DOUBLE_COUNT_WITH_ISSUES);
        apiMock.adminAuditCsvConsistency.mockResolvedValue({ success: true, summary: { totalScanned: 10, consistent: 10, divergent: 0 } });
        apiMock.adminAuditCicloDessincronizado.mockResolvedValue({ success: true, summary: { divergent: 0, curaveisAuto: 0, valorNaoFaturado: 0 }, details: [] });
    });

    it('consulta as duas auditorias na montagem', async () => {
        render(<AuditSection />);

        await waitFor(() => {
            expect(apiMock.adminAuditConsistency).toHaveBeenCalledTimes(1);
            expect(apiMock.adminAuditDoubleCount).toHaveBeenCalledTimes(1);
        });
    });

    it('mostra os KPIs de consistência na sub-aba padrão', async () => {
        render(<AuditSection />);

        expect(await screen.findByText('Consistência de Dias em Atraso')).toBeDefined();
        expect(screen.getByText('52')).toBeDefined(); // totalScanned
        expect(screen.getByText(/100% consistente/)).toBeDefined();
    });

    it('troca para a sub-aba Double-Counting e mostra as discrepâncias', async () => {
        render(<AuditSection />);
        await screen.findByText('Consistência de Dias em Atraso');

        fireEvent.click(screen.getByRole('button', { name: 'Double-Counting' }));

        expect(await screen.findByText('Double-Counting de Pagamentos')).toBeDefined();
        expect(screen.getByText('3')).toBeDefined(); // discrepancies
        expect(screen.getByText(/audit_completo\.js/)).toBeDefined();
    });

    it('link do relatório completo aponta para o HTML servido em /audit', async () => {
        render(<AuditSection />);
        await screen.findByText('Consistência de Dias em Atraso');

        const link = screen.getByRole('link', { name: /Abrir relatório completo/i });
        expect(link.getAttribute('href')).toMatch(/audit\/audit_consistency_dashboard\.html$/);
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toMatch(/noopener/);
    });

    it('botão Atualizar refaz as duas consultas', async () => {
        render(<AuditSection />);
        await screen.findByText('Consistência de Dias em Atraso');

        fireEvent.click(screen.getByRole('button', { name: /atualizar/i }));

        await waitFor(() => {
            expect(apiMock.adminAuditConsistency).toHaveBeenCalledTimes(2);
            expect(apiMock.adminAuditDoubleCount).toHaveBeenCalledTimes(2);
        });
    });

    describe('ciclo dessincronizado (aba Correções)', () => {
        const COM_CICLO = {
            success: true,
            summary: { divergent: 1, curaveisAuto: 1, valorNaoFaturado: 128.31 },
            details: [{
                cpf: '94973492973', name: 'Massa', dueAtual: '2026-11-02T18:00:00.000Z', dueEsperado: '2026-10-02T15:00:00.000Z',
                ultimaFechada: '2026-09-02T18:00:00.000Z', ciclosPulados: 1, valorNaoFaturado: 128.31, curavelAuto: true,
            }],
        };

        it('valida, lista a massa e cura; o botão Curar só habilita quando há massa a curar', async () => {
            apiMock.adminAuditCicloDessincronizado.mockResolvedValue(COM_CICLO);
            apiMock.adminFixCicloDessincronizado.mockResolvedValue({ success: true, totalFound: 1, totalCured: 1, errorsCount: 0 });

            render(<AuditSection />);
            await screen.findByText('Consistência de Dias em Atraso');
            fireEvent.click(screen.getByRole('button', { name: 'Correções' }));

            expect(await screen.findByText(/1 massa\(s\) precisam de cura/)).toBeDefined();
            expect(screen.getByText(/94973492973/)).toBeDefined();

            apiMock.adminAuditCicloDessincronizado.mockResolvedValue({ success: true, summary: { divergent: 0, curaveisAuto: 0, valorNaoFaturado: 0 }, details: [] });
            fireEvent.click(screen.getByRole('button', { name: /Curar Ciclos/ }));

            await waitFor(() => expect(apiMock.adminFixCicloDessincronizado).toHaveBeenCalledTimes(1));
            expect(await screen.findByText(/1 massa\(s\) encontrada\(s\), 1 curada\(s\)/)).toBeDefined();
            expect(await screen.findByText('Nenhuma massa com ciclo dessincronizado.')).toBeDefined();
            expect((screen.getByRole('button', { name: /Curar Ciclos/ }) as HTMLButtonElement).disabled).toBe(true);
        });

        it('CSV × Backend avisa quando há ciclo dessincronizado', async () => {
            apiMock.adminAuditCicloDessincronizado.mockResolvedValue(COM_CICLO);

            render(<AuditSection />);
            await screen.findByText('Consistência de Dias em Atraso');
            fireEvent.click(screen.getByRole('button', { name: 'CSV × Backend' }));

            expect(await screen.findByText(/ciclo dessincronizado \(vencimento adiantado/)).toBeDefined();
        });
    });

    it('mostra mensagem de erro quando a consulta falha', async () => {
        apiMock.adminAuditConsistency.mockResolvedValue({ success: false, message: 'Erro ao auditar consistência' });

        render(<AuditSection />);

        expect(await screen.findByText('Erro ao auditar consistência')).toBeDefined();
    });
});
