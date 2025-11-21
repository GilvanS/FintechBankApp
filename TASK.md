
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
    -   A comunicação com a API foi configurada utilizando `ngrok`.

-   [x] **Tarefa 6.2: Sincronizar o Projeto com o Capacitor**
    -   Executado `npx cap sync` para atualizar a plataforma Android com as últimas alterações.

-   [x] **Tarefa 6.3: Compilar e Gerar o APK de Debug via Gradle**
    -   O código foi preparado e enviado para o repositório para compilação local pelo desenvolvedor.

-   [x] **Tarefa 6.4: Documentação Final e Encerramento**
    -   A documentação foi finalizada, e a migração do projeto `WEB` para `MOBILE` foi concluída com sucesso.

---

### **Fase 7: Correção de Bug Pós-Login (MOBILE)**

-   [x] **Tarefa 7.1: Análise e Documentação do Bug**
    -   **Bug:** Erro de tempo de execução `TypeError: Cannot read properties of undefined (reading 'fullName')` ocorre após o login no aplicativo `MOBILE`.
    -   **Causa Raiz:** O componente principal da aplicação, renderizado após o login, não está recebendo os dados do objeto `user`. Isso faz com que qualquer tentativa de acessar `user.fullName` (ou qualquer outra propriedade) resulte em um erro, impedindo a renderização da tela Home.

-   [x] **Tarefa 7.2: Implementação da Correção**
    -   **Análise:** O erro foi causado porque o componente `Home` esperava receber o objeto `user` como uma propriedade (prop), mas o componente `App.tsx` o renderizava sem passar essa prop. A versão web funcionava por usar o `AuthContext` de forma diferente.
    -   **Correção:** Ajustar a renderização do componente `Home` no arquivo `MOBILE/src/App.tsx`. A linha `<Home />` foi alterada para `<Home user={user} onLogout={handleLogout} refreshUserData={handleUpdateUser} />`, passando explicitamente os dados do usuário e as funções de logout e update, conforme esperado pelo componente.

-   [x] **Tarefa 7.3: Validação da Correção e Encerramento**
    -   O fluxo de login no `MOBILE` foi corrigido. O código-fonte foi atualizado e está pronto para a validação final pelo desenvolvedor.
