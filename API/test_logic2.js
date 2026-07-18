const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'pwd123',
  database: 'fintechbank',
});

function toISO(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

async function main() {
  try {
    const res = await pool.query(`SELECT id, type, amount, date, description FROM fintech.transactions WHERE cpf = '11111111111'`);
    const cardRows = res.rows;
    
    // Simulate mapping
    const cardTransactions = cardRows.map(r => {
        const base = {
            id: r.id,
            date: toISO(r.date),
            amount: Math.abs(parseFloat(r.amount || 0)),
        };
        const desc = r.description || '';
        if (r.type === 'SHOP_CREDIT' || r.type === 'CREDIT') {
            return { ...base, merchant: desc || 'Compra credito', type: 'CREDIT' };
        }
        return null;
    }).filter(Boolean);

    const today = new Date();
    let closingDay = 9; let dueDay = 20;

    let openInvoiceMonth = today.getUTCMonth();
    let openInvoiceYear = today.getUTCFullYear();
    if (today.getUTCDate() > closingDay) { openInvoiceMonth += 1; if (openInvoiceMonth > 11) { openInvoiceMonth = 0; openInvoiceYear += 1; } }

    const _closeMs = new Date(Date.UTC(openInvoiceYear, openInvoiceMonth, closingDay, 23, 59, 59, 999)).getTime();
    
    const _prevCd = new Date(_closeMs);
    _prevCd.setUTCMonth(_prevCd.getUTCMonth() - 1);
    const _prevCloseMs = _prevCd.getTime();

    const _prevPrevCd = new Date(_closeMs);
    _prevPrevCd.setUTCMonth(_prevPrevCd.getUTCMonth() - 2);
    const _prevPrevCloseMs = _prevPrevCd.getTime();

    const closedTransactions = cardTransactions.filter(tx => {
        const txDate = new Date(tx.date).getTime();
        if (txDate <= _prevPrevCloseMs || txDate > _prevCloseMs) return false;
        if (tx.type === 'INVOICE_INSTALLMENT') return true;
        if (tx.type === 'CREDIT' || tx.type === 'SHOP_CREDIT') return true;
        return false;
    });

    console.log('closedTransactions length:', closedTransactions.length);
    console.log(closedTransactions);
    
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
main();
