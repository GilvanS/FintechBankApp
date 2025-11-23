/**
 * Interface for Database Providers
 * All providers must implement these methods.
 */
class DatabaseInterface {
    /**
     * Connect to the database
     * @returns {Promise<void>}
     */
    async connect() {
        throw new Error('Method not implemented');
    }

    /**
     * Disconnect from the database
     * @returns {Promise<void>}
     */
    async disconnect() {
        throw new Error('Method not implemented');
    }

    /**
     * Execute a SQL query
     * @param {string} query 
     * @returns {Promise<any[]>}
     */
    async executeQuery(query) {
        throw new Error('Method not implemented');
    }

    /**
     * Generate a UUID
     * @returns {string}
     */
    generateUUID() {
        throw new Error('Method not implemented');
    }

    /**
     * Format fully qualified table name
     * @param {string} tableName 
     * @returns {string}
     */
    fq(tableName) {
        throw new Error('Method not implemented');
    }
}

module.exports = DatabaseInterface;
