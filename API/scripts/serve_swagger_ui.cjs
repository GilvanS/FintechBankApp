#!/usr/bin/env node
/**
 * serve_swagger_ui.cjs
 * Sobe um swagger-ui local servindo o swagger.yaml MANUAL do projeto
 * (fonte da verdade — inclui rotas documentadas à mão que o swagger-autogen
 * não gera, ex.: POST /recurring-bills/{cpf}/{billId}/pay).
 *
 * Uso:
 *   node scripts/serve_swagger_ui.cjs [porta]
 *   (default: 3100)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');

const PORT = Number(process.argv[2] || process.env.SWAGGER_PORT || 3100);
const yamlPath = path.join(__dirname, '..', 'swagger.yaml');

const swaggerDocument = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
if (!swaggerDocument || !swaggerDocument.paths) {
    console.error('Falha ao parsear swagger.yaml');
    process.exit(1);
}

const app = express();

// Swagger UI na raiz servindo o documento parseado do yaml manual
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get('/', (req, res) => res.redirect('/api-docs'));
app.get('/swagger.yaml', (req, res) => {
    res.setHeader('Content-Type', 'text/yaml');
    res.send(fs.readFileSync(yamlPath, 'utf8'));
});
app.get('/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(swaggerDocument, null, 2));
});

const server = http.createServer(app);
server.listen(PORT, () => {
    console.log(`Swagger UI em http://localhost:${PORT}/api-docs`);
    console.log(`  - YAML fonte: ${yamlPath}`);
    console.log(`  - Paths documentados: ${Object.keys(swaggerDocument.paths).length}`);
    // NOTA: a rota /pay foi documentada no YAML e registrada em src/routes/recurringBills.routes.js.
    // O lookup deve usar a chave COM o sufixo /pay — antes usava a chave sem o sufixo,
    // reportando AUSENTE mesmo com a rota documentada (bug de verificação).
    const pay = swaggerDocument.paths['/recurring-bills/{cpf}/{billId}/pay'];
    console.log(`  - POST /recurring-bills/{cpf}/{billId}/pay: ${pay && pay.post ? 'PRESENTE' : 'AUSENTE'}`);
});
