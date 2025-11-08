full contents of FRONT_I.md# Documentação do Frontend - Fintech Bank App

## 1. Visão Geral da Arquitetura

A aplicação é um **Single Page Application (SPA)** construído com **React** e **TypeScript**. A estrutura é componentizada, visando a reutilização e a manutenibilidade do código.

- **`App.tsx`**: É o componente raiz. Ele gerencia o estado de autenticação global através de um `AuthContext` e controla a navegação entre as telas principais: pré-login, login, cadastro e o dashboard do usuário logado.
- **`Dashboard.tsx`**: Após o login, este componente se torna o "cérebro" da aplicação. Ele gerencia a navegação interna entre todas as funcionalidades (PIX, Cartões, Shop, etc.) e controla a exibição de modais e telas de fluxo, como o processo de compra e a confirmação por senha.
- **`services/mockApi.ts`**: Simula todas as chamadas de backend. Ele utiliza o `localStorage` do navegador para persistir os dados, permitindo que a aplicação funcione de forma independente.
- **`components/`**: Diretório que contém todos os componentes reutilizáveis e as telas da aplicação.
- **`types.ts`**: Define todas as interfaces e tipos de dados (User, Transaction, etc.), garantindo a segurança de tipos em todo o projeto.
- **Estilização**: Realizada com **Tailwind CSS** para um desenvolvimento ágil e um design consistente.

## 2. Fluxos e Telas Principais

### 2.1. Experiência Pré-Login
- **`PreLoginDashboard.tsx`**: A tela de entrada inicial. Apresenta a marca e um botão para acessar a tela de login.
- **Banner de Notícias Dinâmico**: Nesta tela, o componente **`PreLoginNewsBanner.tsx`** consome a **NewsAPI** em tempo real para exibir um carrossel com as últimas manchetes, demonstrando a capacidade de integração do app.
- **`Login.tsx`**: Formulário de login com campos para CPF e senha. Inclui navegação para cadastro e recuperação de senha (ainda em desenvolvimento).
- **`SignUp.tsx`**: Formulário para criação de novas contas.

### 2.2. Dashboard Principal (Pós-Login)
A navegação principal é controlada pelo **`BottomNavBar.tsx`**, que contém 5 abas:

#### a. Início (`home`)
É a tela principal, composta por vários widgets:
- **`Header.tsx`**: Saudação ao usuário e atalhos.
- **`AccountBalance.tsx`**: Exibe o saldo em conta com um botão para ocultar/mostrar o valor.
- **`MainActions.tsx`**: Um carrossel horizontal expansível com atalhos para todas as principais funcionalidades do app.
- **`CreditCardInfo.tsx`**: Um resumo da fatura atual do cartão de crédito.
- **Banners Dinâmicos**:
  - **`PromotionalBanner.tsx`**: Um carrossel que consome múltiplas APIs de notícias (IBGE, NewsAPI, WorldNewsAPI) para exibir manchetes com imagens.
  - **`GuardianBanner.tsx`**: Um banner similar que consome a API do jornal The Guardian.

#### b. Cartões (`cards`)
- **`CardDashboard.tsx`**: Tela principal para gerenciamento do cartão de crédito. Exibe a fatura aberta, o limite e os últimos lançamentos.
- **Fluxos Acessíveis**:
  - **`ClosedInvoice.tsx`**: Tela para visualizar a fatura fechada, com opções de **pagar** ou **parcelar**.
  - **`PointsDashboard.tsx`**: Tela do programa de pontos "Fintech Loop".
  - **`AnticipateInstallments.tsx`**: Área para antecipar o pagamento de compras parceladas.
- **Lógica de Bloqueio**: O cartão é visualmente marcado como bloqueado se a fatura estiver vencida há mais de 7 dias.

#### c. Shop (`shop`)
- **`Shop.tsx`**: Uma vitrine de marketplace com banners, categorias e uma grade de produtos.
- **`ProductPage.tsx`**: Página de detalhes de um produto, com descrição, preço e botão "Comprar".
- **Fluxo de Compra**:
  1. **`PaymentMethods.tsx`**: O usuário é direcionado para esta tela para escolher entre **Débito (Saldo em Conta)** ou **Cartão de Crédito**.
  2. **Débito**: Se escolhido, o fluxo segue para a confirmação com PIN.
  3. **Crédito**: Se escolhido, o **`InstallmentModal.tsx`** é aberto.
     - **Uso de Cashback**: O modal primeiro oferece a opção de usar o saldo de pontos para abater o valor. Se o valor for zerado, o fluxo segue para a confirmação com PIN.
     - **Seleção de Parcelas**: O usuário escolhe o número de parcelas.
  4. **`PasswordModal.tsx`**: Tela de segurança que solicita o PIN de 4 dígitos (`9898`) para autorizar a transação.
  5. **`PurchaseConfirmation.tsx`**: Tela de sucesso que exibe o comprovante da compra.

#### d. Investir (`invest`)
- **`Investments.tsx`**: Exibe o total investido e uma lista de produtos de investimento, como Renda Fixa.

#### e. Perfil (`profile`)
- **`Profile.tsx`**: Hub de navegação para todas as áreas relacionadas ao usuário.
- **Sub-telas**:
  - **`MyData.tsx`**: Exibe os dados do perfil do usuário.
  - **`EditProfile.tsx`**: Formulário para editar as informações do perfil.
  - **`Security.tsx`**: Menu de opções de segurança.
  - **`Limits.tsx`**: Tela para visualizar e solicitar alteração do limite diário do PIX.
  - **`Admin.tsx`**: Painel de administração (visível apenas para usuários com a role `admin`).
  - **`Notifications.tsx`**: Lista de notificações da conta.

## 3. Regras de Negócio do Frontend

- **Validação de Formulários**: Todos os formulários (login, cadastro, PIX) possuem validação de entrada para garantir que os dados estejam no formato correto.
- **Formatação de Dados**: Funções utilitárias em `utils/formatters.ts` são usadas para formatar valores como CPF e moeda.
- **Gerenciamento de Estado**: O estado global do usuário é gerenciado pelo `AuthContext`. A navegação e os estados de modais são controlados localmente no `Dashboard.tsx`, garantindo que apenas os componentes relevantes sejam re-renderizados.
- **Segurança**: A lógica para acionar o `PasswordModal.tsx` é centralizada no `Dashboard.tsx` e é chamada antes de qualquer operação que modifique dados financeiros sensíveis.
