/**
 * UTI de Massas — correção FORÇADA para massas presas em fintech.tbl_cemiterio_teste
 * (dado de teste com anomalia que a auditoria diária normal não cura sozinha).
 *
 * Diferença pra "cura" (services/dailyAudit.js): a cura só aplica fórmulas
 * seguras e pontuais quando o gatilho é exato, e roda sobre a base inteira.
 * O UTI é dirigido: pega só quem está no cemitério, e para cada CPF FORÇA o
 * estado atual (billing_charges, vínculos, limites) a bater com o invariante
 * estrutural de uma massa saudável do MESMO PERFIL (adimplente/inadimplente),
 * escolhida dinamicamente a cada execução como massa-molde — não tenta
 * reconciliar o histórico peça por peça, reconstrói do zero usando a MESMA
 * fórmula canônica (invoiceMath.js) que qualquer massa saudável segue.
 *
 * Uso via terminal:
 *   node scripts/uti_massa.cjs                      # dry-run: só mostra o plano
 *   node scripts/uti_massa.cjs --confirm             # aplica de verdade
 *   node scripts/uti_massa.cjs --cpf=12345678900     # restringe a 1 CPF (dry-run)
 *   node scripts/uti_massa.cjs --cpf=12345678900 --confirm
 *   node scripts/uti_massa.cjs --json                # saída só em JSON (pro painel Admin)
 *
 * Uso programático (encadeado por outro script, ex.: populate_cemiterio_teste.cjs):
 *   const { runUti } = require('./uti_massa.cjs');
 *   const relatorio = await runUti({ confirm: false });
 */
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');
const {
    calcMulta, calcJurosMora, calcJurosRemuneratorios, calcIof, round2,
} = require('../utils/invoiceMath');
// Reusa a MESMA fórmula canônica do botão "Recalcular Limite Disponível" —
// não reinventa o cálculo de limite aqui.
const { simularSemPersistir, recalcularEmLote } = require('./recalcular_limite_disponivel.cjs');

function genId(db) {
    return db.generateUUID ? db.generateUUID() : `chg-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// ─── Detecção escopada por CPF ──────────────────────────────────────────────
// Mesmas regras de services/dailyAudit.js, mas WHERE cpf = X em vez de rodar
// na base inteira — o UTI só toca em quem está listado no cemitério.

async function checkAnomalias(db, cpf) {
    const anomalias = [];

    const invoicesFechadas = await db.executeQuery(`
        SELECT id, valor_total, dias_atraso, due_date
        FROM fintech.invoices
        WHERE cpf = '${cpf}' AND status = 'FECHADA' AND data_pagamento IS NULL
        ORDER BY due_date DESC
    `);
    const pendingCharges = await db.executeQuery(`
        SELECT id, charge_type, amount, invoice_amount, days_overdue
        FROM fintech.billing_charges
        WHERE cpf = '${cpf}' AND status = 'pending'
    `);

    // BILLING_CHARGES_DESSINCRONIZADO_POS_CONSOLIDACAO: nenhum billing_charges
    // pending tem invoice_amount batendo o valor_total de QUALQUER invoice
    // FECHADA atual — o join "por valor" (não há FK) está 100% quebrado,
    // sintoma de consolidação (fix_blacklist_invoice_consolidation.cjs) que
    // somou valor_total sem realinhar os encargos.
    if (pendingCharges.length > 0 && invoicesFechadas.length > 0) {
        const valoresValidos = new Set(invoicesFechadas.map((i) => round2(parseFloat(i.valor_total)).toFixed(2)));
        const orfaos = pendingCharges.filter((c) => !valoresValidos.has(round2(parseFloat(c.invoice_amount)).toFixed(2)));
        if (orfaos.length === pendingCharges.length) {
            anomalias.push({
                type: 'BILLING_CHARGES_DESSINCRONIZADO_POS_CONSOLIDACAO',
                detail: `${orfaos.length} billing_charges pending, nenhum com invoice_amount batendo as ${invoicesFechadas.length} invoice(s) FECHADA atuais (valores atuais: ${[...valoresValidos].join(', ')}; valores órfãos: ${[...new Set(orfaos.map((o) => o.invoice_amount))].join(', ')}).`,
                invoicesFechadas,
                pendingCharges,
            });
        }
    }

    // FATURA_DUPLICADA: mais de uma FECHADA com o mesmo due_date.
    const dup = await db.executeQuery(`
        SELECT due_date, COUNT(*) as total, array_agg(id) as ids, array_agg(CAST(valor_total AS TEXT)) as valores
        FROM fintech.invoices WHERE cpf = '${cpf}' AND status = 'FECHADA'
        GROUP BY due_date HAVING COUNT(*) > 1
    `);
    for (const d of dup) {
        anomalias.push({
            type: 'FATURA_DUPLICADA',
            detail: `${d.total} faturas com vencimento ${d.due_date}: ids ${d.ids.join(', ')}, valores ${d.valores.join(', ')}.`,
            dup: d,
        });
    }

    const userRow = (await db.executeQuery(`
        SELECT account_status, days_overdue, credit_card_available_limit, credit_card_total_limit
        FROM fintech.users WHERE cpf = '${cpf}'
    `))[0];
    if (userRow) {
        const totalPending = pendingCharges.reduce((s, c) => s + parseFloat(c.amount), 0);
        if (userRow.account_status === 'inadimplente' && Number(userRow.days_overdue) > 0 && totalPending === 0 && invoicesFechadas.length > 0) {
            anomalias.push({
                type: 'INADIMPLENTE_SEM_ENCARGOS',
                detail: `Inadimplente há ${userRow.days_overdue}d sem nenhum encargo pending.`,
                userRow,
                invoicesFechadas,
            });
        }
        const disponivel = parseFloat(userRow.credit_card_available_limit);
        const total = parseFloat(userRow.credit_card_total_limit);
        if (disponivel > total) {
            anomalias.push({
                type: 'SALDO_CREDOR_ESTACIONADO',
                detail: `Disponível (${disponivel.toFixed(2)}) > Total (${total.toFixed(2)}) — saldo credor de R$ ${(disponivel - total).toFixed(2)} nunca aplicado.`,
                userRow,
            });
        }
    }

    // LIMITE_EXCEDIDO: mesma fórmula canônica do botão "Recalcular Limite
    // Disponível" (scripts/recalcular_limite_disponivel.cjs) — reusada aqui,
    // não reimplementada. limitePreview.estourado=true é ESTADO VÁLIDO (dívida
    // real > limite total), não é a anomalia em si; a anomalia é o valor
    // GRAVADO divergir do que a fórmula diz que deveria ser.
    const limitePreview = await simularSemPersistir(cpf);
    if (limitePreview && limitePreview.alterado) {
        anomalias.push({
            type: 'LIMITE_EXCEDIDO',
            detail: `Limite disponível gravado (R$ ${limitePreview.limiteAnterior.toFixed(2)}) diverge do que a fórmula canônica calcula (R$ ${limitePreview.limiteNovo.toFixed(2)}, dívida atual R$ ${limitePreview.currentInvoiceTotal.toFixed(2)}).${limitePreview.estourado ? ' Fica negativo de propósito — dívida real excede o limite total, estado válido.' : ''}`,
            limitePreview,
        });
    }

    return anomalias;
}

// ─── Massa-molde: escolhida a cada execução, prova o invariante estrutural ──

async function acharMassaModelo(db, perfil) {
    const candidatos = await db.executeQuery(`
        SELECT cpf FROM fintech.users
        WHERE account_status = '${perfil}' AND role NOT IN ('admin')
          AND cpf NOT IN (SELECT cpf FROM fintech.tbl_cemiterio_teste)
        ORDER BY updated_at DESC
        LIMIT 30
    `);
    for (const c of candidatos) {
        const anomalias = await checkAnomalias(db, c.cpf);
        if (anomalias.length === 0) return c.cpf;
    }
    return null;
}

// ─── Correções (força o invariante da massa-molde) ──────────────────────────

async function corrigirBillingChargesDessincronizado(db, cpf, anomalia, confirm) {
    const invoiceAlvo = anomalia.invoicesFechadas[0];
    const principal = round2(parseFloat(invoiceAlvo.valor_total));

    // users.days_overdue é a fonte canônica (é o que a regra de blacklist >=90d
    // usa, é o que o motor diário mantém). invoices.dias_atraso pode estar tão
    // obsoleto quanto os billing_charges — a consolidação
    // (fix_blacklist_invoice_consolidation.cjs) só reescreve valor_total, nunca
    // dias_atraso. Preferir sempre users.days_overdue e realinhar a invoice junto.
    const u = (await db.executeQuery(`SELECT days_overdue FROM fintech.users WHERE cpf = '${cpf}'`))[0];
    const dias = Number(u?.days_overdue || 0) || Number(invoiceAlvo.dias_atraso) || 0;
    const invoiceDiasDivergente = Number(invoiceAlvo.dias_atraso) !== dias;

    const novos = [
        ['multa', calcMulta(principal)],
        ['juros_mora', calcJurosMora(principal, dias)],
        ['juros_remuneratorios', calcJurosRemuneratorios(principal, dias)],
        ['iof', calcIof(principal, dias)],
    ];

    const plano = {
        acao: `Apagar ${anomalia.pendingCharges.length} billing_charges pending órfãos e regerar 4 do zero ancorados na fatura vigente (valor_total=${principal}, dias_atraso=${dias} via users.days_overdue)`
            + (invoiceDiasDivergente ? ` — também realinha invoices.dias_atraso (estava ${invoiceAlvo.dias_atraso}, também obsoleto pós-consolidação)` : ''),
        apaga: anomalia.pendingCharges.map((c) => `${c.charge_type} R$${c.amount} (invoice_amount=${c.invoice_amount})`),
        insere: novos.map(([tipo, valor]) => `${tipo} R$${valor} (invoice_amount=${principal}, days_overdue=${dias})`),
    };

    if (confirm) {
        await db.executeQuery(`DELETE FROM fintech.billing_charges WHERE cpf = '${cpf}' AND status = 'pending'`);
        const ref = invoiceAlvo.due_date ? new Date(invoiceAlvo.due_date).toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7);
        for (const [tipo, valor] of novos) {
            await db.executeQuery(`
                INSERT INTO fintech.billing_charges
                (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount, created_at, status)
                VALUES ('${genId(db)}', '${cpf}', '${ref}', '${tipo}', ${valor}, ${dias}, ${principal}, CURRENT_TIMESTAMP, 'pending')
            `);
        }
        if (invoiceDiasDivergente) {
            await db.executeQuery(`UPDATE fintech.invoices SET dias_atraso = ${dias}, updated_at = CURRENT_TIMESTAMP WHERE id = '${invoiceAlvo.id}'`);
        }
    }
    return plano;
}

async function corrigirSaldoCredorEstacionado(db, cpf, anomalia, confirm) {
    const total = round2(parseFloat(anomalia.userRow.credit_card_total_limit));
    const plano = { acao: `Recapar credit_card_available_limit em ${total} (era ${anomalia.userRow.credit_card_available_limit})` };
    if (confirm) {
        await db.executeQuery(`UPDATE fintech.users SET credit_card_available_limit = ${total}, updated_at = CURRENT_TIMESTAMP WHERE cpf = '${cpf}'`);
    }
    return plano;
}

async function corrigirInadimplenteSemEncargos(db, cpf, anomalia, confirm) {
    const invoiceAlvo = anomalia.invoicesFechadas[0];
    const principal = round2(parseFloat(invoiceAlvo.valor_total));
    const dias = Number(anomalia.userRow.days_overdue) || Number(invoiceAlvo.dias_atraso) || 0;
    const novos = [
        ['multa', calcMulta(principal)],
        ['juros_mora', calcJurosMora(principal, dias)],
        ['juros_remuneratorios', calcJurosRemuneratorios(principal, dias)],
        ['iof', calcIof(principal, dias)],
    ];
    const plano = { acao: `Seed de 4 billing_charges (principal=${principal}, dias=${dias}) — inadimplente sem nenhum encargo`, insere: novos.map(([t, v]) => `${t} R$${v}`) };
    if (confirm) {
        const ref = invoiceAlvo.due_date ? new Date(invoiceAlvo.due_date).toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7);
        for (const [tipo, valor] of novos) {
            await db.executeQuery(`
                INSERT INTO fintech.billing_charges
                (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount, created_at, status)
                VALUES ('${genId(db)}', '${cpf}', '${ref}', '${tipo}', ${valor}, ${dias}, ${principal}, CURRENT_TIMESTAMP, 'pending')
            `);
        }
    }
    return plano;
}

// FATURA_DUPLICADA NÃO é corrigida automaticamente — e NUNCA desligando a trava
// trg_invoices_immutable_when_closed (a versão antiga fazia DISABLE TRIGGER,
// somava as FECHADAs numa só e apagava as outras). Regra (2026-09-23): fatura
// FECHADA é imutável; ajuste de dinheiro vai para a fatura ABERTA/saldo.
// As 30 duplicadas históricas eram 2 CICLOS diferentes com o mesmo vencimento
// (3870,86 + compras do ciclo seguinte), não cópias: a dívida somada estava
// certa, o erro era o due_date do 2º ciclo. Por isso aqui só se descreve o caso
// e a massa fica para análise manual (manual:true → não marca curada_uti).
async function corrigirFaturaDuplicada(db, cpf, anomalia, _confirm) {
    const { ids, valores } = anomalia.dup;
    const copia = new Set(valores.map((v) => round2(parseFloat(v)).toFixed(2))).size === 1;
    return {
        manual: true,
        acao: copia
            ? `ANÁLISE MANUAL — ${ids.length} faturas FECHADAS com o MESMO valor (${valores.join(', ')}) e mesmo vencimento: possível cobrança em dobro. A fechada não muda; o valor duplicado deve ser compensado como crédito na fatura ABERTA.`
            : `ANÁLISE MANUAL — ${ids.length} faturas FECHADAS com mesmo vencimento e valores diferentes (${valores.join(', ')}): provavelmente 2 ciclos com due_date igual. Dívida somada está certa; revisar o vencimento do ciclo mais novo (due_date não é coluna monetária). Nada foi alterado.`,
        faturas: ids,
    };
}

async function corrigirLimiteExcedido(db, cpf, anomalia, confirm) {
    const p = anomalia.limitePreview;
    const plano = {
        acao: `Recalcular credit_card_available_limit: R$ ${p.limiteAnterior.toFixed(2)} → R$ ${p.limiteNovo.toFixed(2)} (fórmula: limite total ${p.totalLimit.toFixed(2)} − dívida atual ${p.currentInvoiceTotal.toFixed(2)})`
            + (p.estourado ? ' — fica negativo de propósito, dívida real excede o limite total (mesma regra do botão "Recalcular Limite Disponível").' : ''),
    };
    if (confirm) {
        await recalcularEmLote({ cpf, persist: true });
    }
    return plano;
}

const HANDLERS = {
    BILLING_CHARGES_DESSINCRONIZADO_POS_CONSOLIDACAO: corrigirBillingChargesDessincronizado,
    SALDO_CREDOR_ESTACIONADO: corrigirSaldoCredorEstacionado,
    INADIMPLENTE_SEM_ENCARGOS: corrigirInadimplenteSemEncargos,
    FATURA_DUPLICADA: corrigirFaturaDuplicada,
    LIMITE_EXCEDIDO: corrigirLimiteExcedido,
};

// Tipos que services/dailyAudit.js já corrige DE FORMA INCONDICIONAL dentro da
// própria chamada (o UPDATE/INSERT roda antes até de decidir se loga o erro) —
// quando populate_cemiterio_teste.cjs roda runDailyAudit() logo antes de listar
// o cemitério, esses tipos JÁ ESTÃO resolvidos no banco no momento em que o UTI
// olha. checkAnomalias() vindo vazio pra esses é confiável.
const AUTO_CURADAS_PELO_DAILY_AUDIT = new Set([
    'BLACKLIST_DESSINCRONIZADA',
    'FATURA_VENCIMENTO_DIVERGENTE_CORRIGIDO',
    'ENCARGOS_ORFAOS_REGERADOS',
    'FATURA_ABERTA_MES_DIVERGENTE_CORRIGIDO',
    'CICLO_PERDIDO_FECHADO',
    'CICLO_PERDIDO_FECHADO_CANDIDATO_BLACKLIST',
]);

// ─── Orquestração (reaproveitável — chamada pelo CLI e por outros scripts) ──

async function runUti({ confirm = false, cpfFilter = null, db: dbInjetado = null } = {}) {
    const db = dbInjetado || DatabaseFactory.createDatabaseService();
    if (!dbInjetado) await db.connect();

    const modeloAdimplente = await acharMassaModelo(db, 'adimplente');
    const modeloInadimplente = await acharMassaModelo(db, 'inadimplente');

    const where = cpfFilter
        ? `WHERE status = 'precisa_massa_nova' AND cpf = '${cpfFilter}'`
        : `WHERE status = 'precisa_massa_nova'`;
    const cemiterio = await db.executeQuery(`SELECT cpf, nome_completo, tipos_anomalia FROM fintech.tbl_cemiterio_teste ${where} ORDER BY data_entrada ASC`);

    const resumo = { curadas: 0, semAnomaliaAtual: 0, semHandler: 0, porTipo: {} };
    const relatorio = [];

    for (const row of cemiterio) {
        const { cpf, nome_completo: nome, tipos_anomalia: tiposRegistrados } = row;
        const anomalias = await checkAnomalias(db, cpf);

        if (anomalias.length === 0) {
            // checkAnomalias() vazio só é confiável se TODO tipo registrado nesta
            // linha do cemitério é ou (a) um tipo que dailyAudit.js já resolveu
            // incondicionalmente antes do UTI olhar, ou (b) um tipo que o UTI
            // sabe checar (e portanto já teria pego se ainda existisse). Se
            // sobrar tipo de fora dessas duas listas (ex.: TRANSACAO_ORFA,
            // PAGAMENTO_SEM_COMPROVANTE, LIMITE_EXCEDIDO, PAGAMENTO_PARCIAL_SEM_
            // ENCARGOS), o UTI NUNCA verificou essa condição de verdade — não dá
            // pra assumir saudável, isso marcaria 'curada_uti' sem checagem real.
            const naoVerificaveis = (tiposRegistrados || []).filter(
                (t) => !HANDLERS[t] && !AUTO_CURADAS_PELO_DAILY_AUDIT.has(t),
            );
            if (naoVerificaveis.length > 0) {
                resumo.semHandler += naoVerificaveis.length;
                for (const t of naoVerificaveis) resumo.porTipo[t] = (resumo.porTipo[t] || 0) + 1;
                relatorio.push({
                    cpf,
                    nome,
                    status: 'nao_verificavel',
                    anomalias: naoVerificaveis.map((type) => ({
                        type,
                        detail: 'Tipo registrado no cemitério que o UTI ainda não sabe detectar/checar de forma independente — não verificado, status mantido.',
                        semHandler: true,
                    })),
                });
                continue;
            }

            resumo.semAnomaliaAtual++;
            if (confirm) {
                await db.executeQuery(`UPDATE fintech.tbl_cemiterio_teste SET status = 'curada_uti' WHERE cpf = '${cpf}'`);
            }
            relatorio.push({ cpf, nome, status: 'ja_saudavel', anomalias: [] });
            continue;
        }

        const itens = [];
        let todasTratadas = true;
        for (const anomalia of anomalias) {
            resumo.porTipo[anomalia.type] = (resumo.porTipo[anomalia.type] || 0) + 1;
            const handler = HANDLERS[anomalia.type];
            if (!handler) {
                todasTratadas = false;
                resumo.semHandler++;
                itens.push({ type: anomalia.type, detail: anomalia.detail, plano: null, semHandler: true });
                continue;
            }
            const plano = await handler(db, cpf, anomalia, confirm);
            // Plano manual (ex.: FATURA_DUPLICADA) não corrige nada — a massa não pode virar curada_uti.
            if (plano && plano.manual) todasTratadas = false;
            itens.push({ type: anomalia.type, detail: anomalia.detail, plano });
        }

        let curada = false;
        if (confirm && todasTratadas) {
            const restante = await checkAnomalias(db, cpf);
            if (restante.length === 0) {
                await db.executeQuery(`UPDATE fintech.tbl_cemiterio_teste SET status = 'curada_uti' WHERE cpf = '${cpf}'`);
                curada = true;
                resumo.curadas++;
            }
        }
        relatorio.push({ cpf, nome, status: curada ? 'curada' : 'com_plano', anomalias: itens });
    }

    if (!dbInjetado) await db.disconnect?.().catch(() => {});

    return {
        modo: confirm ? 'confirm' : 'dry-run',
        modeloAdimplente,
        modeloInadimplente,
        totalProcessadas: cemiterio.length,
        resumo,
        relatorio,
    };
}

module.exports = { runUti };

// ─── CLI ─────────────────────────────────────────────────────────────────

if (require.main === module) {
    const args = process.argv.slice(2);
    const confirm = args.includes('--confirm');
    const jsonMode = args.includes('--json');
    const cpfArg = args.find((a) => a.startsWith('--cpf='));
    const cpfFilter = cpfArg ? cpfArg.split('=')[1].replace(/\D/g, '') : null;

    runUti({ confirm, cpfFilter }).then((resultado) => {
        if (jsonMode) {
            console.log(JSON.stringify(resultado));
            process.exit(0);
        }

        console.log(`\n${'='.repeat(70)}`);
        console.log(`UTI de Massas — modo: ${confirm ? 'CONFIRM (grava no banco)' : 'DRY-RUN (só mostra o plano)'}`);
        console.log('='.repeat(70));
        console.log(`\nMassa-molde adimplente escolhida: ${resultado.modeloAdimplente || 'NENHUMA'}`);
        console.log(`Massa-molde inadimplente escolhida: ${resultado.modeloInadimplente || 'NENHUMA'}`);
        console.log(`\nMassas no cemitério processadas: ${resultado.totalProcessadas}\n`);

        for (const item of resultado.relatorio) {
            if (item.status === 'ja_saudavel') {
                console.log(`✅ ${item.cpf} (${item.nome}) — sem anomalia detectável agora.`);
                continue;
            }
            console.log(`🏥 ${item.cpf} (${item.nome}) — ${item.anomalias.length} anomalia(s):`);
            for (const a of item.anomalias) {
                console.log(`   • [${a.type}] ${a.detail}`);
                if (a.semHandler) {
                    console.log('     ⚠ sem handler no UTI ainda — sem cura automática segura, ação manual necessária.');
                    continue;
                }
                console.log(`     → ${a.plano.acao}`);
                if (a.plano.apaga) a.plano.apaga.forEach((l) => console.log(`       - apaga: ${l}`));
                if (a.plano.insere) a.plano.insere.forEach((l) => console.log(`       + insere: ${l}`));
            }
            if (item.status === 'curada') console.log('   ✅ curada — status atualizado pra \'curada_uti\'.');
            console.log('');
        }

        console.log('='.repeat(70));
        console.log(`Resumo: ${resultado.totalProcessadas} massas | ${resultado.resumo.curadas} curadas | ${resultado.resumo.semAnomaliaAtual} já saudáveis | ${resultado.resumo.semHandler} anomalias sem handler`);
        console.log('Por tipo:', JSON.stringify(resultado.resumo.porTipo, null, 2));
        if (!confirm) console.log('\n(dry-run — nada foi gravado. Rode com --confirm pra aplicar de verdade.)');
        process.exit(0);
    }).catch((err) => {
        if (jsonMode) {
            console.log(JSON.stringify({ success: false, message: err.message }));
        } else {
            console.error('[UTI] Erro fatal:', err);
        }
        process.exit(1);
    });
}
