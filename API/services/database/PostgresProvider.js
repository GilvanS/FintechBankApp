const { Pool } = require('pg');
const DatabaseInterface = require('./DatabaseInterface');

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
        // Construct connection string if not provided but individual params are
        if (!this.config.connectionString && this.config.host) {
            const { user, password, host, port, database } = this.config;
            this.config.connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
        }

        if (!this.config.connectionString) {
            console.warn('⚠️ Connection string do PostgreSQL ausente.');
            throw new Error('Postgres connection string missing');
        }

        try {
            this.pool = new Pool({
                connectionString: this.config.connectionString,
                ssl: this.config.ssl ? { rejectUnauthorized: false } : false
            });
            
            // Test connection
            const client = await this.pool.connect();
            console.log("✅ Conectado ao PostgreSQL com sucesso.");
            client.release();
        } catch (error) {
            console.error('❌ Falha ao conectar com PostgreSQL:', error.message);
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

        console.log("Executing Query (PG):", pgQuery);
        
        const client = await this.pool.connect();
        try {
            const res = await client.query(pgQuery);
            return res.rows;
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
