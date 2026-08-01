#!/usr/bin/env node
/**
 * Estorno manual de pagamento órfão do Admin 99999999999
 * 
 * O Admin fez 2 pagamentos para a mesma fatura:
 *  1. R$ 4.284,94 → pagou a fatura TOTALMENTE (já corrigido pelo audit)
 *  2. R$ 399,99  → pagamento EXTRA após fatura já paga
 * 
 * Este R$ 399,99 foi debitado do saldo mas nunca aplicado a nenhuma invoice.
 * Deve ser estornado ao saldo do Admin.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');
const { esc } = require('../repositories/context');

const round2 = n => Math.round(n * 100) / 100;

async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('  ESTORNO — Pagamento Órfão Admin');
    console.log('═══════════════════════════════════════════');

    const db = DatabaseFactory.createDatabaseService();
    await db.connect();
    const fq = t => db.fq(t);
    const cpf = '99999999999';

    try {
        // 1. Verificar saldo atual
        const userRows = await db.executeQuery(`
            SELECT balance, full_name FROM ${fq('users')} WHERE cpf = ${esc(cpf)}
        `);
        const balanceAntes = parseFloat(userRows[0]?.balance || 0);
        const name = userRows[0]?.full_name || 'Admin';
        console.log(`  Usuário: ${name} (${cpf})`);
        console.log(`  Saldo ANTES: R$ ${balanceAntes.toFixed(2)}`);

        // 2. Verificar as transações INVOICE_PAYMENT
        const txs = await db.executeQuery(`
            SELECT id, amount, description, date
            FROM ${fq('transactions')}
            WHERE cpf = ${esc(cpf)} AND type = 'INVOICE_PAYMENT'
            ORDER BY date ASC
        `);
        console.log(`\n  Pagamentos encontrados: ${txs.length}`);
        for (const tx of txs) {
            console.log(`    R$ ${Math.abs(parseFloat(tx.amount || 0)).toFixed(2)}  ${(tx.description || '').trim()}  ${String(tx.date).substring(0, 19)}`);
        }

        // 3. Estornar R$ 399,99
        const refundAmount = 399.99;
        await db.executeQuery(`
            UPDATE ${fq('users')}
            SET balance = COALESCE(balance, 0) + ${refundAmount.toFixed(2)},
                updated_at = CURRENT_TIMESTAMP
            WHERE cpf = ${esc(cpf)}
        `);
        console.log(`\n  💰 Estornado: R$ ${refundAmount.toFixed(2)}`);

        // 4. Verificar saldo após
        const userRowsAfter = await db.executeQuery(`
            SELECT balance FROM ${fq('users')} WHERE cpf = ${esc(cpf)}
        `);
        const balanceDepois = parseFloat(userRowsAfter[0]?.balance || 0);
        console.log(`  Saldo DEPOIS: R$ ${balanceDepois.toFixed(2)}`);
        console.log(`  Diferença:    R$ ${(balanceDepois - balanceAntes).toFixed(2)}`);

        console.log('\n  ✅ Estorno concluído com sucesso!');

    } catch (err) {
        console.error('❌ Erro:', err.message);
        process.exit(1);
    } finally {
        try { await db.disconnect(); } catch (_) {}
    }
}

main().catch(err => {
    console.error('❌ Fatal:', err);
    process.exit(1);
});
