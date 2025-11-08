# Fintech Bank App

## 📜 Visão Geral do Projeto

O **Fintech Bank App** é uma aplicação bancária moderna, segura e completa, projetada para oferecer uma experiência de usuário intuitiva e poderosa. Construído com as tecnologias mais recentes, o aplicativo simula um ambiente de banco digital completo, permitindo que os usuários gerenciem suas finanças, realizem transferências, controlem seus cartões de crédito e explorem um marketplace integrado.

Este projeto utiliza uma API mockada robusta, persistindo os dados no `localStorage` do navegador para simular um backend real e garantir uma experiência contínua entre as sessões.

---

## ✨ Funcionalidades Implementadas

###  Authentication & Security
- **Fluxo de Login Completo**: Autenticação segura por CPF e senha.
- **Cadastro de Novos Usuários**: Um formulário simples e intuitivo para criar novas contas.
- **Recuperação de Senha**: Um fluxo de múltiplos passos que inclui solicitação, aprovação via painel administrativo e redefinição de senha pelo usuário.
- **Painel de Administração (`/admin`)**: Uma área restrita para administradores com funcionalidades para:
    - Buscar usuários por CPF.
    - Bloquear e desbloquear contas de clientes.
    - Realizar depósitos administrativos.
    - Aprovar ou negar solicitações de redefinição de senha e aumento de limite PIX.
- **Funções de Usuário**: Distinção clara entre perfis de `usuário` e `administrador`.

### 💳 Gestão de Cartão de Crédito
- **Dashboard de Cartões**: Uma tela centralizada para gerenciar todas as informações do cartão.
- **Cartão Virtual Interativo**: Representação visual do cartão com opção de personalização de cores (Laranja, Preto, Vermelho).
- **Gestão de Fatura**:
    - Visualização clara da **fatura aberta** e do **limite disponível**.
    - Acesso ao extrato detalhado da **fatura fechada**.
- **Bloqueio Automático**: O cartão é visualmente marcado como **"Bloqueado"** se a fatura estiver com mais de 7 dias de atraso.
- **Programa de Pontos ("Fintech Loop")**:
    - Consulta de saldo de pontos.
    - Abas para "Ganhar Pontos" e "Resgatar", com opções de cashback e transferência.
- **Antecipação de Parcelas**: Funcionalidade que permite ao usuário quitar parcelas futuras com desconto (o valor com desconto é adicionado à fatura aberta).

### 🛒 Marketplace & Fluxo de Compra (Shop)
- **Vitrine de Produtos**: Uma home de shopping completa com:
    - Carrossel de banners promocionais.
    - Grade de produtos de diversas categorias (Celulares, TVs, Notebooks, Smartwatches).
    - Filtros de ordenação ("Mais vendidos").
- **Página de Detalhes do Produto**: Visualização completa de um item, com imagem, preço, opções de parcelamento e simulador de frete.
- **Fluxo de Compra Interativo**:
    - **Uso de Cashback**: Permite abater o valor da compra utilizando o saldo de pontos.
    - **Seleção de Parcelas**: Um modal interativo onde o usuário escolhe o número de parcelas, com cálculo de juros e valor final exibido em tempo real.
- **Confirmação de Compra**: Uma tela de sucesso é exibida após a compra, com um comprovante detalhado da transação (valor, parcelas, ID).
- **Integração com Fatura**: A compra é automaticamente lançada na fatura aberta do cartão de crédito, com a descrição da parcela (ex: "Parcela 1/10").

### 💸 PIX e Transferências
- **Área PIX Dedicada**: Um hub central para todas as operações PIX.
- **Transferência PIX**: Envio de dinheiro via chave PIX, com verificação de saldo e limite diário.
- **PIX Parcelado (PIX no Crédito)**:
    - Permite realizar uma transferência PIX e lançar o valor em parcelas na fatura do cartão de crédito.
    - Inclui uma tela de resumo detalhada antes da confirmação, exibindo as condições do parcelamento.
- **Gestão de Chaves e Contatos**:
    - Cadastro e exclusão de chaves PIX (CPF, E-mail).
    - Adição e remoção de contatos favoritos para agilizar transferências.
- **Comprovante PIX**: Geração de um recibo detalhado após cada transferência bem-sucedida.

### 🏠 Dashboard Principal e Experiência do Usuário
- **Visão Geral da Conta**: Exibe o saldo com um botão para ocultar/mostrar o valor.
- **Navegação Intuitiva**: Uma barra de navegação inferior fixa com acesso rápido às principais áreas: Início, Cartões, Shop, Investir e Perfil.
- **Ações Rápidas**: Um carrossel expansível com atalhos para as funcionalidades mais usadas.
- **Banners Dinâmicos**: O aplicativo busca notícias reais de APIs públicas (IBGE, NewsAPI) para exibir banners informativos e stories, criando uma experiência mais rica.
- **"Meu Perfil"**: Uma área completa para o usuário, com:
    - Acompanhamento do status de compras (`A pagar`, `Preparando`, `A caminho`).
    - Carrossel "Comprar novamente" com itens de compras anteriores.
    - Acesso rápido a "Meus Dados", "Segurança" e "Ajustes".

###  yatırım (Investments)
- **Área de Investimentos**: Uma seção dedicada para produtos de investimento.
- **Visão Geral**: Mostra o total investido pelo usuário.
- **Produtos de Renda Fixa**: Exibe uma lista de produtos mockados, como CDBs e LCIs, com detalhes sobre rendimento e liquidez.

---

## 💻 Tecnologias Utilizadas

- **Frontend**:
  - **React**: Biblioteca principal para a construção da interface de usuário.
  - **TypeScript**: Para tipagem estática e um código mais robusto e seguro.
  - **Tailwind CSS**: Para estilização rápida e moderna, seguindo uma abordagem utility-first.
- **Backend (Simulado)**:
  - **`localStorage`**: Utilizado como um banco de dados mock para persistir os dados do usuário, transações e outras informações, garantindo a continuidade da sessão.
- **Estrutura do Servidor (Modelo)**:
  - **Node.js & Express**: Uma estrutura básica de servidor foi incluída (`/server`) como um modelo para uma futura implementação de backend real.
  - **Swagger (YAML)**: Documentação da API para guiar o desenvolvimento do backend.

---

## 🚀 Como Executar

Este aplicativo foi projetado para rodar em um ambiente de desenvolvimento sandboxed. Não há necessidade de instalar dependências ou configurar um servidor local.

1.  Abra o arquivo `index.html` em um navegador web moderno.
2.  O script `index.tsx` será carregado automaticamente.
3.  Interaja com o aplicativo. Os dados serão salvos no `localStorage` do seu navegador.

**Credenciais de Teste:**
- **Administrador**:
  - **CPF**: `111.222.333-44`
  - **Senha**: `password123`
- **Usuário Comum 1**:
  - **CPF**: `999.999.999-99`
  - **Senha**: `pwd999`
- **Usuário Comum 2**:
  - **CPF**: `222.222.222-22`
  - **Senha**: `password`
