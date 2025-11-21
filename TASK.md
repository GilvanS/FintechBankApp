
# Tarefas: Migração do Projeto WEB para MOBILE (Android)

Este documento detalha o planejamento e as etapas para transformar o projeto `WEB` em um aplicativo `MOBILE` para Android, incluindo a configuração para comunicação com um backend local via Wi-Fi.

## Fases do Projeto

---

### **Fase 1: Preparação do Ambiente e Duplicação do Projeto**

-   [x] **Tarefa 1.1:** Criar este documento de planejamento (`TASK.md`).
-   [x] **Tarefa 1.2:** Duplicar o diretório `WEB` para um novo diretório `MOBILE` para isolar o ambiente de desenvolvimento móvel.

**Possíveis Erros e Como Evitar:**
*   **Erro:** Alterações no projeto `MOBILE` afetarem o projeto `WEB`.
*   **Prevenção:** A duplicação do projeto garante que os ambientes sejam completamente separados. Não farei alterações diretas na pasta `WEB`.

---

### **Fase 2: Integração com o Capacitor**

O objetivo é "embrulhar" a aplicação web existente em um contêiner nativo Android.
-   [x] **Tarefa 2.1:** Instalar e configurar o Capacitor no projeto `MOBILE`.
-   [x] **Tarefa 2.2:** Adicionar a plataforma Android ao projeto.
-   [x] **Tarefa 2.3:** Realizar a primeira compilação e execução em um emulador ou dispositivo Android para garantir que a aplicação web é carregada.

---

### **Fase 3: Análise e Planejamento da Sincronização de Telas (Home e Telas Filhas)**

O objetivo desta fase é garantir que a experiência do usuário na aplicação `MOBILE` seja idêntica à da `WEB`, começando pela tela `Home`.

-    [x] **Tarefa 3.1: Análise da Lógica de Negócios da Tela Home (WEB)**
    -   Analisar o fluxo de dados e os componentes da tela `Home` na aplicação `WEB`.
    -   Mapear todas as chamadas de API feitas a partir da `Home`.
    -   Entender como o estado é gerenciado (ex: `Context API`, `Redux`).

-   [x] **Tarefa 3.2: Análise da Estrutura HTML e CSS da Tela Home (WEB)**
    -   Documentar a estrutura dos componentes React (`JSX`).
    -   Analisar os estilos (`CSS`, `Styled-Components`) para garantir a replicação visual.

-   [x] **Tarefa 3.3: Comparativo e Mapeamento de Divergências (WEB vs. MOBILE)**
    -   Comparar a implementação da `Home` no `MOBILE` com a análise da `WEB`.
    -   Listar todas as diferenças de lógica, componentes e estilos.
    -   Identificar componentes/lógicas ausentes ou desatualizados no `MOBILE`.

-   [x] **Tarefa 3.4: Análise da Sincronia de API (WEB vs. MOBILE)**
    -   Verificar se o `MOBILE` está consumindo os mesmos `endpoints` de API que o `WEB`.
    -   Analisar se os dados retornados pela API estão sendo tratados da mesma forma.
    -   Garantir que a manipulação de erros e estados de `loading` seja consistente.

-   [x] **Tarefa 3.5: Planejamento de Implementação das Correções (MOBILE)**
    -   Criar uma lista de subtarefas para cada divergência encontrada.
        -   **Exemplo:** "Refatorar o componente `Header` no `MOBILE` para incluir o `Saldo`."
        -   **Exemplo:** "Corrigir a chamada da API de `Extrato` para usar o `endpoint /v2/statement`."
        -   **Exemplo:** "Aplicar os estilos do `Card de Crédito` do `WEB` no `MOBILE`."
    -   Priorizar as tarefas com base na complexidade e no impacto na experiência do usuário.

-   [x] **Tarefa 3.6: Validação Funcional e Visual**
    -   Executar ambas as aplicações (WEB e MOBILE) lado a lado.
    -   Validar se o fluxo de navegação a partir da `Home` é o mesmo.
    -   Garantir que a interface do `MOBILE` seja um espelho da `WEB`.

---

### **Fase 4: Implementação do Fluxo de Compras no MOBILE**

O objetivo desta fase foi replicar a funcionalidade completa de compras, desde a seleção de um produto até a confirmação do pagamento, garantindo paridade com a aplicação `WEB`.

-   [x] **Tarefa 4.1: Análise do Fluxo de Compras (WEB)**
    -   Analisado o `Dashboard.tsx` da aplicação `WEB` para mapear todos os componentes, estados e chamadas de API envolvidos no processo de compra.
    -   Componentes analisados: `Shop`, `ShoppingCart`, `PaymentMethods`, `InstallmentModal`, `PasswordModal`, `BlockedCardModal` e `PurchaseConfirmation`.

-   [x] **Tarefa 4.2: Implementação do Carrinho de Compras (`ShoppingCart.tsx`)**
    -   Criado e implementado o componente `ShoppingCart` no `MOBILE`, responsável por listar os itens adicionados, permitir a alteração de quantidade e iniciar o checkout.

-   [x] **Tarefa 4.3: Implementação dos Métodos de Pagamento (`PaymentMethods.tsx`)**
    -   Replicado o componente `PaymentMethods` do `WEB` para o `MOBILE`, permitindo ao usuário escolher entre pagamento com débito ou crédito.

-   [x] **Tarefa 4.4: Implementação da Confirmação de Compra (`PurchaseConfirmation.tsx`)**
    -   Desenvolvido o componente `PurchaseConfirmation` no `MOBILE` para fornecer feedback visual ao usuário após uma compra bem-sucedida, com redirecionamento automático para a `Home`.

-   [x] **Tarefa 4.5: Implementação do Modal de Parcelamento (`InstallmentModal.tsx`)**
    -   Portado o `InstallmentModal` para o `MOBILE`, permitindo a seleção de número de parcelas e a utilização de cashback em compras no crédito.

-   [x] **Tarefa 4.6: Implementação dos Modais de Segurança (`PasswordModal.tsx` e `BlockedCardModal.tsx`)**
    -   Criados os componentes `PasswordModal` para autorização de transações com senha e `BlockedCardModal` para notificar o usuário sobre o bloqueio do cartão de crédito.

-   [x] **Tarefa 4.7: Integração da Lógica de Compra no `Home.tsx` (MOBILE)**
    -   Adaptada e integrada toda a lógica de gerenciamento de estado do fluxo de compra (do `Dashboard.tsx` do `WEB`) para o `Home.tsx` do `MOBILE`.
    -   Implementado o controle de visibilidade dos modais, o fluxo de autorização com senha e as chamadas às APIs `purchaseWithDebit` e `purchaseWithCard`.
