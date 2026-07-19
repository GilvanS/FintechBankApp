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
        { name: 'Admin', description: 'Painel administrativo (requer role admin)' },
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
    admin: 'Admin',
    debug: 'Debug',
    stories: 'Social',
    proxy: 'Outros',
    test: 'Debug',
};

function tagForPath(pathKey) {
    const firstSegment = pathKey.replace(/^\/api\/?/, '').split('/')[0] || '';
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
