/**
 * Script para executar a migração de valores padrão de signup
 * Executa automaticamente a atualização dos schemas
 */

require('dotenv').config();
const { DatabaseFactory } = require('./services/database/DatabaseFactory');

async function runMigration() {
    console.log('🚀 Iniciando migração de valores padrão de signup...\n');
    
    const dbService = DatabaseFactory.createDatabaseService();
    
    try {
        await dbService.connect();
        console.log('✅ Conectado ao banco de dados.\n');
        
        const provider = process.env.DB_PROVIDER || process.env.DB_DIALECT;
        
        if (provider === 'postgres') {
            console.log('📋 Executando migração para PostgreSQL...\n');
            
            // Ler e executar o script de migração
            const fs = require('fs');
            const path = require('path');
            const migrationScript = fs.readFileSync(
                path.join(__dirname, 'migration_update_signup_defaults.sql'),
                'utf8'
            );
            
            // Dividir o script em comandos individuais (remover BEGIN/COMMIT e DO $$ blocks)
            // Por enquanto, vamos executar comandos específicos
            console.log('🔧 Adicionando colunas de cartão de crédito se necessário...');
            
            // Verificar e adicionar colunas
            const creditCardColumns = await dbService.executeQuery(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'fintech' 
                AND table_name = 'users' 
                AND column_name IN ('credit_card_total_limit', 'credit_card_available_limit')
            `);
            
            const existingColumns = creditCardColumns.map(c => c.column_name);
            
            if (!existingColumns.includes('credit_card_total_limit')) {
                await dbService.executeQuery(`
                    ALTER TABLE fintech.users
                    ADD COLUMN credit_card_total_limit DECIMAL(15,2) DEFAULT 5000.00
                `);
                console.log('✅ Coluna credit_card_total_limit adicionada.');
            }
            
            if (!existingColumns.includes('credit_card_available_limit')) {
                await dbService.executeQuery(`
                    ALTER TABLE fintech.users
                    ADD COLUMN credit_card_available_limit DECIMAL(15,2) DEFAULT 5000.00
                `);
                console.log('✅ Coluna credit_card_available_limit adicionada.');
            }
            
            // Atualizar DEFAULTs
            console.log('\n🔧 Atualizando valores DEFAULT...');
            
            await dbService.executeQuery(`
                ALTER TABLE fintech.users
                ALTER COLUMN pix_daily_limit SET DEFAULT 2000.00
            `);
            console.log('✅ DEFAULT de pix_daily_limit atualizado para 2000.00');
            
            await dbService.executeQuery(`
                ALTER TABLE fintech.users
                ALTER COLUMN credit_card_total_limit SET DEFAULT 5000.00
            `);
            console.log('✅ DEFAULT de credit_card_total_limit atualizado para 5000.00');
            
            await dbService.executeQuery(`
                ALTER TABLE fintech.users
                ALTER COLUMN credit_card_available_limit SET DEFAULT 5000.00
            `);
            console.log('✅ DEFAULT de credit_card_available_limit atualizado para 5000.00');
            
            // Atualizar usuários existentes
            console.log('\n🔧 Atualizando usuários existentes...');
            const updateResult = await dbService.executeQuery(`
                UPDATE fintech.users
                SET 
                    credit_card_total_limit = COALESCE(credit_card_total_limit, 5000.00),
                    credit_card_available_limit = COALESCE(credit_card_available_limit, 5000.00),
                    credit_card_points_balance = COALESCE(credit_card_points_balance, 0),
                    credit_card_is_blocked = COALESCE(credit_card_is_blocked, FALSE)
                WHERE credit_card_total_limit IS NULL 
                   OR credit_card_available_limit IS NULL
            `);
            console.log(`✅ Usuários atualizados.`);
            
            // Verificar estrutura final
            console.log('\n📊 Verificando estrutura final...');
            const finalCheck = await dbService.executeQuery(`
                SELECT 
                    column_name, 
                    data_type, 
                    is_nullable, 
                    column_default
                FROM information_schema.columns
                WHERE table_schema = 'fintech' 
                AND table_name = 'users'
                AND column_name IN (
                    'pix_daily_limit',
                    'credit_card_total_limit',
                    'credit_card_available_limit',
                    'credit_card_points_balance',
                    'credit_card_is_blocked'
                )
                ORDER BY 
                    CASE column_name
                        WHEN 'pix_daily_limit' THEN 1
                        WHEN 'credit_card_total_limit' THEN 2
                        WHEN 'credit_card_available_limit' THEN 3
                        WHEN 'credit_card_points_balance' THEN 4
                        WHEN 'credit_card_is_blocked' THEN 5
                    END
            `);
            
            console.table(finalCheck.map(col => ({
                Coluna: col.column_name,
                Tipo: col.data_type,
                Padrão: col.column_default
            })));
            
        } else {
            console.log('📋 Usando Databricks. A migração será executada na próxima inicialização da API.');
            console.log('💡 Os valores padrão são aplicados automaticamente no código da API.');
        }
        
        console.log('\n✅ Migração concluída com sucesso!');
        
    } catch (error) {
        console.error('\n❌ Erro durante a migração:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await dbService.disconnect();
        console.log('\n🔌 Desconectado do banco de dados.');
    }
}

// Executar migração
if (require.main === module) {
    runMigration().catch(error => {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    });
}

module.exports = { runMigration };

