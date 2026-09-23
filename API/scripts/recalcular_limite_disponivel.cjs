#!/usr/bin/env node
/**
 * Recalcula credit_card_available_limit com a fórmula canônica (limite_total -
 * currentInvoiceTotal), a mesma fonte única usada pelo "Próxima Fatura" do
 * Web/Admin (enrichUserCreditCardData). Substitui o clamp cosmético que o
 * audit_completo.js fazia antes ("negativo → 0.00" sem olhar a dívida real).
 *
 * Requer ../index.cjs sob NODE_ENV=test para reusar enrichUserCreditCardData/
 * normalizeUser/usersRepo sem duplicar a lógica — o guard de IS_TEST em
 * index.cjs impede bootstrap()/app.listen() de rodar neste processo filho
 * (script sempre roda como processo Node separado, nunca importado de volta
 * por index.cjs — sem risco de ciclo).
 *
 * Uso:
 *   node scripts/recalcular_limite_disponivel.cjs                # dry-run, todas as massas
 *   node scripts/recalcular_limite_disponivel.cjs --fix --confirm # aplica, todas as massas
 *   node scripts/recalcular_limite_disponivel.cjs --cpf=XXX --fix --confirm
 *   node scripts/recalcular_limite_disponivel.cjs --json
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const ALLOW_FIX = process.argv.includes('--fix') && process.argv.includes('--confirm');
const CPF_FILTER = (process.argv.find(a => a.startsWith('--cpf=')) || '').split('=')[1] || null;
const JSON_OUTPUT = process.argv.includes('--json');

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { recalcularLimiteDisponivel, normalizeUser, enrichUserCreditCardData, usersRepo, dbService } = require('../index.cjs');

// IS_TEST em index.cjs pula bootstrap() (que faria seed + app.listen, indesejados
// aqui) — mas isso também deixa o pool de conexão sem conectar. connect() sozinho
// só abre a conexão, sem side effects de seed/migração.
let _connectPromise = null;
async function ensureConnected() {
    if (!_connectPromise) _connectPromise = dbService.connect();
    return _connectPromise;
}

/**
 * Réplica ENXUTA do cálculo só para preview (dry-run) — não persiste. Mantém a
 * MESMA fórmula (limite_total - currentInvoiceTotal via enrichUserCreditCardData),
 * só pula o UPDATE. Necessário porque recalcularLimiteDisponivel real sempre
 * persiste quando `alterado` — não tem flag de dry-run própria (ela vive no
 * index.cjs e não teve motivo pra crescer um parâmetro só usado por este script).
 */
async function simularSemPersistir(cpf) {
    // Exportada e chamada direto pelo uti_massa.cjs (sem passar por recalcularEmLote):
    // sem isto, "Pool não está conectado!" quando a UTI simula o limite primeiro.
    await ensureConnected();
    const userRow = await usersRepo.findByCpf(cpf);
    if (!userRow) return null;
    const tempUser = normalizeUser(userRow);
    await enrichUserCreditCardData(tempUser, cpf);
    const totalLimit = parseFloat(userRow.credit_card_total_limit || 0);
    const currentInvoiceTotal = tempUser.creditCard?.currentInvoiceTotal ?? 0;
    const limiteAnterior = parseFloat(userRow.credit_card_available_limit || 0);
    const limiteNovo = Math.round((totalLimit - currentInvoiceTotal) * 100) / 100;
    const alterado = Math.abs(limiteNovo - limiteAnterior) > 0.005;
    return {
        cpf, fullName: userRow.full_name, totalLimit, currentInvoiceTotal,
        limiteAnterior, limiteNovo, alterado, estourado: limiteNovo < 0,
    };
}

/**
 * Roda o recálculo para 1 CPF ou para a base inteira, em dry-run ou aplicando.
 * Reexportada para o audit_completo.js reusar sem duplicar a fórmula.
 */
async function recalcularEmLote({ cpf = null, persist = false } = {}) {
    await ensureConnected();
    const alvos = cpf
        ? [{ cpf }]
        : (await usersRepo.listUsers()).filter(u => u.role !== 'admin');

    const resultados = [];
    for (const u of alvos) {
        try {
            const r = persist
                ? await recalcularLimiteDisponivel(u.cpf)
                : await simularSemPersistir(u.cpf);
            if (r) resultados.push(r);
        } catch (err) {
            resultados.push({ cpf: u.cpf, erro: err.message });
        }
    }
    return resultados;
}

async function main() {
    const resultados = await recalcularEmLote({ cpf: CPF_FILTER, persist: ALLOW_FIX });
    const divergentes = resultados.filter(r => r.alterado);
    const estourados = resultados.filter(r => r.estourado);
    const erros = resultados.filter(r => r.erro);

    const report = {
        modo: ALLOW_FIX ? 'FIX (aplicado)' : 'DRY-RUN (nenhuma alteração persistida)',
        cpfFiltro: CPF_FILTER || 'TODAS AS MASSAS',
        totalVerificado: resultados.length,
        divergentes: divergentes.length,
        estourados: estourados.length,
        erros: erros.length,
        detalhes: resultados,
    };

    if (JSON_OUTPUT) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log(`\n🔧 Recalcular Limite Disponível — ${report.modo}`);
        console.log(`   Alvo: ${report.cpfFiltro}\n`);
        for (const r of resultados) {
            if (r.erro) {
                console.log(`  ❌ ${r.cpf}: ${r.erro}`);
                continue;
            }
            if (!r.alterado) continue;
            const tag = r.estourado ? '🔴 ESTOURADO' : '✅';
            console.log(`  ${tag} ${r.fullName} (${r.cpf}): R$ ${r.limiteAnterior.toFixed(2)} → R$ ${r.limiteNovo.toFixed(2)} (dívida atual: R$ ${r.currentInvoiceTotal.toFixed(2)} / limite: R$ ${r.totalLimit.toFixed(2)})`);
        }
        if (divergentes.length === 0) console.log('  ✅ Nenhuma divergência encontrada.');
        console.log(`\n📊 Verificadas: ${report.totalVerificado} | Divergentes: ${report.divergentes} | Estouradas: ${report.estourados} | Erros: ${report.erros}`);
        if (!ALLOW_FIX && divergentes.length > 0) {
            console.log('\n⚠️  Rode com --fix --confirm para aplicar de verdade.');
        }
    }

    process.exit(erros.length > 0 ? 1 : 0);
}

module.exports = { recalcularEmLote, simularSemPersistir };

if (require.main === module) {
    main().catch(err => {
        console.error('❌ Erro fatal:', err.message);
        process.exit(1);
    });
}
