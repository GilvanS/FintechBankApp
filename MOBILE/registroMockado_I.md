# Registro de Mocks e APIs - Fintech Bank (registroMockado_I.md)

Este documento serve como um catálogo de todas as funcionalidades, dados e chamadas de API que estão atualmente "mockados" (simulados) no frontend do projeto Fintech Bank. O objetivo é fornecer um guia claro para a equipe de backend sobre o que precisa ser substituído por uma implementação real.

## 1. Simulação de Banco de Dados (`localStorage`)

- **Localização:** `src/services/mockApi.ts`
- **Descrição:** Toda a "base de dados" da aplicação (usuários, solicitações, notificações) é armazenada em uma única chave no `localStorage` do navegador (`fintech_app_data`).
- **Motivo do Mock:** Para permitir o desenvolvimento e teste do frontend de forma independente.
- **Substituição Futura:** Todas as funções que leem ou escrevem no `localStorage` (`_getStore`, `_saveStore`) serão substituídas por chamadas HTTP para a API do backend.

## 2. Usuários de Teste

- **Localização:** `src/data/mockData.ts` (`MOCK_USERS`)
- **Descrição:** O projeto inclui um conjunto de usuários de teste pré-definidos com dados completos. A função `initializeMockUsers` em `mockApi.ts` garante que esses usuários estejam sempre presentes no `localStorage`.
- **Substituição Futura:** Em um ambiente de produção, a base de dados será populada por usuários reais através do fluxo de cadastro.

## 3. Funções de API Simuladas (`mockApi.ts`)

O arquivo `src/services/mockApi.ts` simula todo o comportamento do backend. Cada função exportada representa um endpoint que precisará ser criado no servidor.

### 3.1. Autenticação
- `login`, `signUp`, `requestNewPassword`, `resetPassword`
- **Descrição:** Simulam o registro, login e o fluxo completo de recuperação de senha.
- **Substituição Futura:** Substituir por chamadas a endpoints `POST /auth/...`.

### 3.2. Operações PIX
- `getPixRecipientInfo`
  - **Descrição:** Simula a validação de uma chave PIX, retornando o nome e o CPF mascarado do destinatário. Implementa a regra de não permitir auto-transferência.
- `performPix`, `performPixCreditInstallment`
  - **Descrição:** Simulam transferências PIX. A função `performPixCreditInstallment` agora atribui **datas futuras corretas** para cada parcela na fatura do cartão, uma regra de negócio crucial.
- `getPixContacts`, `addPixContact`, `deletePixContact`, `getPixKeys`, `registerPixKey`, `deletePixKey`
  - **Descrição:** Simulam o gerenciamento de chaves e contatos.
- `updateUserPixDailyLimit`, `requestLimitIncrease`
  - **Descrição:** Simulam a alteração do limite PIX e a solicitação de aumento.
- **Substituição Futura:** Substituir por chamadas a endpoints `/pix/...`.

### 3.3. Compras e Marketplace
- `purchaseWithDebit`, `purchaseWithCard`
- **Descrição:** Simulam o fluxo de compra. A função `purchaseWithCard` foi atualizada para:
  - Salvar `purchaseDate` e `pointsEarned` em cada item comprado.
  - Atribuir **datas futuras corretas** para cada parcela na fatura do cartão.
- **Substituição Futura:** Substituir por uma chamada a um endpoint `POST /shop/checkout`.

### 3.4. Gerenciamento de Cartão
- `payCreditCardInvoice`, `parcelCreditCardInvoice`, `anticipateCreditCardInstallments`
- **Descrição:** Simulam as operações da fatura do cartão. A função `parcelCreditCardInvoice` foi atualizada para atribuir **datas futuras corretas** para cada nova parcela da fatura.
- **Substituição Futura:** Substituir por chamadas a endpoints `/cards/...`.

### 3.5. Funções Administrativas
- `adminGetUserByCpf`, `blockUser`, `unblockUser`, `adminDeposit`, `adminGetPasswordRequests`, `adminApprovePasswordRequest`, etc.
- **Descrição:** Simulam todas as ações disponíveis no Painel do Administrador.
- `adminUpdateCardDetails`
  - **Descrição:** Simula a alteração das datas de vencimento do cartão e da fatura pelo admin.
  - **Regra de Negócio Crucial:** Contém a lógica que bloqueia o cartão do cliente automaticamente se a nova data de vencimento da fatura for mais de 7 dias no passado.
- **Substituição Futura:** Substituir por chamadas a endpoints `/admin/...`.

## 4. Chamadas de API Reais no Frontend

Existem chamadas de API que são feitas diretamente do frontend para serviços de terceiros. A recomendação é movê-las para o backend para proteger chaves de API e implementar caching.

- **API de Notícias (IBGE):**
  - **Localização:** `src/components/NewsSection.tsx`
  - **Descrição:** Busca notícias de economia diretamente da API pública do IBGE.
  - **Recomendação de Migração:** Criar um endpoint `GET /proxy/news` no backend.
