/**
 * Teste Unitário - Endpoint /auth/signup
 * Valida o payload recebido dos fronts (WEB e MOBILE) antes de processar
 */

const request = require('supertest');
const express = require('express');
const { body, validationResult } = require('express-validator');

// Mock da estrutura do servidor para testes
const createTestServer = () => {
    const app = express();
    app.use(express.json());

    // Regras de validação (mesmas do index.cjs)
    const signupValidationRules = [
        body('fullName').isString().notEmpty().withMessage('Nome completo é obrigatório.'),
        body('cpf').isString().isLength({ min: 11, max: 11 }).withMessage('CPF deve ter 11 dígitos.').isNumeric().withMessage('CPF deve conter apenas números.'),
        body('email').isEmail().withMessage('Formato de e-mail inválido.'),
        body('password').isString().isLength({ min: 6, max: 12 }).withMessage('A senha deve ter entre 6 e 12 caracteres.')
    ];

    const handleValidationErrors = (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                message: errors.array().map(e => e.msg).join(', '),
                errors: errors.array()
            });
        }
        next();
    };

    // Endpoint de teste que retorna o payload recebido
    app.post('/auth/signup', signupValidationRules, handleValidationErrors, (req, res) => {
        // Retorna o payload recebido para validação nos testes
        res.status(200).json({ 
            success: true, 
            message: 'Payload válido recebido',
            receivedPayload: {
                fullName: req.body.fullName,
                cpf: req.body.cpf,
                email: req.body.email,
                password: req.body.password ? '***' : undefined, // Não retorna senha real
                showStoriesPopup: req.body.showStoriesPopup,
                cpfType: typeof req.body.cpf,
                cpfLength: req.body.cpf ? req.body.cpf.length : 0,
                cpfIsNumeric: req.body.cpf ? /^\d+$/.test(req.body.cpf) : false
            }
        });
    });

    return app;
};

describe('Teste Unitário - Endpoint /auth/signup', () => {
    let app;

    beforeAll(() => {
        app = createTestServer();
    });

    describe('Validação de Payload - WEB (formato esperado)', () => {
        test('Deve aceitar payload válido do WEB com CPF apenas números', async () => {
            const payload = {
                fullName: 'João da Silva',
                cpf: '12345678901', // CPF sem formatação (apenas números)
                email: 'joao.silva@example.com',
                password: 'Senha123',
                showStoriesPopup: true
            };

            const response = await request(app)
                .post('/auth/signup')
                .send(payload)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.receivedPayload.cpf).toBe('12345678901');
            expect(response.body.receivedPayload.cpfType).toBe('string');
            expect(response.body.receivedPayload.cpfLength).toBe(11);
            expect(response.body.receivedPayload.cpfIsNumeric).toBe(true);
        });

        test('Deve aceitar payload válido do MOBILE com CPF apenas números', async () => {
            const payload = {
                fullName: 'Maria Santos',
                cpf: '98765432100', // CPF sem formatação (apenas números)
                email: 'maria.santos@example.com',
                password: 'MinhaSenha123',
                showStoriesPopup: true
            };

            const response = await request(app)
                .post('/auth/signup')
                .send(payload)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.receivedPayload.cpf).toBe('98765432100');
            expect(response.body.receivedPayload.cpfIsNumeric).toBe(true);
        });
    });

    describe('Validação de Payload - Rejeições esperadas', () => {
        test('Deve rejeitar CPF com formatação (pontos e traços)', async () => {
            const payload = {
                fullName: 'João da Silva',
                cpf: '123.456.789-01', // CPF COM formatação (INVÁLIDO)
                email: 'joao.silva@example.com',
                password: 'Senha123'
            };

            const response = await request(app)
                .post('/auth/signup')
                .send(payload)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('CPF deve conter apenas números');
        });

        test('Deve rejeitar CPF com menos de 11 dígitos', async () => {
            const payload = {
                fullName: 'João da Silva',
                cpf: '1234567890', // 10 dígitos (INVÁLIDO)
                email: 'joao.silva@example.com',
                password: 'Senha123'
            };

            const response = await request(app)
                .post('/auth/signup')
                .send(payload)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('CPF deve ter 11 dígitos');
        });

        test('Deve rejeitar CPF com mais de 11 dígitos', async () => {
            const payload = {
                fullName: 'João da Silva',
                cpf: '123456789012', // 12 dígitos (INVÁLIDO)
                email: 'joao.silva@example.com',
                password: 'Senha123'
            };

            const response = await request(app)
                .post('/auth/signup')
                .send(payload)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('CPF deve ter 11 dígitos');
        });

        test('Deve rejeitar email inválido', async () => {
            const payload = {
                fullName: 'João da Silva',
                cpf: '12345678901',
                email: 'email-invalido', // Email inválido
                password: 'Senha123'
            };

            const response = await request(app)
                .post('/auth/signup')
                .send(payload)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Formato de e-mail inválido');
        });

        test('Deve rejeitar senha com menos de 6 caracteres', async () => {
            const payload = {
                fullName: 'João da Silva',
                cpf: '12345678901',
                email: 'joao.silva@example.com',
                password: '12345' // 5 caracteres (INVÁLIDO)
            };

            const response = await request(app)
                .post('/auth/signup')
                .send(payload)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('A senha deve ter entre 6 e 12 caracteres');
        });

        test('Deve rejeitar senha com mais de 12 caracteres', async () => {
            const payload = {
                fullName: 'João da Silva',
                cpf: '12345678901',
                email: 'joao.silva@example.com',
                password: 'SenhaMuitoLonga123456' // Mais de 12 caracteres (INVÁLIDO)
            };

            const response = await request(app)
                .post('/auth/signup')
                .send(payload)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('A senha deve ter entre 6 e 12 caracteres');
        });

        test('Deve rejeitar nome completo vazio', async () => {
            const payload = {
                fullName: '', // Nome vazio (INVÁLIDO)
                cpf: '12345678901',
                email: 'joao.silva@example.com',
                password: 'Senha123'
            };

            const response = await request(app)
                .post('/auth/signup')
                .send(payload)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Nome completo é obrigatório');
        });
    });

    describe('Comparação de Payloads - WEB vs MOBILE', () => {
        test('Payloads do WEB e MOBILE devem ter o mesmo formato (CPF sem formatação)', async () => {
            // Payload do WEB
            const webPayload = {
                fullName: 'João WEB',
                cpf: '11111111111', // Sem formatação
                email: 'web@test.com',
                password: 'Senha123',
                showStoriesPopup: true
            };

            // Payload do MOBILE
            const mobilePayload = {
                fullName: 'João MOBILE',
                cpf: '22222222222', // Sem formatação
                email: 'mobile@test.com',
                password: 'Senha123',
                showStoriesPopup: true
            };

            const webResponse = await request(app)
                .post('/auth/signup')
                .send(webPayload)
                .expect(200);

            const mobileResponse = await request(app)
                .post('/auth/signup')
                .send(mobilePayload)
                .expect(200);

            // Ambos devem ser aceitos
            expect(webResponse.body.success).toBe(true);
            expect(mobileResponse.body.success).toBe(true);

            // Ambos devem ter CPF apenas numérico
            expect(webResponse.body.receivedPayload.cpfIsNumeric).toBe(true);
            expect(mobileResponse.body.receivedPayload.cpfIsNumeric).toBe(true);

            // Ambos devem ter CPF com 11 dígitos
            expect(webResponse.body.receivedPayload.cpfLength).toBe(11);
            expect(mobileResponse.body.receivedPayload.cpfLength).toBe(11);
        });
    });

    describe('Logs e Debug - Validação de Estrutura', () => {
        test('Deve logar estrutura completa do payload recebido', async () => {
            const payload = {
                fullName: 'Teste Debug',
                cpf: '12345678901',
                email: 'debug@test.com',
                password: 'Senha123',
                showStoriesPopup: true
            };

            const response = await request(app)
                .post('/auth/signup')
                .send(payload)
                .expect(200);

            // Verificar que todos os campos esperados estão presentes
            expect(response.body.receivedPayload).toHaveProperty('fullName');
            expect(response.body.receivedPayload).toHaveProperty('cpf');
            expect(response.body.receivedPayload).toHaveProperty('email');
            expect(response.body.receivedPayload).toHaveProperty('password');
            expect(response.body.receivedPayload).toHaveProperty('showStoriesPopup');
            expect(response.body.receivedPayload).toHaveProperty('cpfType');
            expect(response.body.receivedPayload).toHaveProperty('cpfLength');
            expect(response.body.receivedPayload).toHaveProperty('cpfIsNumeric');
        });
    });
});

