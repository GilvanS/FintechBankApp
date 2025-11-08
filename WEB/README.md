# Fintech Bank App - Aplicação Completa

Este projeto simula uma aplicação bancária moderna e segura para uma Fintech, construída como um Single Page Application (SPA) utilizando React e TypeScript. Ele abrange desde a autenticação de usuários até funcionalidades complexas como transferências PIX, marketplace integrado, gerenciamento de cartões de crédito e um painel administrativo.

## Visão Geral do Design

O aplicativo adota uma **identidade visual moderna e sofisticada**, com um **tema escuro** predominante que utiliza tons de preto e cinza-escuro, acentuado por elementos de interface em verde e laranja vibrantes para ações e destaques. A tipografia é limpa e a organização dos componentes é focada na clareza e na facilidade de uso, com ícones intuitivos e feedback visual claro para o usuário.

## Funcionalidades Principais

### 1. Autenticação e Segurança
- **Login e Cadastro**: Fluxo completo de autenticação.
- **Recuperação de Senha**: Processo assistido por administrador.
- **PIN de Segurança**: Todas as transações sensíveis (compras, PIX, pagamentos) exigem a confirmação com um PIN de 4 dígitos (`9898`).
- **Painel Administrativo**: Acesso restrito para o usuário `admin`, permitindo o gerenciamento de clientes e a aprovação de solicitações.

### 2. Dashboard Principal (Tela de Início)
- **Visão Geral**: Apresenta um resumo da conta com saldo (com opção de ocultar), atalhos para as principais funcionalidades e informações da fatura do cartão.
- **Ações Rápidas**: Um carrossel horizontal e expansível oferece acesso rápido a todas as áreas do app.
- **Banners Dinâmicos**: A tela é enriquecida com banners que consomem **APIs públicas e gratuitas** em tempo real, como a **NewsAPI** e **The Guardian API**, para exibir as últimas notícias, tornando a experiência mais viva e demonstrando a capacidade de integração do sistema.

### 3. Área PIX
- **Transferências**: Envio de PIX para chaves salvas ou novas.
- **PIX no Crédito**: Opção de realizar uma transferência PIX parcelada no cartão de crédito.
- **Gestão de Chaves e Contatos**: Cadastro, exclusão e gerenciamento de chaves PIX e contatos favoritos.
- **Comprovantes**: Geração de comprovantes detalhados para cada transação.

### 4. Marketplace ("Shop")
- **Vitrine de Produtos**: Uma loja completa com banners, categorias e uma grade de produtos.
- **Página de Detalhes**: Cada produto possui uma página com descrição, preço, opções de parcelamento e simulador de frete.
- **Fluxo de Compra Completo**:
  - **Seleção de Método**: O usuário escolhe entre **Débito (Saldo em Conta)** ou **Cartão de Crédito**.
  - **Uso de Cashback**: Opção de abater o valor da compra com o saldo de pontos.
  - **Parcelamento (Crédito)**: Se a compra for no crédito, o usuário pode escolher o número de parcelas.
  - **Confirmação Segura**: A compra só é finalizada após a inserção do PIN de segurança.
  - **Registro Automático**: A transação é registrada no extrato da conta (débito) ou na fatura do cartão (crédito).

### 5. Gestão de Cartão de Crédito
- **Dashboard do Cartão**: Visualização da fatura aberta, limite disponível e últimos lançamentos.
- **Privacidade**: Opção de ocultar os valores da fatura e do limite.
- **Pagamento de Fatura**: Pague a fatura fechada usando o saldo em conta, com confirmação por PIN.
- **Parcelamento e Antecipação**: Funcionalidades para parcelar a fatura fechada ou antecipar o pagamento de compras parceladas.
- **Programa de Pontos ("Fintech Loop")**: Uma área para acompanhar o saldo de pontos e as opções de resgate.
- **Bloqueio Automático**: O cartão é bloqueado se a fatura estiver vencida há mais de 7 dias.

### 6. Painel do Administrador
- **Gerenciamento de Usuários**: Busca de clientes por CPF, visualização de dados, bloqueio e desbloqueio de contas.
- **Aprovação de Solicitações**: Fila para aprovar ou negar pedidos de redefinição de senha e aumento de limite PIX.
- **Depósito Administrativo**: Ferramenta para creditar valores na conta de um cliente.

## Tecnologias e Conceitos
- **Frontend**: React, TypeScript, Tailwind CSS.
- **Simulação de Backend**: Toda a lógica de negócio e persistência de dados é simulada no `localStorage` através do `services/mockApi.ts`, tornando o projeto totalmente funcional sem um servidor real.
- **Integração de APIs**: O aplicativo consome APIs de notícias em tempo real para enriquecer a interface.
- **Design Responsivo**: Layout adaptado para uma visualização otimizada em formato de smartphone.
