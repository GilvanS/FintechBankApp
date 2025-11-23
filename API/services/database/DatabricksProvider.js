const { DBSQLClient } = require('@databricks/sql');
const DatabaseInterface = require('./DatabaseInterface');

class DatabricksProvider extends DatabaseInterface {
    constructor(config) {
        super();
        this.config = config;
        this.client = null;
        this.session = null;
        this.catalog = config.catalog || 'workspace';
        this.schema = config.schema || 'default';
        this.mockMode = false;
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    async connect() {
        const isMissingEnv =
            !this.config.serverHostname ||
            !this.config.httpPath ||
            !this.config.token;
        const looksLikePlaceholder =
            String(this.config.token || '').toUpperCase().includes('PAT') ||
            String(this.config.token || '').includes('DATABRICKS_TOKEN') ||
            String(this.config.token || '').includes('CHANGE_ME');

        if (isMissingEnv || looksLikePlaceholder) {
            console.warn('⚠️ Configuracao Databricks ausente ou token placeholder. Ativando mockMode.');
            this.mockMode = true;
            this.client = null;
            this.session = null;
            return;
        }

        try {
            this.client = new DBSQLClient();
            const connectedClient = await this.client.connect({
                host: this.config.serverHostname,
                path: this.config.httpPath,
                token: this.config.token,
            });
            this.session = await connectedClient.openSession({
                initialCatalog: this.catalog,
                initialSchema: this.schema,
            });
            console.log("✅ Conectado ao Databricks com sucesso.");
            console.log(`📋 Catalog configurado: ${this.catalog}`);
            console.log(`📋 Schema configurado: ${this.schema}`);

            // Detectar catálogo disponível automaticamente
            await this.detectAvailableCatalog();
            
            // Verificar se catalog e schema são iguais (pode causar problemas)
            if (this.catalog === this.schema) {
                console.warn(`⚠️  ATENÇÃO: Catalog e Schema são iguais (${this.catalog}).`);
                console.log(`💡 Ajustando para usar schema 'default' automaticamente.`);
                // Ajustar para usar 'default' como schema quando são iguais
                this.schema = 'default';
                console.log(`✅ Schema ajustado para: ${this.schema}`);
            }
            
            this.mockMode = false;
        } catch (error) {
            console.error('❌ Falha ao conectar com Databricks:', error.message);
            console.warn('⚠️ Ativando mockMode para desenvolvimento local.');
            this.mockMode = true;
            this.client = null;
            this.session = null;
        }
    }

    async detectAvailableCatalog() {
        try {
            console.log("🔍 Detectando catálogo disponível no workspace...");
            
            // Tentar listar catálogos disponíveis
            const catalogs = await this.executeQuery("SHOW CATALOGS");
            console.log("📋 Catálogos disponíveis:", catalogs.map(c => c.catalog).join(', '));
            
            // Verificar se o catálogo configurado existe
            const availableCatalogs = catalogs.map(c => c.catalog);
            if (availableCatalogs.includes(this.catalog)) {
                console.log(`✅ Catálogo '${this.catalog}' encontrado e será usado.`);
            } else {
                // Prioridade de fallback: workspace > samples > hive_metastore > primeiro disponível
                let fallbackCatalog = null;
                
                if (availableCatalogs.includes('workspace')) {
                    fallbackCatalog = 'workspace';
                } else if (availableCatalogs.includes('samples')) {
                    fallbackCatalog = 'samples';
                } else if (availableCatalogs.includes('hive_metastore')) {
                    fallbackCatalog = 'hive_metastore';
                } else if (availableCatalogs.length > 0) {
                    fallbackCatalog = availableCatalogs[0];
                }
                
                if (fallbackCatalog) {
                    console.log(`⚠️  Catálogo '${this.catalog}' não encontrado. Usando '${fallbackCatalog}' como padrão.`);
                    this.catalog = fallbackCatalog;
                } else {
                    throw new Error("Nenhum catálogo disponível encontrado");
                }
            }
            
            console.log(`✅ Usando catálogo: ${this.catalog}`);
        } catch (error) {
            console.warn("⚠️  Não foi possível detectar catálogos. Usando configuração padrão:", error.message);
            console.log(`📋 Tentando usar catálogo configurado: ${this.catalog}`);
        }
    }

    async disconnect() {
        if (this.session) await this.session.close();
        if (this.client) await this.client.close();
        console.log("Desconectado do Databricks");
    }

    async executeQuery(query) {
        if (this.mockMode) {
            throw new Error('MockMode ativo: operacao de banco nao disponivel no desenvolvimento local.');
        }
        console.log("Executing Query:", query);
        const operation = await this.session.executeStatement(query, { runAsync: false, maxRows: 10000 });
        const result = await operation.fetchAll();
        await operation.close();
        return result;
    }

    fq(tableName) {
        // Sempre usar catalog.schema.table
        return `\`${this.catalog}\`.\`${this.schema}\`.\`${tableName}\``;
    }
}

module.exports = DatabricksProvider;
