const newman = require('newman');
const path = require('path');
const fs = require('fs');

// Configurações
const config = {
    collection: path.join(__dirname, '..', 'postman-collection.json'),
    environment: null, // Usaremos as variáveis da collection
    reporters: ['cli', 'json', 'html'],
    reporter: {
        html: {
            export: path.join(__dirname, 'newman-report.html')
        },
        json: {
            export: path.join(__dirname, 'newman-report.json')
        }
    },
    insecure: true, // Para desenvolvimento local
    timeout: 30000, // 30 segundos timeout
    delayRequest: 500, // 500ms entre requests
    iterationCount: 1
};

console.log('🚀 Iniciando testes Newman para FintechBankApp...\n');

// Função para verificar se o servidor está rodando
async function checkServerHealth() {
    try {
        const response = await fetch('http://localhost:3001/health');
        if (response.ok) {
            console.log('✅ Servidor está rodando e saudável\n');
            return true;
        }
    } catch (error) {
        console.log('❌ Servidor não está rodando ou não está saudável');
        console.log('   Por favor, inicie o servidor com: npm start\n');
        return false;
    }
}

// Função principal para executar os testes
async function runTests() {
    console.log('📋 Configuração dos testes:');
    console.log(`   Collection: ${config.collection}`);
    console.log(`   Timeout: ${config.timeout}ms`);
    console.log(`   Delay entre requests: ${config.delayRequest}ms`);
    console.log(`   Relatórios: CLI, JSON, HTML\n`);

    // Verificar se o arquivo de collection existe
    if (!fs.existsSync(config.collection)) {
        console.error('❌ Arquivo de collection não encontrado:', config.collection);
        process.exit(1);
    }
    // Pré-processa a collection para garantir base /api correta
    const preparedCollection = prepareCollection(config.collection);
    const newmanConfig = { ...config, collection: preparedCollection };
    // Verificar se o servidor está rodando
    const serverHealthy = await checkServerHealth();
    if (!serverHealthy) {
        process.exit(1);
    }

    console.log('🧪 Executando testes...\n');

    newman.run(newmanConfig, function (err, summary) {
        if (err) {
            console.error('❌ Erro ao executar os testes:', err);
            process.exit(1);
        }

        console.log('\n📊 RESUMO DOS TESTES:');
        console.log('='.repeat(50));
        
        // Estatísticas gerais
        const stats = summary.run.stats;
        console.log(`📈 Requests executados: ${stats.requests.total}`);
        console.log(`✅ Sucessos: ${stats.requests.total - stats.requests.failed}`);
        console.log(`❌ Falhas: ${stats.requests.failed}`);
        console.log(`⏱️  Tempo total: ${summary.run.timings.completed - summary.run.timings.started}ms`);
        
        // Detalhes das falhas
        if (summary.run.failures && summary.run.failures.length > 0) {
            console.log('\n🔍 DETALHES DAS FALHAS:');
            console.log('-'.repeat(30));
            summary.run.failures.forEach((failure, index) => {
                console.log(`${index + 1}. ${failure.source.name || 'Request'}`);
                console.log(`   Erro: ${failure.error.message}`);
                if (failure.error.test) {
                    console.log(`   Teste: ${failure.error.test}`);
                }
                console.log('');
            });
        }

        // Testes administrativos específicos
        console.log('\n👨‍💼 TESTES ADMINISTRATIVOS:');
        console.log('-'.repeat(30));
        
        const adminTests = summary.run.executions.filter(execution => 
            execution.item.name.toLowerCase().includes('admin') ||
            execution.item.parent().name.toLowerCase().includes('admin')
        );

        if (adminTests.length > 0) {
            adminTests.forEach(test => {
                const status = test.response && test.response.code < 400 ? '✅' : '❌';
                const responseTime = test.response ? test.response.responseTime : 'N/A';
                console.log(`${status} ${test.item.name} (${responseTime}ms)`);
            });
        } else {
            console.log('ℹ️  Nenhum teste administrativo específico encontrado');
        }

        // Relatórios gerados
        console.log('\n📄 RELATÓRIOS GERADOS:');
        console.log('-'.repeat(20));
        console.log(`📊 HTML: ${path.join(__dirname, 'newman-report.html')}`);
        console.log(`📋 JSON: ${path.join(__dirname, 'newman-report.json')}`);

        // Status final
        if (stats.requests.failed === 0) {
            console.log('\n🎉 TODOS OS TESTES PASSARAM! 🎉');
            console.log('✅ A API está funcionando corretamente');
            process.exit(0);
        } else {
            console.log('\n⚠️  ALGUNS TESTES FALHARAM');
            console.log('❌ Verifique os detalhes acima e corrija os problemas');
            process.exit(1);
        }
    });
}

// Função para ajustar a collection
function prepareCollection(originalPath) {
    const raw = fs.readFileSync(originalPath, 'utf8');
    const replaced = raw.replace(/\/api\/v1\b/g, '/api');
    const fixedPath = path.join(__dirname, 'postman-collection.fixed.json');
    fs.writeFileSync(fixedPath, replaced, 'utf8');
    console.log(`🔧 Collection ajustada: ${fixedPath} (replace /api/v1 -> /api)`);
    return fixedPath;
}

// Executar os testes
runTests().catch(error => {
    console.error('❌ Erro inesperado:', error);
    process.exit(1);
});