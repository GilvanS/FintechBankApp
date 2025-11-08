# Especificação da API Backend - Fintech Bank App

## 1. Visão Geral

Esta documentação descreve a API RESTful necessária para suportar todas as funcionalidades da aplicação Fintech Bank. O backend será responsável pela lógica de negócio, segurança e persistência dos dados.

**URL Base:** `/api/v1`

**Autenticação:** A maioria das rotas requer autenticação via `Bearer Token` (JWT), que deve ser enviado no header `Authorization`.

---

## 2. Endpoints

### Módulo de Autenticação (`/auth`)

#### `POST /auth/signup`
- **Descrição**: Registra um novo usuário.
- **Request Body**: `{ fullName, cpf, email, password }`
- **Success Response (201)**: `{ success: true, message: "Cadastro realizado com sucesso!" }`
- **Error Response (400)**: `{ success: false, message: "CPF ou E-mail já cadastrado." }`

#### `POST /auth/login`
- **Descrição**: Autentica um usuário e retorna um token JWT.
- **Request Body**: `{ cpf, password }`
- **Success Response (200)**: `{ success: true, message: "Login bem-sucedido!", user: { ...user }, token: "jwt_token" }`
- **Error Response (401)**: `{ success: false, message: "CPF ou senha inválidos." }` ou `{ success: false, message: "Este usuário está bloqueado." }`

#### `POST /auth/request-password-reset`
- **Descrição**: Inicia o fluxo de recuperação de senha, criando uma solicitação para o admin.
- **Request Body**: `{ cpf }`
- **Success Response (200)**: `{ success: true, message: "Solicitação enviada para análise." }`
- **Error Response (404)**: `{ success: false, message: "Usuário não encontrado." }`

#### `GET /auth/password-request-status/{cpf}`
- **Descrição**: Verifica o status de uma solicitação de redefinição de senha.
- **Success Response (200)**: `{ cpf, status: "pending" | "approved" | "denied", reason?: "..." }`

#### `POST /auth/reset-password`
- **Descrição**: Permite que um usuário com uma solicitação aprovada crie uma nova senha.
- **Request Body**: `{ cpf, newPassword }`
- **Success Response (200)**: `{ success: true, message: "Senha redefinida com sucesso!" }`
- **Error Response (400)**: `{ success: false, message: "Nenhuma solicitação aprovada encontrada." }`

---

### Módulo de Usuário (`/users`)

#### `PUT /users/profile/{cpf}`
- **Descrição**: Atualiza os dados do perfil do usuário.
- **Request Body**: `{ fullName?, username?, profileDescription?, showStoriesPopup? }`
- **Success Response (200)**: `{ success: true, message: "Perfil atualizado!", user: { ...user } }`

---

### Módulo PIX (`/pix`)

#### `POST /pix/transfer`
- **Descrição**: Realiza uma transferência PIX a partir do saldo da conta.
- **Request Body**: `{ cpf, pixKey, amount, description? }`
- **Success Response (200)**: `{ success: true, message: "PIX enviado com sucesso!", transaction: { ...transaction } }`
- **Error Response (400)**: `{ success: false, message: "Saldo insuficiente." }` ou `{ success: false, message: "Este valor excede seu limite diário de PIX." }`

#### `POST /pix/transfer/credit`
- **Descrição**: Realiza uma transferência PIX parcelada no cartão de crédito.
- **Request Body**: `{ cpf, pixKey, amount, installments }`
- **Success Response (200)**: `{ success: true, message: "PIX no crédito realizado com sucesso!", user: { ...user } }`
- **Error Response (400)**: `{ success: false, message: "Limite do cartão de crédito insuficiente." }`

#### `GET /pix/keys/{cpf}` e `POST /pix/keys/{cpf}` e `DELETE /pix/keys/{cpf}/{key}`
- **Descrição**: Rotas para obter, registrar e deletar chaves PIX de um usuário.

#### `GET /pix/contacts/{cpf}` e `POST /pix/contacts/{cpf}` e `DELETE /pix/contacts/{cpf}/{key}`
- **Descrição**: Rotas para obter, adicionar e deletar contatos PIX favoritos.

#### `PUT /pix/limits/{cpf}`
- **Descrição**: Atualiza o limite PIX diário do usuário. Se o valor for acima de um teto (ex: R$ 2.000), cria uma solicitação para o admin.
- **Request Body**: `{ newLimit }`
- **Success Response (200)**: `{ success: true, message: "Limite atualizado." }` ou `{ success: true, message: "Solicitação de aumento de limite enviada." }`

---

### Módulo de Cartão de Crédito (`/cards`)

#### `POST /cards/invoice/pay`
- **Descrição**: Paga a fatura fechada do cartão com o saldo da conta.
- **Request Body**: `{ cpf }`
- **Success Response (200)**: `{ success: true, message: "Fatura paga com sucesso!", user: { ...user }, transactionId: "..." }`
- **Error Response (400)**: `{ success: false, message: "Saldo insuficiente para pagar a fatura." }`

#### `POST /cards/invoice/parcel`
- **Descrição**: Parcela o valor da fatura fechada, lançando as parcelas com juros na fatura aberta.
- **Request Body**: `{ cpf, amount, installments }`
- **Success Response (200)**: `{ success: true, message: "Fatura parcelada com sucesso!", user: { ...user } }`

#### `POST /cards/installments/anticipate` (Sugestão)
- **Descrição**: Antecipa o pagamento de parcelas de compras, aplicando um desconto.
- **Request Body**: `{ cpf, transactionId, numberOfInstallments }`

---

### Módulo de Marketplace (`/shop`)

#### `POST /shop/purchase/debit`
- **Descrição**: Realiza a compra de um item no débito, usando o saldo da conta.
- **Request Body**: `{ cpf, item: { ...item }, cashbackUsed }`
- **Success Response (200)**: `{ success: true, message: "Compra realizada!", user: { ...user } }`
- **Error Response (400)**: `{ success: false, message: "Saldo insuficiente." }`

#### `POST /shop/purchase/credit`
- **Descrição**: Realiza a compra de um item no crédito.
- **Request Body**: `{ cpf, item: { ...item }, cashbackUsed, installments }`
- **Success Response (200)**: `{ success: true, message: "Compra realizada!", user: { ...user } }`
- **Error Response (400)**: `{ success: false, message: "Limite do cartão de crédito insuficiente." }`

---

### Módulo Administrativo (`/admin`)

#### `GET /admin/users/{cpf}`
- **Descrição**: Busca os dados de um cliente pelo CPF.
- **Success Response (200)**: `{ success: true, user: { ...user } }`

#### `POST /admin/users/block` e `POST /admin/users/unblock`
- **Descrição**: Bloqueia ou desbloqueia a conta de um usuário.
- **Request Body**: `{ cpf }`

#### `POST /admin/users/deposit`
- **Descrição**: Realiza um depósito na conta de um usuário.
- **Request Body**: `{ cpf, amount }`

#### `GET /admin/requests/password` e `GET /admin/requests/limit`
- **Descrição**: Obtém as listas de solicitações pendentes de redefinição de senha e aumento de limite.

#### `POST /admin/requests/password/approve` e `POST /admin/requests/password/deny`
- **Descrição**: Aprova ou nega uma solicitação de redefinição de senha.
- **Request Body**: `{ cpf, reason? }` (motivo obrigatório para negação)

#### `POST /admin/requests/limit/approve` e `POST /admin/requests/limit/deny`
- **Descrição**: Aprova ou nega uma solicitação de aumento de limite PIX.
- **Request Body**: `{ cpf, reason? }`

---

### Módulo de Notificações (`/notifications`)

#### `GET /notifications/{cpf}`
- **Descrição**: Obtém todas as notificações de um usuário.

#### `PUT /notifications/read/{cpf}/{notificationId}`
- **Descrição**: Marca uma notificação específica como lida.

---

### Módulo de APIs Externas (Sugestão)
#### `GET /external/news`
- **Descrição**: Um endpoint de proxy que busca notícias das APIs externas (NewsAPI, The Guardian, etc.). Isso evita expor as chaves de API no frontend, melhora a performance com cache e centraliza a lógica.
- **Success Response (200)**: ` { articles: [ ... ] }`
