import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MainMassCreatorFlow } from '../components/Admin/MainMassCreatorFlow';
import { generateRandomMassData, sanitizeToLatinUtf8 } from '../utils/massGenerator';
import { AppStateProvider } from '../contexts/AppStateContext';

const renderWithContext = (ui: React.ReactElement) => {
    return render(
        <AppStateProvider>
            {ui}
        </AppStateProvider>
    );
};

describe('⚡ MainMassCreatorFlow & 360 Global Mass Engine', () => {
    it('deve sanitizar e transliterar ideogramas e caracteres estrangeiros para UTF-8 latino', () => {
        expect(sanitizeToLatinUtf8('Tōkyō - Japān')).toBe('Tokyo - Japan');
        expect(sanitizeToLatinUtf8('São Paulo, Brasil')).toBe('Sao Paulo, Brasil');
        expect(sanitizeToLatinUtf8('طريق الملك فهد')).toBe(''); // Remove caracteres não-latinos mantendo limpo
    });

    it('deve gerar dados randômicos válidos para o Brasil, Japão e Arábia Saudita com transliteração estrita UTF-8', () => {
        const brData = generateRandomMassData('Brasil');
        expect(brData.countryOrigin).toBe('Brasil');
        expect(brData.cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
        expect(brData.address.street).not.toBe('');

        const jpData = generateRandomMassData('Japão');
        expect(jpData.countryOrigin).toBe('Japão');
        expect(jpData.fullName).toMatch(/^[A-Za-z\s]+$/); // Apenas letras latinas no nome

        const saData = generateRandomMassData('Arábia Saudita');
        expect(saData.countryOrigin).toBe('Arábia Saudita');
        expect(saData.fullName).toMatch(/^[A-Za-z\s-]+$/);
    });

    it('gera idade sempre no range 18–80 sem tutor (regra de tutor removida do gerador)', () => {
        // O gerador foi refatorado: idade sempre entre 18 e 80 (comentário no código:
        // "Idade sempre entre 18 e 80 (regra de tutor removida)") — o forceAgeCondition
        // é ignorado e hasTutor é sempre false.
        for (let i = 0; i < 20; i++) {
            const data = generateRandomMassData('Brasil');
            expect(data.age).toBeGreaterThanOrEqual(18);
            expect(data.age).toBeLessThanOrEqual(80);
            expect(data.hasTutor).toBe(false);
        }
    });

    it('renderiza o painel 3.0 em pagina unica, sem wizard de etapas', () => {
        renderWithContext(<MainMassCreatorFlow />);

        // Todas as secoes visiveis de uma vez — nao ha mais navegacao entre etapas.
        expect(screen.getByText('Perfil')).toBeInTheDocument();
        expect(screen.getByText('Endereço SAC')).toBeInTheDocument();
        expect(screen.getByText('Financeiro')).toBeInTheDocument();
        expect(screen.getByText('Cartão')).toBeInTheDocument();

        expect(screen.queryByRole('button', { name: /Avançar/i })).not.toBeInTheDocument();
    }, 25000);

    it('expoe as acoes de gerar e concluir no topo do painel', () => {
        renderWithContext(<MainMassCreatorFlow />);

        expect(screen.getByRole('button', { name: /Gerar Aleatório/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Concluir e Criar/i })).toBeInTheDocument();
    }, 25000);

    it('vira o cartao para revelar o CVV ao clicar', () => {
        renderWithContext(<MainMassCreatorFlow />);

        const card = screen.getByLabelText(/Virar cartão para ver CVV/i);
        expect(card).toHaveStyle({ transform: 'rotateY(0deg)' });

        fireEvent.click(card);
        expect(card).toHaveStyle({ transform: 'rotateY(180deg)' });
    }, 25000);
});
