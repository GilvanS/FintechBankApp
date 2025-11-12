const { getDb, esc } = require('./context');

async function listProducts() {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT id, name, description, price, image_url
        FROM ${db.fq('products')}
        ORDER BY id ASC
    `);
    return rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        price: parseFloat(r.price),
        imageUrl: r.image_url
    }));
}

async function ensureSeed() {
    const db = getDb();
    const count = await db.executeQuery(`SELECT COUNT(1) AS c FROM ${db.fq('products')}`);
    const total = count[0]?.c || 0;
    if (total === 0) {
        await db.executeQuery(`
            INSERT INTO ${db.fq('products')}
            (id, name, description, price, image_url)
            VALUES
            ${[
                `(${esc('prod-001')}, ${esc('Fone de Ouvido')}, ${esc('Fone Bluetooth')}, ${esc(199.90)}, ${esc('https://example.com/fone.jpg')})`,
                `(${esc('prod-002')}, ${esc('Smartwatch')}, ${esc('Relogio inteligente')}, ${esc(499.00)}, ${esc('https://example.com/smartwatch.jpg')})`
              ].join(',')}
        `);
    }
}

module.exports = { listProducts, ensureSeed };