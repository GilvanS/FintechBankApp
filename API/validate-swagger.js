const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

console.log('🔍 Validando arquivo swagger.yaml...');

try {
    // Ler e parsear o arquivo YAML
    const swaggerPath = path.resolve(__dirname, 'swagger.yaml');
    console.log(`🔍 Validando arquivo swagger.yaml em: ${swaggerPath}`);
    const content = fs.readFileSync(swaggerPath, 'utf8');
    const doc = yaml.load(content);
    
    console.log('✅ Arquivo YAML é válido!');
    console.log('📊 Estatísticas:');
    console.log(`   - Título: ${doc.info?.title || 'N/A'}`);
    console.log(`   - Versão: ${doc.info?.version || 'N/A'}`);
    console.log(`   - Endpoints: ${Object.keys(doc.paths || {}).length}`);
    
    // Verificar padrões regex
    // (REMOVIDO) Linha duplicada que causava SyntaxError:
    // const content = fileContents;
    const regexPatterns = content.match(/pattern:\s*['"][^'"]*['"]/g) || [];
    console.log(`   - Padrões regex encontrados: ${regexPatterns.length}`);
    
    // Verificar padrões incompletos
    const incompletePatterns = content.match(/pattern:\s*['"][^'"]*[^$]['"]/g) || [];
    if (incompletePatterns.length > 0) {
        console.log('⚠️  Padrões potencialmente incompletos encontrados:');
        incompletePatterns.forEach((pattern, index) => {
            console.log(`   ${index + 1}. ${pattern}`);
        });
    }
    
    console.log('🎉 Validação concluída com sucesso!');
    process.exit(0);
    
} catch (error) {
    console.error('❌ Erro na validação:');
    console.error(`   Linha: ${error.mark?.line || 'N/A'}`);
    console.error(`   Coluna: ${error.mark?.column || 'N/A'}`);
    console.error(`   Mensagem: ${error.message}`);
    console.error(`   Snippet: ${error.mark?.snippet || 'N/A'}`);
    process.exit(1);
}