require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'f1nt3ch-b4nk-s3cr3t-k3y-2024!';

// Generate an admin token
const token = jwt.sign(
    { id: 'admin', cpf: 'admin', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

const runTest = (scenario) => {
    return new Promise((resolve) => {
        let data, path, method;
        
        if (scenario === 'CREDIT_PURCHASE') {
            data = JSON.stringify({
                cardNumber: '1111222233334444',
                cvv: '123',
                expiry: '12/30',
                pin: '9898',
                amount: 15.50,
                type: 'CREDIT',
                installments: 1,
                description: 'Compra Padaria',
                hasInterest: false,
                cpf: '04617745777' // Fallback para achar o usuário
            });
            path = '/api/v1/admin/acquirer-simulate';
            method = 'POST';
        } else if (scenario === 'SUBSCRIPTION_PURCHASE') {
            data = JSON.stringify({
                cardNumber: '1111222233334444',
                cvv: '123',
                expiry: '12/30',
                pin: '9898',
                amount: 39.99,
                type: 'SUBSCRIPTION',
                installments: 1,
                description: 'Assinatura Netflix',
                hasInterest: false,
                frequency: 'MONTHLY',
                paymentMethod: 'CREDIT_CARD',
                cpf: '04617745777'
            });
            path = '/api/v1/admin/acquirer-simulate';
            method = 'POST';
        }

        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'Authorization': `Bearer ${token}`
            }
        };

        const req = http.request(options, res => {
            let responseData = '';
            res.on('data', d => { responseData += d; });
            res.on('end', () => {
                let json;
                try {
                    json = JSON.parse(responseData);
                } catch(e) {
                    json = responseData;
                }
                resolve({ statusCode: res.statusCode, data: json });
            });
        });

        req.on('error', error => {
            resolve({ error });
        });

        req.write(data);
        req.end();
    });
};

async function executeTests() {
    console.log('--- INICIANDO TESTES DE INTEGRAÇÃO (API) ---\n');
    
    console.log('1. Testando Compra a Crédito Normal (CREDIT)');
    const res1 = await runTest('CREDIT_PURCHASE');
    console.log(`Status Code: ${res1.statusCode}`);
    console.log('Resultado:', JSON.stringify(res1.data, null, 2));
    
    console.log('\n----------------------------------------\n');
    
    console.log('2. Testando Compra de Assinatura (SUBSCRIPTION)');
    const res2 = await runTest('SUBSCRIPTION_PURCHASE');
    console.log(`Status Code: ${res2.statusCode}`);
    console.log('Resultado:', JSON.stringify(res2.data, null, 2));

    console.log('\n--- FIM DOS TESTES ---');
}

executeTests();
