import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AllureShell, type AllureSection } from '../components/shared/AllureShell';
import { LayoutGrid, List } from 'lucide-react';

const mockSections: AllureSection<'sec1' | 'sec2'>[] = [
  { key: 'sec1', label: 'Seção 1', icon: LayoutGrid },
  { key: 'sec2', label: 'Seção 2', icon: List },
];

describe('AllureShell', () => {
  it('renders title, subtitle and sections', () => {
    const { getByText, getAllByText } = render(
      <AllureShell
        title="Test Shell"
        subtitle="Subtítulo de Teste"
        theme="midnight"
        onBack={vi.fn()}
        sections={mockSections}
        activeSection="sec1"
        onSelectSection={vi.fn()}
      >
        <div>Conteúdo Principal</div>
      </AllureShell>
    );

    expect(getByText('Test Shell')).toBeInTheDocument();
    expect(getByText('Subtítulo de Teste')).toBeInTheDocument();
    // "Seção 1" aparece 2x: sidebar desktop + nav de pills mobile (fallback responsivo)
    expect(getAllByText('Seção 1').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Conteúdo Principal')).toBeInTheDocument();
  });

  it('calls onSelectSection when section button is clicked', () => {
    const handleSelect = vi.fn();
    const { getByTitle } = render(
      <AllureShell
        title="Test Shell"
        theme="yellow"
        onBack={vi.fn()}
        sections={mockSections}
        activeSection="sec1"
        onSelectSection={handleSelect}
      >
        <div>Content</div>
      </AllureShell>
    );

    fireEvent.click(getByTitle('Seção 2'));
    expect(handleSelect).toHaveBeenCalledWith('sec2');
  });

  it('calls onBack when back button is clicked', () => {
    const handleBack = vi.fn();
    const { getByLabelText } = render(
      <AllureShell
        title="Test Shell"
        theme="midnight"
        onBack={handleBack}
        sections={mockSections}
        activeSection="sec1"
        onSelectSection={vi.fn()}
      >
        <div>Content</div>
      </AllureShell>
    );

    fireEvent.click(getByLabelText('Voltar'));
    expect(handleBack).toHaveBeenCalled();
  });

  it('starts with sidebar on the left and toggles side without persisting', () => {
    const { getByTitle } = render(
      <AllureShell
        title="Test Shell"
        theme="midnight"
        onBack={vi.fn()}
        sections={mockSections}
        activeSection="sec1"
        onSelectSection={vi.fn()}
      >
        <div>Content</div>
      </AllureShell>
    );

    const toggleBtn = getByTitle('Mover menu para direita');
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(getByTitle('Mover menu para esquerda')).toBeInTheDocument();
    expect(localStorage.getItem('allure-sidebar-side')).toBeNull();
  });

  it('renders expanded modal content and handles close', () => {
    const handleClose = vi.fn();
    const { getByText, getByLabelText } = render(
      <AllureShell
        title="Test Shell"
        theme="midnight"
        onBack={vi.fn()}
        sections={mockSections}
        activeSection="sec1"
        onSelectSection={vi.fn()}
        expandedContent={<div>Conteúdo do Modal</div>}
        onCloseExpanded={handleClose}
      >
        <div>Content</div>
      </AllureShell>
    );

    expect(getByText('Conteúdo do Modal')).toBeInTheDocument();
    fireEvent.click(getByLabelText('Fechar'));
    expect(handleClose).toHaveBeenCalled();
  });
});
