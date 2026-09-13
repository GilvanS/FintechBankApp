# Plano de Implementação: Correções de Layout, Modo Escuro e Painel de Administração

Este plano descreve as correções estruturais solicitadas, focando em melhorar a usabilidade em web/mobile, padronizar modais e resolver problemas de legibilidade (contraste de cores).

## Alterações Propostas

---

### 1. Refatoração do `BoletoModal` (Layout Ocupando a Tela Toda)
**O problema:** O usuário relatou que o modal do boleto com formato de "celular mockado" ou janela centralizada ficou estranho, e solicitou o layout igual ao do "Aprenda a Usar" (`StoryViewer.tsx`).
- **Ação em WEB e MOBILE:** 
  - Atualizar `BoletoModal.tsx` para remover o contêiner central (`relative w-full max-w-md h-[85vh] rounded-3xl`) e usar um layout em tela cheia idêntico ao `StoryViewer` (`absolute inset-0 bg-black z-50 flex flex-col`).
  - Remover animações do container antigo e aplicar animações completas de tela (`animate-fade-in`).
  - Manter a lógica de estado do fluxo de boleto, focando apenas no encapsulamento visual.

---

### 2. Painel do Administrador: De Modal para View (`Admin.tsx`)
**O problema:** O painel do administrador atualmente abre como um Modal sobreposto à tela, o que piora a experiência em Web e Mobile.
- **Ação em WEB e MOBILE:**
  - Alterar `Admin.tsx` para não ser mais um modal, mas uma View renderizada pelo `Dashboard.tsx` (semelhante ao `CreditView`, `ShopView` e `Profile`).
  - Atualizar `Dashboard.tsx` para gerenciar a rota interna de navegação do admin: ex. `activeView === 'admin'`.
  - Mudar o botão na Header/Home para setar o estado `setActiveView('admin')` ao invés de controlar a propriedade `isOpen` do Modal.
  - Aplicar as cores da nova paleta principal.
  - Substituir todos os ícones (`material-symbols-outlined`) por ícones da biblioteca `lucide-react` para resolver erros de carregamento e exibição incorreta (ex: `arrow_back`).

---

### 3. Correção de Contraste e Cores no Modo Escuro (Botões e Títulos)
**O problema:** Títulos e o botão "Sair da Conta" estão escuros, tornando-os impossíveis de ler. 
- **Ação em WEB e MOBILE:**
  - Revisar `global.css` (Web) e `variables.css` (Mobile) para corrigir classes ou aplicar sobreposições CSS (`@layer utilities`) que forçam cores incorretas no tema `dark` (ex. `theme-midnight`).
  - Identificar o botão de "Sair da Conta" no `Profile.tsx` (ou Sidebar) e garantir que a propriedade de texto (`text-white` ou similar) não esteja sendo cancelada globalmente.
  - Testar o comportamento das cores da paleta nos botões principais no modo noturno e claro.

---

## Perguntas em Aberto
- Nenhuma no momento. O layout e a diretiva de padronização foram definidos claramente ("usar a mesma paleta" e "mesmo comportamento das Views de limite, shop e perfil").

## Plano de Verificação

### Testes Automatizados
- Executar `npm run build` na pasta `WEB` e `MOBILE` para garantir integridade.

### Verificação Manual
1. **Admin Panel:** Acessar o Dashboard, clicar no ícone de Admin e verificar se a view transiciona suavemente ocupando o mesmo slot das outras telas (sem modal/overlay). Verificar o uso dos ícones lucide-react.
2. **Boleto Modal:** Iniciar o fluxo "Pagar Boleto" e confirmar que ele assume a tela cheia com fundo preto sem os limitadores do mock-up celular.
3. **Contraste no Modo Escuro:** Ativar o modo Dark, ir até Perfil e confirmar se o botão "Sair da Conta" está legível. Verificar menus laterais e títulos.
