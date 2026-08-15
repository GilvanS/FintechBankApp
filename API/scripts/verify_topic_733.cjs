#!/usr/bin/env node
/**
 * verify_topic_733.cjs — Verifica a entrega dos PDFs da fatura (fechada + aberta)
 * no tópico Telegram #733 da massa 12310012300.
 *
 * Envia os PDFs LOCAIS já gerados (.freebuff/pdf-preview/massa_12310012300_*.pdf —
 * Página 2 validada com compras reais) diretamente via Bot API sendDocument para o
 * tópico #733, capturando o message_id de cada envio (resposta autoritativa).
 *
 * Uso: node scripts/verify_topic_733.cjs [--cpf <cpf>] [--topic <id>]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
// Parametrizado (plano Imp. 4.3): --cpf e --topic; default = massa 12310012300/tópico 733.
const argv = process.argv.slice(2);
const argVal = (flag, def) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const CPF = argVal('--cpf', '12310012300');
const TOPIC_ID = Number(argVal('--topic', '733')) || 733;

const PDFS = [
    { file: path.join(__dirname, '..', '..', '.freebuff', 'pdf-preview', `massa_${CPF}_closed.pdf`), label: 'Fechada', filename: `fatura_closed_${CPF}.pdf` },
    { file: path.join(__dirname, '..', '..', '.freebuff', 'pdf-preview', `massa_${CPF}_open.pdf`),    label: 'Aberta',  filename: `fatura_open_${CPF}.pdf` },
];

(async () => {
    if (!TOKEN || !CHAT_ID) {
        console.error('❌ TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID ausentes no .env');
        process.exit(1);
    }
    console.log(`🔎 Verificando tópico #${TOPIC_ID} (chat ${CHAT_ID}) da massa ${CPF}\n`);

    for (const pdf of PDFS) {
        if (!fs.existsSync(pdf.file)) {
            console.log(`⚠️  ${pdf.label}: PDF local não encontrado (${pdf.file}) — pulando`);
            continue;
        }
        const buffer = fs.readFileSync(pdf.file);
        const form = new FormData();
        form.append('chat_id', String(CHAT_ID));
        form.append('message_thread_id', String(TOPIC_ID));
        form.append('document', new Blob([buffer], { type: 'application/pdf' }), pdf.filename);

        const started = Date.now();
        const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendDocument`, { method: 'POST', body: form });
        const json = await res.json();
        const ms = Date.now() - started;

        if (json.ok && json.result) {
            const m = json.result;
            console.log(`✅ ${pdf.label}: ENVIADA com sucesso`);
            console.log(`   message_id: ${m.message_id}`);
            console.log(`   file_name : ${m.document?.file_name}`);
            console.log(`   file_size : ${m.document?.file_size} bytes`);
            console.log(`   chat      : ${m.chat?.title} (id ${m.chat?.id})`);
            console.log(`   thread    : ${m.message_thread_id}`);
            console.log(`   latência  : ${ms}ms`);
            console.log(`   link      : https://t.me/c/${String(m.chat?.id).replace('-100', '')}/${m.message_id}\n`);
        } else {
            console.log(`❌ ${pdf.label}: FALHOU — ${json.description || JSON.stringify(json)} (${ms}ms)\n`);
        }
    }

    // Confirma o dono do tópico no banco
    const { Pool } = require('pg');
    const p = new Pool({
        host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres', password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'fintechbank',
    });
    try {
        const { rows } = await p.query(
            `SELECT cpf, topic_id, created_at FROM fintech.telegram_user_topics WHERE topic_id = $1`, [TOPIC_ID]);
        console.log('=== dono do tópico no banco ===');
        for (const r of rows) console.log(`  ${r.cpf} -> topic#${r.topic_id} | ${r.created_at?.toISOString?.() || r.created_at}`);
    } catch (e) {
        console.log('(banco indisponível para confirmar dono:', e.message, ')');
    }
    await p.end();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
