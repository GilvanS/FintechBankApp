// Garante JWT_SECRET antes de qualquer require() do harness.
// middlewares/auth.js aborta a importação se a env var não estiver definida —
// sem este setup, suites que tocam o middleware (auditLog etc) falham em carregar.
//
// O valor é descartável — os tokens emitidos aqui não são usados em produção.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-not-for-production';
