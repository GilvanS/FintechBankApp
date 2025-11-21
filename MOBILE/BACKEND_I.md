# Especificação da API Backend - Fintech Bank (BACKEND_I.md).

Este documento descreve os endpoints e as regras de negócio que a API do backend precisa implementar para suportar todas as funcionalidades do frontend da Fintech Bank.

## 1. Autenticação e Usuários (`/auth`, `/users`)

### `POST /auth/signup`
- **Descrição:** Registra um novo usuário.
- **Request Body:** `{ fullName, email, cpf, password }`
- **Regras de Negócio:**
  - Validar se o CPF e o e-mail já existem no banco de dados.
  - Criptografar a senha antes de salvar.
  - Criar um novo usuário com valores padrão (saldo 0, sem transações, etc.) e um cartão de crédito associado.
- **Response:** `{ success: true, message: "Usuário criado com sucesso." }`

### `POST /auth/login`
- **Descrição:** Autentica um usuário.
- **Request Body:** `{ cpf, password }`
- **Regras de Negócio:**
  - Comparar a senha fornecida com a versão criptografada no banco.
  - Verificar se a conta do usuário está bloqueada.
- **Response:** `{ success: true, token: "JWT_TOKEN", user: { ...userData } }` (retorna os dados do usuário sem a senha).

### `POST /auth/request-password-reset`
- **Descrição:** Inicia o processo de recuperação de senha.
- **Request Body:** `{ cpf }`
- **Regras de Negócio:**
  - Cria um registro na tabela `password_requests` com status `pending`.
  - Envia uma notificação para a fila de administradores.
- **Response:** `{ success: true, message: "Solicitação enviada para aprovação." }`

### `POST /auth/reset-password`
- **Descrição:** Redefine a senha do usuário usando um token.
- **Corpo da Requisição:** `{ cpf, token, newPassword }`
- **Regras de Negócio:**
    - O `token` esperado é os 4 últimos dígitos do CPF do usuário.
    - Validar o CPF e o token antes de atualizar a senha.
- **Response:** `{ success: true, message: "Senha redefinida com sucesso!" }`

### `GET /users/me`
- **Descrição:** Retorna os dados completos do usuário autenticado.
- **Header:** `Authorization: Bearer JWT_TOKEN`
- **Response:** `{ ...fullUserData }` (incluindo `purchasedItems` com `pointsEarned` e `purchaseDate`).

## 2. Área PIX (`/pix`)

### `POST /pix/recipient-info`
- **Descrição:** Valida uma chave PIX e retorna os dados do destinatário para a tela de confirmação.
- **Corpo da Requisição:** `{ key, senderCpf }`
- **Regras de Negócio:**
    - Não permite transferências para o próprio remetente.
- **Response de Sucesso:** `{ success: true, name: "...", cpf: "***.123.456-**" }` (CPF mascarado).
- **Response de Erro:** `{ success: false, message: "Chave PIX não encontrada." | "Não é possível enviar PIX para si mesmo." }`

### `POST /pix/transfer`
- **Descrição:** Realiza uma transferência PIX.
- **Request Body:** `{ toKey, amount, description }`
- **Regras de Negócio:**
  - Validar se o saldo do remetente é suficiente.
  - Validar se o valor não excede o limite diário PIX do usuário.
  - Deduzir o valor da conta do remetente e adicionar à conta do destinatário.
  - Registrar uma transação de `PIX_SENT` para o remetente e uma de `PIX_RECEIVED` para o destinatário.
- **Response:** `{ success: true, message: "PIX enviado com sucesso.", transaction: { ...txData } }`

### `POST /pix/transfer-credit`
- **Descrição:** Realiza uma transferência PIX no crédito.
- **Request Body:** `{ toKey, amount, installments }`
- **Regras de Negócio:**
  - Validar se o limite de crédito do usuário é suficiente.
  - Deduzir o valor do limite disponível e adicionar o valor (com juros) à fatura.
  - **Crucial:** Criar as transações de parcelamento na fatura do cartão com datas de vencimento futuras corretas (uma para cada mês subsequente).
- **Response:** `{ success: true, message: "PIX no crédito realizado com sucesso." }`

### `GET /pix/keys`, `POST /pix/keys`, `DELETE /pix/keys/:key`
- **Descrição:** Endpoints para gerenciar as chaves PIX do usuário.

### `GET /pix/contacts`, `POST /pix/contacts`, `DELETE /pix/contacts/:key`
- **Descrição:** Endpoints para gerenciar os contatos PIX salvos do usuário.

## 3. Marketplace e Compras (`/shop`)

### `GET /shop/products`
- **Descrição:** Retorna a lista de produtos disponíveis no marketplace.
- **Response:** `[{ ...productData }, ...]`

### `POST /shop/checkout`
- **Descrição:** Processa a compra de um ou mais itens do carrinho.
- **Request Body:** `{ items: [{ productId, quantity }], paymentMethod: 'debit' | 'credit', cashbackUsed: number, installments: number }`
- **Regras de Negócio:**
  - Calcular pontos ganhos na transação (`Math.floor(finalAmount / 10)`).
  - Salvar cada `purchasedItem` com `purchaseDate` e `pointsEarned`.
  - **Se `paymentMethod` é `debit`:**
    - Validar e debitar o valor do saldo da conta.
  - **Se `paymentMethod` é `credit`:**
    - Validar o limite do cartão.
    - Se `installments > 1`, calcular juros e criar as transações de parcelamento na fatura com **datas de vencimento futuras corretas**.
- **Response:** `{ success: true, message: "Compra realizada com sucesso.", orderId: "..." }`

## 4. Gerenciamento de Cartão de Crédito (`/cards`)

### `POST /cards/invoice/pay`
- **Descrição:** Paga a fatura fechada do cartão com o saldo da conta.
- **Regras de Negócio:**
  - Validar se o saldo da conta é suficiente.
  - Restaurar o limite de crédito e zerar o valor da `closedInvoice`.
  - Se o cartão estava bloqueado, desbloqueá-lo.
- **Response:** `{ success: true, message: "Fatura paga com sucesso." }`

### `POST /cards/invoice/parcel`
- **Descrição:** Parcela a fatura fechada.
- **Request Body:** `{ amount, installments }`
- **Regras de Negócio:**
  - Calcular juros e o valor de cada parcela.
  - **Crucial:** Lançar as transações de `INVOICE_INSTALLMENT` nas futuras faturas com **datas de vencimento futuras corretas**.
- **Response:** `{ success: true, message: "Fatura parcelada com sucesso." }`

## 5. Painel do Administrador (`/admin`)

Todos os endpoints de admin devem ser protegidos e só acessíveis por usuários com `role: 'admin'`.

### `GET /admin/requests/password`, `GET /admin/requests/limit`
- **Descrição:** Retornam as listas de solicitações pendentes.

### `POST /admin/requests/password/:cpf/approve`, `POST /admin/requests/password/:cpf/deny`
- **Descrição:** Aprovam ou negam uma solicitação de redefinição de senha.

### `PUT /admin/users/:cpf/card-details`
- **Descrição:** Atualiza as datas de vencimento do cartão e da fatura do cliente.
- **Corpo da Requisição:** `{ dueDate, invoiceDueDate }`
- **Regras de Negócio:**
    - Ao alterar `invoiceDueDate` de uma fatura fechada para o passado, o sistema deve reavaliar o status do cartão.
    - Se a nova data for mais de 7 dias no passado e a fatura não estiver paga, o cartão deve ser bloqueado (`isBlocked = true`) e uma notificação deve ser enviada ao cliente.
- **Response:** `{ success: true, message: "Detalhes do cartão do cliente foram atualizados.", user: { ... } }`

### `POST /admin/users/:cpf/block`, `POST /admin/users/:cpf/unblock`
- **Descrição:** Bloqueiam ou desbloqueiam um usuário.

### `POST /admin/users/:cpf/deposit`
- **Descrição:** Realiza um depósito manual na conta de um cliente.
- **Request Body:** `{ amount }`

## 6. Endpoints de Proxy (Recomendação)

### `GET /proxy/news`
- **Descrição:** Um endpoint que atua como intermediário (proxy) para as APIs de notícias.
- **Regras de Negócio:**
  - O backend faz a chamada para a API externa, escondendo a chave de API do frontend.
  - Pode implementar um cache para reduzir o número de chamadas.
- **Response:** Retorna os dados formatados das notícias.
