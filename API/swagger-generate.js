const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });

const doc = {
    info: {
        title: 'FintechBankApp API',
        description: 'API REST para o banco digital FintechBankApp.\n\n**Autenticação:** Bearer token JWT via header `Authorization: Bearer <token>` ou httpOnly cookie `token`.',
        version: '1.0.0',
    },
    servers: [
        { url: 'http://localhost:3001/api', description: 'Desenvolvimento local' },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'JWT obtido em POST /auth/login. Alternativa: cookie httpOnly `token`.',
            },
        },
        schemas: {
            LoginRequest: {
                type: 'object',
                required: ['cpf', 'password'],
                properties: {
                    cpf: { type: 'string', example: '11111111111', description: '11 dígitos sem formatação' },
                    password: { type: 'string', example: 'Senha1234', minLength: 6, maxLength: 12 },
                },
            },
            SignupRequest: {
                type: 'object',
                required: ['cpf', 'fullName', 'email', 'password'],
                properties: {
                    cpf: { type: 'string', example: '12345678909' },
                    fullName: { type: 'string', example: 'João Silva' },
                    email: { type: 'string', format: 'email', example: 'joao@exemplo.com' },
                    password: { type: 'string', example: 'Senha1234', minLength: 6, maxLength: 12 },
                    username: { type: 'string', example: 'joaosilva' },
                },
            },
            SuccessResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string' },
                },
            },
            ErrorResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Erro ao processar a solicitação.' },
                },
            },
        },
    },
    security: [{ bearerAuth: [] }],
    tags: [
        { name: 'Auth', description: 'Autenticação e autorização' },
        { name: 'Users', description: 'Perfil, saldo e extrato do usuário' },
        { name: 'PIX', description: 'Transferências PIX, chaves e contatos' },
        { name: 'Cards', description: 'Cartão de crédito, faturas e parcelamentos' },
        { name: 'Financeiro', description: 'Assinaturas, contas recorrentes, extrato, saúde financeira e estorno/cancelamento de transações' },
        { name: 'Shop', description: 'Marketplace — produtos e checkout' },
        { name: 'Admin - Usuários', description: 'Gerenciamento de contas: bloqueio, limites, senha, saldo, stats' },
        { name: 'Admin - Cartões e Autorizações de Compra', description: 'Simulação/autorização de compras em crédito e débito, detalhes de cartão, status de entrega' },
        { name: 'Admin - Faturamento', description: 'Ciclo de faturas, configuração de cobrança, cenários de teste' },
        { name: 'Admin - Solicitações', description: 'Aprovação/rejeição de pedidos de aumento de limite e reset de senha' },
        { name: 'Debug', description: 'Diagnóstico do sistema (requer role admin)' },
        { name: 'Sistema', description: 'Health check e utilitários gerais' },
        { name: 'Social', description: 'Stories e conteúdo social' },
        { name: 'Outros', description: 'Endpoints diversos ainda não categorizados' },
    ],
};

const outputFile = './swagger.json';
const endpointsFiles = ['./index.cjs'];

// swagger-autogen só atribui tags a partir de comentários "#swagger.tags" no
// código-fonte das rotas — como index.cjs não tem esses comentários, todas as
// 90 rotas saíam sem tag e o Swagger UI as agrupava num bloco único "default",
// sem separação por funcionalidade. Em vez de anotar manualmente cada uma das
// ~90 rotas espalhadas por um arquivo de 5000+ linhas (alto risco de quebrar
// algo), a tag é inferida aqui pelo primeiro segmento do path — mais seguro e
// se mantém sozinho a cada nova rota, sem precisar editar index.cjs.
const TAG_BY_PREFIX = {
    health: 'Sistema',
    auth: 'Auth',
    users: 'Users',
    user: 'Users',
    pix: 'PIX',
    cards: 'Cards',
    credit: 'Cards',
    transactions: 'Financeiro',
    vouchers: 'Financeiro',
    subscriptions: 'Financeiro',
    'recurring-bills': 'Financeiro',
    statement: 'Financeiro',
    'financial-health': 'Financeiro',
    billing: 'Financeiro',
    shop: 'Shop',
    debug: 'Debug',
    stories: 'Social',
    proxy: 'Outros',
    test: 'Debug',
};

// Admin concentra o maior numero de rotas (33) com finalidades bem diferentes
// entre si — sobretudo apos as novas rotas de autorizacao de compra em
// credito/debito (simulate-purchases, card/purchase/open|closed,
// transactions/simulate-mass). Em vez de um unico bloco "Admin", divide por
// segundos segmentos do path em 4 subgrupos.
function tagForAdminPath(segments) {
    const rest = segments.slice(1); // remove 'admin'
    if (rest.includes('requests')) return 'Admin - Solicitações';
    if (rest.includes('invoices') || rest.includes('billing')) return 'Admin - Faturamento';
    const isCardOrPurchaseAuth =
        rest.includes('simulate-purchases') ||
        rest.includes('transactions') ||
        rest.includes('cards') ||
        rest.includes('card-details') ||
        (rest.includes('card') && rest.includes('purchase'));
    if (isCardOrPurchaseAuth) return 'Admin - Cartões e Autorizações de Compra';
    return 'Admin - Usuários';
}

function tagForPath(pathKey) {
    const segments = pathKey.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    const firstSegment = segments[0] || '';
    if (firstSegment === 'admin') return tagForAdminPath(segments);
    return TAG_BY_PREFIX[firstSegment] || 'Outros';
}

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
    const fs = require('fs');
    const generated = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    for (const [pathKey, methods] of Object.entries(generated.paths || {})) {
        if (pathKey.startsWith('/api-docs')) continue; // rotas do proprio Swagger, sem tag
        const tag = tagForPath(pathKey);
        for (const operation of Object.values(methods)) {
            if (operation && typeof operation === 'object') {
                operation.tags = [tag];
            }
        }
    }
    fs.writeFileSync(outputFile, JSON.stringify(generated, null, 2));
    console.log('✅ swagger.json gerado com sucesso (tags organizadas por funcionalidade).');
});
