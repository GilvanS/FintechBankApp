
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

-   [x] **Tarefa 8.1:** Análise e Correção de Divergências Visuais
-   [x] **Tarefa 8.2:** Correção do Bug de Navegação na Home
-   [x] **Tarefa 8.3:** Implementar Cache para o Endereço do Backend (Ngrok)

---

### **Fase 9: Correção de Bugs Críticos Pós-Lançamento (MOBILE)**

-   [x] **Tarefa 9.1:** Análise e Documentação dos Bugs em Cascata
-   [x] **Tarefa 9.2:** Implementação da Correção
-   [x] **Tarefa 9.3:** Validação da Correção e Encerramento (FALHOU)

---

### **Fase 10: Correção de Regressão Crítica de UI (Home)**

-   [x] **Tarefa 10.1:** Análise e Correção de Divergência de Cores
-   [x] **Tarefa 10.2:** Restauração da Barra de Navegação e Layout
-   [x] **Tarefa 10.3:** Correção do Bug de Interação dos Botões
-   [x] **Tarefa 10.4:** Validação Final da UI e Interação

---

### **Fase 11: Correção do Mecanismo de Cache da API**

-   [x] **Tarefa 11.1:** Análise e Documentação do Bug de Persistência
-   [x] **Tarefa 11.2:** Implementação da Correção no Código
-   [x] **Tarefa 11.3:** Validação da Correção pelo Usuário
    -   **Ação Pendente:** Usuário deve realizar `git pull`, compilar o APK, instalar e testar a persistência do endereço da API entre as sessões do aplicativo.
    -   **Status:** Correção implementada, aguardando validação do usuário

---

### **Fase 12: Bugs Críticos Identificados (Pendentes de Resolução)**

-   [ ] **Tarefa 12.1:** Correção de Erro no swagger.yaml (Padrão regex malformado)
    -   **Descrição:** Erro "Malformed inline YAML string ('^[0-9]{11})" na linha 773 do swagger.yaml impede inicialização do servidor backend
    -   **Localização:** API/swagger.yaml
    -   **Impacto:** API completamente indisponível
    -   **Status:** Aguardando correção imediata
-   [ ] **Tarefa 12.2:** Validar Resolução de Falha na Fase 9
    -   **Descrição:** A validação da correção dos bugs críticos pós-lançamento (Fase 9.3) foi marcada como "FALHOU"
    -   **Status:** Necessário reanálise e nova implementação
-   [x] **Tarefa 12.3:** Validar Persistência do Cache da API
    -   **Descrição:** Verificar se a correção do mecanismo de cache da API (Fase 11) está funcionando corretamente após implementação
    -   **Status:** Correção implementada e testes pendentes de validação

---

### **Fase 13: Correções Críticas Realizadas (Aguardando Validação do Usuário)**

-   [x] **Tarefa 13.1:** Correção de Imports Ausentes no Dashboard.tsx
    -   **Descrição:** Arquivo MOBILE\src\components\Dashboard.tsx estava faltando importações essenciais (React hooks, contexto de autenticação, tipos, serviços de API)
    -   **Impacto:** Componentes não funcionando corretamente, erros de execução
    -   **Solução:** Adicionados imports: React hooks, useAuth, tipos (PurchasedItem, Transaction, User), e serviços de API
-   [x] **Tarefa 13.2:** Correção de Elementos de Navegação na HomeView.tsx
    -   **Descrição:** Botões de navegação na tela Home do MOBILE estavam usando divs em vez de elementos button, causando problemas de interação
    -   **Impacto:** Botões não funcionavam corretamente, experiência do usuário degradada
    -   **Solução:** Substituídos elementos div por button em todos os itens de navegação rápida (Shop, Cards, Pagar Contas, Extrato)
-   [x] **Tarefa 13.3:** Correção de Propriedades Opcionais na HomeView.tsx
    -   **Descrição:** Componente NewsSection na HomeView do MOBILE esperava propriedade news que não estava sendo fornecida
    -   **Impacto:** Erros de execução e falha na renderização da seção de notícias
    - **Solução:** Atualizada interface HomeViewProps e chamada do NewsSection para remover a propriedade news
-   [x] **Tarefa 13.4:** Inicialização Adequada do Cache da API no App.tsx
    -   **Descrição:** A função initializeApi não estava sendo chamada no startup do aplicativo MOBILE
    -   **Impacto:** Cache da URL da API não funcionava, endereço da API não persistia entre sessões
    -   **Solução:** Adicionada chamada para initializeApi() na inicialização do App.tsx

---

### **Fase 14: Ajustes Finais e Validação de Componentes (Concluídos)**

-   [x] **Tarefa 14.1:** Correção de Parâmetros Incompatíveis no Home.tsx
    -   **Descrição:** Componente HomeView estava recebendo propriedade news que foi removida em atualizações anteriores
    -   **Impacto:** Erros de execução e falha na renderização da tela Home
    -   **Solução:** Atualizada chamada do HomeView para remover o parâmetro news e limpeza de código desnecessário
-   [x] **Tarefa 14.2:** Atualização de Texto para Validação Visual
    -   **Descrição:** Alteração do texto "Acessar minha conta" para "Entre na conta" no PreLoginDashboard
    -   **Impacto:** Facilita verificação visual de que as correções estão presentes no APK
    -   **Solução:** Atualizado texto do botão principal de login para indicar que as atualizações estão aplicadas
-   [x] **Tarefa 14.3:** Validação Completa das Correções Realizadas
    -   **Descrição:** Verificação final de todas as correções implementadas nas fases anteriores
    -   **Impacto:** Garantia de que todos os bugs identificados foram devidamente corrigidos
    -   **Solução:** Revisão completa dos componentes principais (Dashboard, HomeView, App, Home) para assegurar consistência

---

### **Fase 15: Correção Crítica do Sistema de Navegação (Concluído)**

-   [x] **Tarefa 15.1:** Análise do Problema de Navegação nos Botões
    -   **Descrição:** Identificação de que os botões na tela Home não estavam funcionando devido ao uso incorreto do contexto de navegação
    -   **Impacto:** Usuário não conseguia navegar entre as diferentes seções do app (PIX, Shop, Cartões, etc.)
    -   **Causa Raiz:** O componente Home.tsx estava tentando usar o estado global de navegação em vez de um estado local para navegação interna
-   [x] **Tarefa 15.2:** Implementação de Sistema de Navegação Local no Home.tsx
    -   **Descrição:** Criação de estado local de navegação dentro do componente Home para gerenciar as telas internas
    -   **Impacto:** Permite navegação adequada entre as diferentes funcionalidades (PIX, Shop, Cartões, Extrato) sem interferir no estado global
    -   **Solução:** Adicionado useState<View> local e função navigateTo local para gerenciar navegação interna
-   [x] **Tarefa 15.3:** Atualização do Tipo View para Incluir Todos os Estados Necessários
    -   **Descrição:** Expansão do tipo View para incluir todos os valores usados no sistema de navegação
    -   **Impacto:** Tipagem correta e prevenção de erros de compilação relacionados à navegação
    -   **Solução:** Adicionados todos os valores possíveis ('paymentMethods', 'purchaseConfirmation', 'menu', 'notifications', etc.) ao tipo View em types.ts

---

### **Fase 16: Identificação e Correção de Componente Duplicado (Concluído)**

-   [x] **Tarefa 16.1:** Análise do Componente PreLoginDashboard
    -   **Descrição:** Identificação de que existiam duas versões do componente PreLoginDashboard no projeto MOBILE
    -   **Impacto:** Dificuldade em identificar qual componente estava sendo usado e potenciais inconsistências
    -   **Causa Raiz:** Cópia do projeto WEB para MOBILE resultou em componentes duplicados em diferentes diretórios
-   [x] **Tarefa 16.2:** Atualização do Componente em src/components/PreLoginDashboard.tsx
    -   **Descrição:** Correção do texto 'Acessar minha conta' para 'Entre na conta' no componente duplicado
    -   **Impacto:** Garantia de consistência em todos os componentes do projeto
    -   **Solução:** Atualização do texto em F:\GITHUB\FintechBankApp\MOBILE\src\components\PreLoginDashboard.tsx
-   [x] **Tarefa 16.3:** Validação da Correta Utilização do Componente Atual
    -   **Descrição:** Confirmação de que o App.tsx utiliza o componente correto em src/pages/PreLoginDashboard
    -   **Impacto:** Garantia de que as alterações feitas anteriormente estavam no componente correto
    -   **Solução:** Verificação do import e uso do componente correto no App.tsx

---

### **Fase 17: Correção Crítica de Vulnerabilidade de Autenticação (Concluído)**

-   [x] **Tarefa 17.1:** Identificação do Bug Crítico de Autenticação
    -   **Descrição:** O aplicativo estava permitindo acesso à tela home sem autenticação válida. Ao abrir o APK, o app ia direto para a tela home sem exigir login.
    -   **Impacto:** VULNERABILIDADE CRÍTICA DE SEGURANÇA - Qualquer pessoa poderia acessar o aplicativo sem fazer login
    -   **Causa Raiz:** 
        1. Inconsistência de chaves de token: Login salvava token como 'authToken', mas mockApi procurava 'token'
        2. App.tsx usava getProfile() do mockApi que não validava token real com backend
        3. checkAuth() não verificava se token existia antes de tentar buscar perfil
        4. Não havia validação real do token com a API backend
-   [x] **Tarefa 17.2:** Implementação de getUserMe Real que Chama API Backend
    -   **Descrição:** Criada implementação real de getUserMe() em api.ts que chama GET /users/me com validação de token
    -   **Impacto:** Agora o app valida o token com o backend antes de permitir acesso
    -   **Solução:** Implementada função getUserMe() que:
        - Verifica se token existe antes de fazer requisição
        - Verifica se API base URL está configurada
        - Chama GET /users/me com headers de autenticação
        - Retorna erro 401 se token inválido/expirado e limpa tokens automaticamente
-   [x] **Tarefa 17.3:** Correção da Verificação de Autenticação no App.tsx
    -   **Descrição:** Corrigido checkAuth() para validar token antes de buscar perfil e tratar erros adequadamente
    -   **Impacto:** App agora verifica autenticação corretamente e redireciona para login se token inválido
    -   **Solução:** 
        - Adicionada verificação de token antes de chamar getProfile()
        - Tratamento adequado de erros com limpeza de tokens
        - Redirecionamento para prelogin se autenticação falhar
-   [x] **Tarefa 17.4:** Correção de Inconsistência de Chaves de Token
    -   **Descrição:** Corrigida inconsistência onde login salvava 'authToken' mas código procurava 'token'
    -   **Impacto:** Garantia de que tokens são salvos e recuperados corretamente
    -   **Solução:** 
        - mockApi.ts atualizado para procurar 'authToken' primeiro, depois 'token' (compatibilidade)
        - Logout atualizado para limpar ambas as chaves ('token' e 'authToken')
-   [x] **Tarefa 17.5:** Correção do Logout para Limpar Todos os Tokens
    -   **Descrição:** Logout agora limpa todos os tokens (localStorage e Preferences)
    -   **Impacto:** Garantia de que logout remove completamente a autenticação
    -   **Solução:** handleLogout() agora remove 'token' e 'authToken' do localStorage e Preferences
