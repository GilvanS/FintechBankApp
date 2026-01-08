const { Pool } = require('pg');
const DatabaseInterface = require('./DatabaseInterface');
const { logPostgresStatus } = require('../../utils/checkPostgresContainers');

class PostgresProvider extends DatabaseInterface {
    constructor(config) {
        super();
        this.config = config;
        this.pool = null;
        this.schema = config.schema || 'public'; // Default to public if not specified
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    async connect() {
        console.log('');
        console.log('🔍 [PostgresProvider] Iniciando conexão com PostgreSQL...');
        
        // Verificar containers PostgreSQL de forma não bloqueante (opcional)
        // Executar em background para não travar a conexão
        logPostgresStatus(this.config).catch(() => {
            // Ignorar erros silenciosamente - não é crítico para a conexão
        });
        
        // Construct connection string if not provided but individual params are
        console.log('🔍 [PostgresProvider] Construindo string de conexão...');
        if (!this.config.connectionString && this.config.host) {
            const { user, password, host, port, database } = this.config;
            this.config.connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
            console.log('✅ [PostgresProvider] String de conexão construída');
        }

        if (!this.config.connectionString) {
            console.warn('⚠️ [PostgresProvider] Connection string do PostgreSQL ausente.');
            throw new Error('Postgres connection string missing');
        }

        // Mostrar informações de conexão (sem senha)
        const connectionInfo = this.config.connectionString.replace(/:[^:@]+@/, ':****@');
        console.log(`🔍 [PostgresProvider] Tentando conectar em: ${connectionInfo}`);

        try {
            this.pool = new Pool({
                connectionString: this.config.connectionString,
                ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
                connectionTimeoutMillis: 10000,
                idleTimeoutMillis: 30000,
                max: 20
            });
            
            // Test connection
            console.log('🔍 [PostgresProvider] Testando conexão...');
            const client = await this.pool.connect();
            console.log("✅ [PostgresProvider] Conectado ao PostgreSQL com sucesso!");
            
            // Verificar se o banco existe
            const dbCheck = await client.query('SELECT current_database()');
            console.log(`✅ [PostgresProvider] Database atual: ${dbCheck.rows[0].current_database}`);
            
            client.release();
            console.log('');
        } catch (error) {
            console.error('');
            console.error('❌ [PostgresProvider] Falha ao conectar com PostgreSQL:');
            console.error(`   Erro: ${error.message}`);
            if (error.code) {
                console.error(`   Código: ${error.code}`);
            }
            console.error('');
            
            // Sugestões baseadas no erro
            if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
                console.error('💡 SUGESTÃO: Verifique se há múltiplos containers PostgreSQL rodando');
                console.error('   Execute: docker ps | findstr postgres');
            } else if (error.message.includes('password') || error.code === '28P01') {
                console.error('💡 SUGESTÃO: Verifique DB_USER e DB_PASS no .env');
            } else if (error.message.includes('does not exist') || error.code === '3D000') {
                console.error('💡 SUGESTÃO: Verifique DB_NAME no .env');
            }
            console.error('');
            
            throw error;
        }
    }

    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            console.log("Desconectado do PostgreSQL");
        }
    }

    async executeQuery(query) {
        if (!this.pool) {
            console.error('❌ [PostgresProvider] Pool não está conectado!');
            throw new Error('Database not connected');
        }
        
        // Adapt Databricks syntax to Postgres if necessary
        // Example: Remove 'USING DELTA' which is Databricks specific
        let pgQuery = query.replace(/USING DELTA/gi, '');
        
        // Replace current_timestamp() with CURRENT_TIMESTAMP
        pgQuery = pgQuery.replace(/current_timestamp\(\)/gi, 'CURRENT_TIMESTAMP');

        // Replace backticks with double quotes for identifiers if strictly needed, 
        // but Postgres usually handles standard SQL. Databricks uses backticks.
        // Simple regex to replace backticks with double quotes:
        pgQuery = pgQuery.replace(/`/g, '"');

        console.log("🔵 [PostgresProvider] Executando Query:", pgQuery);
        
        const client = await this.pool.connect();
        try {
            const res = await client.query(pgQuery);
            console.log(`🔵 [PostgresProvider] Query executada com sucesso. Retornou ${res.rows ? res.rows.length : 0} linha(s)`);
            return res.rows;
        } catch (error) {
            console.error(`❌ [PostgresProvider] Erro ao executar query:`, error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    fq(tableName) {
        // Postgres uses "schema"."table"
        return `"${this.schema}"."${tableName}"`;
    }
}

module.exports = PostgresProvider;
