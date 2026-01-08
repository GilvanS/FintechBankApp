# 🧪 Como Testar a API FintechBankApp

## 📋 Pré-requisitos

1. **Servidor rodando**: A API deve estar rodando em `http://localhost:3001`
2. **Dependências instaladas**: Execute `npm install --legacy-peer-deps` na pasta API
3. **Newman instalado**: Já está incluído nas dependências

## 👥 CPFs de Teste Configurados

- **Usuário 1**: `11111111111` (principal)
- **Usuário 2**: `77777777777` (secundário)
- **Usuário 3**: `88888888888` (terciário)
- **Admin**: `99999999999`

**Senha padrão para todos**: `admin999`  
**PIN padrão**: `9898`

## 🚀 Formas de Executar os Testes

### Opção 1: Script PowerShell (Recomendado)

```powershell
cd API
.\test-api-completo.ps1
```

### Opção 2: Script NPM

```bash
cd API
npm run test:api
```

ou

```bash
npm run test:newman
```

### Opção 3: Node.js Direto

```bash
cd API
node run-newman-tests.js
```

### Opção 4: Newman CLI Direto

```bash
cd API
npx newman run postman-collection.json -e postman-environment.json --reporters cli --reporters html --reporters json
```

**Nota**: Se der erro com os reporters, use apenas CLI:
```bash
npx newman run postman-collection.json -e postman-environment.json
```

## 📊 Relatórios Gerados

Após a execução, os seguintes relatórios serão gerados:

- **`newman-report.html`** - Relatório visual em HTML
- **`newman-report.json`** - Relatório em JSON para análise programática

## ✅ O que é Testado

A collection simplificada testa:

### 🔐 Autenticação
- Login normal
- Login admin
- Cadastrar usuário

### 👤 Usuários
- Consultar extrato (inclui saldo e compras)

### 💸 PIX
- Info do destinatário
- Listar chaves PIX
- Cadastrar chave PIX (CPF e Email)
- Deletar chave PIX
- Listar contatos PIX
- Adicionar contato PIX
- Remover contato PIX
- Transferir PIX (débito)
- Transferir PIX Crédito

### 💳 Cartão
- Pagar fatura
- Parcelar fatura

### 🛒 Shop
- Listar produtos
- Cadastrar produto (Admin)
- Editar produto (Admin)
- Comprar produto (Débito)
- Comprar produto (Crédito à vista)
- Comprar produto (Crédito 12x sem juros)
- Comprar produto (Crédito 18x com juros)

### 👨‍💼 Admin
- Listar usuários
- Consultar usuário
- Fazer depósito
- Atualizar detalhes do cartão
- Compra aberta (Vista, 12x, 18x)
- Compra fechada (Vista, 12x, 20x)

## 🔧 Configuração

### Variáveis do Environment

O arquivo `postman-environment.json` contém:

- `baseUrl`: `http://localhost:3001/api/v1`
- `userCpf`: `11111111111`
- `userCpf2`: `77777777777`
- `userCpf3`: `88888888888`
- `adminCpf`: `99999999999`
- `userPassword`: `admin999`
- `adminPassword`: `admin999`
- `pin`: `9898`
- `destinationCpf1/2/3`: Salvos automaticamente ao cadastrar usuários/contatos

### CPFs de Destino Automáticos

Os CPFs são salvos automaticamente em `destinationCpf1`, `destinationCpf2` e `destinationCpf3` quando:
- Um novo usuário é cadastrado via Signup
- Um contato PIX é adicionado

Máximo de 3 CPFs são mantidos. Quando os 3 slots estão preenchidos, os CPFs são rotacionados (FIFO).

## 🐛 Troubleshooting

### Servidor não está rodando

```
❌ Servidor não está rodando ou não está acessível!
```

**Solução**: Inicie o servidor em outro terminal:
```bash
cd API
npm run dev
```

### Erro ao instalar dependências

```
npm error ERESOLVE unable to resolve dependency tree
```

**Solução**: Use `--legacy-peer-deps`:
```bash
npm install --legacy-peer-deps
```

### Testes falhando

1. Verifique se o servidor está rodando
2. Verifique se os CPFs de teste existem no banco de dados
3. Verifique os logs do servidor para erros
4. Consulte o relatório HTML gerado para detalhes

## 📝 Notas

- Os tokens são salvos automaticamente após login
- Os CPFs de destino são salvos automaticamente
- O PIN padrão é `9898` para todas as operações
- Timeout de 30 segundos por request
- Delay de 500ms entre requests para evitar sobrecarga
