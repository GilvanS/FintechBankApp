import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TelegramManagement from '../components/Admin/TelegramManagement';

// Mock do contexto de tema (mesmo padrão dos outros testes de Admin).
vi.mock('../contexts/AppStateContext', () => ({
    useAppState: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));

vi.mock('../utils/toast', () => ({
    showToast: vi.fn(),
}));

// Mocks das funções da API — vi.hoisted para poder reconfigurar por teste.
const { apiMock } = vi.hoisted(() => ({
    apiMock: {
        adminTelegramStatus: vi.fn(),
        adminTelegramTopics: vi.fn(),
        adminTelegramSettings: vi.fn(),
        adminTelegramLog: vi.fn(),
        adminTelegramUpdateSetting: vi.fn(),
        adminTelegramTestCategory: vi.fn(),
        adminTelegramTest: vi.fn(),
        adminTelegramDeleteTopic: vi.fn(),
        adminTelegramSendPdf: vi.fn(),
        adminTelegramSendTable: vi.fn(),
    },
}));

vi.mock('../services/api', () => apiMock);

const LOG_ENTRIES = [
    {
        id: 1,
        cpf: '11111111111',
        topic_id: 1415,
        category: 'deposit',
        destination: 'cpf',
        message_type: 'text',
        message_id: '1416',
        ok: true,
        error: null,
        created_at: '2026-08-15T09:00:00.000Z',
    },
    {
        id: 2,
        cpf: '11111111111',
        topic_id: null,
        category: 'deposit',
        destination: 'general',
        message_type: 'document',
        message_id: '1417',
        ok: false,
        error: 'chat not found',
        created_at: '2026-08-15T08:30:00.000Z',
    },
];

describe('TelegramManagement — Histórico Persistente de Envios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiMock.adminTelegramStatus.mockResolvedValue({ configured: true, enabled: true, topicCount: 1 });
        apiMock.adminTelegramTopics.mockResolvedValue({ success: true, topics: [] });
        apiMock.adminTelegramSettings.mockResolvedValue({ success: true, settings: [] });
        apiMock.adminTelegramLog.mockResolvedValue(LOG_ENTRIES);
    });

    it('mostra a seção de histórico de envios e carrega ao clicar no botão', async () => {
        render(<TelegramManagement />);

        expect(screen.getByText(/Histórico de Envios/)).toBeDefined();
        expect(screen.getByText(/Clique em "Carregar Histórico"/)).toBeDefined();

        fireEvent.click(screen.getByRole('button', { name: /Carregar Histórico/i }));

        await waitFor(() => {
            expect(apiMock.adminTelegramLog).toHaveBeenCalledTimes(1);
        });

        expect((await screen.findAllByText('111.111.111-11')).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/deposit/i).length).toBeGreaterThan(0);
    });

    it('mostra status OK e erro com cor diferente nas linhas', async () => {
        render(<TelegramManagement />);
        fireEvent.click(screen.getByRole('button', { name: /Carregar Histórico/i }));

        expect(await screen.findByText('✓ OK')).toBeDefined();
        expect(screen.getByText('✗ Erro')).toBeDefined();
        expect(screen.getByText('document')).toBeDefined();
    });

    it('filtra por CPF e categoria ao clicar em Filtrar', async () => {
        render(<TelegramManagement />);
        fireEvent.click(screen.getByRole('button', { name: /Carregar Histórico/i }));
        await screen.findAllByText('111.111.111-11');

        fireEvent.change(screen.getByPlaceholderText('Somente números'), { target: { value: '22222222222' } });
        fireEvent.click(screen.getByRole('button', { name: /Filtrar/i }));

        await waitFor(() => {
            expect(apiMock.adminTelegramLog).toHaveBeenLastCalledWith({
                cpf: '22222222222',
                category: undefined,
                limit: 30,
            });
        });
    });

    it('mostra mensagem vazia quando não há registros com os filtros', async () => {
        apiMock.adminTelegramLog.mockResolvedValue([]);

        render(<TelegramManagement />);
        fireEvent.click(screen.getByRole('button', { name: /Carregar Histórico/i }));

        expect(await screen.findByText(/Nenhum envio registrado com os filtros informados/)).toBeDefined();
    });
});
