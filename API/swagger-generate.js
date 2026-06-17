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
        { name: 'Shop', description: 'Marketplace — produtos e checkout' },
        { name: 'Admin', description: 'Painel administrativo (requer role admin)' },
        { name: 'Debug', description: 'Diagnóstico do sistema (requer role admin)' },
    ],
};

const outputFile = './swagger.json';
const endpointsFiles = ['./index.cjs'];

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
    console.log('✅ swagger.json gerado com sucesso.');
});
