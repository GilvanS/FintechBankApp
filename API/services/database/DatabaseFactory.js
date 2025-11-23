const DatabricksProvider = require('./DatabricksProvider');
const PostgresProvider = require('./PostgresProvider');

class DatabaseFactory {
    static createDatabaseService() {
        // Support both DB_PROVIDER and DB_DIALECT (for compatibility)
        const provider = process.env.DB_PROVIDER || process.env.DB_DIALECT || 'databricks';
        
        console.log(`🏭 DatabaseFactory: Inicializando provedor '${provider}'...`);

        if (provider === 'postgres') {
            return new PostgresProvider({
                connectionString: process.env.POSTGRES_CONNECTION_STRING,
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASS,
                database: process.env.DB_NAME,
                port: process.env.DB_PORT,
                ssl: process.env.DB_SSL === 'true',
                password: process.env.DB_PASS,
                database: process.env.DB_NAME,
                port: process.env.DB_PORT,
                ssl: process.env.DB_SSL === 'true',
                schema: process.env.DB_SCHEMA || 'fintech' // Default to fintech matching DB structure
            });
        } else {
            // Default to Databricks
            return new DatabricksProvider({
                serverHostname: process.env.DATABRICKS_SERVER_HOSTNAME,
                httpPath: process.env.DATABRICKS_HTTP_PATH,
                token: process.env.DATABRICKS_TOKEN,
                catalog: process.env.DATABRICKS_CATALOG,
                schema: process.env.DATABRICKS_SCHEMA
            });
        }
    }
}

module.exports = DatabaseFactory;
