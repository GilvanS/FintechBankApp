import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Imports dos utilitarios e componentes da Fase 1, 2 e 3
import {
    round2,
    computeInvoiceGross,
    computeInvoiceOwed,
    planDistribution,
    calcMulta,
    calcJurosMora,
    calcAllCharges
} from '../src/utils/invoiceMath';

import {
    savePaymentCodesToCache,
    getPaymentCodesFromCache,
    removePaymentCodesFromCache,
    PaymentCodesData
} from '../src/utils/paymentCodeCache';

import OverdueBadge from '../src/components/OverdueBadge';
import PaymentTypeFilter from '../src/components/PaymentTypeFilter';
import { HeroBannerSVG, VoucherIconSVG, FastDeliverySVG, CashbackCoinsSVG } from '../src/components/ShopSVGIllustrations';

describe('Calculos Matematica de Fatura (invoiceMath.ts)', () => {
    it('arredonda valores corretamente com round2', () => {
        expect(round2(10.555)).toBe(10.56);
        expect(round2(10.554)).toBe(10.55);
    });

    it('calcula o valor bruto e devendo da fatura', () => {
        const invoice = { valor_total: 1000, valor_pago: 200 };
        expect(computeInvoiceOwed(invoice)).toBe(800);
    });

    it('calcula multa e encargos corretamente', () => {
        expect(calcMulta(1000)).toBe(20); // 2%
        const charges = calcAllCharges(1000, 10);
        expect(charges.multa).toBe(20);
        expect(charges.total).toBeGreaterThan(20);
    });

    it('distribui pagamentos de faturas corretamente', () => {
        const invoices = [
            { id: '1', valor_total: 500, valor_pago: 0 },
            { id: '2', valor_total: 300, valor_pago: 0 }
        ];
        const res = planDistribution(invoices, 600);
        expect(res.applied).toBe(600);
        expect(res.invoices[0].isFullyPaid).toBe(true);
        expect(res.invoices[1].isFullyPaid).toBe(false);
    });
});

describe('Cache de Codigos de Pagamento (paymentCodeCache.ts)', () => {
    const mockData: PaymentCodesData = {
        invoice: { id: 'inv1', amount: 100, amountFormatted: 'R$ 100,00', dueDate: '2026-09-01', dueDateFormatted: '01/09/2026', payerName: 'TESTE', payerCpf: '11111111111' },
        boleto: { barcode: '123', linhaDigitavel: '123', linhaDigitavelRaw: '123', amount: 100, amountFormatted: 'R$ 100,00', dueDate: '2026-09-01', dueDateFormatted: '01/09/2026', dueDateFactor: 9999, beneficiary: { name: 'V', cnpj: '0', bankCode: '341', bankName: 'I' }, payer: { name: 'T', cpf: '1', cpfFormatted: '1' }, invoiceId: 'inv1' },
        pix: { payload: 'pix123', qrcodeSvg: '<svg></svg>', amount: 100, amountFormatted: 'R$ 100,00', pixKey: 'key', txid: 'tx1', beneficiary: { name: 'V', cnpj: '0' }, payer: { name: 'T', cpf: '1', cpfFormatted: '1' }, invoiceId: 'inv1' },
        generatedAt: new Date().toISOString()
    };

    it('salva e recupera dados de pagamento do cache', async () => {
        await savePaymentCodesToCache('11111111111', 'inv1', mockData, 60000);
        const cached = await getPaymentCodesFromCache('11111111111', 'inv1');
        expect(cached).not.toBeNull();
        expect(cached?.invoice.id).toBe('inv1');
    });

    it('remove item do cache', async () => {
        await savePaymentCodesToCache('11111111111', 'inv2', mockData, 60000);
        await removePaymentCodesFromCache('11111111111', 'inv2');
        const cached = await getPaymentCodesFromCache('11111111111', 'inv2');
        expect(cached).toBeNull();
    });
});

describe('Componentes Visuais da Fase 2 e 3', () => {
    it('renderiza OverdueBadge corretamente', () => {
        render(<OverdueBadge closedInvoice={500} daysOverdue={10} />);
        expect(screen.getByText(/Fatura Fechada em Atraso \(10 dias\)/i)).toBeInTheDocument();
    });

    it('renderiza PaymentTypeFilter com opcoes de filtro', () => {
        const onFilterChange = vi.fn();
        render(<PaymentTypeFilter activeFilter="ALL" onFilterChange={onFilterChange} isMidnight={false} />);
        expect(screen.getByText(/Todos/i)).toBeInTheDocument();
    });

    it('renderiza ilustracoes SVG da Volt Store sem erros', () => {
        const { container } = render(
            <div>
                <HeroBannerSVG />
                <VoucherIconSVG />
                <FastDeliverySVG />
                <CashbackCoinsSVG />
            </div>
        );
        expect(container.querySelectorAll('svg').length).toBe(4);
    });
});