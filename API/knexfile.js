require('dotenv').config();

const schema = process.env.DB_SCHEMA || 'fintech';

/**
 * Knex configuration for PostgreSQL migrations only.
 * The API runtime uses a custom DatabaseFactory (services/database/DatabaseFactory.js)
 * that also supports Databricks. Knex is used exclusively for versioned schema migrations.
 */
module.exports = {
    development: {
        client: 'pg',
        connection: process.env.POSTGRES_CONNECTION_STRING || {
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT) || 5432,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASS || '',
            database: process.env.DB_NAME || 'fintechbank',
        },
        searchPath: [schema, 'public'],
        migrations: {
            directory: './migrations',
            tableName: 'knex_migrations',
            schemaName: schema,
        },
    },
    production: {
        client: 'pg',
        connection: process.env.POSTGRES_CONNECTION_STRING,
        searchPath: [schema, 'public'],
        migrations: {
            directory: './migrations',
            tableName: 'knex_migrations',
            schemaName: schema,
        },
        pool: { min: 2, max: 10 },
    },
};
