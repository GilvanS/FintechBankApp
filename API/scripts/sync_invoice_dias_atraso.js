/**
 * sync_invoice_dias_atraso.js
 * 
 * Script standalone que atualiza dias_atraso em TODAS as invoices FECHADAS não pagas
 * com base na data atual: dias_atraso = GREATEST(0, TODAY - due_date).
 * 
 * O runBillingValidation já faz isso por usuário no loop, mas apenas QUANDO
 * o users.days_overdue precisa ser alterado. Este script garante que todas
 * as invoices sejam sincronizadas independentemente.
 * 
 * Uso:
 *   node scripts/sync_invoice_dias_atraso.js              # apenas audit (--dry-run)
 *   node scripts/sync_invoice_dias_atraso.js --fix         # executa o UPDATE
 *   node scripts/sync_invoice_dias_atraso.js --fix --cpf=02816769844  # apenas 1 CPF
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const PostgresProvider = require('../services/database/PostgresProvider');
const { dayKey } = require('../utils/timezone');

const args = process.argv.slice(2);
const isFix = args.includes('--fix') || args.includes('--confirm');
const cpfFilter = args.find(a => a.startsWith('--cpf='))?.split('=')[1] || null;

async function run() {
    const config = {
        schema: process.env.DB_SCHEMA || 'fintech',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'pwd123',
        database: process.env.DB_NAME || 'fintechbank'
    };
    const db = new PostgresProvider(config);
    await db.connect();

    try {
        const cpfClause = cpfFilter ? `AND i.cpf = '${cpfFilter}'` : '';
        const mode = isFix ? '--fix (ESCREVENDO)' : '--dry-run (apenas leitura)';

        console.log(`\n${'='.repeat(70)}`);
        console.log(`  SINCronizando dias_atraso nas invoices ${mode}`);
        console.log(`  Filtro CPF: ${cpfFilter || 'TODOS'}`);
        console.log(`  Data base: ${dayKey(new Date())}`);
        console.log(`${'='.repeat(70)}\n`);

        // 1. AUDIT: listar invoices com dias_atraso desatualizado
        const audit = await db.executeQuery(`
            SELECT i.cpf, u.full_name, i.id, i.due_date, 
                   i.dias_atraso AS dias_atual,
                   GREATEST(0, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - i.due_date))::INT / 86400) AS dias_correto,
                   i.valor_total, i.valor_pago, i.data_pagamento,
                   u.days_overdue AS user_days_overdue
            FROM ${config.schema}.invoices i
            JOIN ${config.schema}.users u ON u.cpf = i.cpf
            WHERE i.status = 'FECHADA'
              AND i.data_pagamento IS NULL
              AND i.due_date < CURRENT_TIMESTAMP
              ${cpfClause}
            ORDER BY ABS(GREATEST(0, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - i.due_date))::INT / 86400) - COALESCE(i.dias_atraso, 0)) DESC
        `);

        if (!audit || audit.length === 0) {
            console.log('✅ Nenhuma invoice fechada/não paga encontrada.');
            await db.disconnect();
            process.exit(0);
        }

        console.log(`📊 Invoices vencidas não pagas: ${audit.length}`);
        console.log(`\n┌──────┬─────────────────┬──────────────────────────┬────────────┬──────────┬────────────┬────────────┬────────────┐`);
        console.log(`│  #   │ CPF             │ Nome                     │ Vencimento │ Dias BD  │ Dias Real  │ Diferença  │ User DO    │`);
        console.log(`├──────┼─────────────────┼──────────────────────────┼────────────┼──────────┼────────────┼────────────┼────────────┤`);

        let desatualizadas = 0;
        for (let i = 0; i < audit.length; i++) {
            const r = audit[i];
            const nome = (r.full_name || 'N/A').substring(0, 24);
            const dueStr = r.due_date ? new Date(r.due_date).toISOString().split('T')[0] : 'N/A';
            const diasAtual = parseInt(r.dias_atual || 0);
            const diasCorreto = parseInt(r.dias_correto || 0);
            const diff = Math.abs(diasCorreto - diasAtual);
            const flag = diff > 0 ? '⚠️' : '  ';
            if (diff > 0) desatualizadas++;

            console.log(
                `│ ${String(i + 1).padStart(2)}   │ ${(r.cpf || '').padEnd(15)} │ ${nome.padEnd(24)} │ ${dueStr.padEnd(10)} │ ${String(diasAtual).padStart(8)} │ ${String(diasCorreto).padStart(10)} │ ${String(diff).padStart(10)} │ ${String(r.user_days_overdue || 0).padStart(10)} │`
            );
        }

        console.log(`└──────┴─────────────────┴──────────────────────────┴────────────┴──────────┴────────────┴────────────┴────────────┘`);
        console.log(`\n📊 Resumo:`);
        console.log(`   Total invoices vencidas: ${audit.length}`);
        console.log(`   Desatualizadas (diff > 0): ${desatualizadas}`);
        console.log(`   Atualizadas (diff = 0): ${audit.length - desatualizadas}`);
        console.log(`   Modo: ${mode}`);

        // 2. Se --fix, executar o UPDATE
        if (isFix) {
            console.log(`\n${'='.repeat(70)}`);
            console.log('  Executando UPDATE...');
            console.log(`${'='.repeat(70)}\n`);

            const updateResult = await db.executeQuery(`
                UPDATE ${config.schema}.invoices i
                SET dias_atraso = GREATEST(0, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - i.due_date))::INT / 86400),
                    updated_at = CURRENT_TIMESTAMP
                WHERE i.status = 'FECHADA'
                  AND i.data_pagamento IS NULL
                  AND i.due_date < CURRENT_TIMESTAMP
                  ${cpfClause}
                  AND (
                      COALESCE(i.dias_atraso, -1) != GREATEST(0, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - i.due_date))::INT / 86400)
                  )
            `);

            const updatedCount = updateResult?.rowCount || updateResult?.length || 0;
            console.log(`✅ UPDATE concluído! ${desatualizadas} invoice(s) corrigida(s).`);

            // Verificar resultado
            const verify = await db.executeQuery(`
                SELECT COUNT(*) AS total, 
                       SUM(CASE WHEN COALESCE(dias_atraso, 0) = GREATEST(0, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - due_date))::INT / 86400) THEN 1 ELSE 0 END) AS corretas
                FROM ${config.schema}.invoices
                WHERE status = 'FECHADA' AND data_pagamento IS NULL AND due_date < CURRENT_TIMESTAMP
                ${cpfClause}
            `);
            if (verify && verify.length > 0) {
                console.log(`   Verificação: ${verify[0].corretas}/${verify[0].total} invoices corretas após UPDATE.`);
            }
        } else {
            console.log(`\n💡 Para aplicar as correções, execute com --fix:`);
            console.log(`   node scripts/sync_invoice_dias_atraso.js --fix${cpfFilter ? ` --cpf=${cpfFilter}` : ''}`);
        }

        await db.disconnect();
        process.exit(0);
    } catch (e) {
        console.error('❌ ERRO:', e.message);
        if (db && typeof db.disconnect === 'function') await db.disconnect().catch(() => {});
        process.exit(1);
    }
}
run();
