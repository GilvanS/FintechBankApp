import { DBSQLClient } from "@databricks/sql";
import { LoggerService } from "./LoggerService";
import { DatabricksConfig } from "../database/data-source";
import { v4 as uuidv4 } from 'uuid';

export class DatabricksService {
    private client: DBSQLClient | null = null;
    private session: any = null;

    async connect(): Promise<void> {
        try {
            // Log das configurações para debug
            LoggerService.info("Configurações do Databricks:", {
                serverHostname: DatabricksConfig.serverHostname,
                httpPath: DatabricksConfig.httpPath,
                token: DatabricksConfig.token ? "***TOKEN_PRESENTE***" : "TOKEN_AUSENTE",
                catalog: DatabricksConfig.catalog,
                schema: DatabricksConfig.schema
            });

            // Validar se as configurações estão presentes
            if (!DatabricksConfig.serverHostname || !DatabricksConfig.httpPath || !DatabricksConfig.token) {
                throw new Error("Configurações do Databricks incompletas. Verifique as variáveis de ambiente.");
            }

            this.client = new DBSQLClient();
            
            // Conectar ao cliente
            const connectedClient = await this.client.connect({
                host: DatabricksConfig.serverHostname,
                path: DatabricksConfig.httpPath,
                token: DatabricksConfig.token,
            });

            // Abrir uma sessão
            this.session = await connectedClient.openSession();

            LoggerService.info("Conectado ao Databricks com sucesso");
        } catch (error) {
            LoggerService.error("Erro ao conectar ao Databricks:", error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        try {
            if (this.session) {
                await this.session.close();
                this.session = null;
            }
            if (this.client) {
                await this.client.close();
                this.client = null;
            }
            LoggerService.info("Desconectado do Databricks");
        } catch (error) {
            LoggerService.error("Erro ao desconectar do Databricks:", error);
        }
    }

    async executeQuery(query: string, parameters: any[] = []): Promise<any[]> {
        if (!this.session) {
            throw new Error("Não conectado ao Databricks");
        }

        try {
            LoggerService.info(`Executando query: ${query}`);
            const operation = await this.session.executeStatement(query, {
                runAsync: false,
                maxRows: 10000
            });

            const result = await operation.fetchAll();
            await operation.close();
            
            return result;
        } catch (error) {
            LoggerService.error("Erro ao executar query:", error);
            throw error;
        }
    }

    async createTables(): Promise<void> {
        // Primeiro, criar o schema se não existir
        const createSchema = `
            CREATE SCHEMA IF NOT EXISTS ${DatabricksConfig.schema}
        `;

        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS ${DatabricksConfig.schema}.users (
                cpf STRING,
                full_name STRING,
                email STRING,
                password_hash STRING,
                balance DECIMAL(15,2),
                login_attempts INT,
                is_blocked BOOLEAN,
                pix_daily_limit DECIMAL(15,2),
                password_reset_requested BOOLEAN,
                created_at TIMESTAMP,
                updated_at TIMESTAMP
            ) USING DELTA
            TBLPROPERTIES (
                'delta.autoOptimize.optimizeWrite' = 'true',
                'delta.autoOptimize.autoCompact' = 'true'
            )
        `;

        const createTransactionsTable = `
            CREATE TABLE IF NOT EXISTS ${DatabricksConfig.schema}.transactions (
                id STRING,
                type STRING,
                amount DECIMAL(15,2),
                description STRING,
                from_cpf STRING,
                to_cpf STRING,
                to_key STRING,
                created_at TIMESTAMP
            ) USING DELTA
            TBLPROPERTIES (
                'delta.autoOptimize.optimizeWrite' = 'true',
                'delta.autoOptimize.autoCompact' = 'true'
            )
        `;

        const createPixContactsTable = `
            CREATE TABLE IF NOT EXISTS ${DatabricksConfig.schema}.pix_contacts (
                id STRING,
                user_cpf STRING,
                contact_key STRING,
                contact_name STRING,
                daily_limit DECIMAL(15,2),
                created_at TIMESTAMP
            ) USING DELTA
            TBLPROPERTIES (
                'delta.autoOptimize.optimizeWrite' = 'true',
                'delta.autoOptimize.autoCompact' = 'true'
            )
        `;

        try {
            await this.executeQuery(createSchema);
            LoggerService.info("Schema criado com sucesso");

            await this.executeQuery(createUsersTable);
            LoggerService.info("Tabela users criada com sucesso");

            await this.executeQuery(createTransactionsTable);
            LoggerService.info("Tabela transactions criada com sucesso");

            await this.executeQuery(createPixContactsTable);
            LoggerService.info("Tabela pix_contacts criada com sucesso");
        } catch (error) {
            LoggerService.error("Erro ao criar tabelas:", error);
            throw error;
        }
    }

    // Métodos para usuários
    async createUser(userData: any): Promise<string> {
        const query = `
            INSERT INTO ${DatabricksConfig.schema}.users 
            (cpf, full_name, email, password_hash, balance, pix_daily_limit, created_at, updated_at)
            VALUES ('${userData.cpf}', '${userData.full_name}', '${userData.email}', 
                    '${userData.password_hash}', ${userData.balance || 0}, 
                    ${userData.pix_daily_limit || 1000}, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
        `;
        
        await this.executeQuery(query);
        LoggerService.info(`Usuário criado: ${userData.cpf}`);
        return userData.cpf;
    }

    async findUserByCpf(cpf: string): Promise<any> {
        const query = `SELECT * FROM ${DatabricksConfig.schema}.users WHERE cpf = '${cpf}'`;
        const result = await this.executeQuery(query);
        return result.length > 0 ? result[0] : null;
    }

    async findUserByEmail(email: string): Promise<any> {
        const query = `SELECT * FROM ${DatabricksConfig.schema}.users WHERE email = '${email}'`;
        const result = await this.executeQuery(query);
        return result.length > 0 ? result[0] : null;
    }

    async updateUserBalance(cpf: string, newBalance: number): Promise<void> {
        const query = `
            UPDATE ${DatabricksConfig.schema}.users 
            SET balance = ${newBalance}, updated_at = CURRENT_TIMESTAMP()
            WHERE cpf = '${cpf}'
        `;
        await this.executeQuery(query);
        LoggerService.info(`Saldo atualizado para usuário ${cpf}: ${newBalance}`);
    }

    // Métodos para transações
    async createTransaction(transactionData: any): Promise<string> {
        const transactionId = uuidv4();
        const query = `
            INSERT INTO ${DatabricksConfig.schema}.transactions 
            (id, type, amount, description, from_cpf, to_cpf, to_key, created_at)
            VALUES ('${transactionId}', '${transactionData.type}', ${transactionData.amount}, 
                    '${transactionData.description}', '${transactionData.from_cpf}', 
                    '${transactionData.to_cpf}', '${transactionData.to_key}', CURRENT_TIMESTAMP())
        `;
        
        await this.executeQuery(query);
        LoggerService.info(`Transação criada: ${transactionId}`);
        return transactionId;
    }

    async createPixTransaction(pixData: any): Promise<any> {
        const transactionId = `PIX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            // Buscar usuário destinatário para obter CPF
            const toUser = await this.findUserByPixKey(pixData.toKey);
            if (!toUser) {
                throw new Error('Destinatário não encontrado');
            }

            // Atualizar saldo do remetente (diminuir)
            const fromUserQuery = `
                UPDATE ${DatabricksConfig.schema}.users 
                SET balance = balance - ${pixData.amount}, updated_at = CURRENT_TIMESTAMP()
                WHERE cpf = '${pixData.fromCpf}'
            `;
            await this.executeQuery(fromUserQuery);

            // Atualizar saldo do destinatário (aumentar)
            const toUserQuery = `
                UPDATE ${DatabricksConfig.schema}.users 
                SET balance = balance + ${pixData.amount}, updated_at = CURRENT_TIMESTAMP()
                WHERE cpf = '${toUser.cpf}'
            `;
            await this.executeQuery(toUserQuery);

            // Criar transação
            const transactionQuery = `
                INSERT INTO ${DatabricksConfig.schema}.transactions 
                (id, type, amount, description, from_cpf, to_cpf, to_key, created_at)
                VALUES ('${transactionId}', 'PIX_SENT', ${pixData.amount}, 
                        '${pixData.description}', '${pixData.fromCpf}', 
                        '${toUser.cpf}', '${pixData.toKey}', CURRENT_TIMESTAMP())
            `;
            await this.executeQuery(transactionQuery);

            LoggerService.info(`PIX realizado: ${transactionId}`);
            
            return {
                id: transactionId,
                type: 'PIX_SENT',
                amount: pixData.amount,
                description: pixData.description,
                from_cpf: pixData.fromCpf,
                to_cpf: toUser.cpf,
                to_key: pixData.toKey,
                created_at: new Date().toISOString()
            };

        } catch (error) {
            LoggerService.error('Erro ao criar transação PIX:', error);
            throw error;
        }
    }

    async getTransactionsByCpf(cpf: string): Promise<any[]> {
        const query = `
            SELECT * FROM ${DatabricksConfig.schema}.transactions 
            WHERE from_cpf = '${cpf}' OR to_cpf = '${cpf}'
            ORDER BY created_at DESC
            LIMIT 50
        `;
        return await this.executeQuery(query);
    }

    // Métodos para contatos PIX
    async createPixContact(contactData: any): Promise<string> {
        const contactId = uuidv4();
        const query = `
            INSERT INTO ${DatabricksConfig.schema}.pix_contacts 
            (id, user_cpf, contact_key, contact_name, daily_limit, created_at)
            VALUES ('${contactId}', '${contactData.user_cpf}', '${contactData.contact_key}', 
                    '${contactData.contact_name}', ${contactData.daily_limit || 1000}, CURRENT_TIMESTAMP())
        `;
        
        await this.executeQuery(query);
        LoggerService.info(`Contato PIX criado: ${contactId}`);
        return contactId;
    }

    async getPixContactsByCpf(cpf: string): Promise<any[]> {
        const query = `
            SELECT * FROM ${DatabricksConfig.schema}.pix_contacts 
            WHERE user_cpf = '${cpf}'
            ORDER BY created_at DESC
        `;
        return await this.executeQuery(query);
    }

    async findUserByPixKey(pixKey: string): Promise<any> {
        // PIX key pode ser CPF ou email
        const query = `
            SELECT * FROM ${DatabricksConfig.schema}.users 
            WHERE cpf = '${pixKey}' OR email = '${pixKey}'
        `;
        const result = await this.executeQuery(query);
        return result.length > 0 ? result[0] : null;
    }
}

export const databricksService = new DatabricksService();