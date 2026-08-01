const { Client } = require('pg');
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'fintechbank',
  password: 'pwd123',
  port: 5432
});

client.connect();

const cpf = '04617745777';
const cvv = '777';

(async () => {
    try {
        const query1 = `SELECT card_cvv, card_expiry, card_is_activated FROM fintech.users WHERE cpf = '${cpf}'`;
        const res1 = await client.query(query1);
        const dbUser = res1.rows[0];
        console.log('dbUser:', dbUser);
        
        // Generate random card
        let cardRaw = Math.floor(Math.random() * 10000000000000000).toString().padStart(16, '0');
        let cardFormatted = cardRaw.replace(/(.{4})/g, '$1 ').trim();
        let cardBrand = 'mastercard';
        let cardBin = '111122';
        let expiryFull = '07/2031';
        let pin = '9898';

        // Salvar cartão na tabela fintech.cards
        const insertQuery = `
            INSERT INTO fintech.cards (user_cpf, card_number, card_number_raw, card_type, card_brand, bin, expiry, expiry_short, cvv, pin, is_activated)
            VALUES ('${cpf}', '${cardFormatted}', '${cardRaw}', 'physical', '${cardBrand}', '${cardBin}', '${expiryFull}', '${dbUser.card_expiry}', '${cvv}', '${pin}', true)
        `;
        console.log('Running insert');
        await client.query(insertQuery);
        
        // Atualizar status do usuário
        const updateQuery = `
            UPDATE fintech.users
            SET card_is_activated = true, card_delivery_status = 'unlocked', updated_at = CURRENT_TIMESTAMP
            WHERE cpf = '${cpf}'
        `;
        console.log('Running update');
        await client.query(updateQuery);
        console.log('Success!');
    } catch (e) {
        console.error('Error during test:', e.message);
    } finally {
        client.end();
    }
})();
