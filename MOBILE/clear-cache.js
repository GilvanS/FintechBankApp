// Script para limpar cache da API no mobile
// Execute no console do navegador quando estiver em http://192.168.0.105:3002

console.log('🧹 Limpando cache da API...');

// Limpar localStorage
localStorage.removeItem('apiBaseUrlCache');
localStorage.removeItem('authToken');
localStorage.removeItem('token');
console.log('✅ localStorage limpo');

// Limpar sessionStorage
sessionStorage.clear();
console.log('✅ sessionStorage limpo');

// Recarregar página
console.log('🔄 Recarregando página...');
setTimeout(() => {
    window.location.reload();
}, 1000);

