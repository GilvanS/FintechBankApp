
# Tarefas: Migração do Projeto WEB para MOBILE (Android)

Este documento detalha o planejamento e as etapas para transformar o projeto `WEB` em um aplicativo `MOBILE` para Android, incluindo a configuração para comunicação com um backend local via Wi-Fi.

## Fases do Projeto

---

### **Fase 1: Preparação do Ambiente e Duplicação do Projeto**

-   [x] **Tarefa 1.1:** Criar este documento de planejamento (`TASK.md`).
-   [x] **Tarefa 1.2:** Duplicar o diretório `WEB` para um novo diretório `MOBILE` para isolar o ambiente de desenvolvimento móvel.

---

### **Fase 2: Integração com o Capacitor**

-   [x] **Tarefa 2.1:** Instalar e configurar o Capacitor no projeto `MOBILE`.
-   [x] **Tarefa 2.2:** Adicionar a plataforma Android ao projeto.
-   [x] **Tarefa 2.3:** Realizar a primeira compilação para garantir que a aplicação web é carregada.

---

### **Fase 3: Sincronização da Tela Home**

-    [x] **Tarefa 3.1: Análise e Mapeamento de Divergências (WEB vs. MOBILE)**
-   [x] **Tarefa 3.2: Planejamento e Implementação das Correções (MOBILE)**
-   [x] **Tarefa 3.3: Validação Funcional e Visual**

---

### **Fase 4: Implementação do Fluxo de Compras no MOBILE**

-   [x] **Tarefa 4.1: Análise do Fluxo de Compras (WEB)**
-   [x] **Tarefa 4.2: Implementação dos Componentes de UI (`ShoppingCart`, `PaymentMethods`, etc.)**
-   [x] **Tarefa 4.3: Implementação dos Modais (`InstallmentModal`, `PasswordModal`, etc.)**
-   [x] **Tarefa 4.4: Integração da Lógica de Compra no `Home.tsx`**
-   [x] **Tarefa 4.5: Validação do Fluxo de Compra de Ponta a Ponta**

---

### **Fase 5: Sincronização das Telas Restantes**

-   [x] **Tarefa 5.1: Análise e Sincronização da Tela PIX**
-   [x] **Tarefa 5.2: Análise e Sincronização da Tela de Cartões**
-   [x] **Tarefa 5.3: Análise e Sincronização da Tela de Extrato**
-   [x] **Tarefa 5.4: Análise e Sincronização da Tela de Perfil**
-   [x] **Tarefa 5.5: Validação Funcional e Visual Final**

---

### **Fase 6: Configuração Final e Compilação para Android**

-   [x] **Tarefa 6.1: Configurar a Comunicação com o Backend**
-   [x] **Tarefa 6.2: Sincronizar o Projeto com o Capacitor**
-   [x] **Tarefa 6.3: Compilar e Gerar o APK de Debug via Gradle**
-   [x] **Tarefa 6.4: Documentação Final e Encerramento**

---

### **Fase 7: Correção de Bug Pós-Login (MOBILE)**

-   [x] **Tarefa 7.1:** Análise e Documentação do Bug
-   [x] **Tarefa 7.2:** Implementação da Correção
-   [x] **Tarefa 7.3:** Validação da Correção e Encerramento

---

### **Fase 8: Ajustes Finais e Melhorias de UX (MOBILE)**

-   [x] **Tarefa 8.1: Análise e Correção de Divergências Visuais**
    -   **Problema:** As cores da tela `Home` no `MOBILE` estão diferentes da versão `WEB`, notavelmente a cor de fundo que é branca em vez de azul-escura.
    -   **Análise:** A investigação no código-fonte do `WEB` (`App.tsx`) identificou o uso da classe `bg-background-dark`. Essa variável de cor não está definida ou não está sendo aplicada corretamente no projeto `MOBILE`.
    -   **Ação:** Adicionar a variável de cor correspondente ao `background-dark` no arquivo `MOBILE/src/theme/variables.css` e garantir que ela seja aplicada como a cor de fundo principal da aplicação para unificar a identidade visual.

-   [x] **Tarefa 8.2: Correção do Bug de Navegação na Home**
    -   **Problema:** Todos os botões de navegação na tela `Home` (ex: PIX, Cartões) redirecionam incorretamente de volta para a própria tela `Home`.
    -   **Análise:** O problema provavelmente reside na função `handleNavigate` ou no gerenciamento do estado `currentView` dentro do componente `Home/index.tsx`. A lógica que deveria atualizar a `view` para a seção correta não está funcionando como esperado.
    -   **Ação:** Revisar e depurar a função `handleNavigate` no arquivo `MOBILE/src/pages/Home/index.tsx` para garantir que o estado `currentView` seja atualizado corretamente com a `view` selecionada, roteando o usuário para a tela certa.

-   [x] **Tarefa 8.3: Implementar Cache para o Endereço do Backend (Ngrok)**
    -   **Problema:** O endereço IP do `ngrok` (ou qualquer URL de backend) precisa ser inserido toda vez que o aplicativo é iniciado, causando atrito no desenvolvimento.
    -   **Análise:** O aplicativo não possui um mecanismo para persistir o endereço da API entre as sessões.
    -   **Ação:** Modificar o serviço `api.ts` para que, ao configurar um novo endereço de API, ele seja salvo no `localStorage` junto com um timestamp. Ao iniciar, o aplicativo verificará se existe um endereço no cache com menos de 60 minutos. Se existir, ele será usado automaticamente; caso contrário, o aplicativo solicitará o novo endereço.
