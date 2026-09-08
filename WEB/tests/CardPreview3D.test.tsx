import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CardPreview3D from '../components/Onboard/CardPreview3D';

describe('CardPreview3D Component', () => {
  it('renders printed name, brand, tier, billing due day badge, and plan name', () => {
    render(
      <CardPreview3D
        brand="VISA"
        tier="BLACK"
        printedName="SILVA M SILVA"
        billingDueDay={10}
        plan="VIP_BLACK"
        estimatedLimit={15000}
      />
    );

    expect(screen.getAllByText('SILVA M SILVA').length).toBeGreaterThan(0);
    expect(screen.getByText('VISA')).toBeInTheDocument();
    expect(screen.getAllByText('BLACK').length).toBeGreaterThan(0);
    expect(screen.getByText('VENC DIA 10')).toBeInTheDocument();
    expect(screen.getByText(/VIP_BLACK|VIP Black/i)).toBeInTheDocument();
  });

  it('asserts security masking for card number and CVV', () => {
    render(
      <CardPreview3D
        brand="MASTERCARD"
        tier="GOLD"
        printedName="JOAO SILVA"
        billingDueDay={15}
        plan="FREE"
      />
    );

    expect(screen.getByText('•••• •••• •••• 8832')).toBeInTheDocument();
    expect(screen.getByText('•••')).toBeInTheDocument();
  });

  it('calculates and displays cost summary for card tier fee and plan fee', () => {
    const { container } = render(
      <CardPreview3D
        brand="ELO"
        tier="PLATINUM"
        printedName="MARIA OLIVEIRA"
        billingDueDay={5}
        plan="PRO"
        estimatedLimit={8000}
      />
    );

    // PLATINUM = R$ 29,90, PRO = R$ 19,90 => Total = R$ 49,80
    expect(screen.getByText(/Anuidade Card/i)).toBeInTheDocument();
    expect(screen.getByText(/Plano/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Mensal/i)).toBeInTheDocument();

    // Check formatted values
    expect(container.textContent).toContain('29,90');
    expect(container.textContent).toContain('19,90');
    expect(container.textContent).toContain('49,80');
    expect(container.textContent).toContain('8.000,00');
  });
});
