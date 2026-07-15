const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'pwd123',
  database: 'fintechbank',
});

async function main() {
  try {
    const res = await pool.query(`SELECT id, type, amount, date, description FROM fintech.transactions WHERE cpf = '11111111111'`);
    const cardRows = res.rows;
    
    // Simulate logic
    const today = new Date();
    // Assuming from previous logs:
    let closingDay = 9;
    let dueDay = 20;

    let openInvoiceMonth = today.getUTCMonth();
    let openInvoiceYear = today.getUTCFullYear();

    if (today.getUTCDate() > closingDay) {
        openInvoiceMonth += 1;
        if (openInvoiceMonth > 11) {
            openInvoiceMonth = 0;
            openInvoiceYear += 1;
        }
    }

    let openDueMonth = openInvoiceMonth;
    let openDueYear = openInvoiceYear;
    if (closingDay > dueDay) {
        openDueMonth += 1;
        if (openDueMonth > 11) {
            openDueMonth = 0;
            openDueYear += 1;
        }
    }

    const _closeDate = new Date(Date.UTC(openInvoiceYear, openInvoiceMonth, closingDay, 23, 59, 59, 999));
    const _closeMs = _closeDate.getTime();
    const invoiceDueDateEndOfDay = new Date(Date.UTC(openDueYear, openDueMonth, dueDay, 23, 59, 59, 999));

    const _prevCd = new Date(_closeMs);
    _prevCd.setUTCMonth(_prevCd.getUTCMonth() - 1);
    const _prevCloseMs = _prevCd.getTime();

    const _prevPrevCd = new Date(_closeMs);
    _prevPrevCd.setUTCMonth(_prevPrevCd.getUTCMonth() - 2);
    const _prevPrevCloseMs = _prevPrevCd.getTime();

    console.log('_prevPrevCloseDate:', new Date(_prevPrevCloseMs).toISOString());
    console.log('_prevCloseDate:', new Date(_prevCloseMs).toISOString());
    console.log('_closeDate:', new Date(_closeMs).toISOString());

    const closedTransactions = cardRows.filter(tx => {
        const txDate = new Date(tx.date).getTime();
        if (txDate <= _prevPrevCloseMs || txDate > _prevCloseMs) return false;
        if (tx.type === 'INVOICE_INSTALLMENT') return true;
        if (tx.type === 'CREDIT' || tx.type === 'SHOP_CREDIT') return true;
        return false;
    });

    console.log('closedTransactions length:', closedTransactions.length);
    console.log(closedTransactions.map(x => ({ date: x.date, type: x.type })));
    
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
main();
