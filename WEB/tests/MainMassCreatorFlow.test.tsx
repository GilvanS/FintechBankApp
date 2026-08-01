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

    it('deve exigir o cadastro do Tutor Legal quando a idade for menor que 18 ou maior que 80 anos', () => {
        const under18 = generateRandomMassData('Brasil', 'under18');
        expect(under18.age).toBeLessThan(18);
        expect(under18.hasTutor).toBe(true);
        expect(under18.tutor?.fullName).toBeTruthy();

        const over80 = generateRandomMassData('Brasil', 'over80');
        expect(over80.age).toBeGreaterThan(80);
        expect(over80.hasTutor).toBe(true);
        expect(over80.tutor?.fullName).toBeTruthy();
    });

    it('deve renderizar a jornada multi-telas de 4 etapas e navegar com sucesso', () => {
        renderWithContext(<MainMassCreatorFlow />);

        // Etapa 1 deve estar visível
        expect(screen.getByText(/Etapa 1: Dados Pessoais, País e Governança de Idade/i)).toBeInTheDocument();

        // Clicar em Avançar para Etapa 2
        const nextButton = screen.getByRole('button', { name: /Avançar/i });
        fireEvent.click(nextButton);

        // Etapa 2 (Endereço SAC) visível
        expect(screen.getByText(/Etapa 2: Endereço Residencial para Entregas & Atendimento SAC/i)).toBeInTheDocument();
    }, 25000);
});
