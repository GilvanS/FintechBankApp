# Fintech Bank App

## Descrição do Projeto

Fintech Bank é uma aplicação bancária moderna e segura, projetada para web e dispositivos móveis. Este projeto simula um ambiente de banco digital completo, permitindo que os usuários gerenciem suas contas, realizem transferências PIX, explorem um marketplace integrado, gerenciem cartões de crédito e muito mais. A aplicação também inclui um painel administrativo robusto para gerenciamento de clientes e solicitações.

O frontend é construído com React e TypeScript, utilizando Tailwind CSS para uma estilização moderna e responsiva. As funcionalidades de backend são simuladas através de uma API mockada que utiliza o `localStorage` do navegador para persistência de dados.

## Funcionalidades Principais

### 1. Autenticação e Segurança
- **Fluxo de Login e Cadastro:** Telas seguras para acesso e criação de novas contas.
- **Recuperação de Senha:** Um fluxo de recuperação de senha que requer aprovação administrativa. Após a aprovação, o usuário utiliza os 4 últimos dígitos do CPF como token para criar uma nova senha.
- **Confirmação por PIN:** Todas as transações sensíveis (PIX, compras, pagamentos) exigem um PIN para autorização.
- **Perfil de Administrador:** Acesso a um painel de controle especial para gerenciamento do sistema.

### 2. Dashboard Principal (Tela de Início)
- **Visão Geral Financeira:** Layout otimizado com o saldo em conta em destaque e um card consolidado para a "Fatura do Cartão", que integra o valor da fatura atual e o limite disponível. A visibilidade dos valores pode ser alternada para maior privacidade.
- **Acesso Rápido:** Botões de acesso rápido para as principais funcionalidades (PIX, Shop, Cartões, Pagar Contas, Extrato) localizados em uma posição de destaque.
- **Conteúdo Dinâmico:** A tela inicial apresenta um carrossel de banners que se alterna entre notícias, ofertas da loja e outras novidades, mantendo o usuário engajado.

### 3. Área PIX
- **Interface Completa:** Uma central de operações PIX com layout responsivo.
- **Fluxo de Transferência Seguro:** O processo inclui uma tela de confirmação que exibe os dados do destinatário (nome e CPF mascarado) antes da solicitação do PIN, garantindo que o usuário valide a transação.
- **Gerenciamento:** Telas para gerenciar chaves PIX e contatos salvos. A seleção de um contato salvo preenche automaticamente a chave PIX no formulário de transferência.
- **PIX no Crédito:** Opção de realizar transferências PIX utilizando o limite do cartão de crédito.

### 4. Marketplace (Shop) e Carrinho de Compras
- **Vitrine de Produtos:** Uma loja completa com banners promocionais, categorias e uma grade de produtos em destaque.
- **Fluxo de Compra Flexível:**
  - **Adicionar ao Carrinho:** Permite continuar navegando.
  - **Comprar Agora:** Adiciona o item e leva o usuário diretamente para o carrinho para finalizar a compra.
- **Carrinho de Comas:** Funcionalidade completa para adicionar produtos, ajustar quantidades e remover itens.
- **Fluxo de Checkout Completo:**
  - **Múltiplos Métodos de Pagamento:** Escolha entre débito (saldo em conta) e cartão de crédito.
  - **Uso de Cashback:** Opção de abater o valor da compra com o saldo de pontos no modal de parcelamento.
  - **Parcelamento:** Opção de parcelar compras no cartão de crédito.
- **Confirmação de Pedido:** Após a confirmação com PIN, uma tela de sucesso exibe o comprovante da transação e, após alguns segundos, redireciona o usuário automaticamente para a tela de Início.

### 5. Gerenciamento de Cartão de Crédito
- **Painel do Cartão Detalhado:** Uma tela dedicada para visualizar a fatura aberta, fechada, limite disponível e saldo de pontos (`Fintech Loop`).
- **Visualização de Faturas:**
    - **Fatura Atual:** Acesso a uma tela com o detalhamento de todos os lançamentos do ciclo atual.
    - **Lançamentos Futuros:** Uma aba dedicada ("Futuros") exibe as parcelas dos meses seguintes, proporcionando clareza no planejamento financeiro.
- **Regras de Inadimplência:** O sistema aplica automaticamente o status de "Fatura Atrasada" após 1 dia de vencimento e "Cartão Bloqueado" após 7 dias, com avisos claros na interface.
- **Ações da Fatura:** Opções completas para Pagar, Parcelar a fatura fechada ou Antecipar parcelas de compras para receber descontos.

### 6. Painel do Administrador
- **Gerenciamento de Usuários:** Ferramentas para buscar clientes, visualizar detalhes, bloquear/desbloquear contas e realizar depósitos manuais.
- **Fila de Solicitações:** Uma interface para aprovar ou negar solicitações de redefinição de senha e aumento de limite PIX.
- **Gerenciamento de Cartão do Cliente:** O administrador pode alterar a data de vencimento do cartão e da fatura de um cliente, com o sistema aplicando automaticamente as regras de bloqueio por inadimplência se a nova data estiver no passado.

### 7. Programa de Pontos (Fintech Loop)
- **Acúmulo e Resgate:** Uma seção onde o usuário pode ver seu saldo de pontos.
- **Histórico de Pontos:** A tela de "Ganhar Pontos" agora exibe um histórico das últimas compras com os pontos acumulados em cada transação, tornando o programa mais transparente.

### 8. APIs Externas
- **Notícias:** Integração com a API de Notícias do IBGE para manter o usuário informado com dados reais.

## Estrutura de Dados e API Mockada

Todo o backend da aplicação é simulado através de uma API mockada, permitindo um desenvolvimento de frontend ágil e independente.

- **`localStorage`:** Atua como o banco de dados da aplicação, armazenando todos os dados de usuários e estados em `localStorage.getItem('fintech_app_data')`.
- **`src/services/mockApi.ts`:** Este arquivo é o coração da simulação. Ele contém a lógica de negócios para todas as operações, como cálculos de juros, validações de saldo, regras de bloqueio de cartão, entre outros.
- **`src/data/mockData.ts`:** Contém os dados iniciais dos usuários, produtos da loja e stories, servindo como a base para os testes e a demonstração da aplicação.

**Nota para o Desenvolvimento do Backend:** Os dados mockados em `src/data/mockData.ts` e a lógica de negócios em `src/services/mockApi.ts` servem como um contrato e um guia paralelo detalhado para a implementação da API de backend, garantindo que o comportamento esperado pelo frontend seja atendido. O arquivo `swagger.md` na raiz do projeto detalha os endpoints e regras de negócio esperados.

## Design e UX

O aplicativo foi projetado com uma abordagem "mobile-first", mas é totalmente responsivo. A identidade visual utiliza um tema "dark mode" sofisticado, com uma paleta de cores "dark green" e detalhes em verde vibrante, proporcionando uma experiência de usuário moderna e agradável.
