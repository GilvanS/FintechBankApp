# Documentação da API - Fintech Bank

Este documento descreve a especificação da API para a aplicação Fintech Bank, com base na implementação da API mockada em `src/services/mockApi.ts`. Ele serve como um guia para a equipe de backend construir os endpoints com as regras de negócio esperadas pelo frontend.

## 1. Autenticação

### `POST /auth/signup`
- **Descrição:** Registra um novo usuário.
- **Corpo da Requisição:** `{ fullName, email, cpf, password }`
- **Regras de Negócio:**
    - Validar se o CPF e o e-mail já existem.
    - Criar um novo usuário com valores padrão (saldo, cartão de crédito inicial, etc.).
- **Resposta de Sucesso:** `{ success: true, message: "Cadastro realizado com sucesso!" }`
- **Resposta de Erro:** `{ success: false, message: "CPF já cadastrado." | "E-mail já cadastrado." }`

### `POST /auth/login`
- **Descrição:** Autentica um usuário.
- **Corpo da Requisição:** `{ cpf, password }`
- **Regras de Negócio:**
    - Verificar se a conta do usuário está bloqueada (`isBlocked`).
    - Validar a senha.
- **Resposta de Sucesso:** `{ success: true, message: "Login bem-sucedido!", user: { ... } }` (retorna o objeto do usuário sem a senha).
- **Resposta de Erro:** `{ success: false, message: "Usuário não encontrado." | "Este usuário está bloqueado." | "CPF ou senha inválidos." }`

### `POST /auth/request-password-reset`
- **Descrição:** Cria uma solicitação para redefinir a senha.
- **Corpo da Requisição:** `{ cpf }`
- **Regras de Negócio:**
    - Adiciona uma solicitação ao sistema com status `pending`.
- **Resposta de Sucesso:** `{ success: true, message: "Solicitação de nova senha enviada para análise." }`
- **Resposta de Erro:** `{ success: false, message: "CPF não encontrado." }`

### `POST /auth/reset-password`
- **Descrição:** Redefine a senha do usuário usando um token.
- **Corpo da Requisição:** `{ cpf, token, newPassword }`
- **Regras de Negócio:**
    - O `token` esperado é os 4 últimos dígitos do CPF do usuário.
    - Validar o CPF e o token antes de atualizar a senha.
- **Resposta de Sucesso:** `{ success: true, message: "Senha redefinida com sucesso!" }`
- **Resposta de Erro:** `{ success: false, message: "CPF não encontrado." | "Token de redefinição inválido." }`

## 2. Usuário

### `GET /user/profile`
- **Descrição:** Retorna os dados do usuário autenticado.
- **Header:** `Authorization: Bearer <token>`
- **Resposta:** Objeto `User`.

### `PUT /user/profile`
- **Descrição:** Atualiza os dados do perfil do usuário.
- **Corpo da Requisição:** `{ fullName, username, profileDescription, showStoriesPopup }`
- **Resposta de Sucesso:** `{ success: true, message: "Perfil atualizado!", user: { ... } }`

### `GET /user/notifications`
- **Descrição:** Retorna a lista de notificações do usuário.
- **Resposta:** `AppNotification[]`

### `PUT /user/notifications/:id/read`
- **Descrição:** Marca uma notificação como lida.
- **Resposta de Sucesso:** `{ success: true, message: "Notificação marcada como lida." }`

## 3. PIX

### `POST /pix/recipient-info`
- **Descrição:** Valida uma chave PIX e retorna os dados do destinatário.
- **Corpo da Requisição:** `{ key, senderCpf }`
- **Regras de Negócio:**
    - Não permite transferências para o próprio remetente.
- **Resposta de Sucesso:** `{ success: true, name: "...", cpf: "***.123.456-**" }` (CPF mascarado).
- **Resposta de Erro:** `{ success: false, message: "Chave PIX não encontrada." | "Não é possível enviar PIX para si mesmo." }`

### `POST /pix/transfer`
- **Descrição:** Executa uma transferência PIX.
- **Corpo da Requisição:** `{ cpf, key, amount, description }`
- **Regras de Negócio:**
    - Validar saldo e limite diário do remetente.
    - Debitar do remetente, creditar no destinatário e registrar transações em ambas as contas.
    - Enviar uma notificação para o destinatário.
- **Resposta de Sucesso:** `{ success: true, message: "PIX enviado com sucesso!", user: { ... }, transaction: { ... } }`

### `POST /pix/transfer-credit`
- **Descrição:** Realiza uma transferência PIX usando o limite do cartão de crédito.
- **Corpo da Requisição:** `{ cpf, amount, installments }`
- **Regras de Negócio:**
    - Juros de 5% ao mês (simples) são aplicados.
    - `totalAmount = amount * (1 + 0.05 * installments)`
    - Validar se `totalAmount` é menor que o limite de crédito disponível.
    - Lançar as parcelas na fatura do cartão.
- **Resposta de Sucesso:** `{ success: true, message: "PIX no crédito realizado com sucesso!", user: { ... } }`

### `GET /pix/contacts` & `POST /pix/contacts` & `DELETE /pix/contacts/:key`
- **Descrição:** Endpoints para gerenciar a lista de contatos PIX do usuário.

### `GET /pix/keys` & `POST /pix/keys` & `DELETE /pix/keys/:key`
- **Descrição:** Endpoints para gerenciar as chaves PIX do usuário.

### `PUT /pix/daily-limit`
- **Descrição:** Atualiza o limite diário de PIX do usuário ou cria uma solicitação de aumento.
- **Corpo da Requisição:** `{ cpf, limit }`
- **Regras de Negócio:**
    - Se `limit` for maior que um valor pré-definido (ex: R$ 5.000), cria uma solicitação com status `pending` para aprovação do admin.
    - Se for menor, atualiza o limite diretamente.
- **Resposta:** `{ success: true, message: "Limite PIX atualizado com sucesso." | "Solicitação de aumento de limite enviada para análise." }`

## 4. Cartão de Crédito

### `POST /cards/invoice/pay`
- **Descrição:** Paga a fatura fechada com o saldo em conta.
- **Corpo da Requisição:** `{ cpf }`
- **Regras de Negócio:**
    - Validar se o saldo é suficiente.
    - Debitar do saldo e restaurar o limite do cartão.
    - Se o cartão estava bloqueado (`isBlocked`), desbloqueá-lo.
    - Limpar os dados da fatura fechada (`closedInvoice`, `closedTransactions`).
- **Resposta de Sucesso:** `{ success: true, message: "Fatura paga com sucesso!", user: { ... } }`

### `POST /cards/invoice/parcel`
- **Descrição:** Parcela a fatura fechada.
- **Corpo da Requisição:** `{ cpf, amount, installments }`
- **Regras de Negócio:**
    - Juros de 10% ao mês (simples) são aplicados.
    - `totalWithInterest = amount * (1 + (0.10 * installments))`
    - O limite disponível é ajustado: `availableLimit += closedInvoice - totalWithInterest`.
    - Limpa a fatura fechada e lança as novas parcelas (`INVOICE_INSTALLMENT`) na fatura aberta com datas futuras.
    - Se o cartão estava bloqueado, desbloqueá-lo.
- **Resposta de Sucesso:** `{ success: true, message: "Fatura parcelada com sucesso!", user: { ... } }`

### `POST /cards/installments/anticipate`
- **Descrição:** Antecipa o pagamento de parcelas futuras com desconto.
- **Corpo da Requisição:** `{ cpf, transactionIds: [...] }`
- **Regras de Negócio:**
    - Um desconto de 5% é aplicado sobre o valor total das parcelas selecionadas.
    - O valor final com desconto é debitado do saldo em conta.
    - As parcelas antecipadas são removidas da fatura do cartão.
- **Resposta de Sucesso:** `{ success: true, message: "Parcelas antecipadas com um desconto de X!", user: { ... } }`

## 5. Shop (Marketplace)

### `POST /shop/purchase-debit`
- **Descrição:** Realiza uma compra usando o saldo em conta.
- **Corpo da Requisição:** `{ cpf, items: [...], cashbackUsed }`
- **Regras de Negócio:**
    - Validar se o saldo é suficiente para `totalAmount - cashbackUsed`.
    - Debitar o valor final do saldo.
    - Debitar os pontos de cashback utilizados.
- **Resposta de Sucesso:** `{ success: true, message: "Compra no débito realizada com sucesso!", user: { ... } }`

### `POST /shop/purchase-credit`
- **Descrição:** Realiza uma compra usando o cartão de crédito.
- **Corpo da Requisição:** `{ cpf, items: [...], cashbackUsed, installments }`
- **Regras de Negócio:**
    - Validar se o cartão não está bloqueado e se há limite suficiente.
    - **Pontos:** Calcular e adicionar pontos ganhos (`Math.floor(finalAmount / 10)`).
    - **Parcelamento:**
        - Se `installments === 1`, lança o valor total na fatura atual.
        - Se `installments > 1`, aplica juros de 1% ao mês (simples) após a primeira parcela. Lança as parcelas na fatura com datas futuras.
- **Resposta de Sucesso:** `{ success: true, message: "Compra no crédito realizada com sucesso!", user: { ... } }`

## 6. Admin

Todos os endpoints de admin devem ser protegidos e só acessíveis por usuários com `role: 'admin'`.

### `GET /admin/users/:cpf`
- **Descrição:** Busca os dados completos de um usuário.
- **Resposta:** `{ success: true, user: { ... } }`

### `POST /admin/users/:cpf/block` e `POST /admin/users/:cpf/unblock`
- **Descrição:** Bloqueia ou desbloqueia a conta de um usuário.
- **Resposta:** `{ success: true, message: "...", user: { ... } }`

### `POST /admin/users/:cpf/deposit`
- **Descrição:** Realiza um depósito na conta de um usuário.
- **Corpo da Requisição:** `{ amount }`
- **Resposta:** `{ success: true, message: "Depósito realizado com sucesso.", user: { ... } }`

### `PUT /admin/users/:cpf/card-details`
- **Descrição:** Atualiza as datas de vencimento do cartão e da fatura do cliente.
- **Corpo da Requisição:** `{ dueDate, invoiceDueDate }`
- **Regras de Negócio:**
    - Ao alterar `invoiceDueDate` de uma fatura fechada para o passado, o sistema deve reavaliar o status do cartão.
    - Se a nova data for mais de 7 dias no passado, o cartão deve ser bloqueado (`isBlocked = true`).
- **Resposta:** `{ success: true, message: "Detalhes do cartão do cliente foram atualizados.", user: { ... } }`

### `GET /admin/requests/password` e `GET /admin/requests/limit`
- **Descrição:** Retornam as listas de solicitações pendentes.

### `POST /admin/requests/password/:cpf/approve` e `POST /admin/requests/password/:cpf/deny`
- **Descrição:** Aprovam ou negam uma solicitação de redefinição de senha.

### `POST /admin/requests/limit/:cpf/approve` e `POST /admin/requests/limit/:cpf/deny`
- **Descrição:** Aprovam ou negam uma solicitação de aumento de limite.
