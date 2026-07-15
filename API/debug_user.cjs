const { Pool } = require('pg');
require('dotenv').config();
const p = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fintechbank',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// Ver hash da senha para descobrir o padrão
p.query("SELECT cpf, full_name, password_hash, card_cvv, card_expiry, card_delivery_status, card_is_activated FROM fintech.users WHERE cpf = '12464865954'")
  .then(r => { 
    const u = r.rows[0];
    console.log('CPF           :', u.cpf);
    console.log('Nome          :', u.full_name);
    console.log('Password hash :', u.password_hash);
    console.log('card_cvv      :', u.card_cvv);
    console.log('card_expiry   :', u.card_expiry);
    console.log('delivery_status:', u.card_delivery_status);
    console.log('is_activated  :', u.card_is_activated);
    p.end(); 
  })
  .catch(e => { console.error(e.message); p.end(); });
