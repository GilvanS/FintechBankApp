/**
 * Backfill de massas antigas: preenche colunas que o Gerador de Massa 2.0
 * (createMassUser / WEB/utils/massGenerator.ts) grava em massas novas mas
 * que ficaram NULL nas massas criadas antes dessas migrações.
 *
 * Modo padrão = DRY-RUN (só imprime o que seria feito, nenhum UPDATE/INSERT).
 * Modo real   = node scripts/backfill-massas-antigas.cjs --apply
 *
 * Escopo:
 *   A) users: birth_date, age, address_* (bundle atômico — só preenche se
 *      já estiver tudo NULL na linha; nunca sobrescreve valor existente,
 *      via COALESCE no UPDATE).
 *   B) pix_keys: reaproveita usersRepo.seedMassPixKeys (idempotente, já
 *      verifica existência antes de inserir).
 *   C) subscriptions: insere assinatura Spotify padrão só se a massa não
 *      tiver nenhuma (mesmo insert do createMassUser).
 *   D) cards: NÃO mexe — só relata (edge case, precisa decisão manual).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');

const DatabaseFactory = require('../services/database/DatabaseFactory');
const { setDb, esc } = require('../repositories/context');
const usersRepo = require('../repositories/usersRepo');

// --- Porta mínima do motor WEB/utils/massGenerator.ts (só endereço + nascimento) ---
function sanitizeToLatinUtf8(text) {
    if (!text) return '';
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s.,-]/gi, '').trim();
}

const GLOBAL_DATASET = {
    'Brasil': {
        streets: ['Avenida Paulista', 'Rua Augusta', 'Avenida Copacabana', 'Rua das Flores', 'Avenida Brigadeiro Faria Lima', 'Avenida Afonso Pena'],
        neighborhoods: ['Bela Vista', 'Consolacao', 'Copacabana', 'Centro', 'Itaim Bibi', 'Savassi'],
        cities: ['Sao Paulo', 'Rio de Janeiro', 'Curitiba', 'Belo Horizonte', 'Porto Alegre', 'Salvador'],
        states: ['SP', 'RJ', 'PR', 'MG', 'RS', 'BA'],
        ceps: ['01310-200', '22070-011', '80010-000', '30130-010', '90010-000', '40020-000'],
    },
    'Estados Unidos': {
        streets: ['Fifth Avenue', 'Broadway Street', 'Ocean Drive', 'Sunset Boulevard', 'Michigan Avenue', 'Peachtree Street'],
        neighborhoods: ['Manhattan', 'South Beach', 'Hollywood', 'Downtown', 'Lincoln Park', 'Midtown'],
        cities: ['Nova York', 'Miami', 'Los Angeles', 'Chicago', 'Atlanta', 'San Francisco'],
        states: ['NY', 'FL', 'CA', 'IL', 'GA', 'CA'],
        ceps: ['10001', '33139', '90028', '60611', '30303', '94102'],
    },
};
// Países sem dataset próprio caem no fallback 'Brasil' (evita expandir o
// dataset inteiro do frontend aqui; é só para preencher colunas vazias).
function datasetFor(country) {
    return GLOBAL_DATASET[country] || GLOBAL_DATASET['Brasil'];
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateAgeAndBirth(existingBirthDate) {
    if (existingBirthDate) {
        const bd = new Date(existingBirthDate);
        const age = Math.max(0, new Date().getFullYear() - bd.getFullYear());
        return { age, birthDate: null }; // birth_date já existe, só falta age
    }
    const age = Math.floor(Math.random() * 63) + 18; // 18–80, mesma regra do gerador
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - age;
    const birthMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const birthDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    return { age, birthDate: `${birthYear}-${birthMonth}-${birthDay}` };
}

function generateAddress(country) {
    const ds = datasetFor(country);
    return {
        cep: pick(ds.ceps),
        street: sanitizeToLatinUtf8(pick(ds.streets)),
        number: String(Math.floor(Math.random() * 900) + 10),
        neighborhood: sanitizeToLatinUtf8(pick(ds.neighborhoods)),
        city: sanitizeToLatinUtf8(pick(ds.cities)),
        state: sanitizeToLatinUtf8(pick(ds.states)),
    };
}

async function main() {
    const db = DatabaseFactory.createDatabaseService();
    await db.connect();
    setDb(db);

    console.log(`\n=== Backfill de massas antigas — modo ${APPLY ? 'APPLY (grava de verdade)' : 'DRY-RUN (nada será gravado)'} ===\n`);

    // ─── A) users: birth_date / age / endereço ────────────────────────────
    const rows = await db.executeQuery(`
        SELECT cpf, full_name, country_origin, birth_date, age,
               address_cep, address_street, address_number, address_neighborhood, address_city, address_state
        FROM ${db.fq('users')}
        WHERE role != 'admin'
          AND (birth_date IS NULL OR age IS NULL OR address_street IS NULL)
        ORDER BY created_at ASC
    `);

    console.log(`[A] Massas com birth_date/age/endereço faltando: ${rows.length}`);

    let plannedA = 0;
    for (const row of rows) {
        const country = row.country_origin || 'Brasil';
        const needsBirth = !row.birth_date || !row.age;
        const needsAddress = !row.address_street;

        const sets = [];
        const values = [];
        let idx = 1;

        if (needsBirth) {
            const { age, birthDate } = generateAgeAndBirth(row.birth_date);
            if (!row.birth_date && birthDate) { sets.push(`birth_date = COALESCE(birth_date, $${idx++})`); values.push(birthDate); }
            if (!row.age) { sets.push(`age = COALESCE(age, $${idx++})`); values.push(age); }
        }
        if (needsAddress) {
            const addr = generateAddress(country);
            sets.push(`address_cep = COALESCE(address_cep, $${idx++})`); values.push(addr.cep);
            sets.push(`address_street = COALESCE(address_street, $${idx++})`); values.push(addr.street);
            sets.push(`address_number = COALESCE(address_number, $${idx++})`); values.push(addr.number);
            sets.push(`address_neighborhood = COALESCE(address_neighborhood, $${idx++})`); values.push(addr.neighborhood);
            sets.push(`address_city = COALESCE(address_city, $${idx++})`); values.push(addr.city);
            sets.push(`address_state = COALESCE(address_state, $${idx++})`); values.push(addr.state);
        }

        if (!sets.length) continue;
        plannedA++;

        if (plannedA <= 8) {
            console.log(`  ${row.cpf} (${row.full_name}) [${country}] -> ${sets.length} campo(s)`);
        }

        if (APPLY) {
            values.push(row.cpf);
            await db.pool.query(
                `UPDATE ${db.fq('users')} SET ${sets.join(', ')} WHERE cpf = $${idx}`,
                values
            );
        }
    }
    console.log(`  Total a atualizar: ${plannedA}${plannedA > 8 ? ' (mostrando 8 primeiros acima)' : ''}\n`);

    // ─── B) pix_keys faltando (reaproveita função real do repositório) ───
    const missingPix = await db.executeQuery(`
        SELECT u.cpf, u.email FROM ${db.fq('users')} u
        WHERE u.role != 'admin' AND NOT EXISTS (SELECT 1 FROM ${db.fq('pix_keys')} p WHERE p.cpf = u.cpf)
    `);
    console.log(`[B] Massas sem nenhuma pix_key: ${missingPix.length}`);
    if (APPLY) {
        for (const u of missingPix) {
            await usersRepo.seedMassPixKeys(db, u.cpf, u.email);
        }
        console.log(`  ✅ pix_keys geradas (CPF + EMAIL) para ${missingPix.length} massas.\n`);
    } else {
        console.log(`  Seria gerado: chave CPF + chave EMAIL para cada uma (via seedMassPixKeys).\n`);
    }

    // ─── C) subscriptions (Spotify padrão) faltando ───────────────────────
    const missingSub = await db.executeQuery(`
        SELECT u.cpf FROM ${db.fq('users')} u
        WHERE u.role != 'admin' AND NOT EXISTS (SELECT 1 FROM ${db.fq('subscriptions')} s WHERE s.cpf = u.cpf)
    `);
    console.log(`[C] Massas sem nenhuma subscription: ${missingSub.length}`);
    if (APPLY) {
        const now = new Date().toISOString();
        for (const u of missingSub) {
            const subId = db.generateUUID ? db.generateUUID() : `sub-${u.cpf}-${Date.now()}`;
            const nextBilling = new Date();
            nextBilling.setMonth(nextBilling.getMonth() + 1);
            await db.executeQuery(`
                INSERT INTO ${db.fq('subscriptions')}
                (id, cpf, name, amount, frequency, payment_method, status, next_billing_date, created_at, updated_at)
                VALUES (${esc(subId)}, ${esc(u.cpf)}, 'Spotify', 19.90, 'monthly', 'credit', 'active', ${esc(nextBilling.toISOString())}, ${esc(now)}, ${esc(now)})
            `);
        }
        console.log(`  ✅ Assinatura Spotify padrão criada para ${missingSub.length} massas.\n`);
    } else {
        console.log(`  Seria criada: assinatura Spotify R$19,90/mês padrão para cada uma.\n`);
    }

    // ─── D) cards faltando — só relata, não mexe ──────────────────────────
    const missingCards = await db.executeQuery(`
        SELECT u.cpf, u.full_name, u.card_brand FROM ${db.fq('users')} u
        WHERE u.role != 'admin' AND NOT EXISTS (SELECT 1 FROM ${db.fq('cards')} c WHERE c.user_cpf = u.cpf)
    `);
    console.log(`[D] Massas sem nenhum card (NÃO alterado por este script — revisar manualmente):`);
    console.log(JSON.stringify(missingCards, null, 2));

    console.log(`\n=== Fim (${APPLY ? 'gravado no banco' : 'dry-run — nada foi gravado'}) ===\n`);

    await db.pool.end();
}

main().catch((err) => {
    console.error('Erro no backfill:', err);
    process.exit(1);
});
