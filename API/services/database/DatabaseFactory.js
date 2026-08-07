const PostgresProvider = require('./PostgresProvider');

class DatabaseFactory {
    static createDatabaseService() {
        // Suporta DB_PROVIDER legado ('postgres' | 'databricks'). Default = Postgres.
        const provider = process.env.DB_PROVIDER || process.env.DB_DIALECT || 'postgres';

        console.log(`🏭 DatabaseFactory: Inicializando provedor '${provider}'...`);

        if (provider !== 'postgres') {
            throw new Error(`DB_PROVIDER='${provider}' não suportado. Apenas 'postgres' (pgdb) é aceito.`);
        }

        return new PostgresProvider({
            connectionString: process.env.POSTGRES_CONNECTION_STRING,
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT,
            ssl: process.env.DB_SSL === 'true',
            schema: process.env.DB_SCHEMA || 'fintech'
        });
    }
}

module.exports = DatabaseFactory;
