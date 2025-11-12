# Documentação Frontend - Fintech Bank (FRONT_I.md)

Este documento detalha a arquitetura, os componentes e as regras de negócio implementadas no frontend da aplicação Fintech Bank.

## 1. Tecnologias e Arquitetura

- **Framework:** React com TypeScript
- **Estilização:** Tailwind CSS para um design responsivo e moderno.
- **Estado Global:** O estado de autenticação e os dados do usuário logado são gerenciados através do `React Context API` (`AuthContext`), acessível em toda a aplicação pelo hook `useAuth`.
- **Estrutura de Componentes:** O aplicativo é dividido em componentes reutilizáveis, localizados em `src/components`. A navegação principal após o login é controlada pelo componente `Dashboard.tsx`, que funciona como um roteador de visualizações.

## 2. Fluxo de Navegação e Componentes

### 2.1. Experiência Pré-Login

- **`PreLoginDashboard.tsx`:** A tela de boas-vindas do aplicativo. Apresenta uma demonstração visual das funcionalidades e dois botões de ação principais: "Acessar minha conta" e "Abra uma conta".
- **`Login.tsx`:** A tela de login, onde o usuário insere CPF e senha. Inclui:
  - Validação de formulário.
  - Link para a tela de cadastro (`SignUp`).
  - Funcionalidade de "Esqueci minha senha", que inicia o fluxo de recuperação.
- **`SignUp.tsx`:** A tela de cadastro de novos usuários, com campos para nome completo, e-mail, CPF e senha.
- **`ResetPassword.tsx`:** Tela dedicada para a redefinição de senha, onde o usuário insere CPF, o token recebido (últimos 4 dígitos do CPF) e a nova senha.

### 2.2. Experiência Pós-Login (`Dashboard.tsx`)

O `Dashboard.tsx` é o coração da aplicação após o login. Ele controla a visualização do conteúdo principal e a renderização da barra de navegação.

- **`BottomNavBar.tsx` (Navegação Principal):** Uma barra de navegação fixa na parte inferior que permite alternar entre as seções principais: Início, Cartões, Shop, Produtos e Perfil.

- **`HomeView.tsx` (Tela de Início):** A tela principal do dashboard.
  - **Regra de Negócio:** Layout otimizado com o saldo em conta em destaque e um card consolidado para a "Fatura do Cartão", que integra o valor da fatura atual e o limite disponível. A visibilidade dos valores pode ser alternada para maior privacidade.
  - **Conteúdo:**
    - Card de "Saldo em conta" com opção de ocultar/exibir valor.
    - Seção de "Acesso Rápido" para as principais funcionalidades (PIX, Shop, Cartões, Pagar Contas, Extrato) localizada em uma posição de destaque.
    - Card consolidado da "Fatura do Cartão".
    - Conteúdo dinâmico com banners de ofertas da loja e seção de "Últimas Notícias".

- **`Pix.tsx` (Área PIX):**
  - **Regra de Negócio:** Centraliza todas as operações relacionadas ao PIX.
  - **Fluxo de Transferência Seguro:** O processo inclui uma tela de confirmação (`PixConfirmation.tsx`) que exibe os dados do destinatário (nome e CPF mascarado) antes da solicitação do PIN, garantindo que o usuário valide a transação.
  - **UX de Contatos Aprimorada:** O acesso aos contatos salvos é feito por um ícone intuitivo ao lado do campo de chave (visível apenas se houver contatos). Antes de adicionar um novo contato, um popup informativo (`InfoPopupBottom`) explica os benefícios da ação.
  - **Gerenciamento:** Telas para gerenciar chaves PIX (`PixKeyManagement`) e contatos salvos (`Contacts`).

- **`Shop.tsx` (Marketplace) e Carrinho de Compras:**
  - **Regra de Negócio:** Uma loja completa com vitrine de produtos, carrinho de compras e fluxo de checkout.
  - **Fluxo de Compra:**
    - **Adicionar ao Carrinho:** Permite continuar navegando.
    - **Comprar Agora:** Adiciona o item e leva o usuário diretamente para o carrinho (`ShoppingCart.tsx`).
  - **Fluxo de Checkout Completo:**
    - **Pagamento:** Escolha entre débito (`purchaseWithDebit`) e crédito (`purchaseWithCard`), com opção de parcelamento e uso de cashback (`InstallmentModal.tsx`).
    - **Confirmação:** Após a confirmação com PIN (`PasswordModal.tsx`), uma tela de sucesso (`PurchaseConfirmation.tsx`) exibe o comprovante e redireciona o usuário automaticamente para a tela de Início após 4 segundos.

- **`CardDashboard.tsx` (Gerenciamento de Cartão de Crédito):**
  - **Regra de Negócio:** Oferece uma visão completa do cartão de crédito.
  - **Visualização de Faturas:**
      - **Fatura Atual:** O card é clicável e leva a uma tela de detalhamento (`CurrentInvoice.tsx`) com todos os lançamentos do ciclo atual.
      - **Lançamentos Futuros:** Uma aba dedicada ("Futuros") exibe as parcelas dos meses seguintes, proporcionando clareza no planejamento financeiro.
  - **Regras de Inadimplência:** O sistema aplica automaticamente o status de "Fatura Atrasada" e "Cartão Bloqueado" com avisos claros. O modal de bloqueio agora possui um botão "Voltar" para evitar loops de navegação.
  - **Ações da Fatura:** Opções completas para Pagar, Parcelar a fatura fechada (`InstallmentOptions.tsx`) ou Antecipar parcelas (`AnticipateInstallments.tsx`).

- **`Admin.tsx` (Painel do Administrador):**
  - **Regra de Negócio:** Acessível apenas por usuários com `role: 'admin'`.
  - **Conteúdo:**
    - Ferramentas para buscar clientes, visualizar detalhes, bloquear/desbloquear contas e realizar depósitos.
    - Fila para aprovar/negar solicitações de redefinição de senha e aumento de limite.
    - **Gerenciamento de Cartão do Cliente:** Permite ao administrador alterar a data de vencimento do cartão e da fatura de um cliente. O sistema aplica automaticamente as regras de bloqueio se a nova data de vencimento da fatura estiver mais de 7 dias no passado.

- **`PointsDashboard.tsx` (Programa de Pontos - Fintech Loop):**
  - **Regra de Negócio:** Centraliza as informações do programa de recompensas.
  - **Conteúdo:** Exibe o saldo de pontos e oferece abas para "Ganhar Pontos" e "Resgatar".
  - **Histórico de Pontos:** A aba "Ganhar Pontos" agora exibe um histórico das últimas compras com os pontos acumulados em cada transação, tornando o programa mais transparente.

## 3. Integração com APIs Externas

- **API de Notícias (IBGE):** Utilizada no `NewsSection.tsx` para buscar e exibir notícias sobre economia na tela inicial.
- **Regra de Negócio:** A chamada é feita diretamente do frontend. A recomendação é que essa chamada seja intermediada por um endpoint de backend (proxy) para proteger futuras chaves de API e implementar caching.
