# 📚 Documentação Completa - FintechBankApp

> Este documento consolida toda a documentação do projeto FintechBankApp em um único arquivo para facilitar a leitura e geração de livros/documentação impressa.

---

# 📋 Índice Geral

1. [Sobre o Projeto](#sobre-o-projeto)
2. [Estrutura do Projeto](#estrutura-do-projeto)
3. [Configuração e Instalação](#configuração-e-instalação)
4. [Banco de Dados](#banco-de-dados)
5. [API - Backend](#api---backend)
6. [Frontend Web](#frontend-web)
7. [Aplicativo Mobile](#aplicativo-mobile)
8. [Geração de APK](#geração-de-apk)
9. [Testes](#testes)
10. [Troubleshooting](#troubleshooting)
11. [Guias Específicos](#guias-específicos)

---

# Sobre o Projeto

## 🏦 FintechBankApp

**FintechBankApp** é uma aplicação bancária moderna e completa, desenvolvida como projeto didático para treinamento de desenvolvimento Web, APIs e **testes automatizados**. Este projeto oferece um ambiente rico e desafiador para QAs experientes praticarem e aprimorarem suas habilidades em automação de testes.

### Objetivos do Projeto

- Exercitar princípios SOLID, Clean Code e testes automatizados
- Simular rotinas bancárias (faturas, cartão de crédito, PIX, extrato)
- Praticar integrações com diferentes bancos de dados e ambientes
- Fornecer uma base completa para implementação de testes E2E

### Tecnologias Principais

- **Backend**: Node.js, Express, JWT, bcrypt, Swagger
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Mobile**: React Native, Capacitor
- **Banco de Dados**: PostgreSQL, SQLite, Databricks
- **Testes**: Jest, Vitest, Newman, Supertest

---

# Estrutura do Projeto

```
FintechBankApp/
├── API/              # Backend Express + Swagger + Testes
├── WEB/              # Frontend React + Vite
├── MOBILE/           # Aplicação React Native
├── docker-compose.yml # Infraestrutura Docker
└── README.md         # Documentação principal
```

---

# Configuração e Instalação

## Pré-requisitos

- Node.js (>= 18)
- Docker Desktop (para PostgreSQL)
- Android SDK (para build mobile)
- Git

## Instalação Inicial

### 1. Clone o Repositório

```bash
git clone <repository-url>
cd FintechBankApp
```

### 2. Instale Dependências

**Backend (API):**
```bash
cd API
npm install
```

**Frontend (WEB):**
```bash
cd WEB
npm install
```

**Mobile:**
```bash
cd MOBILE
npm install
```

### 3. Configure Variáveis de Ambiente

Copie o arquivo de exemplo e configure:

**API/.env:**
```env
PORT=3001
JWT_SECRET=seu-secret-key-aqui
DB_PROVIDER=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=pwd123
DB_NAME=fintech
DB_SCHEMA=fintech
```

---

# Banco de Dados

## Configuração do PostgreSQL via Docker

### Primeira Vez - Setup Inicial

#### Opção 1: Script Automatizado (Recomendado)

```powershell
cd API
.\RECRIAR-BANCO.ps1
```

O script executa automaticamente:
- Para e remove containers antigos
- Inicia PostgreSQL no Docker
- Aguarda o banco inicializar
- Cria o banco de dados `fintech`
- Cria o schema `fintech`
- Executa todos os scripts SQL necessários

#### Opção 2: Passo a Passo Manual

1. **Iniciar PostgreSQL:**
```powershell
docker-compose up -d database
```

2. **Aguardar 15-20 segundos** para inicialização

3. **Criar banco de dados:**
```powershell
docker exec pgdb psql -U postgres -c "CREATE DATABASE fintech;"
```

4. **Criar schema:**
```powershell
docker exec pgdb psql -U postgres -d fintech -c "CREATE SCHEMA IF NOT EXISTS fintech;"
```

5. **Executar script principal:**
```powershell
Get-Content "schema_pg_fintech.sql" | docker exec -i pgdb psql -U postgres -d fintech
```

### Recriar do Zero

Quando o banco ou Docker foram deletados:

1. **Parar e remover containers:**
```powershell
docker-compose down -v
```

2. **Remover volumes (se necessário):**
```powershell
docker volume rm $(docker volume ls -q | grep postgres)
```

3. **Executar script de recriação:**
```powershell
cd API
.\RECRIAR-BANCO.ps1
```

### Informações do Banco

- **Container**: `pgdb`
- **Imagem**: `postgres:trixie`
- **Porta**: `5432`
- **Usuário**: `postgres`
- **Senha**: `pwd123`
- **Banco**: `fintech`
- **Schema**: `fintech`

### Verificar Status

```powershell
# Verificar se container está rodando
docker ps | findstr pgdb

# Verificar tabelas criadas
docker exec pgdb psql -U postgres -d fintech -c "\dt fintech.*"

# Conectar ao banco
docker exec -it pgdb psql -U postgres -d fintech
```

---

# API - Backend

## Como Executar

```bash
cd API
npm run dev
```

A API estará disponível em `http://localhost:3001`

## Documentação Swagger

Acesse: `http://localhost:3001/api-docs`

## Endpoints Principais

### Autenticação
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/signup` - Cadastro
- `POST /api/v1/auth/request-password-reset` - Solicitar reset de senha
- `POST /api/v1/auth/reset-password` - Resetar senha

### Usuários
- `GET /api/v1/users/me` - Dados do usuário logado
- `GET /api/v1/users/:cpf` - Dados de um usuário
- `GET /api/v1/users/:cpf/statement` - Extrato

### PIX
- `POST /api/v1/pix/transfer` - Transferência PIX
- `POST /api/v1/pix/transfer-credit` - PIX no crédito
- `GET /api/v1/pix/keys` - Listar chaves PIX
- `POST /api/v1/pix/keys` - Cadastrar chave PIX
- `DELETE /api/v1/pix/keys/:key` - Deletar chave PIX
- `GET /api/v1/pix/contacts/:cpf` - Listar contatos
- `POST /api/v1/pix/contacts/:cpf` - Adicionar contato
- `DELETE /api/v1/pix/contacts/:cpf/:key` - Remover contato

### Cartão de Crédito
- `POST /api/v1/cards/invoice/pay` - Pagar fatura
- `POST /api/v1/cards/invoice/parcel` - Parcelar fatura
- `POST /api/v1/cards/invoice/anticipate` - Antecipar parcelas

### Shop
- `GET /api/v1/shop/products` - Listar produtos
- `POST /api/v1/shop/checkout` - Finalizar compra

### Admin
- `GET /api/v1/admin/users` - Listar usuários
- `GET /api/v1/admin/users/:cpf` - Detalhes do usuário
- `POST /api/v1/admin/users/:cpf/deposit` - Fazer depósito
- `POST /api/v1/admin/users/:cpf/block` - Bloquear usuário
- `POST /api/v1/admin/users/:cpf/unblock` - Desbloquear usuário

## Segurança

### Middlewares
- `bearerAuth`: Validação de token JWT
- `requireScope`: Validação de escopo (admin/customer)
- `pinGuard`: Validação de PIN para operações sensíveis
- `withReqId`: Correlação de logs

### Autenticação

Todas as rotas protegidas requerem header:
```
Authorization: Bearer <token>
```

### PIN

Operações sensíveis requerem PIN de 4 dígitos:
- Transferências PIX
- Compras no shop
- Pagamento de faturas
- Parcelamento

PIN padrão para testes: `9898`

---

# Frontend Web

## Como Executar

```bash
cd WEB
npm run dev
```

A interface web abrirá em `http://localhost:5173`

## Build de Produção

```bash
cd WEB
npm run build
npm run preview
```

## Funcionalidades

### Autenticação
- Login e cadastro
- Recuperação de senha (com aprovação admin)
- Perfil de usuário

### Dashboard
- Saldo em conta
- Fatura do cartão
- Acesso rápido às funcionalidades
- Carrossel de notícias e ofertas

### PIX
- Transferências
- Gerenciamento de chaves
- Contatos salvos
- PIX no crédito

### Shop
- Vitrine de produtos
- Carrinho de compras
- Checkout (débito/crédito)
- Parcelamento

### Cartão de Crédito
- Visualização de faturas
- Pagamento
- Parcelamento
- Antecipação

### Admin
- Gerenciamento de usuários
- Aprovação de solicitações
- Depósitos manuais

---

# Aplicativo Mobile

## Configuração para Desenvolvimento

### 1. Configurar IP da API

Edite `MOBILE/src/apiConfig.ts`:

```typescript
export const API_BASE_URL = 'http://192.168.0.105:3001';
```

**Importante**: Use o IP da sua máquina na rede local.

### 2. Usando Ngrok (Recomendado)

Para desenvolvimento mobile, use ngrok para expor a API:

1. **Instale o ngrok:**
```bash
ngrok config add-authtoken SEU_TOKEN
```

2. **Inicie a API:**
```bash
cd API
npm run dev
```

3. **Inicie o ngrok:**
```bash
ngrok http 3001
```

4. **Copie a URL HTTPS** (ex: `https://xxxx.ngrok-free.app`)

5. **Atualize o arquivo de configuração:**
```typescript
export const API_BASE_URL = 'https://xxxx.ngrok-free.app';
```

### 3. Build e Sincronização

```bash
cd MOBILE
npm run build
npx cap sync android
npx cap open android
```

---

# Geração de APK

## Script Automatizado

O projeto possui um script único que faz todo o processo:

```powershell
cd MOBILE
.\GERAR-APK-DO-ZERO.ps1
```

## O que o Script Faz

1. **Verifica versão** (antes e durante o processo)
2. **Limpeza completa**:
   - Remove pasta `dist`
   - Remove cache do Vite
   - Executa `gradlew clean`
   - Remove `android/app/build`
   - Remove `android/build`
   - Remove cache do Gradle
3. **Verifica dependências** (instala se necessário)
4. **Build do projeto web** (`npm run build`)
5. **Sincroniza com Android** (`npx cap sync android`)
6. **Gera APK** (`gradlew assembleDebug`)
7. **Instala no dispositivo** (se conectado)

## Localização do APK

Após executar o script, o APK estará em:

```
MOBILE\android\app\build\outputs\apk\debug\app-debug.apk
```

## Verificar Versão

Após instalar o APK:
1. Abra o app
2. Vá em **Perfil** → **Informações do App**
3. Deve mostrar a versão atual (ex: `4.0.2-20250127`)

## Requisitos

- Node.js instalado
- Android SDK instalado
- Java JDK instalado
- Dispositivo Android conectado (opcional, para instalação automática)

## Processo Manual (Alternativo)

Se preferir fazer manualmente:

```bash
cd MOBILE

# 1. Limpar
npm run clean
cd android && ./gradlew clean && cd ..

# 2. Build web
npm run build

# 3. Sincronizar
npx cap sync android

# 4. Gerar APK
cd android
./gradlew assembleDebug
cd ..

# 5. APK gerado em:
# android/app/build/outputs/apk/debug/app-debug.apk
```

---

# Testes

## Testes de API

### Newman (Postman)

```bash
cd API
npm run test:newman
```

Ou execute diretamente:

```bash
newman run postman-collection.json -e postman-environment.json --reporters cli,html,json
```

### Jest

```bash
cd API
npm run test
npm run test:watch
npm run test:coverage
```

## Testes de Frontend

```bash
cd WEB
npm run test
```

## Geração de Massa de Dados

```bash
cd API
npm run generate:test-invoices
```

---

# Troubleshooting

## Problemas Comuns

### API não inicia

1. Verifique se o banco de dados está rodando:
```powershell
docker ps | findstr pgdb
```

2. Verifique as variáveis de ambiente no `.env`

3. Verifique os logs:
```bash
cd API
npm run dev
```

### Erro de conexão com banco

1. Verifique se o container está rodando:
```powershell
docker ps
```

2. Verifique as credenciais no `.env`

3. Teste a conexão:
```powershell
docker exec pgdb psql -U postgres -d fintech -c "SELECT 1;"
```

### APK não gera

1. Verifique se o Android SDK está instalado

2. Verifique se o Java JDK está instalado:
```bash
java -version
```

3. Limpe tudo e tente novamente:
```powershell
cd MOBILE
.\GERAR-APK-DO-ZERO.ps1
```

### Erro de permissão no PowerShell

Execute como Administrador ou ajuste a política:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

# Guias Específicos

## Configuração de IP Fixo (Windows)

Para desenvolvimento mobile, pode ser útil configurar um IP fixo:

```powershell
# Execute como Administrador
New-NetIPAddress -InterfaceAlias "Wi-Fi" -IPAddress "192.168.0.105" -PrefixLength 24 -DefaultGateway "192.168.0.1"
Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses "8.8.8.8","8.8.4.4"
```

Se o IP já existir:
```powershell
Set-NetIPAddress -InterfaceAlias "Wi-Fi" -IPAddress "192.168.0.105" -PrefixLength 24
Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses "8.8.8.8","8.8.4.4"
```

## Usuários Padrão para Testes

### Admin
- **CPF**: `99999999999`
- **Senha**: `admin999`
- **Email**: `admin@fintechbank.com`

### Usuários de Teste
- **CPF**: `11111111111`
- **CPF**: `22222222222`
- **CPF**: `77777777777`
- **CPF**: `88888888888`
- **Senha padrão**: `admin999`

### PIN Padrão
- **PIN**: `9898` (para todas as operações sensíveis)

---

# Comandos Úteis

## Docker

```bash
# Iniciar containers
docker-compose up -d

# Parar containers
docker-compose down

# Ver logs
docker-compose logs -f

# Remover tudo (containers + volumes)
docker-compose down -v
```

## API

```bash
# Desenvolvimento
npm run dev

# Testes
npm run test
npm run test:newman

# Build
npm run build
```

## Mobile

```bash
# Build web
npm run build

# Sincronizar
npx cap sync android

# Abrir Android Studio
npx cap open android

# Gerar APK (script)
.\GERAR-APK-DO-ZERO.ps1
```

---

# Estrutura de Dados

## Tabelas Principais

### users
- Dados do usuário
- Saldo em conta
- Limites do cartão
- Configurações de perfil

### transactions
- Histórico de transações
- Tipos: PIX, SHOP, INVOICE, etc.

### pix_keys
- Chaves PIX cadastradas
- Tipos: CPF, EMAIL

### pix_contacts
- Contatos salvos para PIX

### products
- Produtos do shop

### installment_plans
- Planos de parcelamento
- Parcelas futuras

### invoices
- Faturas do cartão
- Status e vencimentos

---

# Segurança

## Autenticação

- JWT tokens com expiração
- Refresh tokens (se implementado)
- Validação de escopo (admin/customer)

## Autorização

- Middleware de autenticação em rotas protegidas
- Validação de PIN para operações sensíveis
- Controle de acesso baseado em roles

## Validações

- Validação de CPF
- Validação de valores monetários
- Validação de limites
- Sanitização de inputs

---

# Performance

## Otimizações

- Cache de notícias (5 minutos)
- Índices no banco de dados
- Lazy loading no frontend
- Code splitting

## Monitoramento

- Logs estruturados
- Correlação de requisições (x-request-id)
- Métricas de performance (se implementado)

---

# Contribuindo

## Padrões de Código

- ESLint para JavaScript/TypeScript
- Prettier para formatação
- Conventional Commits para mensagens

## Testes

- Cobertura mínima: 80%
- Testes unitários para lógica de negócio
- Testes de integração para APIs
- Testes E2E para fluxos críticos

---

# Licença

Este projeto é um projeto didático para fins de aprendizado e treinamento.

---

**Desenvolvido com ❤️ para a comunidade de QA e Desenvolvimento**

---

*Última atualização: Janeiro 2025*
