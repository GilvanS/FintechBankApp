# Estrutura de Integração Databricks (Proposta)

Este documento descreve a estrutura de pastas e arquivos proposta para integrar configurações, schemas e jobs do Databricks na API Node.js.

## 📂 Estrutura de Pastas

Recomenda-se adicionar a pasta `databricks` na raiz da API:

```text
API/
│
├── databricks/                  <-- [NOVA PASTA] Raiz do módulo Databricks
│   │
│   ├── config/                  <-- Configurações de conexão e ambiente
│   │   ├── databricks.properties    <-- Arquivo de propriedades (ou .env mapping)
│   │   └── clusters.json            <-- Configurações de templates de cluster
│   │
│   ├── schemas/                 <-- Schemas dos dados (Bronze, Silver, Gold)
│   │   ├── bronze/
│   │   │   └── transactions.schema.json
│   │   └── silver/
│   │       └── customers_enriched.schema.json
│   │
│   ├── jobs/                    <-- Definições de Jobs (Workflows)
│   │   ├── ingestion_job.json       <-- Payload para criar/atualizar jobs
│   │   └── nightly_batch.json
│   │
│   └── parameters/              <-- Parâmetros dinâmicos para Notebooks
│       ├── widget_defaults.json     <-- Valores padrão para widgets
│       └── job_params.json          <-- Parâmetros específicos por ambiente
│
├── index.cjs
├── package.json
└── ...
```

## 📄 Detalhe dos Arquivos (Exemplos)

### 1. `databricks/config/databricks.properties`
Arquivo chave-valor para configurações globais.

```properties
# Configurações de Conexão Databricks
databricks.instance=https://adb-123456789.12.azuredatabricks.net
databricks.api.version=2.0

# Caminhos Padrão no DBFS/Workspace
databricks.workspace.root=/Shared/FintechBank
databricks.dbfs.mount=/mnt/fintech-data

# Configurações de Cluster Padrão
databricks.cluster.node_type=Standard_DS3_v2
databricks.cluster.spark_version=13.3.x-scala2.12
```

### 2. `databricks/schemas/bronze/transactions.schema.json`
Definição agnóstica do schema (pode ser usada para validar dados na API antes de enviar).

```json
{
  "type": "struct",
  "fields": [
    {"name": "transaction_id", "type": "string", "nullable": false},
    {"name": "amount", "type": "double", "nullable": false},
    {"name": "timestamp", "type": "timestamp", "nullable": true}
  ]
}
```

### 3. `databricks/parameters/job_params.json`
Parâmetros que a API pode injetar ao disparar um Job.

```json
{
  "ingestion_mode": "incremental",
  "source_system": "fintech_api_v1",
  "max_retries": 3
}
```

## 🚀 Como consumir (Conceito)

Exemplo de utilitário para carregar as configurações:

```javascript
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'databricks/config/databricks.properties');

function getDatabricksConfig() {
    // Lógica para ler o arquivo e transformar em objeto JSON
    // Retorna: { instance: '...', workspace_root: '...' }
}
```
