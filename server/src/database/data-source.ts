import * as dotenv from "dotenv";
import path from "path";

// Carrega as variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Log das variáveis de ambiente para debug
console.log("Variáveis de ambiente carregadas:", {
    DATABRICKS_SERVER_HOSTNAME: process.env.DATABRICKS_SERVER_HOSTNAME,
    DATABRICKS_HTTP_PATH: process.env.DATABRICKS_HTTP_PATH,
    DATABRICKS_TOKEN: process.env.DATABRICKS_TOKEN ? "***TOKEN_PRESENTE***" : "TOKEN_AUSENTE",
    DATABRICKS_CATALOG: process.env.DATABRICKS_CATALOG,
    DATABRICKS_SCHEMA: process.env.DATABRICKS_SCHEMA
});

// Configuração do Databricks
export const DatabricksConfig = {
    serverHostname: process.env.DATABRICKS_SERVER_HOSTNAME || "",
    httpPath: process.env.DATABRICKS_HTTP_PATH || "",
    token: process.env.DATABRICKS_TOKEN || "",
    catalog: process.env.DATABRICKS_CATALOG || "hive_metastore",
    schema: process.env.DATABRICKS_SCHEMA || "fintech_bank"
};