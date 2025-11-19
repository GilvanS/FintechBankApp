# Análise de Fluxo de UI e Navegação

Este documento mapeia a estrutura de navegação e as interações esperadas para o aplicativo bancário, com base nos wireframes/telas analisados.

## 1. Menu Inferior (Bottom Navigation)
Este é o principal meio de navegação do aplicativo.

### 🏠 Início (Home)
*   **Destino**: Dashboard principal.
*   **Função**: Visão geral de saldo, fatura do cartão e atalhos rápidos.

### 💳 Cartões
*   **Destino**: Tela de Gestão de Cartões.
*   **Funcionalidades Esperadas**:
    *   Visualização de cartão físico e virtual (carrossel).
    *   Bloqueio/Desbloqueio temporário.
    *   Configuração de pagamento por aproximação (NFC).
    *   Visualização de senha e dados do cartão.
    *   Geração de novo cartão virtual.

### 🏪 Shop (Loja)
*   **Destino**: Marketplace interno.
*   **Funcionalidades Esperadas**:
    *   Compra de Gift Cards (Uber, iFood, Spotify, etc.).
    *   Recarga de celular.
    *   Shopping com parceiros (Cashback).

### 🔲 Produtos (Investimentos/Serviços)
*   **Destino**: Hub de contratação de serviços financeiros.
*   **Funcionalidades Esperadas**:
    *   **Investimentos**: CDB, Tesouro, Fundos, Cripto.
    *   **Seguros**: Vida, Celular, Auto.
    *   **Empréstimos**: Simulação e contratação.

### 👤 Perfil
*   **Destino**: Configurações da Conta e do Usuário.
*   **Funcionalidades Esperadas**:
    *   Dados cadastrais (E-mail, Telefone, Endereço).
    *   Gerenciamento de Chaves Pix.
    *   Segurança (Biometria, Senha do App, Dispositivos conectados).
    *   Informe de Rendimentos.
    *   **Logout/Sair**.

---

## 2. Acesso Rápido (Dashboard)
Botões de ação rápida localizados na tela inicial.

### 💠 PIX
*   **Destino**: Área Pix.
*   **Fluxo**:
    *   Pagar (Ler QR Code, Pix Copia e Cola).
    *   Transferir (CPF/CNPJ, Chave Aleatória, Agência/Conta).
    *   Receber (Gerar QR Code de cobrança).

### 🛍️ Shop
*   **Destino**: Mesmo destino do menu inferior "Shop".
*   **Objetivo**: Atalho para aumentar o engajamento com o marketplace.

### 📄 Cart... (Pagar/Carteira)
*   **Cenário A (Pagar)**: Abre leitor de código de barras para boletos.
*   **Cenário B (Carteira)**: Gerenciamento de carteiras digitais (Google/Apple Pay).

---

## 3. Card de Cartão de Crédito
Interações no widget de cartão na Home.

### Botão "Ver fatura e limite"
*   **Destino**: Detalhe da Fatura.
*   **Funcionalidades Esperadas**:
    *   Linha do tempo de compras (extrato da fatura).
    *   **Pagar Fatura**: Opções de pagar com saldo da conta ou gerar boleto.
    *   **Ajustar Limite**: Slider para gerenciar o limite disponível.
