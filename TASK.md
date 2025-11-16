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

-   [x] **Tarefa 2.1:** Instalar as dependências do Capacitor (`@capacitor/core`, `@capacitor/cli`) no diretório `MOBILE`.
-   [x] **Tarefa 2.2:** Inicializar o Capacitor no projeto `MOBILE` (`npx cap init`).
-   [x] **Tarefa 2.3:** Adicionar a plataforma Android ao projeto (`npx cap add android`).

**Possíveis Erros e Como Evitar:**
*   **Erro:** Falha na instalação de dependências por conflitos de versão do Node.js/npm.
*   **Prevenção:** Verificarei as versões recomendadas pelo Capacitor e as instalarei se necessário. O ambiente do IDX já possui o Node.js, o que minimiza esse risco.
*   **Erro:** `npx cap add android` falhar por falta do ambiente de desenvolvimento Android (JDK, Android Studio).
*   **Prevenção:** Antes de executar o comando, vou verificar se o `JAVA_HOME` está configurado e se as ferramentas de linha de comando do Android SDK estão disponíveis no ambiente. Se não estiverem, avisarei você.

---

### **Fase 3: Configuração da Comunicação Local (Wi-Fi)**

O passo mais crítico para garantir que o APK se comunique com sua máquina.

-   [ ] **Tarefa 3.1:** Modificar o arquivo de serviço da API (`MOBILE/src/services/api.ts`) para apontar para o IP da sua máquina local. **Atenção:** Você precisará me fornecer seu endereço IP local quando eu solicitar.
-   [ ] **Tarefa 3.2:** Configurar o projeto Android para permitir tráfego de "texto puro" (HTTP), que é necessário para o desenvolvimento local. Isso envolve a criação de uma configuração de segurança de rede (`network_security_config.xml`) e a referência a ela no `AndroidManifest.xml`.
-   [ ] **Tarefa 3.3:** Garantir que o `vite.config.ts` no projeto `MOBILE` esteja configurado para expor o servidor de desenvolvimento na rede (`host: '0.0.0.0'`). Isso já está configurado no projeto `WEB`.

**Possíveis Erros e Como Evitar:**
*   **Erro:** O aplicativo não consegue se conectar à API.
*   **Prevenção:**
    1.  **Firewall:** Seu computador pode ter um firewall bloqueando a porta `3001`. Você precisará criar uma regra para permitir conexões de entrada nesta porta.
    2.  **Rede Errada:** Seu celular e seu computador **DEVEM** estar conectados na **MESMA** rede Wi-Fi.
    3.  **IP Dinâmico:** O IP da sua máquina pode mudar. Se a conexão falhar, verifique se o IP mudou e me informe para que eu possa atualizar a configuração.
*   **Erro:** Android bloqueia a conexão por não ser HTTPS.
*   **Prevenção:** A Tarefa 3.2 (criação do `network_security_config.xml`) é projetada especificamente para prevenir este problema durante o desenvolvimento.

---

### **Fase 4: Compilação e Geração do APK**

O processo final de empacotamento.

-   [x] **Tarefa 4.1:** Gerar a build de produção da aplicação React (`npm run build`) dentro da pasta `MOBILE`.
-   [x] **Tarefa 4.2:** Sincronizar os arquivos web com o projeto nativo (`npx cap sync`).
-   [x] **Tarefa 4.3:** Abrir o projeto no Android Studio (`npx cap open android`).
-   [x] **Tarefa 4.4:** Executar o processo de build do APK no Android Studio.

**Possíveis Erros e Como Evitar:**
*   **Erro:** A build do APK falha por problemas de `Gradle` (gerenciador de dependências do Android).
*   **Prevenção:** O Android Studio geralmente lida com isso automaticamente, baixando as versões corretas. Se ocorrer um erro, eu avisarei você. Manter o Android Studio e seus plugins atualizados ajuda a evitar isso.
*   **Erro:** O APK gerado é muito grande.
*   **Prevenção:** O processo `npm run build` já otimiza os arquivos. Para produção, podemos habilitar `ProGuard` ou `R8` no Android para ofuscar e diminuir ainda mais o código.

---

### **Guia de Setup para Novas Máquinas e Resolução de Problemas**

Esta seção foi adicionada após o setup inicial para documentar o fluxo de trabalho correto ao clonar o projeto em um novo ambiente.

**1. Clonando o Repositório:**
   - Use `git clone <url_do_repositorio>`.

**2. Resolvendo Conflitos Iniciais do Git (se ocorrer):**
   - **Problema:** O histórico do repositório pode conter uma referência antiga onde a pasta `MOBILE` era um "submódulo" ou um "arquivo" em vez de um diretório.
   - **Sintoma:** O `git pull` falha com um conflito de "file/directory".
   - **Solução:** Forçar o repositório local a ser um espelho exato do servidor.
     ```bash
     # Joga fora todas as alterações locais e se alinha com o servidor
     git reset --hard origin/developer
     ```

**3. Configurando o Projeto Mobile pela Primeira Vez:**
   - O projeto é clonado sem a pasta `android/` (isso é intencional e definido no `.gitignore`). Você precisa gerá-la localmente.
   - **Passo 1: Instalar Dependências do Node.js**
     ```bash
     cd mobile
     npm install
     ```
   - **Passo 2: Adicionar a Plataforma Android**
     ```bash
     # Este comando cria a pasta /android
     npx cap add android
     ```
   - **Passo 3: Compilar a Aplicação Web**
     ```bash
     # Este comando cria a pasta /dist
     npm run build
     ```
   - **Passo 4: Sincronizar Web e Nativo**
     ```bash
     # Copia a pasta /dist para dentro de /android
     npx cap sync android
     ```

**4. Gerando o APK:**
   - Após a sincronização, abra a pasta `mobile/android` no Android Studio.
   - Vá em **`Build` -> `Build Bundle(s) / APK(s)` -> `Build APK(s)`** para gerar o `app-debug.apk`.
   - Clique em **"locate"** na notificação para encontrar o arquivo.

Vou mantê-lo informado ao final de cada fase principal.
