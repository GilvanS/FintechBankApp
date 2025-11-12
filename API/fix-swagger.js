const fs = require('fs');
const path = require('path');

console.log('🔧 Corrigindo padrões regex malformados no swagger.yaml...');

const swaggerFile = path.join(__dirname, 'swagger.yaml');
const backupFile = path.join(__dirname, 'swagger.yaml.backup');

try {
    // Fazer backup
    if (fs.existsSync(swaggerFile)) {
        fs.copyFileSync(swaggerFile, backupFile);
        console.log('✅ Backup criado: swagger.yaml.backup');
    } else {
        console.error('❌ Arquivo swagger.yaml não encontrado!');
        process.exit(1);
    }

    // Ler o arquivo
    let content = fs.readFileSync(swaggerFile, 'utf8');
    
    // Contar padrões malformados
    const malformedMatches = content.match(/pattern: '\^[0-9]\{11\}[^'$]/g);
    const malformedCount = malformedMatches ? malformedMatches.length : 0;
    console.log(`🔍 Encontrados ${malformedCount} padrões malformados`);

    // Corrigir todos os padrões malformados
    // Substituir pattern: '^[0-9]{11} por pattern: '^[0-9]{11}$'
    content = content.replace(/pattern: '\^[0-9]\{11\}(?!['\$])/g, "pattern: '^[0-9]{11}$'");
    
    // Salvar o arquivo corrigido
    fs.writeFileSync(swaggerFile, content);
    
    // Contar padrões corretos
    const correctMatches = content.match(/pattern: '\^[0-9]\{11\}\$'/g);
    const correctCount = correctMatches ? correctMatches.length : 0;
    
    console.log('✅ Arquivo corrigido com sucesso!');
    console.log(`📊 Padrões corrigidos: ${correctCount}`);
    
    // Testar se o YAML está válido
    console.log('🧪 Testando se o YAML está válido...');
    
    try {
        const yaml = require('yamljs');
        yaml.load(swaggerFile);
        console.log('✅ YAML válido - servidor deve iniciar sem erros!');
        
        // Remover backup se tudo estiver OK
        if (fs.existsSync(backupFile)) {
            fs.unlinkSync(backupFile);
            console.log('🗑️  Backup removido (correção bem-sucedida)');
        }
        
    } catch (yamlError) {
        console.error('❌ YAML ainda inválido:', yamlError.message);
        console.log('🔄 Restaurando backup...');
        fs.copyFileSync(backupFile, swaggerFile);
        console.log('✅ Backup restaurado');
    }
    
} catch (error) {
    console.error('❌ Erro durante a correção:', error.message);
    
    // Restaurar backup em caso de erro
    if (fs.existsSync(backupFile)) {
        fs.copyFileSync(backupFile, swaggerFile);
        console.log('🔄 Backup restaurado devido ao erro');
    }
    
    process.exit(1);
}

console.log('');
console.log('📋 Próximos passos:');
console.log('   1. Execute: npm run dev');
console.log('   2. Teste as APIs: npm run test');
console.log('   3. Verifique os logs do servidor');