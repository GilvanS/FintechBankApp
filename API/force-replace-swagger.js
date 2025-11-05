const fs = require('fs');
const path = require('path');

console.log('🚨 CORREÇÃO FORÇADA DO SWAGGER.YAML');

try {
    // Ler o arquivo limpo
    const cleanContent = fs.readFileSync('swagger-clean.yaml', 'utf8');
    console.log(`📖 Arquivo limpo lido: ${cleanContent.split('\n').length} linhas`);
    
    // Fazer backup do arquivo corrompido
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `swagger-corrupted-${timestamp}.yaml`;
    
    if (fs.existsSync('swagger.yaml')) {
        fs.renameSync('swagger.yaml', backupName);
        console.log(`📦 Backup criado: ${backupName}`);
    }
    
    // Escrever o novo arquivo
    fs.writeFileSync('swagger.yaml', cleanContent, 'utf8');
    console.log('✅ Arquivo swagger.yaml substituído com sucesso!');
    
    // Verificar o resultado
    const newContent = fs.readFileSync('swagger.yaml', 'utf8');
    const newLines = newContent.split('\n').length;
    console.log(`📊 Novo arquivo: ${newLines} linhas`);
    
    // Verificar se há padrões malformados
    const malformedPattern = /pattern:\s*'\^[^']*[^$]'/g;
    const matches = newContent.match(malformedPattern);
    
    if (matches) {
        console.log(`⚠️  Ainda há ${matches.length} padrões malformados!`);
        matches.forEach(match => console.log(`   - ${match}`));
    } else {
        console.log('✅ Nenhum padrão malformado encontrado!');
    }
    
    console.log('\n🎯 Próximos passos:');
    console.log('1. Execute: npm run dev');
    console.log('2. Teste: http://localhost:3001/health');
    
} catch (error) {
    console.error('❌ Erro na correção:', error.message);
    process.exit(1);
}