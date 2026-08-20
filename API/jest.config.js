// jest.config.js — Configuração com projetos separados.
// unit        -> testes de lógica pura (tests/unit)
// integration -> testes que exercitam a API completa (tests/integration)
// Executar: npm test (roda os dois projetos), npm run test:unit, npm run test:integration
module.exports = {
    // Opções globais (Jest 29: verbose/testTimeout pertencem à globalConfig, não a projetos)
    verbose: true,
    testTimeout: 30000, // cobre unit (rápidos) e integration (API completa via supertest)
    projects: [
        {
            displayName: 'unit',
            testEnvironment: 'node',
            testMatch: ['**/tests/unit/**/*.test.js'],
            transformIgnorePatterns: [
                '/node_modules/(?!uuid)'
            ],
            transform: {
                '^.+\.js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }]
            },
        },
        {
            displayName: 'integration',
            testEnvironment: 'node',
            testMatch: ['**/tests/integration/**/*.test.js'],
            transformIgnorePatterns: [
                '/node_modules/(?!uuid)'
            ],
            transform: {
                '^.+\.js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }]
            },
        },
    ],
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
