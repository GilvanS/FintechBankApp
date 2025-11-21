
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

-   [ ] **Tarefa 6.3: Compilar e Gerar o APK de Debug via Gradle**
    -   Executar o comando do Gradle para compilar o projeto e gerar um APK de debug. A abertura do Android Studio não foi necessária.

-   [ ] **Tarefa 6.4: Documentação Final e Encerramento**
    -   Finalizar a documentação, registrar os resultados e concluir a migração.
