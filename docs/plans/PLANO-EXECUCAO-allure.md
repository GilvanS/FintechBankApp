# PLANO DE EXECUÇÃO — Modo Allure (WEB)

> **Documento único e autocontido.** Substitui e consolida:
> - `2026-09-05-dashboard-analytics-allure-dither.md`
> - `2026-09-05-allure-mode-home-faturas-perfil.md`
> - `2026-09-05-auditoria-paridade-telas-allure.md`
> - `PLANO-MESTRE-allure-paridade.md`
>
> **Para a IA que vai executar:** não presuma nada que não esteja escrito aqui ou que você não tenha lido no código. A falha anterior deste projeto foi exatamente presumir. Leia as seções 1 a 7 antes de escrever a primeira linha de código.

---

# PARTE I — O que você precisa saber antes de começar

## 1. Contexto

- **Repo:** `F:\GITHUB\FintechBankApp`, branch `developer`
- **App:** "VOLT" — fintech (carteira digital + cartão de crédito). **Não é banco tradicional**: não existe agência, conta corrente nem tipo de conta.
- **Stack WEB:** React 19 + TypeScript + Vite, pasta `WEB/`
- **Comandos** (sempre de dentro de `WEB/`):
  ```bash
  npm run dev        # dev server porta 3000
  npm test -- --run  # Vitest
  npx tsc --noEmit   # typecheck
  ```
- **Baselines — não regredir:**
  - `npx tsc --noEmit` → **68 linhas de erro** (pré-existentes, em `LimitView.tsx`, `Admin/*`, `services/api.ts`, etc). Acima de 68 = você introduziu erro.
  - `npm test -- --run` → **152 testes / 29 arquivos, todos verdes**
- **Design system:** `DESIGN.md` na raiz. **Ler antes de qualquer UI.** Temas: `midnight` (dark, accent único `volt-green #00ff9d`) e `yellow` (brutalista, `shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]`, `border-4 border-black`, zero blur).
- **Roteamento:** view por state em `WEB/components/Dashboard.tsx`. Não é React Router dentro do dashboard.
- **Fora de escopo:** Shop e Admin. Abrem por rota própria e **não devem ser tocados**.

## 2. Estado atual

**Pronto e aprovado pelo usuário:**
- `WEB/components/Analytics/` — referência de qualidade. Sidebar, drag-to-reorder persistido, modal, charts recharts, Hero3D (Three.js), textura ASCII no header.
- `WEB/components/shared/AllureShell.tsx` — casca reutilizável
- `WEB/hooks/useCardOrder.ts` — ordem de cards em `localStorage`

**Quebrado — é o que este plano conserta:** `HomeAllureView`, `InvoicesAllureView` e `ProfileAllureView` substituíram as telas antigas no `Dashboard.tsx` sem paridade, perdendo ~80% da funcionalidade.

| Tela | Antiga | Nova | Perda |
|---|---|---|---|
| Perfil | `Profile.tsx` — 959 linhas, 6 popups | `Profile/ProfileAllureView.tsx` — 201 linhas, 0 popups | ~79% |
| Home | `HomeView.tsx` — 2730 linhas, 14 componentes, 5 modais | `Home/HomeAllureView.tsx` — 427 linhas | ~84% |
| Faturas | `InvoicesView.tsx` + `CurrentInvoice` + `ClosedInvoice` + `InvoiceInstallmentPlan` | `Invoices/InvoicesAllureView.tsx` — 290 linhas | ações caem na tela antiga |

## 3. Schema real — decore isto

Fonte da verdade: `WEB/types.ts`. **Nunca invente campo. Leia o arquivo antes de usar qualquer propriedade.**

```ts
interface User {
  cpf: string;
  fullName: string;          // NÃO existe "name"
  username?: string;
  email: string;
  password: string;
  balance: number;
  transactions: Transaction[];
  isBlocked: boolean;
  role: 'user' | 'admin';    // minúsculo
  pixDailyLimit: number;
  pixKeys: PixKey[];
  pixContacts: PixContact[];
  limitIncreaseRequest: LimitIncreaseRequest | null;
  showStoriesPopup: boolean;
  purchasedItems: PurchasedItem[];
  creditCard: CreditCard;    // obrigatório
  accountStatus?: 'adimplente' | 'inadimplente' | 'suspenso';
  // NÃO existe: name, agency, accountNumber, accountType, id
}

interface CreditCard {
  number: string;            // NÃO existe "cardNumber"
  dueDate: string;
  invoiceDueDate: string;
  currentInvoice: number;
  closedInvoice: number;
  availableLimit: number;    // NÃO existe "limit"
  totalLimit: number;
  currentInvoiceTotal?: number;
  pointsBalance: number;
  isBlocked: boolean;
  transactions: ...[];       // obrigatório
  closedTransactions: ...[]; // obrigatório
  // NÃO existe: cardHolderName, expirationDate, status
}
```

**Transaction:** `amount` é **sempre positivo**. A direção vem de `type`:
```ts
const ENTRADA_TYPES = new Set(['DEPOSIT', 'PIX_RECEIVED', 'CASHBACK_CREDIT', 'POINTS_EARNED']);
// tudo que não está aqui é saída
// types válidos: PIX_SENT | PIX_RECEIVED | DEPOSIT | PAYMENT | INVOICE_PAYMENT
//                | PIX_CREDIT_SENT | SHOP_DEBIT | SHOP_CREDIT | CASHBACK_CREDIT | POINTS_EARNED
```

## 4. Interface do `AllureShell`

`WEB/components/shared/AllureShell.tsx` já resolve header, sidebar colapsável, animação de troca de seção e o modal grande. Você só passa conteúdo.

```tsx
interface AllureShellProps<K extends string> {
  title: string;
  subtitle?: string;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  sections: readonly AllureSection<K>[];   // { key, label, icon }
  activeSection: K;
  onSelectSection: (key: K) => void;
  headerExtra?: React.ReactNode;     // linha de KPIs abaixo do título
  headerActions?: React.ReactNode;   // botões no canto do header
  children: React.ReactNode;         // conteúdo da seção ativa
  expandedContent?: React.ReactNode; // se != null, abre o modal grande
  onCloseExpanded?: () => void;
}
```

O modal já é `max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden` com botão X. **Não crie modal próprio.**

## 5. REGRA DE OURO

> **Não reimplemente conteúdo. Renderize o componente que já existe dentro do shell.**

❌ Errado (causou a regressão atual):
```tsx
<AllureShell ...>
  <div>...versão simplificada reescrita à mão...</div>
</AllureShell>
```

✅ Certo:
```tsx
<AllureShell ...>
  {activeSection === 'dados' && <Profile />}   {/* componente real, completo */}
</AllureShell>
```

Se o componente antigo assumir tela cheia (`fixed inset-0`, header próprio, botão voltar próprio): **leia o componente e trate** — ou adicione prop de modo embutido, ou envolva num wrapper que neutralize o posicionamento. Nunca copie e simplifique.

## 6. Como o executor anterior errou

1. **Não leu `WEB/types.ts`.** Usou campos de "app de banco genérico" (`user.name`, `user.agency`, `accountNumber`, `accountType`, `card.limit`, `cardHolderName`) que não existem neste schema.
2. **Escondeu o erro com fallback fabricado:** `?? 5000`, `|| '0001'`, `|| 'CORRENTE'`. Em runtime o JS não quebra com `undefined` — usa o valor falso. O usuário veria número plausível e errado.
3. **Escreveu os mocks de teste com o mesmo schema inventado**, então os testes validavam a mentira e passavam.
4. **Reimplementou em vez de reaproveitar**, perdendo ~80% da funcionalidade sem perceber.
5. **Deixou controle falso na UI:** `ProfileAllureView.tsx:27` tem o comentário literal `// Toggle states fictícios/UI` — 3 toggles que não persistem nem fazem nada, substituindo toggles reais que existiam.

**Regra derivada:** se um dado não existe no schema, **não invente fallback plausível**. Ou não renderize o campo, ou mostre estado honesto de indisponível. Nunca um número que parece real.

## 7. As 7 armadilhas — todas já causaram bug real aqui

1. **GSAP stagger em `.children` trava em `opacity: 0`** quando o efeito re-executa (troca de seção). Use variants do Motion (`motion.div` / `Reorder.Item`). Nunca `gsap.from(container.children, ...)`.
2. **`Reorder.Group axis` depende da direção do grid.** Desktop = 1 linha, 2-3 colunas → `axis="x"`. Mobile = empilhado → `axis="y"`. Use `matchMedia('(min-width: 768px)')` reativo.
3. **Modal com recharts precisa de `overflow-x-hidden`** — o `ResponsiveContainer` estoura ~12px por arredondamento e cria barra horizontal.
4. **`applyAsciiHalftone` pinta fundo preto sólido.** No tema yellow o accent é preto → preto sobre preto = invisível. `AsciiHeaderAccent.tsx` resolve deixando o fundo transparente no pós-processamento.
5. **Direção da transação vem de `type`**, não do sinal de `amount` (sempre positivo).
6. **A view full-bleed cobre o Header do app** — o toggle de tema original fica inacessível. Replique o controle dentro da tela, via `headerActions` do shell.
7. **`tsc` e `vitest` não pegam bug de animação, layout nem funcionalidade faltando.** Os 8 erros de campo inventado passaram por 152 testes verdes. **Teste ao vivo no navegador, clicando, é obrigatório.**

---

# PARTE II — Ordem de execução

## Por que esta ordem

A ordem é ditada por **propriedade de arquivo**, não por preferência. Duas tasks nunca tocam o mesmo arquivo, então nenhuma atrapalha a outra.

| Task | Arquivos que MODIFICA | Colide com |
|---|---|---|
| 1 — Sidebar configurável | `shared/AllureShell.tsx`, `tests/AllureShell.test.tsx` | Task 2 (mesmo arquivo) → por isso são sequenciais |
| 2 — Fundo ASCII | `shared/AllureShell.tsx`, novo `AsciiBackdrop.tsx` | Task 1 (mesmo arquivo) |
| 3 — Perfil | `Profile/ProfileAllureView.tsx` | ninguém |
| 4 — Faturas | `Invoices/InvoicesAllureView.tsx`, `tests/InvoicesAllureView.test.tsx` | ninguém |
| 5 — Home | `Home/HomeAllureView.tsx` | ninguém |
| 6 — Verificação final | nenhum (só valida) | — |
| 7 — DESKTOP | `DESKTOP/` | — |

**Tasks 1 e 2 vêm primeiro** porque mudam a casca que as 3 telas usam. Fazer depois obrigaria a re-testar as 3 telas de novo. Fazendo antes, cada tela é testada uma vez só, contra a casca definitiva.

**Tasks 3, 4 e 5 são independentes entre si** — arquivos diferentes. Podem ser feitas em qualquer ordem, ou em paralelo por executores diferentes. A ordem sugerida (Perfil → Faturas → Home) é por valor: Perfil tem os 2 itens que o usuário citou nominalmente; Faturas tem um bug ativo; Home é a maior.

---

## TASK 1 — Sidebar com lado configurável

**Decisão do usuário:** esquerda por padrão, botão para trocar de lado, escolha persistida.

**Files:** `WEB/components/shared/AllureShell.tsx`, `WEB/tests/AllureShell.test.tsx`

- [ ] **1.1** State `sidebarSide: 'left' | 'right'`, default `'left'`, lido de `localStorage` na chave `allure-sidebar-side` (global — vale para todas as telas).
- [ ] **1.2** O container já é `flex flex-col md:flex-row` (linha ~54). Alternar para `md:flex-row-reverse` quando `right`. **Não duplique o JSX do `<aside>`** — só inverta a direção do flex.
- [ ] **1.3** Botão de trocar lado ao lado do botão de recolher (linha ~131). Ícones `PanelLeft`/`PanelRight` do lucide. Grava no `localStorage` a cada clique.
- [ ] **1.4** Ícones de recolher devem acompanhar o lado atual — hoje são fixos `PanelRightClose`/`PanelRightOpen` (linha ~138).
- [ ] **1.5** Testes em `AllureShell.test.tsx`: default é esquerda; toggle troca; valor persistido é lido no mount.
- [ ] **1.6** `tsc` 68 linhas + testes verdes.
- [ ] **1.7** QA ao vivo: abrir a Analytics (única tela íntegra hoje), trocar lado, recolher, recarregar e confirmar que o lado persistiu. Nos 2 temas.
- [ ] **1.8** Commit.

---

## TASK 2 — Textura ASCII como fundo (opcional)

Hoje a textura é um acento 120x40 no header (`WEB/components/Analytics/AsciiHeaderAccent.tsx`). O usuário sugeriu usá-la como fundo da tela.

**Restrição inegociável:** o fundo é superfície de leitura de dados densos. Contraste do texto **não pode cair abaixo de 4.5:1**.

**Files:** `WEB/components/shared/AllureShell.tsx`, novo `WEB/components/Analytics/AsciiBackdrop.tsx`

- [ ] **2.1** Criar `AsciiBackdrop.tsx` preenchendo o container, gerando o padrão em **tile** — não recalcular pixel a pixel numa área grande (custo de CPU).
- [ ] **2.2** Montar no `AllureShell` atrás do conteúdo, **opt-in por prop** (`backdrop?: boolean`). Não ligar em todas as telas de uma vez.
- [ ] **2.3** Opacidade inicial 0.04–0.06, `pointer-events: none`, `aria-hidden="true"`.
- [ ] **2.4** Medir contraste do texto sobre a textura nos 2 temas. Se reprovar 4.5:1, baixar opacidade até passar.
- [ ] **2.5** **Mostrar ao usuário antes de aplicar em todas as telas** — é decisão estética dele.
- [ ] **2.6** `tsc` 68 + testes verdes + commit.

---

## TASK 3 — Perfil: restaurar paridade

**Files:**
- Modify: `WEB/components/Profile/ProfileAllureView.tsx`
- Ler (fonte da verdade funcional): `WEB/components/Profile.tsx` — 959 linhas
- Ler: `WEB/utils/AppVersion.ts`
- Não quebrar: `WEB/tests/Profile.test.tsx` (testa persistência de 5 toggles)

### Checklist de paridade — Perfil

**Popups que existiam e sumiram (6):**
- [ ] **3.1** `showVersionPopup` — **botão "Versão do App"** + popup com `AppVersion.current` e `AppVersion.fullDetails` (ref: `Profile.tsx:188-204, 945-953`). Usar `expandedContent` do shell, não modal novo.
- [ ] **3.2** `showOnboardingWelcome`
- [ ] **3.3** `showHomeWelcomeMessage`
- [ ] **3.4** `showHomeStoriesStatus`
- [ ] **3.5** `showOverdueAlertPopup`
- [ ] **3.6** `showFinancialHealthPopup`

**Ações que sumiram:**
- [ ] **3.7** **Botão "Sair da Conta Volt"** — `const { logout } = useAuth()` (ref: `Profile.tsx:934-941`). Lugar visível: `headerActions` do shell ou rodapé da sidebar.
- [ ] **3.8** "Editar Nome do Titular"
- [ ] **3.9** "Detalhes da Build"

**Configurações que existiam (14) — verificar uma a uma:**
- [ ] **3.10** Aparência do Aplicativo (Amarelo Volt / Midnight)
- [ ] **3.11** Preferências da Tela Inicial (grupo)
- [ ] **3.12** Mostrar Onboarding
- [ ] **3.13** Mensagem de Boas-Vindas
- [ ] **3.14** Stories/Status do Home
- [ ] **3.15** Popup de Saúde Financeira
- [ ] **3.16** Aviso de Fatura em Atraso
- [ ] **3.17** Notificações em Tempo Real
- [ ] **3.18** Alertas Inteligentes
- [ ] **3.19** Alerta de Limite
- [ ] **3.20** Aviso de Compra Elevada
- [ ] **3.21** Limite de Gastos Mensal
- [ ] **3.22** Faturas & Ciclo de Faturamento
- [ ] **3.23** Segurança e Biometria

**Achado grave a corrigir:**
- [ ] **3.24** `ProfileAllureView.tsx:27-30` tem o comentário literal `// Toggle states fictícios/UI` — 3 toggles (`notifications`, `biometrics`, `darkMode`) que não persistem e não fazem nada. **Ligar na persistência real ou remover.** Controle que finge funcionar é pior que ausência.

**Fechamento:**
- [ ] **3.25** Ler `Profile.tsx` inteiro e conferir se há funcionalidade fora desta lista. Se houver, **acrescentar à lista** antes de fechar a task.
- [ ] **3.26** `tsc` 68 + testes verdes (incluindo `Profile.test.tsx`).
- [ ] **3.27** QA ao vivo nos 2 temas, clicando em **cada** item 3.1–3.24.
- [ ] **3.28** Commit.

---

## TASK 4 — Faturas: ações no modal + navegação completa

**Bug confirmado:** `InvoicesAllureView.tsx:168` faz `onNavigate('currentInvoice')` e sai do layout Allure, caindo na tela antiga. Mesmo padrão em `:178` e `:244`.

**Decisão do usuário:** essas ações abrem no **modal grande dentro da tela**.

**Componentes reais existentes — verificados, não inventar outros:** `CurrentInvoice.tsx`, `ClosedInvoice.tsx`, `InvoiceInstallmentPlan.tsx`, `InvoiceSummarySheet.tsx`, `PaymentHistoryModal.tsx`, `PaymentMethods.tsx`.

**Files:** `WEB/components/Invoices/InvoicesAllureView.tsx`, `WEB/tests/InvoicesAllureView.test.tsx`

- [ ] **4.1** "Pagar Fatura Atual" → `expandedContent` com `<CurrentInvoice />`. **Ler o componente antes**; se assumir tela cheia, tratar (ver Regra de Ouro).
- [ ] **4.2** "Ver Todas as Faturas" → mesmo tratamento.
- [ ] **4.3** "Parcelamentos" (`:244`) → mesmo tratamento com `<InvoiceInstallmentPlan />`.
- [ ] **4.4** Ampliar a sidebar com as seções: `Resumo` (atual), `Fatura Atual`, `Fatura Fechada`, `Parcelamentos`, `Histórico de Pagamentos`.
- [ ] **4.5** **Regra de negócio:** fatura FECHADA é imutável. A seção "Fatura Fechada" é somente leitura — nenhum controle que sugira editar ou alterar.
- [ ] **4.6** Atualizar `InvoicesAllureView.test.tsx` com os títulos novos de sidebar.
- [ ] **4.7** `tsc` 68 + testes verdes.
- [ ] **4.8** QA ao vivo: clicar em cada ação, confirmar que abre modal (não sai da tela), que fecha corretamente e que a tela Allure continua atrás.
- [ ] **4.9** Commit.

---

## TASK 5 — Home: restaurar paridade

**Files:**
- Modify: `WEB/components/Home/HomeAllureView.tsx`
- Ler (fonte da verdade funcional): `WEB/components/HomeView.tsx` — 2730 linhas

**14 componentes que a tela antiga monta e a nova não:**
- [ ] **5.1** `StoryHighlights` + `StoryViewer`
- [ ] **5.2** `HomeBanners`
- [ ] **5.3** `ShopOffersBanner`
- [ ] **5.4** `NewsSection`
- [ ] **5.5** `WeeklyStreak`
- [ ] **5.6** `SpendingHeatmapSection`
- [ ] **5.7** `SpendingTrendsSection`
- [ ] **5.8** `PaymentTimelineChart`
- [ ] **5.9** `InvoiceSummarySheet`
- [ ] **5.10** `FinancialInsightsCarouselModal`
- [ ] **5.11** `OverdueAlertModal`
- [ ] **5.12** `BiometricModal`
- [ ] **5.13** `PasswordModal`
- [ ] **5.14** Menu de inteligência (`isIntelligenceMenuOpen`)

**5 modais controlados que sumiram:**
- [ ] **5.15** `isBiometricOpen`
- [ ] **5.16** `isCarouselInsightsOpen`
- [ ] **5.17** `isIntelligenceMenuOpen`
- [ ] **5.18** `isInvoiceSummaryOpen`
- [ ] **5.19** `isPasswordVerifyOpen`

**Fechamento:**
- [ ] **5.20** Mapear cada componente/modal à seção do shell onde deve viver (`visaoGeral`, `extrato`, `limites`, ou seção nova se fizer sentido pelo conteúdo — não por estética).
- [ ] **5.21** Modais usam `expandedContent` do shell, não modal próprio.
- [ ] **5.22** Conferir se os botões de ação (Depositar/PIX/Boleto) estão ligados de fato — hoje são props `openDepositModal`/`openPixModal`/`openBoletoModal`; confirmar que o `Dashboard.tsx` passa.
- [ ] **5.23** Ler `HomeView.tsx` inteiro e conferir se há funcionalidade fora desta lista. Se houver, **acrescentar à lista**.
- [ ] **5.24** `tsc` 68 + testes verdes.
- [ ] **5.25** QA ao vivo nos 2 temas, item por item.
- [ ] **5.26** Commit.

---

## TASK 6 — Verificação final

- [ ] **6.1** `npx tsc --noEmit` → exatamente **68 linhas**.
- [ ] **6.2** `npm test -- --run` → tudo verde.
- [ ] **6.3** Navegar ao vivo pelas 4 telas (Analytics, Home, Faturas, Perfil), nos 2 temas: colapsar sidebar, trocar lado, arrastar cards, abrir/fechar modal, e **trocar de seção 5x seguidas** (regressão da armadilha 1).
- [ ] **6.4** Mobile 375px em cada tela: 1 coluna, sem sidebar, sem scroll horizontal.
- [ ] **6.5** Console sem erro — **abrir aba nova**, porque o buffer do console não limpa em reload.
- [ ] **6.6** Confirmar que **Shop e Admin continuam intocados**.
- [ ] **6.7** Todos os checkboxes das Tasks 3, 4 e 5 marcados.

---

## TASK 7 — DESKTOP (BLOQUEADA)

**Não iniciar** antes do usuário validar o WEB. Ordem explícita dele: *"desktop quero só efetuar quando eu validar o web"*.

- [ ] **7.1** Mapear `DESKTOP/` — confirmar se compartilha o bundle React do WEB ou é base separada.
- [ ] **7.2** Usar a skill `desktop-principles` (hover, atalhos de teclado, multi-janela).
- [ ] **7.3** **Nunca rodar o `.exe` direto** — usar `DESKTOP/run.ps1`. Há duas saídas de build com CEFs diferentes disputando o mesmo cache; rodar o exe direto trava.

---

# PARTE III — Protocolo obrigatório

Vale para **toda** task, sem exceção:

1. **Antes de codar:** ler o componente/tipo que você vai usar. Não presuma interface.
2. `npx tsc --noEmit` → **68 linhas exatas**. Mais que isso = você introduziu erro.
3. `npm test -- --run` → todos verdes.
4. **Navegador, clicando de verdade**, nos 2 temas. Testes automatizados não pegam funcionalidade faltando.
5. Marcar o checkbox correspondente neste arquivo.
6. **Commit escopado por caminho:** `git add <caminhos exatos>`. **Nunca `git add -A`** — o working tree tem bastante coisa não relacionada de outras sessões.

## Skills de design (o foco deste trabalho é visual)

| Quando | Skill |
|---|---|
| Antes de começar qualquer task de UI (1, 2, 3, 4, 5) | `frontend-design` + `ecc:frontend-design-direction` |
| Ao escrever qualquer animação | `motion-principles` |
| Ao final de cada task de UI, antes do commit | `design-audit` |

> **Se algo não estiver no schema, no componente existente ou neste documento: pergunte ao usuário. Não invente.**
