// Verifica se o frontend está rodando em modo demo
const isDemo = process.env.VITE_USE_MOCK_API === 'true';
console.log('Modo demo:', isDemo);