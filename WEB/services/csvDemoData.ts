import { User, Transaction, CustomerCard, PixKey, CardTransaction } from '../types';

/**
 * Carrega as massas de demonstração a partir dos CSVs exportados do PostgreSQL
 * (API/scripts/export_demo_csv.cjs → WEB/public/demo-data/).
 *
 * É a fonte de verdade do modo demo: só loga quem existe nesses CSVs.
 * Mudou o schema no banco? Roda o export de novo e os CSVs (portfólio + demo)
 * atualizam juntos.
 */

// Os CSVs não carregam senha (excluída no export por segurança). No modo demo
// toda massa usa esta senha.
export const DEMO_PASSWORD = 'admin999';

const CSV_FILES = ['users', 'cards', 'transactions', 'invoices', 'pix_keys'] as const;

type CsvRow = Record<string, string>;

/** Parser RFC-4180: respeita aspas, vírgulas e quebras de linha dentro do campo. */
function parseCsv(text: string): CsvRow[] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (inQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            row.push(field);
            field = '';
        } else if (char === '\r') {
            // ignora: o \n seguinte fecha a linha
        } else if (char === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += char;
        }
    }
    if (field !== '' || row.length) {
        row.push(field);
        rows.push(row);
    }

    if (!rows.length) return [];
    const header = rows[0];
    return rows.slice(1)
        .filter((r) => r.some((cell) => cell !== ''))
        .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const num = (v: string | undefined): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const bool = (v: string | undefined): boolean => v === 'true' || v === 't' || v === '1';

const CARD_BRANDS = ['MASTERCARD', 'VISA', 'ELO', 'AMEX'] as const;
const normalizeBrand = (raw: string): CustomerCard['brand'] => {
    const upper = (raw || '').toUpperCase();
    return (CARD_BRANDS as readonly string[]).includes(upper) ? (upper as CustomerCard['brand']) : 'MASTERCARD';
};

async function fetchCsv(name: string): Promise<CsvRow[]> {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}demo-data/${name}.csv`);
    if (!res.ok) throw new Error(`Falha ao carregar ${name}.csv (HTTP ${res.status})`);
    return parseCsv(await res.text());
}

function groupBy(rows: CsvRow[], key: string): Map<string, CsvRow[]> {
    const map = new Map<string, CsvRow[]>();
    rows.forEach((row) => {
        const k = row[key];
        if (!k) return;
        const list = map.get(k);
        if (list) list.push(row);
        else map.set(k, [row]);
    });
    return map;
}

/** Encargos vêm calculados do banco (motor de faturamento) — aqui só somamos. */
function invoiceTotalWithCharges(inv: CsvRow): number {
    const stored = num(inv.valor_total_com_encargos);
    if (stored > 0) return stored;
    return num(inv.valor_total)
        + num(inv.valor_multa)
        + num(inv.valor_juros_mora)
        + num(inv.valor_juros_remuneratorios)
        + num(inv.valor_iof);
}

function parseItemized(raw: string): CardTransaction[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as CardTransaction[]) : [];
    } catch {
        return [];
    }
}

export async function loadDemoUsersFromCsv(): Promise<User[]> {
    const [usersRows, cardsRows, txRows, invoiceRows, pixRows] = await Promise.all(
        CSV_FILES.map((f) => fetchCsv(f))
    );

    const cardsByCpf = groupBy(cardsRows, 'user_cpf');
    const txByCpf = groupBy(txRows, 'cpf');
    const invoicesByCpf = groupBy(invoiceRows, 'cpf');
    const pixByCpf = groupBy(pixRows, 'cpf');

    return usersRows.map((u): User => {
        const cpf = u.cpf;

        // Fatura fechada mais recente da massa — traz os encargos já calculados.
        const invoices = (invoicesByCpf.get(cpf) || [])
            .slice()
            .sort((a, b) => (b.due_date || '').localeCompare(a.due_date || ''));
        const closed = invoices[0];

        const closedTotal = closed ? invoiceTotalWithCharges(closed) : 0;
        const closedResidual = closed ? Math.max(0, closedTotal - num(closed.valor_pago)) : 0;
        const closedTransactions = closed ? parseItemized(closed.itemized_transactions) : [];

        // A fatura ABERTA não existe como linha no banco: é derivada das compras de
        // crédito que ainda não entraram no snapshot da fatura fechada.
        const closedTxIds = new Set(closedTransactions.map((t) => t.id));
        const allTx = txByCpf.get(cpf) || [];
        const openCardTx: CardTransaction[] = allTx
            .filter((t) => ['SHOP_CREDIT', 'SUBSCRIPTION', 'INVOICE_INSTALLMENT'].includes(t.type))
            .filter((t) => !closedTxIds.has(t.id))
            .map((t) => ({
                id: t.id,
                date: t.date,
                merchant: t.description,
                amount: num(t.amount),
                type: 'CREDIT',
            } as CardTransaction));
        const currentInvoice = openCardTx.reduce((sum, t) => sum + t.amount, 0);

        const cards: CustomerCard[] = (cardsByCpf.get(cpf) || []).map((c) => ({
            id: c.id,
            type: (c.card_type || '').toUpperCase() === 'VIRTUAL' ? 'VIRTUAL' : 'PHYSICAL',
            brand: normalizeBrand(c.card_brand),
            name: c.nickname || `Volt ${normalizeBrand(c.card_brand)}`,
            cardNumberMasked: c.card_number,
            expirationDate: c.expiry_short || c.expiry,
            isBlocked: bool(c.is_blocked),
            limit: num(u.credit_card_total_limit),
            dueDay: num(u.credit_card_due_day),
            createdAt: c.created_at,
        }));

        const transactions: Transaction[] = allTx.map((t) => ({
            id: t.id,
            type: t.type as Transaction['type'],
            amount: num(t.amount),
            date: t.date,
            description: t.description,
            from: t.from_user || undefined,
            to: t.to_user || undefined,
        }));

        const pixKeys: PixKey[] = (pixByCpf.get(cpf) || []).map((k) => ({
            type: k.type as PixKey['type'],
            key: k.key,
        }));

        return {
            cpf,
            fullName: u.full_name,
            username: u.username || undefined,
            email: u.email,
            password: DEMO_PASSWORD,
            balance: num(u.balance),
            transactions,
            isBlocked: bool(u.is_blocked),
            role: u.role === 'admin' ? 'admin' : 'user',
            pixDailyLimit: num(u.pix_daily_limit),
            pixKeys,
            pixContacts: [],
            limitIncreaseRequest: null,
            showStoriesPopup: bool(u.show_stories_popup),
            purchasedItems: [],
            profileDescription: u.profile_description || undefined,
            profileMessage: u.profile_message || undefined,
            createdAt: u.created_at || undefined,
            birthDate: u.birth_date || undefined,
            age: u.age ? num(u.age) : undefined,
            countryOrigin: u.country_origin || undefined,
            accountStatus: (u.account_status as User['accountStatus']) || undefined,
            daysOverdue: num(u.days_overdue),
            address: u.address_cep
                ? {
                      cep: u.address_cep,
                      street: u.address_street,
                      number: u.address_number,
                      complement: u.address_complement || undefined,
                      neighborhood: u.address_neighborhood,
                      city: u.address_city,
                      state: u.address_state,
                  }
                : undefined,
            cards,
            creditCard: {
                number: cards[0]?.cardNumberMasked || '**** **** **** 0000',
                dueDate: u.credit_card_due_date,
                invoiceDueDate: u.credit_card_invoice_due_date,
                closedInvoiceDueDate: closed?.due_date,
                currentInvoice,
                closedInvoice: closedResidual,
                availableLimit: num(u.credit_card_available_limit),
                totalLimit: num(u.credit_card_total_limit),
                pointsBalance: num(u.credit_card_points_balance),
                isBlocked: bool(u.credit_card_is_blocked),
                isActivated: bool(u.card_is_activated),
                deliveryStatus: (u.card_delivery_status as any) || undefined,
                daysOverdue: num(u.days_overdue),
                dueDay: num(u.credit_card_due_day),
                closedInvoiceTotal: closedTotal,
                closedInvoiceAmount: closedResidual,
                closedInvoiceIsPaid: closed ? closedResidual <= 0 : false,
                closedInvoicePaidAt: closed?.data_pagamento || null,
                currentInvoiceTotal: currentInvoice,
                closedInvoiceCharges: closed
                    ? {
                          multa: num(closed.valor_multa),
                          jurosMora: num(closed.valor_juros_mora),
                          jurosRemuneratorios: num(closed.valor_juros_remuneratorios),
                          iof: num(closed.valor_iof),
                          totalEncargos:
                              num(closed.valor_multa) +
                              num(closed.valor_juros_mora) +
                              num(closed.valor_juros_remuneratorios) +
                              num(closed.valor_iof),
                      }
                    : undefined,
                transactions: openCardTx,
                closedTransactions,
            } as User['creditCard'],
        };
    });
}
