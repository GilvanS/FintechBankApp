import { describe, it, expect, beforeEach } from 'vitest';
import { shouldShowOverdueAlert } from '../components/OverdueAlertModal';
import type { User } from '../types';

function makeUser(overrides: Partial<User['creditCard']> = {}): User {
  const nowIso = new Date().toISOString();
  return {
    cpf: '00000000000',
    fullName: 'Usuario Teste',
    email: 'user@test.com',
    password: '',
    balance: 1000,
    transactions: [],
    isBlocked: false,
    role: 'user',
    pixDailyLimit: 1000,
    pixKeys: [],
    pixContacts: [],
    limitIncreaseRequest: null,
    showStoriesPopup: false,
    purchasedItems: [],
    creditCard: {
      number: '1111222233334444',
      dueDate: nowIso,
      invoiceDueDate: nowIso,
      closedInvoiceDueDate: nowIso,
      currentInvoice: 0,
      closedInvoice: 3870.86,
      availableLimit: 1500,
      totalLimit: 5000,
      pointsBalance: 0,
      isBlocked: false,
      transactions: [],
      closedTransactions: [],
      ...overrides,
    },
  } as User;
}

describe('OverdueAlertModal — shouldShowOverdueAlert', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('mostra o alerta quando há saldo em atraso e o parâmetro está ligado (padrão)', () => {
    const user = makeUser();
    expect(shouldShowOverdueAlert(user)).toBe(true);
  });

  it('não mostra o alerta quando o parâmetro volt_show_overdue_alert_popup está desligado', () => {
    localStorage.setItem('volt_show_overdue_alert_popup', 'false');
    const user = makeUser();
    expect(shouldShowOverdueAlert(user)).toBe(false);
  });

  it('não mostra o alerta quando não há saldo em atraso', () => {
    const user = makeUser({ closedInvoice: 0 });
    expect(shouldShowOverdueAlert(user)).toBe(false);
  });

  it('não mostra o alerta quando a fatura em atraso já foi quitada', () => {
    const user = makeUser({ closedInvoiceIsPaid: true } as any);
    expect(shouldShowOverdueAlert(user)).toBe(false);
  });

  it('não mostra novamente dentro de 1 hora após já ter sido exibido', () => {
    localStorage.setItem('overdue_alert_last_shown', Date.now().toString());
    const user = makeUser();
    expect(shouldShowOverdueAlert(user)).toBe(false);
  });
});
