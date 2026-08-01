// jest.config.js — Configuração com projetos separados.
// unit        -> testes de lógica pura (tests/unit)
// integration -> testes que exercitam a API completa (tests/integration)
// Executar: npm test (roda os dois projetos), npm run test:unit, npm run test:integration
module.exports = {
    projects: [
        {
            displayName: 'unit',
            testEnvironment: 'node',
            testMatch: ['**/tests/unit/**/*.test.js'],
            verbose: true,
            testTimeout: 10000,
        },
        {
            displayName: 'integration',
            testEnvironment: 'node',
            testMatch: ['**/tests/integration/**/*.test.js'],
            verbose: true,
            // Testes de integração sobem a API completa (supertest) — precisam de mais tempo
            testTimeout: 30000,
        },
    ],
    // Opções globais (aplicadas a todos os projetos)
    collectCoverageFrom: [
        'index.cjs',
        'src/**/*.js',
        'repositories/**/*.js',
        'middlewares/**/*.js',
        'services/**/*.js',
        '!**/node_modules/**',
        '!**/tests/**',
    ],
    coverageDirectory: 'coverage',
};
