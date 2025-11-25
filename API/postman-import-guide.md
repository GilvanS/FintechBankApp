# Guia de Importação do Postman

## Arquivos Gerados

1. **postman-collection-complete.json** - Collection completa com todos os endpoints
2. **postman-environment-development.json** - Environment para desenvolvimento
3. **postman-environment-production.json** - Environment para produção

## Como Importar no Postman

### 1. Importar a Collection

1. Abra o Postman
2. Clique em **Import** (botão no canto superior esquerdo)
3. Arraste o arquivo `postman-collection-complete.json` ou clique em **Upload Files**
4. Clique em **Import**

### 2. Importar os Environments

1. No Postman, clique no ícone de **engrenagem** (⚙️) no canto superior direito
2. Clique em **Import**
3. Selecione os arquivos:
   - `postman-environment-development.json`
   - `postman-environment-production.json`
4. Clique em **Import**

### 3. Selecionar o Environment

1. No canto superior direito do Postman, clique no dropdown de **Environments**
2. Selecione **FintechBankApp - Development**

### 4. Obter Tokens de Autenticação

#### Para usuário comum:
1. Vá para a pasta **Autenticação** na collection
2. Execute a requisição **Login**
3. O token será salvo automaticamente na variável `authToken`

#### Para administrador:
1. Execute a requisição **Login Admin**
2. O token será salvo automaticamente na variável `adminToken`

## Variáveis de Ambiente

### Development
- `baseUrl`: http://localhost:3001/api/v1
- `authToken`: Token JWT do usuário (preenchido automaticamente após login)
- `adminToken`: Token JWT do admin (preenchido automaticamente após login)
- `userCpf`: 11111111111
- `adminCpf`: 99999999999
- `adminPassword`: admin999
- `userPassword`: senha123
- `pin`: 9898

### Production
- `baseUrl`: https://api.fintechbankapp.com/api/v1
- Outras variáveis devem ser configuradas manualmente

## Como Usar a Collection

1. **Autenticação**: Sempre comece fazendo login para obter o token
2. **Endpoints Protegidos**: A maioria dos endpoints requer autenticação Bearer Token
3. **Endpoints Admin**: Requerem token de administrador (use `adminToken`)
4. **Variáveis**: Edite os valores nas variáveis de ambiente conforme necessário

## Estrutura da Collection

- **Sistema**: Health check
- **Autenticação**: Login, cadastro, reset de senha
- **Usuários**: Perfil, extrato, notificações, etc.
- **PIX**: Transferências, chaves, contatos
- **Shop**: Produtos e checkout
- **Cartão de Crédito**: Pagamento de fatura, parcelamento
- **Admin**: Gerenciamento de usuários e solicitações
- **Outros**: Stories, notícias

## Troubleshooting

### Erro 401 (Unauthorized)
- Verifique se você fez login e o token foi salvo
- Verifique se está usando o token correto (usuário vs admin)

### Erro de conexão
- Verifique se a API está rodando
- Verifique a URL base no environment selecionado
- Para desenvolvimento local: `http://localhost:3001/api/v1`

### Swagger não carrega no Postman
- O Postman pode importar o Swagger diretamente pela URL:
  - `http://localhost:3001/api-docs/swagger.json` ou
  - `http://localhost:3001/api-docs/swagger.yaml`
- Use a collection gerada (`postman-collection-complete.json`) que contém todos os endpoints



