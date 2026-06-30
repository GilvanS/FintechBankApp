# Issue #49: Recuperação de Design e Correções de Tempo de Execução pós-Migração

## Descrição
Após a restauração do design baseado no tema `Midnight` (Midnight Green/Escuro) a partir da base `new-base-fintechbank`, a aplicação apresentou quebras de build e erros em tempo de execução ao tentar interagir com as telas e navegar pelo Dashboard. Esta issue descreve o diagnóstico e as correções realizadas para restabelecer a estabilidade e funcionamento completo do frontend.

## Problemas Resolvidos & Correções
1. **Erro de Build em Login.tsx (Unterminated regular expression)**:
   - *Causa*: O arquivo `Login.tsx` continha uma tag `</div>` extra no final, desbalanceando a estrutura JSX e confundindo o parser do esbuild/vite.
   - *Resolução*: Remoção da tag `</div>` extra para balancear os elementos.

2. **Erro no Login (Cannot read properties of undefined reading 'map' em SmartAlerts.tsx)**:
   - *Causa*: O wrapper global `<AppStateProvider>` não estava presente no arquivo [App.tsx](file:///F:/GITHUB/FintechBankApp/WEB/App.tsx) da base de código ativa. Como resultado, o hook `useAppState()` falhava ao inicializar o estado de alertas.
   - *Resolução*: Substituição/sincronização do `App.tsx` para incluir o wrapper do context global e a cópia de todos os arquivos de contexto restaurados.

3. **Erro ao renderizar Dashboard (invoiceSubView is not defined)**:
   - *Causa*: A declaração dos estados locais de sub-views de fatura (`invoiceSubView`) e extrato (`statementSubView`) no Dashboard estavam ausentes e geravam erro ao serem passadas como prop para o `<Header />`.
   - *Resolução*: Adicionados os respectivos `useState` em [Dashboard.tsx](file:///F:/GITHUB/FintechBankApp/WEB/components/Dashboard.tsx).

4. **Erro ao acessar a aba Shopping (handleTransactionComplete is not defined)**:
   - *Causa*: O switch do Dashboard para o componente `<ShopView />` passava `handleTransactionComplete` para o `onPurchaseComplete`, mas a função declarada na lógica do Dashboard chamava-se `handleTransactionCompleteLimit`.
   - *Resolução*: Atualização do nome da prop para referenciar o handler correto.

5. **Erro ao tentar Ocultar o Menu Superior (onHide is not defined / LayoutGrid is not defined)**:
   - *Causa*: 
     - A prop `onHide` não estava presente no destructuring dos parâmetros de `Header` em [Header.tsx](file:///F:/GITHUB/FintechBankApp/WEB/components/Header.tsx), e no Dashboard o parâmetro era passado como `onHideHeader`.
     - O ícone `LayoutGrid` era utilizado para o botão de reexibição do menu superior, mas não estava importado do `lucide-react`.
   - *Resolução*: 
     - Adicionado `onHide` na assinatura e na interface `HeaderProps` em `Header.tsx`.
     - Ajustado o nome do parâmetro passado no Dashboard de `onHideHeader` para `onHide`.
     - Importado explicitamente o `LayoutGrid` no topo de [Dashboard.tsx](file:///F:/GITHUB/FintechBankApp/WEB/components/Dashboard.tsx).

## Critérios de Aceite
- [x] O build de produção do Vite deve passar sem avisos ou erros críticos.
- [x] O usuário deve conseguir logar na aplicação sem erros de execução de hooks.
- [x] O tema Midnight Green deve estar configurado por padrão.
- [x] O botão "Ocultar Menu" deve funcionar perfeitamente e permitir a reexibição através do botão flutuante.
- [x] A tela de Shopping e a compra de pontos devem renderizar sem quebras de escopo de funções.
