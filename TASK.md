
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

---

### **Fase 3: Análise e Planejamento da Sincronização de Telas (Home e Telas Filhas)**

O objetivo desta fase é garantir que a experiência do usuário na aplicação `MOBILE` seja idêntica à da `WEB`, começando pela tela `Home`.

-   [ ] **Tarefa 3.1: Análise da Lógica de Negócios da Tela Home (WEB)**
    -   Analisar o fluxo de dados e os componentes da tela `Home` na aplicação `WEB`.
    -   Mapear todas as chamadas de API feitas a partir da `Home`.
    -   Entender como o estado é gerenciado (ex: `Context API`, `Redux`).

-   [ ] **Tarefa 3.2: Análise da Estrutura HTML e CSS da Tela Home (WEB)**
    -   Documentar a estrutura dos componentes React (`JSX`).
    -   Analisar os estilos (`CSS`, `Styled-Components`) para garantir a replicação visual.

-   [ ] **Tarefa 3.3: Comparativo e Mapeamento de Divergências (WEB vs. MOBILE)**
    -   Comparar a implementação da `Home` no `MOBILE` com a análise da `WEB`.
    -   Listar todas as diferenças de lógica, componentes e estilos.
    -   Identificar componentes/lógicas ausentes ou desatualizados no `MOBILE`.

-   [ ] **Tarefa 3.4: Análise da Sincronia de API (WEB vs. MOBILE)**
    -   Verificar se o `MOBILE` está consumindo os mesmos `endpoints` de API que o `WEB`.
    -   Analisar se os dados retornados pela API estão sendo tratados da mesma forma.
    -   Garantir que a manipulação de erros e estados de `loading` seja consistente.

-   [ ] **Tarefa 3.5: Planejamento de Implementação das Correções (MOBILE)**
    -   Criar uma lista de subtarefas para cada divergência encontrada.
        -   **Exemplo:** "Refatorar o componente `Header` no `MOBILE` para incluir o `Saldo`."
        -   **Exemplo:** "Corrigir a chamada da API de `Extrato` para usar o `endpoint /v2/statement`."
        -   **Exemplo:** "Aplicar os estilos do `Card de Crédito` do `WEB` no `MOBILE`."
    -   Priorizar as tarefas com base na complexidade e no impacto na experiência do usuário.

-   [ ] **Tarefa 3.6: Validação Funcional e Visual**
    -   Executar ambas as aplicações (WEB e MOBILE) lado a lado.
    -   Validar se o fluxo de navegação a partir da `Home` é o mesmo.
    -   Garantir que a interface do `MOBILE` seja um espelho da `WEB`.
