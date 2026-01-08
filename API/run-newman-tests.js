const newman = require('newman');
const path = require('path');
const fs = require('fs');

// Configurações
const config = {
    collection: path.join(__dirname, 'postman-collection.json'),
    environment: path.join(__dirname, 'postman-environment.json'),
    reporters: ['cli'],
    // Reporters HTML e JSON podem ser adicionados se newman-reporter-html estiver instalado
    // Para usar: npm install newman-reporter-html --save-dev
    // Depois descomente as linhas abaixo:
    // reporters: ['cli', 'json', 'html'],
    // reporter: {
    //     html: {
    //         export: path.join(__dirname, 'newman-report.html')
    //     },
    //     json: {
    //         export: path.join(__dirname, 'newman-report.json')
    //     }
    // },
    insecure: true, // Para desenvolvimento local
    timeout: 30000, // 30 segundos timeout
    delayRequest: 500, // 500ms entre requests
    iterationCount: 1
};

console.log('🚀 Iniciando testes Newman para FintechBankApp API Simplificada...\n');

// Função para verificar se o servidor está rodando
async function checkServerHealth(retries = 5, interval = 2000) {
    const http = require('http');
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await new Promise((resolve, reject) => {
                const req = http.get('http://localhost:3001/api/v1/health', (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            resolve({ statusCode: res.statusCode, data: json });
                        } catch (e) {
                            resolve({ statusCode: res.statusCode, data: null });
                        }
                    });
                });
                req.on('error', reject);
                req.setTimeout(5000, () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
            });
            
            if (response.statusCode === 200) {
                console.log('✅ Servidor está rodando e saudável');
                console.log(`   Status: ${response.data?.data?.status || 'OK'}\n`);
                return true;
            }
        } catch (error) {
            // Ignora o erro e tenta novamente
        }
        console.log(`(${i + 1}/${retries}) Servidor não respondeu. Tentando novamente em ${interval / 1000}s...`);
        await new Promise(res => setTimeout(res, interval));
    }

    console.log('❌ Servidor não está rodando ou não está saudável após várias tentativas.');
    console.log('   Por favor, inicie o servidor com: npm run dev\n');
    return false;
}

// Função principal para executar os testes
async function runTests() {
    console.log('📋 Configuração dos testes:');
    console.log(`   Collection: ${path.basename(config.collection)}`);
    console.log(`   Environment: ${path.basename(config.environment)}`);
    console.log(`   Base URL: http://localhost:3001/api/v1`);
    console.log(`   Timeout: ${config.timeout}ms`);
    console.log(`   Delay entre requests: ${config.delayRequest}ms`);
    console.log(`   Relatórios: CLI\n`);

    // Verificar se os arquivos existem
    if (!fs.existsSync(config.collection)) {
        console.error('❌ Arquivo de collection não encontrado:', config.collection);
        process.exit(1);
    }
    if (!fs.existsSync(config.environment)) {
        console.error('❌ Arquivo de environment não encontrado:', config.environment);
        process.exit(1);
    }

    // Verificar se o servidor está rodando
    const serverHealthy = await checkServerHealth();
    if (!serverHealthy) {
        process.exit(1);
    }

    console.log('🧪 Executando testes...\n');

    newman.run(config, function (err, summary) {
        if (err) {
            console.error('❌ Erro ao executar os testes:', err);
            process.exit(1);
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO DOS TESTES');
        console.log('='.repeat(60));
        
        // Estatísticas gerais
        const stats = summary.run.stats;
        const total = stats.requests.total;
        const passed = stats.requests.total - stats.requests.failed;
        const failed = stats.requests.failed;
        const assertions = stats.assertions;
        
        console.log(`\n📈 Requests executados: ${total}`);
        console.log(`✅ Sucessos: ${passed}`);
        console.log(`❌ Falhas: ${failed}`);
        console.log(`\n📝 Assertions:`);
        console.log(`   Total: ${assertions.total}`);
        console.log(`   Passou: ${assertions.total - assertions.failed}`);
        console.log(`   Falhou: ${assertions.failed}`);
        
        const duration = summary.run.timings.completed - summary.run.timings.started;
        console.log(`\n⏱️  Tempo total: ${(duration / 1000).toFixed(2)}s`);
        
        // Detalhes das falhas
        if (summary.run.failures && summary.run.failures.length > 0) {
            console.log('\n' + '-'.repeat(60));
            console.log('🔍 DETALHES DAS FALHAS:');
            console.log('-'.repeat(60));
            summary.run.failures.forEach((failure, index) => {
                const item = failure.source.name || 'Request';
                const parent = failure.source.parent ? failure.source.parent.name : '';
                const fullName = parent ? `${parent} > ${item}` : item;
                console.log(`\n${index + 1}. ${fullName}`);
                console.log(`   Erro: ${failure.error.message}`);
                if (failure.error.test) {
                    console.log(`   Teste: ${failure.error.test}`);
                }
            });
        }

        // Relatórios gerados (se configurados)
        // console.log('\n' + '-'.repeat(60));
        // console.log('📄 RELATÓRIOS GERADOS:');
        // console.log('-'.repeat(60));
        // console.log(`📊 HTML: ${path.join(__dirname, 'newman-report.html')}`);
        // console.log(`📋 JSON: ${path.join(__dirname, 'newman-report.json')}`);

        // Status final
        console.log('\n' + '='.repeat(60));
        if (failed === 0 && assertions.failed === 0) {
            console.log('🎉 TODOS OS TESTES PASSARAM! 🎉');
            console.log('✅ A API está funcionando corretamente');
            process.exit(0);
        } else {
            console.log('⚠️  ALGUNS TESTES FALHARAM');
            console.log('❌ Verifique os detalhes acima e corrija os problemas');
            process.exit(1);
        }
    });
}

// Executar os testes
runTests().catch(error => {
    console.error('❌ Erro inesperado:', error);
    process.exit(1);
});
