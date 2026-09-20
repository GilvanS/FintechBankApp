/**
 * Roda a auditoria diária real (dailyAudit.js — já cura o que sabe curar sozinha,
 * ex: BLACKLIST_DESSINCRONIZADA) e joga toda massa que SOBROU com anomalia (não
 * autocurável) em tbl_cemiterio_teste — sinal pro admin de "não tenta salvar essa
 * massa, gera outra nova com o gerador".
 *
 * Distinta de fintech.cemiterio_massas (essa é fluxo de NEGÓCIO real — cliente que
 * virou perda e precisa renegociar; tbl_cemiterio_teste é sobre QUALIDADE DE DADO DE
 * TESTE, não confundir os dois conceitos).
 *
 * ATENÇÃO: dailyAudit.js manda alerta no Telegram pra cada anomalia encontrada — é
 * comportamento normal do sistema (canal já usado por outras rotinas), não é
 * exclusivo deste script.
 *
 * Rodar (dentro da pasta API):
 *   node scripts/populate_cemiterio_teste.cjs
 */
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');

async function main() {
    const db = DatabaseFactory.createDatabaseService();
    await db.connect();

    await db.executeQuery(`
        CREATE TABLE IF NOT EXISTS fintech.tbl_cemiterio_teste (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cpf VARCHAR(11) NOT NULL,
            nome_completo TEXT,
            tipos_anomalia TEXT[] NOT NULL,
            detalhes JSONB NOT NULL,
            data_entrada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(30) NOT NULL DEFAULT 'precisa_massa_nova'
        )
    `);

    // auditLog dummy — só precisa não quebrar; grava audit_log de verdade se a tabela existir.
    const auditLogStub = async (req, action, level, details) => {
        try {
            await db.executeQuery(`
                CREATE TABLE IF NOT EXISTS fintech.audit_log (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    cpf VARCHAR(11), action VARCHAR(100), level VARCHAR(20),
                    details JSONB, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await db.executeQuery(`
                INSERT INTO fintech.audit_log (cpf, action, level, details)
                VALUES ('${(details && details.cpf) || '00000000000'}', '${action}', '${level}', '${JSON.stringify(details || {}).replace(/'/g, "''")}')
            `);
        } catch (e) { /* melhor esforço, não derruba a auditoria */ }
    };

    const { runDailyAudit } = require('../services/dailyAudit');
    console.log('🔎 Rodando auditoria diária completa...');
    const result = await runDailyAudit(db, auditLogStub, null);
    console.log(`Auditoria encontrou ${result.count} anomalia(s) no total.`);

    // Agrupa por CPF (uma massa pode ter mais de uma anomalia).
    const porCpf = new Map();
    for (const err of result.errors) {
        if (!porCpf.has(err.cpf)) porCpf.set(err.cpf, { nome: err.name, tipos: [], detalhes: [] });
        const entry = porCpf.get(err.cpf);
        entry.tipos.push(err.type);
        entry.detalhes.push(err);
    }

    // BLACKLIST_DESSINCRONIZADA já foi curada sozinha (dailyAudit.js já corrige o
    // campo) — não precisa ir pro cemitério de teste. As outras (sem cura automática)
    // são as candidatas de verdade a "gera massa nova".
    let ok = 0;
    for (const [cpf, info] of porCpf) {
        const tiposReais = info.tipos.filter(t => t !== 'BLACKLIST_DESSINCRONIZADA');
        if (tiposReais.length === 0) continue;

        const jaExiste = await db.executeQuery(`SELECT id FROM fintech.tbl_cemiterio_teste WHERE cpf = '${cpf}'`);
        if (jaExiste.length > 0) continue;

        await db.executeQuery(`
            INSERT INTO fintech.tbl_cemiterio_teste (cpf, nome_completo, tipos_anomalia, detalhes)
            VALUES ('${cpf}', '${(info.nome || '').replace(/'/g, "''")}', ARRAY[${tiposReais.map(t => `'${t}'`).join(',')}]::text[], '${JSON.stringify(info.detalhes).replace(/'/g, "''")}')
        `);
        ok++;
    }

    console.log(`✅ ${ok} massa(s) inserida(s) em tbl_cemiterio_teste (precisam de massa nova).`);

    // Encadeamento com o UTI de recuperação: só dispara se ESTA rodada achou
    // massa NOVA no cemitério (ok > 0) — se nada novo entrou, não tem por que
    // gastar tempo/consultas rodando o UTI de novo sobre o que já foi visto.
    // Sempre em dry-run aqui: o UTI só GRAVA de verdade quando alguém roda
    // `node scripts/uti_massa.cjs --confirm` (terminal) ou aciona o botão
    // "Rodar UTI de Recuperação" no painel Admin — encadear não pula essa
    // revisão humana antes de forçar escrita em massa.
    if (ok > 0) {
        console.log(`\n🏥 ${ok} massa(s) nova(s) no cemitério — rodando UTI de recuperação em dry-run pra já mostrar o plano de correção...`);
        const { runUti } = require('./uti_massa.cjs');
        const relatorio = await runUti({ confirm: false, db });
        console.log(`UTI (dry-run): ${relatorio.totalProcessadas} massas no cemitério | ${relatorio.resumo.semAnomaliaAtual} já saudáveis | ${relatorio.resumo.semHandler} sem handler | por tipo: ${JSON.stringify(relatorio.resumo.porTipo)}`);
        console.log('Rode "node scripts/uti_massa.cjs --confirm" (ou o botão "Rodar UTI de Recuperação" no Admin) pra aplicar de verdade.');
    }

    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
