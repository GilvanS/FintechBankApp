#!/usr/bin/env node
/**
 * audit_retroativo_double_charge.js
 * ────────────────────────────────────────────
 * AUDITORIA E CORREÇÃO RETROATIVA — Dupla Cobrança de Encargos
 *
 * PROBLEMA:
 *   O enrichUserCreditCardData usava computeInvoiceGross (valor_total + multa + juros + IOF)
 *   como base para closedInvoice. Depois calculava NOVOS encargos sobre esse valor já
 *   inflado — causando DUPLA COBRANÇA. Algumas massas pagaram a fatura com base no valor
 *   inflado (closedInvoiceTotal antigo), resultando em valor_pago > valor_total no banco.
 *
 * AÇÃO DESTE SCRIPT:
 *   Modo auditoria (padrão):   lista invoices com valor_pago > valor_total
 *   Modo correção (--fix):     ajusta valor_pago → MIN(valor_pago, valor_total)
 *                               e estorna o excesso ao balance do usuário
 *
 * COMPANION SQL: veja audit_retroativo_double_charge.sql para as queries SQL puras.
 *
 * USO:
 *   node scripts/audit_retroativo_double_charge.js
 *   node scripts/audit_retroativo_double_charge.js --fix       (audita + corrige)
 *   node scripts/audit_retroativo_double_charge.js --fix --confirm (corrige sem confirmação)
 *   node scripts/audit_retroativo_double_charge.js --cpf=99999999999 (foco num CPF)
 */

// ── Check dotenv ────────────────────────────────────────────────────────────
try {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
} catch (e) {
  console.error('❌ dotenv não encontrado. Execute: npm install dotenv');
  process.exit(1);
}

const { Pool } = require('pg');

// ── Config ──────────────────────────────────────────────────────────────────
const SCHEMA = process.env.DB_SCHEMA || 'fintech';
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'fintechbank',
});

const args = process.argv.slice(2);
const FLAG_FIX = args.includes('--fix');
const FLAG_CONFIRM = args.includes('--confirm');
const FLAG_CPF = args.find(a => a.startsWith('--cpf='));
const TARGET_CPF = FLAG_CPF ? FLAG_CPF.split('=')[1].replace(/\D/g, '') : null;

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmt = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const hr = () => console.log('─'.repeat(80));
const section = (t) => { hr(); console.log(`  ${t}`); hr(); };

// ── Parameterized query helper (evita SQL injection) ───────────────────────
const execute = async (text, params = []) => {
  // Injeta SCHEMA no template (seguro — é hardcoded), mas usa $1, $2 para params
  const sql = text.replace(/\$\{SCHEMA\}/g, SCHEMA);
  return pool.query(sql, params);
};

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════════════╗');
  console.log('  ║   AUDITORIA RETROATIVA — Dupla Cobrança de Encargos        ║');
  console.log('  ╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Modo:       ${FLAG_FIX ? 'CORREÇÃO (--fix)' : 'Auditoria (read-only)'}`);
  console.log(`  Schema:     ${SCHEMA}`);
  if (TARGET_CPF) console.log(`  CPF alvo:   ${TARGET_CPF}`);
  console.log('');

  try {
    // ── 1. AUDITAR invoices com valor_pago > valor_total ────────────────
    section('1. Invoices com valor_pago > valor_total (overpayment)');

    const overpaidResult = await execute(`
      SELECT 
        i.cpf,
        TRIM(u.full_name) as nome,
        ROUND(i.valor_total::numeric, 2) as valor_total,
        ROUND(COALESCE(i.valor_multa,0)::numeric, 2) as multa,
        ROUND(COALESCE(i.valor_juros_mora,0)::numeric, 2) as juros_mora,
        ROUND(COALESCE(i.valor_juros_remuneratorios,0)::numeric, 2) as juros_rem,
        ROUND(COALESCE(i.valor_iof,0)::numeric, 2) as iof,
        ROUND((i.valor_total + COALESCE(i.valor_multa,0) + COALESCE(i.valor_juros_mora,0) + COALESCE(i.valor_juros_remuneratorios,0) + COALESCE(i.valor_iof,0))::numeric, 2) as gross,
        ROUND(COALESCE(i.valor_pago,0)::numeric, 2) as valor_pago_atual,
        ROUND(COALESCE(i.valor_pago,0)::numeric, 2) - ROUND(i.valor_total::numeric, 2) as excesso,
        ROUND(COALESCE(u.balance,0)::numeric, 2) as saldo_atual,
        i.data_pagamento,
        CASE WHEN i.data_pagamento IS NOT NULL THEN 'PAGA' ELSE 'NAO_PAGA' END as status_pgto
      FROM ${SCHEMA}.invoices i
      LEFT JOIN ${SCHEMA}.users u ON u.cpf = i.cpf
      WHERE i.status = 'FECHADA'
        AND COALESCE(i.valor_pago,0) > i.valor_total
        ${TARGET_CPF ? 'AND i.cpf = $1' : ''}
      ORDER BY i.cpf
    `, TARGET_CPF ? [TARGET_CPF] : []);

    const overpaid = overpaidResult.rows;

    if (overpaid.length === 0) {
      console.log('\n  ✅ NENHUMA invoice com valor_pago > valor_total encontrada.\n');
      if (TARGET_CPF) {
        console.log('  💡 Dica: o CPF pode não ter invoice paga ou estar com valor correto.\n');
      }
    } else {
      console.log(`\n  🔴 ${overpaid.length} invoice(s) com valor_pago > valor_total:\n`);
      console.table(overpaid.map(r => ({
        CPF: r.cpf,
        Nome: (r.nome || '').slice(0, 22),
        'Valor Total': fmt(r.valor_total),
        'Valor Pago': fmt(r.valor_pago_atual),
        Excesso: fmt(r.excesso),
        'Saldo Atual': fmt(r.saldo_atual),
        Status: r.status_pgto,
      })));

      const totalExcesso = overpaid.reduce((s, r) => s + parseFloat(r.excesso || 0), 0);
      console.log(`\n  💰 Excesso total a estornar: ${fmt(totalExcesso)}\n`);

      // ── 2. CORREÇÃO ──────────────────────────────────────────────────
      if (FLAG_FIX) {
        section('2. Correção Retroativa');

        if (!FLAG_CONFIRM) {
          console.log('\n  ⚠️  Modo --fix ativado sem --confirm. Deseja continuar?');
          console.log('  Para pular confirmação, use: --fix --confirm\n');
          console.log('  🔸 Os seguintes ajustes serão feitos:');
          for (const r of overpaid) {
            const excesso = parseFloat(r.excesso || 0);
            if (excesso <= 0) continue;
            console.log(`     • CPF ${r.cpf} (${(r.nome || '').slice(0, 20)}):`);
            console.log(`       valor_pago: ${fmt(r.valor_pago_atual)} → ${fmt(r.valor_total)} (economia: ${fmt(excesso)})`);
            console.log(`       balance:    ${fmt(r.saldo_atual)} → ${fmt(parseFloat(r.saldo_atual) + excesso)} (+${fmt(excesso)})`);
          }
          console.log('\n  Pressione Ctrl+C para cancelar ou execute com --confirm');
          console.log('  node scripts/audit_retroativo_double_charge.js --fix --confirm\n');
          await pool.end();
          process.exit(0);
        }

        // Executar correções — adquire um CLIENT único para a transação
        const client = await pool.connect();
        let corrigidos = 0;
        let estornado = 0;
        try {
          for (const r of overpaid) {
            const excesso = parseFloat(r.excesso || 0);
            if (excesso <= 0) continue;

            await client.query('BEGIN');

            // Lock nas linhas para evitar race condition
            await client.query(`
              SELECT i.valor_pago, u.balance
              FROM ${SCHEMA}.invoices i
              JOIN ${SCHEMA}.users u ON u.cpf = i.cpf
              WHERE i.cpf = $1 AND i.status = 'FECHADA' AND i.data_pagamento IS NOT NULL
                AND COALESCE(i.valor_pago,0) > i.valor_total
              FOR UPDATE OF i, u
            `, [r.cpf]);

            // 2a. Ajustar valor_pago para = valor_total (capped)
            await client.query(`
              UPDATE ${SCHEMA}.invoices
              SET valor_pago = valor_total,
                  updated_at = CURRENT_TIMESTAMP
              WHERE cpf = $1 AND status = 'FECHADA' AND data_pagamento IS NOT NULL
                AND COALESCE(valor_pago,0) > valor_total
            `, [r.cpf]);

            // 2b. Creditar o excesso ao balance do usuário
            const bp = await client.query(`
              UPDATE ${SCHEMA}.users
              SET balance = balance + $1,
                  updated_at = CURRENT_TIMESTAMP
              WHERE cpf = $2
              RETURNING balance
            `, [excesso, r.cpf]);

            await client.query('COMMIT');

            corrigidos++;
            estornado += excesso;
            const novoSaldo = bp.rows[0]?.balance || 0;
            console.log(`  ✅ CPF ${r.cpf}: valor_pago ajustado, excesso ${fmt(excesso)} estornado ao balance (novo saldo: ${fmt(novoSaldo)})`);
          }
          console.log(`\n  📊 Resumo da correção:`);
          console.log(`     Invoices corrigidas: ${corrigidos}`);
          console.log(`     Total estornado:     ${fmt(estornado)}\n`);
        } catch (e) {
          await client.query('ROLLBACK');
          console.error(`  ❌ ERRO durante correção: ${e.message}`);
          throw e;
        } finally {
          client.release();
        }
      }
    }

    // ── 3. AUDITAR billing_charges potencialmente inflados ────────────
    section('3. billing_charges (encargos gerados pelo runBillingValidation)');

    const chargesResult = await execute(`
      SELECT 
        bc.invoice_reference,
        bc.charge_type,
        COUNT(*) as qtd,
        ROUND(AVG(bc.amount)::numeric, 2) as avg_amount,
        ROUND(SUM(bc.amount)::numeric, 2) as total,
        -- Para multa, verificar se a média condiz com 2% do valor_total médio das invoices
        CASE bc.charge_type
          WHEN 'multa' THEN ROUND(2.00::numeric, 2)
          WHEN 'juros_mora' THEN ROUND(0.0333::numeric, 4)
          WHEN 'juros_remuneratorios' THEN ROUND(0.513::numeric, 3)
          ELSE 0
        END as taxa_pct
      FROM ${SCHEMA}.billing_charges bc
      ${TARGET_CPF ? 'WHERE bc.cpf = $1' : ''}
      GROUP BY bc.invoice_reference, bc.charge_type
      ORDER BY bc.invoice_reference, bc.charge_type
    `, TARGET_CPF ? [TARGET_CPF] : []);

    if (chargesResult.rows.length === 0) {
      console.log('\n  Nenhum registro em billing_charges.\n');
    } else {
      const chargesByRef = {};
      for (const r of chargesResult.rows) {
        if (!chargesByRef[r.invoice_reference]) chargesByRef[r.invoice_reference] = {};
        chargesByRef[r.invoice_reference][r.charge_type] = {
          avg: parseFloat(r.avg_amount || 0),
          total: parseFloat(r.total || 0),
          qtd: parseInt(r.qtd || 0),
          taxa: parseFloat(r.taxa_pct || 0),
        };
      }

      for (const [ref, types] of Object.entries(chargesByRef)) {
        console.log(`  📅 Referência: ${ref}`);
        for (const [tipo, info] of Object.entries(types)) {
          const comp = tipo === 'iof' ? '—' : `${info.taxa}% ao dia`;
          console.log(`     ${tipo.padEnd(22)} média: ${fmt(info.avg)} | qtd: ${info.qtd} | taxa: ${comp}`);
        }
        console.log('');
      }

      const totalCharges = chargesResult.rows.reduce((s, r) => s + parseFloat(r.total || 0), 0);
      console.log(`  💰 Total de encargos registrados: ${fmt(totalCharges)}`);
      console.log('  ℹ️  Para verificar se as médias estão corretas, compare com:');
      console.log('     multa = 2% do principal | juros_mora = 0,0333%/dia');
      console.log('     juros_rem = 0,513%/dia | IOF = 0,38% + 0,0082%/dia\n');
    }

    // ── 4. RESUMO GERAL ────────────────────────────────────────────────
    section('4. Resumo Geral');

    const totalsResult = await execute(`
      SELECT 
        COUNT(*) FILTER (WHERE i.status = 'FECHADA') as total_fechadas,
        COUNT(*) FILTER (WHERE i.status = 'FECHADA' AND i.data_pagamento IS NOT NULL) as pagas,
        COUNT(*) FILTER (WHERE i.status = 'FECHADA' AND i.data_pagamento IS NULL) as nao_pagas,
        COUNT(*) FILTER (WHERE i.status = 'FECHADA' AND COALESCE(i.valor_pago,0) > i.valor_total) as overpaid,
        ROUND(SUM(COALESCE(i.valor_pago,0) - i.valor_total) FILTER (WHERE COALESCE(i.valor_pago,0) > i.valor_total)::numeric, 2) as total_excesso
      FROM ${SCHEMA}.invoices i
      ${TARGET_CPF ? 'WHERE i.cpf = $1' : ''}
    `, TARGET_CPF ? [TARGET_CPF] : []);

    if (totalsResult.rows.length > 0) {
      const t = totalsResult.rows[0];
      console.log(`  Faturas fechadas:      ${t.total_fechadas}`);
      console.log(`  Pagas:                 ${t.pagas}`);
      console.log(`  Não pagas:             ${t.nao_pagas}`);
      console.log(`  Sobre-pagas (vp>vt):   ${t.overpaid}`);
      console.log(`  Excesso total:         ${fmt(t.total_excesso)}`);
    }

    console.log('');

  } catch (e) {
    console.error('\n❌ ERRO FATAL:', e.message, '\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
