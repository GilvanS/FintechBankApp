const { runInvoiceImmutabilityHealth } = require('../../services/invoiceImmutabilityHealth');
const telegramService = require('../../services/telegramService');

jest.mock('../../services/telegramService', () => ({
  formatCpf: jest.fn(cpf => `${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9)}`),
  alertGroup: jest.fn()
}));

describe('Invoice Immutability Health Check & Messages', () => {
  let mockDbService;
  let mockAuditLog;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditLog = jest.fn();
  });

  test('deve detectar PAYMENT_SEM_INVOICE_ID e formatar mensagem de alerta rica', async () => {
    mockDbService = {
      executeQuery: jest.fn().mockImplementation((sql) => {
        if (sql.includes("name LIKE '%005%'")) {
          return Promise.resolve([{ created_at: '2026-08-01T00:00:00.000Z' }]);
        }
        if (sql.includes("t.invoice_id IS NULL")) {
          return Promise.resolve([{
            id: 'tx-123',
            cpf: '20250513611',
            amount: -4985.33,
            date: '2026-08-09T20:17:39Z',
            description: 'Pagamento fatura',
            full_name: 'Karla Melo'
          }]);
        }
        return Promise.resolve([]);
      }),
      fq: jest.fn(t => `fintech.${t}`)
    };

    const res = await runInvoiceImmutabilityHealth(mockDbService, mockAuditLog);

    expect(res.success).toBe(true);
    expect(res.count).toBe(1);
    expect(telegramService.alertGroup).toHaveBeenCalledWith(
      expect.stringContaining('INVOICE_PAYMENT de R$ 4985.33 em 2026-08-09T20:17:39Z'),
      'daily_anomaly'
    );
  });

  test('deve detectar PAGAMENTO_ACIMA_DO_VALOR com contexto de cascata/excedente', async () => {
    mockDbService = {
      executeQuery: jest.fn().mockImplementation((sql) => {
        if (sql.includes("name LIKE '%005%'")) {
          return Promise.resolve([{ created_at: '2026-08-01T00:00:00.000Z' }]);
        }
        if (sql.includes("HAVING COALESCE(SUM(ABS(CAST(t.amount AS DECIMAL(15,2)))), 0) > CAST(i.valor_total")) {
          return Promise.resolve([{
            cpf: '44444444444',
            invoice_id: 'cb6f219d-d380-4a0b-bd11-90ee4b6f7e61',
            valor_total: '1146.07',
            due_date: '2026-08-10T15:00:00Z',
            full_name: 'Fernanda Lima',
            pago: '5016.93'
          }]);
        }
        return Promise.resolve([]);
      }),
      fq: jest.fn(t => `fintech.${t}`)
    };

    const res = await runInvoiceImmutabilityHealth(mockDbService, mockAuditLog);

    expect(res.success).toBe(true);
    expect(res.count).toBe(1);
    expect(telegramService.alertGroup).toHaveBeenCalledWith(
      expect.stringContaining('Fatura cb6f219d-d380-4a0b-bd11-90ee4b6f7e61 (vencida 2026-08-10T15:00:00Z): pago R$ 5016.93, devido R$ 1146.07, excedente R$ 3870.86.'),
      'daily_anomaly'
    );
  });
});
