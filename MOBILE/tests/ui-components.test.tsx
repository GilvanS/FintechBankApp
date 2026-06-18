import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import LoadingSpinner from '../src/components/LoadingSpinner';
import ErrorState from '../src/components/ErrorState';

describe('LoadingSpinner', () => {
    it('renderiza com mensagem padrão', () => {
        render(<LoadingSpinner />);
        expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });

    it('renderiza com mensagem customizada', () => {
        render(<LoadingSpinner message="Aguarde..." />);
        expect(screen.getByText('Aguarde...')).toBeInTheDocument();
    });

    it('não renderiza mensagem quando string vazia', () => {
        render(<LoadingSpinner message="" />);
        expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
    });

    it('aplica className customizada ao container', () => {
        const { container } = render(<LoadingSpinner className="h-64" />);
        expect(container.firstChild).toHaveClass('h-64');
    });

    it('renderiza o elemento do spinner animado', () => {
        const { container } = render(<LoadingSpinner />);
        const spinner = container.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
    });
});

describe('ErrorState', () => {
    it('renderiza com mensagem padrão', () => {
        render(<ErrorState />);
        expect(screen.getByText('Algo deu errado. Tente novamente.')).toBeInTheDocument();
    });

    it('renderiza com mensagem customizada', () => {
        render(<ErrorState message="Falha de conexão." />);
        expect(screen.getByText('Falha de conexão.')).toBeInTheDocument();
    });

    it('não exibe botão de retry quando onRetry não é fornecido', () => {
        render(<ErrorState />);
        expect(screen.queryByRole('button', { name: /tentar novamente/i })).not.toBeInTheDocument();
    });

    it('exibe botão de retry quando onRetry é fornecido', () => {
        render(<ErrorState onRetry={vi.fn()} />);
        expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
    });

    it('chama onRetry ao clicar no botão', () => {
        const onRetry = vi.fn();
        render(<ErrorState onRetry={onRetry} />);
        fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
        expect(onRetry).toHaveBeenCalledOnce();
    });

    it('aplica className customizada ao container', () => {
        const { container } = render(<ErrorState className="h-64" />);
        expect(container.firstChild).toHaveClass('h-64');
    });

    it('renderiza o ícone de aviso', () => {
        const { container } = render(<ErrorState />);
        const icon = container.querySelector('svg');
        expect(icon).toBeInTheDocument();
    });
});
