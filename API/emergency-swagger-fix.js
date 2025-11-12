const fs = require('fs');

console.log('🚨 SOLUÇÃO DE EMERGÊNCIA - SWAGGER');

// Criar arquivo com nome diferente
const cleanContent = fs.readFileSync('swagger-clean.yaml', 'utf8');
fs.writeFileSync('swagger-fixed.yaml', cleanContent, 'utf8');
console.log('✅ Arquivo swagger-fixed.yaml criado');

// Ler o index.js
let indexContent = fs.readFileSync('index.js', 'utf8');

// Substituir a referência ao swagger.yaml
const oldPattern = /swagger\.yaml/g;
const newPattern = 'swagger-fixed.yaml';

if (indexContent.includes('swagger.yaml')) {
    indexContent = indexContent.replace(oldPattern, newPattern);
    fs.writeFileSync('index.js', indexContent, 'utf8');
    console.log('✅ index.js atualizado para usar swagger-fixed.yaml');
} else {
    console.log('⚠️  Referência ao swagger.yaml não encontrada no index.js');
}

console.log('\n🎯 Correção de emergência concluída!');
console.log('Execute: npm run dev');