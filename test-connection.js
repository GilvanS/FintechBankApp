const http = require('http');

const urls = [
    'http://localhost:3001/api/health',
    'http://127.0.0.1:3001/api/health',
    'http://192.168.0.105:3001/api/health'
];

console.log('Iniciando testes de conexão com a API...\n');

urls.forEach(url => {
    const req = http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(`[SUCESSO] ${url} - Status: ${res.statusCode}`);
            // console.log('Resposta:', data);
        });
    });

    req.on('error', (err) => {
        console.error(`[FALHA]   ${url} - Erro: ${err.message}`);
    });

    req.setTimeout(2000, () => {
        req.destroy();
        console.error(`[TIMEOUT] ${url} - Tempo limite excedido`);
    });
});
