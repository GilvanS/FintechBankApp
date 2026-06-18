import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock do Toast para todos os componentes de "em breve"
vi.mock('../src/components/Toast', () => ({
    useToast: () => ({
        toast: null,
        showSuccess: vi.fn(),
        showError: vi.fn(),
        hide: vi.fn(),
    }),
    ToastContainer: () => null,
}));

import Loans from '../src/components/Loans';
import Insurance from '../src/components/Insurance';
import Marketplace from '../src/components/Marketplace';

// ------------------------------------------------------------------
// Loans
// ------------------------------------------------------------------
describe('Loans', () => {
    it('renderiza o título da tela', () => {
        render(<Loans onBack={vi.fn()} />);
        expect(screen.getByText('Empréstimos')).toBeInTheDocument();
    });

    it('exibe badge "Em breve"', () => {
        render(<Loans onBack={vi.fn()} />);
        expect(screen.getByText('Em breve')).toBeInTheDocument();
    });

    it('exibe todos os 4 benefícios', () => {
        render(<Loans onBack={vi.fn()} />);
        expect(screen.getByText('Aprovação instantânea')).toBeInTheDocument();
        expect(screen.getByText('Taxas a partir de 1,49% a.m.')).toBeInTheDocument();
        expect(screen.getByText('Até 60 meses')).toBeInTheDocument();
        expect(screen.getByText('Sem burocracia')).toBeInTheDocument();
    });

    it('exibe botão "Quero ser notificado" inicialmente', () => {
        render(<Loans onBack={vi.fn()} />);
        expect(screen.getByRole('button', { name: /quero ser notificado/i })).toBeInTheDocument();
    });

    it('muda o botão para "Interesse registrado!" após clique', () => {
        render(<Loans onBack={vi.fn()} />);
        const btn = screen.getByRole('button', { name: /quero ser notificado/i });
        fireEvent.click(btn);
        expect(screen.getByText('Interesse registrado!')).toBeInTheDocument();
    });

    it('desabilita o botão após registrar interesse', () => {
        render(<Loans onBack={vi.fn()} />);
        const btn = screen.getByRole('button', { name: /quero ser notificado/i });
        fireEvent.click(btn);
        expect(btn).toBeDisabled();
    });

    it('chama onBack ao clicar no botão voltar', () => {
        const onBack = vi.fn();
        render(<Loans onBack={onBack} />);
        fireEvent.click(screen.getByLabelText('Voltar'));
        expect(onBack).toHaveBeenCalledOnce();
    });
});

// ------------------------------------------------------------------
// Insurance
// ------------------------------------------------------------------
describe('Insurance', () => {
    it('renderiza o título da tela completa', () => {
        render(<Insurance onBack={vi.fn()} />);
        expect(screen.getByText('Seguros')).toBeInTheDocument();
    });

    it('exibe badge "Em breve"', () => {
        render(<Insurance onBack={vi.fn()} />);
        expect(screen.getByText('Em breve')).toBeInTheDocument();
    });

    it('exibe as 4 coberturas disponíveis', () => {
        render(<Insurance onBack={vi.fn()} />);
        expect(screen.getByText('Seguro de Vida')).toBeInTheDocument();
        expect(screen.getByText('Seguro Auto')).toBeInTheDocument();
        expect(screen.getByText('Seguro Residencial')).toBeInTheDocument();
        expect(screen.getByText('Seguro de Dispositivos')).toBeInTheDocument();
    });

    it('muda o botão para "Interesse registrado!" após clique', () => {
        render(<Insurance onBack={vi.fn()} />);
        const btn = screen.getByRole('button', { name: /quero ser notificado/i });
        fireEvent.click(btn);
        expect(btn).toBeDisabled();
        expect(screen.getByText('Interesse registrado!')).toBeInTheDocument();
    });

    it('chama onBack ao clicar no botão voltar', () => {
        const onBack = vi.fn();
        render(<Insurance onBack={onBack} />);
        fireEvent.click(screen.getByLabelText('Voltar'));
        expect(onBack).toHaveBeenCalledOnce();
    });

    it('modo isPreview renderiza card compacto sem botão CTA', () => {
        render(<Insurance onBack={vi.fn()} isPreview />);
        expect(screen.getByText('Nossos Seguros')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /quero ser notificado/i })).not.toBeInTheDocument();
    });

    it('modo isPreview não exibe badge "Em breve"', () => {
        render(<Insurance onBack={vi.fn()} isPreview />);
        expect(screen.queryByText('Em breve')).not.toBeInTheDocument();
    });
});

// ------------------------------------------------------------------
// Marketplace
// ------------------------------------------------------------------
describe('Marketplace', () => {
    it('renderiza o título da tela completa', () => {
        render(<Marketplace onBack={vi.fn()} />);
        expect(screen.getByRole('heading', { name: /marketplace/i })).toBeInTheDocument();
    });

    it('exibe badge "Em breve"', () => {
        render(<Marketplace onBack={vi.fn()} />);
        expect(screen.getByText('Em breve')).toBeInTheDocument();
    });

    it('exibe os 4 destaques', () => {
        render(<Marketplace onBack={vi.fn()} />);
        expect(screen.getByText('Ofertas exclusivas')).toBeInTheDocument();
        expect(screen.getByText('Cashback em tudo')).toBeInTheDocument();
        expect(screen.getByText('Parceiros selecionados')).toBeInTheDocument();
        expect(screen.getByText('Entrega expressa')).toBeInTheDocument();
    });

    it('muda o botão para "Interesse registrado!" após clique', () => {
        render(<Marketplace onBack={vi.fn()} />);
        const btn = screen.getByRole('button', { name: /quero ser notificado/i });
        fireEvent.click(btn);
        expect(btn).toBeDisabled();
        expect(screen.getByText('Interesse registrado!')).toBeInTheDocument();
    });

    it('chama onBack ao clicar no botão voltar', () => {
        const onBack = vi.fn();
        render(<Marketplace onBack={onBack} />);
        fireEvent.click(screen.getByLabelText('Voltar'));
        expect(onBack).toHaveBeenCalledOnce();
    });

    it('modo isPreview renderiza card compacto sem botão CTA', () => {
        render(<Marketplace onBack={vi.fn()} isPreview />);
        expect(screen.getByText('Marketplace')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /quero ser notificado/i })).not.toBeInTheDocument();
    });
});
