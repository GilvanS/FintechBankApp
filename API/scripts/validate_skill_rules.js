#!/usr/bin/env node
/**
 * validate_skill_rules.js — Validador de Regras do SKILL.md vs Código Real
 *
 * Lê o arquivo SKILL.md da raiz do projeto, extrai as regras de negócio
 * documentadas, e verifica se estão implementadas corretamente no código
 * fonte (API/index.cjs, WEB/components, utils/invoiceMath.js).
 *
 * Uso:
 *   node scripts/validate_skill_rules.js            # Modo normal
 *   node scripts/validate_skill_rules.js --verbose    # Mostra detalhes
 *   node scripts/validate_skill_rules.js --fix        # (reservado)
 *
 * Exit code: 0 se todas passam, 1 se alguma falha.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKILL_PATH = path.join(ROOT, 'SKILL.md');
const API_PATH = path.join(ROOT, 'API', 'index.cjs');
const MATH_PATH = path.join(ROOT, 'API', 'utils', 'invoiceMath.js');
const WEB_DIR = path.join(ROOT, 'WEB', 'components');

const verbose = process.argv.includes('--verbose');

// ─── Utilitários ──────────────────────────────────────────────────────────

/** Suporta ANSI? (Windows cmd.exe geralmente nao, PowerShell sim) */
const ansi = process.stdout.isTTY && !process.env.CI;
const C = (code, s) => ansi ? `\x1b[${code}m${s}\x1b[0m` : s;
const bold   = (s) => C('1', s);
const green  = (s) => C('32', s);
const red    = (s) => C('31', s);
const yellow = (s) => C('33', s);
const dim    = (s) => C('2', s);

const readFileSafe = (p) => {
  if (!fs.existsSync(p)) {
    console.error(`  ${red('[AUSENTE]')} ${p}`);
    process.exit(1); // Falha critica — arquivo necessario ausente
  }
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch (e) {
    console.error(`  ${red('[ERRO]')} ${p}: ${e.message}`);
    process.exit(1);
  }
};

let passed = 0;
let failed = 0;
let warnings = 0;

const check = (label, condition, detail = '') => {
  if (condition) {
    passed++;
    if (verbose) console.log(`  ${green('OK')} ${dim(label)}`);
  } else {
    failed++;
    console.log(`  ${red('FAIL')} ${bold(label)}`);
    if (detail) console.log(`         ${yellow(detail)}`);
  }
};

const checkWarn = (label, condition, detail = '') => {
  if (condition) {
    passed++;
    if (verbose) console.log(`  ${green('OK')} ${dim(label)}`);
  } else {
    warnings++;
    console.log(`  ${yellow('WARN')} ${bold(label)}`);
    if (detail) console.log(`         ${detail}`);
  }
};

// ─── Funcoes de verificacao ───────────────────────────────────────────────

/** Regra 1.1: _closedInvoiceValorTotal NAO deve usar computeInvoiceGross */
const checkGrossNotUsedAsTotal = () => {
  const content = readFileSafe(API_PATH);
  if (!content) return;
  const bad = content.includes('_closedInvoiceValorTotal = Math.round(computeInvoiceGross');
  check('R1.1: _closedInvoiceValorTotal NAO usa computeInvoiceGross', !bad,
    bad ? 'Encontrou atribuicao proibida' : '');
};

/** Regra 1.2: closedInvoice = residual (valor_total - valor_pago) */
const checkResidualFormula = () => {
  const content = readFileSafe(API_PATH);
  if (!content) return;
  const ok = content.includes('valor_total || 0) - parseFloat(inv.valor_pago || 0)')
    || /Math\.max\(0,\s*parseFloat\([^)]+\)\s*-\s*parseFloat\([^)]+\)/.test(content);
  check('R1.2: closedInvoice usa residual (valor_total - valor_pago)', ok,
    'Esperava a formula "valor_total - valor_pago"');
};

/** Regra 2.1: INSERT diferencia Pagamento minimo vs parcial */
const checkPaymentDescription = () => {
  const c = readFileSafe(API_PATH);
  if (!c) return;
  const ok = c.includes("'Pagamento minimo de fatura'") && c.includes("'Pagamento parcial de fatura'");
  check('R2.1: INSERT diferencia minimo vs parcial', ok);
};

/** Regra 2.2: .map() verifica parcial antes de minimo */
const checkMerchantMapping = () => {
  const c = readFileSafe(API_PATH);
  if (!c) return;
  check('R2.2: .map() verifica parcial antes de minimo',
    c.includes(".includes('parcial')") && c.includes(".includes('minimo') || lowerDesc.includes('mínimo')"));
};

/** Regra 2.3: currentInvoice filtra PAYMENT */
const checkPaymentFilter = () => {
  const c = readFileSafe(API_PATH);
  if (!c) return;
  check('R2.3: currentInvoice filtra PAYMENT',
    c.includes(".filter(tx => tx.type !== 'PAYMENT')"));
};

/** Regra 2.4: PAYMENT aparece em openTransactions */
const checkPaymentInOpen = () => {
  const c = readFileSafe(API_PATH);
  if (!c) return;
  check('R2.4: PAYMENT incluso em openTransactions',
    c.includes("type: 'PAYMENT'") || c.includes("type === 'INVOICE_PAYMENT'"));
};

/** Regra 2.5: PAYMENT NAO aparece em closedTransactions */
const checkPaymentNotInClosed = () => {
  const c = readFileSafe(API_PATH);
  if (!c) return;
  // Procura o bloco onde closedTransactions e montado e verifica se tem PAYMENT
  const closedBlock = c.match(/closedTransactions[\s\S]{0,800}/);
  const blockStr = closedBlock ? closedBlock[0] : '';
  const hasPaymentInBlock = /INVOICE_PAYMENT\b/.test(blockStr);
  // Se nao encontrou INVOICE_PAYMENT no bloco, significa que filtra corretamente
  check('R2.5: PAYMENT ausente de closedTransactions', !hasPaymentInBlock,
    hasPaymentInBlock ? 'INVOICE_PAYMENT encontrado no bloco closedTransactions' : '');
};

/** Regra 3.1: runBillingValidation usa residual para encargos */
const checkResidualEncargos = () => {
  const c = readFileSafe(API_PATH);
  if (!c) return;
  check('R3.1: runBillingValidation usa residual para encargos',
    c.includes('Usa o saldo RESIDUAL da fatura fechada (valor_total - valor_pago)') &&
    /const\s+residual\s*=\s*Math\.max\(0,/.test(c));
};

/** Regra 3.2: closedInvoiceTotal = apenas principal */
const checkClosedInvTotal = () => {
  const c = readFileSafe(API_PATH);
  if (!c) return;
  check('R3.2: closedInvoiceTotal = apenas principal (sem encargos)',
    c.includes('closedInvoiceTotal = _r2(_closedVal)'));
};

/** Regra 4: Funcoes invoiceMath.js */
const checkMathFile = () => {
  const c = readFileSafe(MATH_PATH);
  if (!c) return;
  check('R4.1: computeInvoiceGross existe', c.includes('function computeInvoiceGross'));
  check('R4.2: computeInvoiceOwed target = valor_total',
    c.includes('target = round2(parseFloat(invoice.valor_total'));
  check('R4.3: planDistribution existe', c.includes('function planDistribution'));
  check('R4.4: planDistribution target = valor_total (NAO gross)',
    c.includes('target = round2(parseFloat(inv.valor_total || 0))'));
  check('R4.5: computeInvoicePaidInfo existe', c.includes('function computeInvoicePaidInfo'));
  check('R4.6: computeInvoicePaidInfo target = valor_total',
    c.includes('target = parseFloat(invoice.valor_total || 0)'));
};

/** Regra 5: Frontend - Amount como 3o parametro */
const checkFrontendAmount = () => {
  const files = [
    { name: 'InvoicesView.tsx', path: path.join(WEB_DIR, 'InvoicesView.tsx'), pattern: 'pendingAmount' },
    { name: 'Dashboard.tsx',    path: path.join(WEB_DIR, 'Dashboard.tsx'),    pattern: ', pin, amountToPay' },
  ];
  for (const f of files) {
    const c = readFileSafe(f.path);
    if (!c) { check(`${f.name}: amount como 3o parametro`, false, 'Arquivo nao encontrado'); continue; }
    check(`${f.name}: amount como 3o parametro`, c.includes(f.pattern));
  }
};

/** Regra 6: Badge PAGA no ClosedInvoice */
const checkClosedInvoicePaga = () => {
  const fp = path.join(WEB_DIR, 'ClosedInvoice.tsx');
  const c = readFileSafe(fp);
  if (!c) return;
  check('R5: ClosedInvoice.tsx tem badge PAGA',
    c && (c.includes('PAGA') || c.includes('Fatura paga') || c.includes('paga em')));
};

/** Grupo 6: Bugs corrigidos */
const checkFixedBugs = () => {
  const c = readFileSafe(API_PATH);
  if (!c) return;
  // Bug 1 fix: verifica que TODAS as linhas de _closedInvoiceValorTotal usam valor_total
  const lines = c.split('\n').filter(l => l.includes('_closedInvoiceValorTotal'));
  const allGood = lines.every(l => l.includes('valor_total') && !l.includes('computeInvoiceGross'));
  check('Bug 1 fix: closedInvoiceValorTotal usa valor_total (nao gross)',
    allGood, allGood ? '' : 'Alguma linha de _closedInvoiceValorTotal NAO usa valor_total');
  check('Bug 2 fix: currentInvoice filtra PAYMENT',
    c.includes("filter(tx => tx.type !== 'PAYMENT')"));
  check('Bug 3 fix: minimo vs parcial diferenciados',
    c.includes("'Pagamento minimo de fatura'") && c.includes("'Pagamento parcial de fatura'"));
};

/**
 * Extrai keywords do cabecalho de uma secao markdown.
 * Ex: "2. Duas Funcoes, Dois Propositos" → ["Duas Funcoes", "Dois Propositos"]
 * Ex: "⚠️ Regra Nº 1 — Antes de TUDO" → ["Regra N", "Antes de TUDO"]
 * Ex: "6. Encargos — Regra de Herança" → ["Encargos", "Regra de Herança"]
 */
const extractKeywordsFromHeading = (heading) => {
  const words = [];
  // Remove numero da secao e pontuacao inicial: "## 1. Titulo" → "Titulo"
  const clean = heading.replace(/^##\s+[0-9]+\.?\s*/, '').replace(/^[⚠️✅❌]*\s*/, '');
  // Divide por separadores: — , : | ;
  const parts = clean.split(/[—–,:|;]/).map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    // Extrai palavra entre ** (bold)
    const boldMatch = part.match(/\*\*([^*]+)\*\*/);
    if (boldMatch) { words.push(boldMatch[1].trim()); continue; }
    // Extrai palavra entre ` (code)
    const codeMatch = part.match(/`([^`]+)`/);
    if (codeMatch) { words.push(codeMatch[1].trim()); continue; }
    // Senao, pega o primeiro substantivo composto (ate 3 palavras)
    const firstWord = part.replace(/^[^\w\u00C0-\u00FF]+/, '').split(/\s+/).slice(0, 3).join(' ').trim();
    if (firstWord && firstWord.length >= 3) words.push(firstWord);
  }
  return [...new Set(words)]; // Remove duplicatas
};

/** Grupo 7: SKILL.md integridade — 100% dinamico, sem hardcoded */
const checkSkillIntegrity = () => {
  const c = readFileSafe(SKILL_PATH);
  if (!c) return;

  // Divide o documento por ## — parts[0] = cabecalho, parts[N] = secao
  const parts = c.split(/^## /m).filter(Boolean);
  const sectionCount = parts.length - 1; // Remove cabecalho
  
  if (verbose) console.log(`  Total de secoes: ${sectionCount}`);
  check('SKILL.md tem ao menos 10 secoes', sectionCount >= 10,
    `Soh ${sectionCount} secoes`);

  // Itera sobre cada secao (pula cabecalho em parts[0])
  for (let i = 1; i < parts.length; i++) {
    const lines = parts[i].split('\n');
    const headingLine = lines[0].trim();
    const fullHeading = '## ' + headingLine;
    const bodyOnly = lines.slice(1).join('\n').trim();
    
    // Extrai numero da secao ("⚠️ Regra Nº 1" → "W", "1. Estrutura" → "1")
    const numMatch = headingLine.match(/^[0-9]+/);
    const sectionLabel = numMatch ? `Secao ${numMatch[0]}` : `Secao (${headingLine.substring(0, 25)})`;
    
    // ── Verificacao 1: conteudo minimo (> 50 caracteres) ──
    check(`${sectionLabel}: conteudo minimo (> 50 chars)`,
      bodyOnly.length > 50,
      `"${headingLine.substring(0, 50)}" tem apenas ${bodyOnly.length} chars`);

    // ── Verificacao 2: contem bloco de codigo OU tabela (conteudo tecnico real) ──
    const hasCodeOrTable = bodyOnly.includes('```') || bodyOnly.includes('| ---');
    checkWarn(`${sectionLabel}: contem bloco de codigo ou tabela`,
      hasCodeOrTable,
      `Nenhum bloco de codigo (\`\`\`) ou tabela (| --- |) encontrado`);

    // ── Verificacao 3 (advertencia): keywords do heading no corpo ──
    // Nota: secoes de documentacao raramente repetem o heading verbatim,
    // entao esta e uma verificacao soft (checkWarn), nao hard (check).
    const keywords = extractKeywordsFromHeading(fullHeading);
    for (const kw of keywords) {
      if (kw.length >= 4) {
        checkWarn(`${sectionLabel}: "${kw.substring(0, 40)}" no corpo`,
          bodyOnly.includes(kw),
          `Keyword "${kw}" nao encontrada no corpo`);
      }
    }
  }

  // Verificacoes globais
  check('SKILL.md referencia docs/REGRAS-NEGOCIO-FATURA.md',
    c.includes('docs/REGRAS-NEGOCIO-FATURA.md'),
    'Esperava cross-reference para o documento completo');
};

// ─── Main ──────────────────────────────────────────────────────────────────

console.log(bold('\n═══════════════════════════════════════════════════════'));
console.log(bold('  VALIDAÇÃO DE REGRAS — SKILL.md vs Código'));
console.log(bold('═══════════════════════════════════════════════════════\n'));

// ─── GRUPO 1: Regra Nº 1 ───
console.log(bold('📋 Grupo 1: Regra Nº 1 — computeInvoiceGross'));
console.log(dim('  NUNCA usar computeInvoiceGross como closedInvoiceValorTotal\n'));
checkGrossNotUsedAsTotal();
checkResidualFormula();

// ─── GRUPO 2: Mapeamento PAYMENT ───
console.log(bold('\n📋 Grupo 2: Mapeamento PAYMENT (BD → Frontend)'));
console.log(dim('  Regras das seções 4, 5 e 6 do SKILL.md\n'));
checkPaymentDescription();
checkMerchantMapping();
checkPaymentFilter();
checkPaymentInOpen();
checkPaymentNotInClosed();

// ─── GRUPO 3: Encargos ───
console.log(bold('\n📋 Grupo 3: Encargos — Residual e Herança'));
console.log(dim('  Regras das seções 6 e 2 do SKILL.md\n'));
checkResidualEncargos();
checkClosedInvTotal();

// ─── GRUPO 4: Funções Auxiliares ───
console.log(bold('\n📋 Grupo 4: Funções Auxiliares (invoiceMath.js)'));
console.log(dim('  Regras da seção 2 do SKILL.md\n'));
checkMathFile();

// ─── GRUPO 5: Frontend ───
console.log(bold('\n📋 Grupo 5: Frontend — Amount e Badge PAGA'));
console.log(dim('  Regras das seções 7 e 6 do SKILL.md\n'));
checkFrontendAmount();
checkClosedInvoicePaga();

// ─── GRUPO 6: Bugs Já Corrigidos ───
console.log(bold('\n📋 Grupo 6: Bugs Já Corrigidos (Seção 9 do SKILL.md)'));
console.log(dim('  Verifica se as correções ainda estão no lugar\n'));

checkFixedBugs();

// ─── GRUPO 7: SKILL.md integridade ───
console.log(bold('\n📋 Grupo 7: Integridade do SKILL.md'));
console.log(dim('  Verifica se o documento contém todas as seções esperadas\n'));
checkSkillIntegrity();

// ─── RESUMO ───
console.log(bold('\n═══════════════════════════════════════════════════════'));
console.log(bold('  RESUMO'));
console.log(bold('═══════════════════════════════════════════════════════\n'));
console.log(`  ${green('✓')} Passaram: ${passed}`);
console.log(`  ${red('✗')} Falharam:  ${failed}`);
console.log(`  ${yellow('⚠')} Alertas:   ${warnings}`);
console.log('');
const total = passed + failed + warnings;
const pct = total > 0 ? Math.round(passed / total * 100) : 0;
console.log(`  Score: ${pct}% (${passed}/${total})`);

const exitCode = failed > 0 ? 1 : 0;
console.log(`\n  Exit code: ${exitCode}\n`);

process.exit(exitCode);
