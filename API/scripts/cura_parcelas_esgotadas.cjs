#!/usr/bin/env node
/**
 * scripts/cura_parcelas_esgotadas.cjs
 *
 * Script CLI de Cura para Massas com Parcelamentos Esgotados (< 6x ou remaining = 0 em atraso)
 * e Faturas sem Lançamentos.
 *
 * Uso:
 *   node scripts/cura_parcelas_esgotadas.cjs                    # Cura todas as massas afetadas
 *   node scripts/cura_parcelas_esgotadas.cjs --dry-run          # Apenas lista os CPFs afetados
 *   node scripts/cura_parcelas_esgotadas.cjs --cpf=21537822284  # Cura um CPF específico
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');
const { curarMassaParcelas } = require('../services/installmentPlanCura');

async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    const cpfArg = (process.argv.find(a => a.startsWith('--cpf=')) || '').split('=')[1] || null;

    console.log('====================================================');
    console.log('  🏥 UTI / CURA DE MASSAS - PARCELAMENTOS ESGOTADOS');
    console.log('====================================================');
    if (cpfArg) console.log(`🎯 Filtro CPF: ${cpfArg}`);
    if (isDryRun) console.log('🔍 Modo: DRY-RUN (apenas diagnóstico)');

    const db = DatabaseFactory.createDatabaseService();
    await db.connect();

    try {
        const result = await curarMassaParcelas(db, {
            cpfFilter: cpfArg,
            dryRun: isDryRun
        });

        console.log('\n--- RESULTADO DA EXECUÇÃO ---');
        console.log(`Total de massas encontradas: ${result.totalFound}`);
        if (!isDryRun) {
            console.log(`Total de massas curadas: ${result.totalCured}`);
            console.log(`Erros: ${result.errorsCount}`);
        } else {
            console.log('CPFs candidatos:');
            console.table(result.cpfs);
        }
    } catch (err) {
        console.error('❌ Falha na execução da cura:', err);
        process.exitCode = 1;
    } finally {
        await db.disconnect();
    }
}

if (require.main === module) {
    main();
}
