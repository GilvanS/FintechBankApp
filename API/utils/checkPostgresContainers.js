/**
 * Utilitário para verificar containers PostgreSQL em execução
 * Detecta duplicação de servidores PostgreSQL
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function checkPostgresContainers() {
    try {
        // Executar docker ps com timeout de 3 segundos
        const { stdout } = await Promise.race([
            execAsync('docker ps --format "{{.Names}}|{{.Image}}|{{.Ports}}"'),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 3000)
            )
        ]);
        
        const lines = stdout.trim().split('\n').filter(line => line.trim());
        const postgresContainers = [];
        
        for (const line of lines) {
            const [name, image, ports] = line.split('|');
            
            // Verificar se é um container PostgreSQL
            if (image && (image.toLowerCase().includes('postgres') || name.toLowerCase().includes('postgres') || name.toLowerCase().includes('pg'))) {
                // Extrair portas mapeadas
                const portMatches = ports.match(/(\d+):(\d+)/g);
                const mappedPorts = portMatches ? portMatches.map(p => {
                    const [hostPort] = p.split(':');
                    return parseInt(hostPort);
                }) : [];
                
                postgresContainers.push({
                    name: name.trim(),
                    image: image.trim(),
                    ports: mappedPorts,
                    portsString: ports.trim()
                });
            }
        }
        
        return postgresContainers;
    } catch (error) {
        // Se docker não estiver disponível ou houver erro, retornar array vazio
        return [];
    }
}

async function logPostgresStatus(config) {
    const containers = await checkPostgresContainers();
    
    if (containers.length === 0) {
        console.log('⚠️  [PostgreSQL] Nenhum container PostgreSQL detectado via Docker');
        console.log('   → Verificando se PostgreSQL está rodando localmente...');
        return;
    }
    
    if (containers.length > 1) {
        console.log('');
        console.log('⚠️  ⚠️  ⚠️  ATENÇÃO: MÚLTIPLOS CONTAINERS POSTGRESQL DETECTADOS! ⚠️  ⚠️  ⚠️');
        console.log('');
        console.log('📦 Containers PostgreSQL encontrados:');
        containers.forEach((container, index) => {
            console.log(`   ${index + 1}. ${container.name}`);
            console.log(`      Imagem: ${container.image}`);
            console.log(`      Portas: ${container.portsString || 'N/A'}`);
            if (container.ports.length > 0) {
                console.log(`      Porta mapeada: ${container.ports[0]}`);
            }
        });
        console.log('');
        console.log('💡 PROBLEMA: Múltiplos servidores PostgreSQL podem causar:');
        console.log('   - Conflitos de conexão');
        console.log('   - Timeouts');
        console.log('   - Dados inconsistentes');
        console.log('   - Confusão sobre qual banco está sendo usado');
        console.log('');
        console.log('🔧 SOLUÇÃO:');
        console.log('   1. Pare os containers desnecessários: docker stop <nome>');
        console.log('   2. Ou use apenas um container e atualize DB_PORT no .env');
        console.log('   3. Verifique qual container tem o banco "fintech":');
        containers.forEach(container => {
            console.log(`      docker exec ${container.name} psql -U postgres -l | findstr fintech`);
        });
        console.log('');
    } else {
        const container = containers[0];
        console.log('✅ [PostgreSQL] Container PostgreSQL detectado:');
        console.log(`   Nome: ${container.name}`);
        console.log(`   Imagem: ${container.image}`);
        console.log(`   Portas: ${container.portsString || 'N/A'}`);
        
        // Verificar se a porta configurada corresponde
        const configPort = parseInt(config.port || process.env.DB_PORT || '5432');
        if (container.ports.length > 0 && container.ports[0] !== configPort) {
            console.log('');
            console.log('⚠️  [PostgreSQL] AVISO: Porta configurada não corresponde à porta do container!');
            console.log(`   Porta configurada (DB_PORT): ${configPort}`);
            console.log(`   Porta do container: ${container.ports[0]}`);
            console.log(`   → Atualize DB_PORT no .env para ${container.ports[0]}`);
            console.log('');
        }
    }
    
    return containers;
}

module.exports = {
    checkPostgresContainers,
    logPostgresStatus
};

