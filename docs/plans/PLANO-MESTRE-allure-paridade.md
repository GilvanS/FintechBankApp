# PLANO MESTRE — Restaurar paridade e concluir o modo Allure (WEB)

> **Para a IA que vai executar:** este documento é autocontido. Não presuma nada que não esteja escrito aqui ou que você não tenha lido no código. **A falha anterior deste projeto foi exatamente presumir.** Leia a seção "Como o executor anterior errou" antes de escrever a primeira linha.

---

## 0. Contexto do projeto

- **Repo:** `F:\GITHUB\FintechBankApp`, branch `developer`
- **App:** "VOLT" — fintech (carteira digital + cartão de crédito). **Não é banco tradicional**: não existe agência, conta corrente nem tipo de conta.
- **Stack WEB:** React 19 + TypeScript + Vite. Pasta `WEB/`.
- **Comandos** (rodar sempre de dentro de `WEB/`):
  ```bash
  npm run dev        # dev server porta 3000
  npm test -- --run  # Vitest
  npx tsc --noEmit   # typecheck
  ```
- **Baselines atuais (não regredir):**
  - `npx tsc --noEmit` → **68 linhas de erro** (pré-existentes, em arquivos não relacionados: `LimitView.tsx`, `Admin/*`, `services/api.ts`, etc). Qualquer número acima de 68 significa que você introduziu erro.
  - `npm test -- --run` → **152 testes, 29 arquivos, todos passando**.
- **Design system:** `DESIGN.md` na raiz do repo. **Leia antes de qualquer código de UI.** Dois temas: `midnight` (dark, accent único `volt-green #00ff9d`) e `yellow` (brutalista, `shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]`, `border-4 border-black`, zero blur).
- **Roteamento:** não é React Router dentro do dashboard. É view por state em `WEB/components/Dashboard.tsx`.

---

## 1. Estado atual (honesto)

### Funciona e está aprovado
- `WEB/components/Analytics/` — view Analytics completa no modo Allure. **É a referência de qualidade.** Sidebar, drag-to-reorder persistido, modal expansível, charts recharts, Hero3D (Three.js), textura ASCII no header.
- `WEB/components/shared/AllureShell.tsx` — casca reutilizável (interface na seção 3).
- `WEB/hooks/useCardOrder.ts` — ordem de cards persistida em `localStorage`.

### Quebrado — é o que este plano conserta
`HomeAllureView`, `InvoicesAllureView` e `ProfileAllureView` **substituíram** as telas antigas no `Dashboard.tsx` sem paridade. Perderam ~80% da funcionalidade:

| Tela | Antiga | Nova | Perda |
|---|---|---|---|
| Perfil | `WEB/components/Profile.tsx` — 959 linhas, 6 popups | `WEB/components/Profile/ProfileAllureView.tsx` — 201 linhas, 0 popups | ~79% |
| Home | `WEB/components/HomeView.tsx` — 2730 linhas, 14 componentes, 5 modais | `WEB/components/Home/HomeAllureView.tsx` — 427 linhas | ~84% |

O checklist item a item está em `docs/plans/2026-09-05-auditoria-paridade-telas-allure.md`.

---

## 2. Schema real (decorar — foi aqui que o executor anterior errou)

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

**Transaction:** o campo `amount` é **sempre positivo**. A direção vem de `type`:
```ts
const ENTRADA_TYPES = new Set(['DEPOSIT', 'PIX_RECEIVED', 'CASHBACK_CREDIT', 'POINTS_EARNED']);
// tudo que não está aqui é saída
// types válidos: PIX_SENT | PIX_RECEIVED | DEPOSIT | PAYMENT | INVOICE_PAYMENT
//                | PIX_CREDIT_SENT | SHOP_DEBIT | SHOP_CREDIT | CASHBACK_CREDIT | POINTS_EARNED
```

---

## 3. Interface real do `AllureShell`

`WEB/components/shared/AllureShell.tsx` — a casca. Ela **já resolve** header, sidebar colapsável, animação de troca de seção e o modal grande. Você só passa conteúdo.

```tsx
interface AllureShellProps<K extends string> {
  title: string;
  subtitle?: string;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  sections: readonly AllureSection<K>[];   // { key, label, icon }
  activeSection: K;
  onSelectSection: (key: K) => void;
  headerExtra?: React.ReactNode;    // linha de KPIs abaixo do título
  headerActions?: React.ReactNode;  // botões no canto do header
  children: React.ReactNode;        // conteúdo da seção ativa
  expandedContent?: React.ReactNode; // se != null, abre o modal grande
  onCloseExpanded?: () => void;
}
```

O modal já é `max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden` com botão X. **Não recrie modal próprio.**

---

## 4. REGRA DE OURO

> **Não reimplemente conteúdo. Renderize o componente que já existe dentro do shell.**

O `AllureShell` é só a moldura. O conteúdo de cada seção deve ser o componente antigo, completo, montado dentro — não uma versão simplificada reescrita.

❌ Errado (o que foi feito e causou a regressão):
```tsx
// Reescreveu uma versão "limpa" do perfil, perdendo 6 popups e o logout
<AllureShell ...>
  <div>...formulário simplificado inventado...</div>
</AllureShell>
```

✅ Certo:
```tsx
<AllureShell ...>
  {activeSection === 'dados' && <Profile />}   {/* componente real, completo */}
</AllureShell>
```

Se o componente antigo assumir tela cheia (`fixed inset-0`, header próprio, botão voltar próprio), **leia o componente e trate**: ou adicione uma prop de "modo embutido", ou envolva num wrapper que neutralize o posicionamento. Nunca copie e simplifique.

---

## 5. As 7 armadilhas (todas já custaram bug real neste projeto)

1. **GSAP stagger em `.children` trava em `opacity: 0`** ao re-executar o efeito (troca de seção). Use variants do Motion (`motion.div` / `Reorder.Item`), que animam pelo ciclo de render do React. Nunca `gsap.from(container.children, ...)`.
2. **`Reorder.Group` axis depende da direção do grid.** Desktop = 1 linha com 2-3 colunas → `axis="x"`. Mobile = empilhado → `axis="y"`. Use `matchMedia('(min-width: 768px)')` reativo.
3. **Modal com recharts precisa de `overflow-x-hidden`** — o `ResponsiveContainer` estoura ~12px por arredondamento e cria barra horizontal.
4. **`applyAsciiHalftone` pinta fundo preto sólido.** No tema yellow o accent é preto → texto preto em fundo preto = invisível. `AsciiHeaderAccent.tsx` resolve tornando o fundo transparente no pós-processamento.
5. **Direção da transação vem de `type`, não do sinal de `amount`** (sempre positivo).
6. **A view full-bleed cobre o Header do app** — o toggle de tema original fica inacessível. Replique o controle dentro da própria tela (`headerActions` do shell).
7. **`tsc` e `vitest` não pegam bug de animação, de layout nem funcionalidade faltando.** Os 8 erros de campo inventado passaram por 152 testes verdes. **Teste ao vivo no navegador, clicando, é obrigatório.**

---

## 6. Como o executor anterior errou (não repita)

1. **Não leu `WEB/types.ts`** antes de escrever os componentes. Usou campos de "app de banco genérico" (`user.name`, `user.agency`, `accountNumber`, `accountType`, `card.limit`, `cardHolderName`) que não existem neste schema.
2. **Escondeu o erro com fallback fabricado**: `?? 5000`, `|| '0001'`, `|| 'CORRENTE'`. Em runtime o JS não quebra com `undefined` — usa o valor falso. O usuário veria número plausível e errado.
3. **Escreveu os mocks de teste com o mesmo schema inventado**, então os testes validavam a mentira e passavam.
4. **Reimplementou em vez de reaproveitar**, perdendo ~80% da funcionalidade sem perceber.
5. **Deixou controle falso na UI**: `ProfileAllureView.tsx` tem o comentário literal `// Toggle states fictícios/UI` — 3 toggles que não persistem e não fazem nada, substituindo toggles reais que existiam.

**Regra derivada:** se um dado não existe no schema, **não invente fallback plausível**. Ou não renderize o campo, ou mostre estado honesto de "indisponível". Nunca um número que parece real.

---

## TASK A — Perfil: restaurar paridade

**Prioridade máxima.** É onde estão os 2 itens que o usuário citou nominalmente.

**Files:**
- Modify: `WEB/components/Profile/ProfileAllureView.tsx`
- Ler (não modificar sem necessidade): `WEB/components/Profile.tsx` (959 linhas — a fonte da verdade funcional)
- Ler: `WEB/utils/AppVersion.ts`

- [ ] **A1.** Ler `Profile.tsx` inteiro. Listar cada funcionalidade. Comparar com o checklist de `docs/plans/2026-09-05-auditoria-paridade-telas-allure.md`. Se achar item que não está no checklist, **acrescente ao checklist**.
- [ ] **A2.** Decidir a estratégia por seção do shell:
  - `dados` → dados pessoais + "Editar Nome do Titular"
  - `seguranca` → senha, PIN, biometria (os reais de `Profile.tsx`, não os fictícios)
  - `preferencias` → os 14 grupos de configuração reais, com persistência em `localStorage` como na tela antiga
- [ ] **A3.** Restaurar o **botão "Sair da Conta Volt"** — `const { logout } = useAuth()`, referência em `Profile.tsx:934-941`. Colocar em lugar visível (sugestão: `headerActions` do shell, ou fixo no rodapé da sidebar).
- [ ] **A4.** Restaurar o **botão "Versão do App" + popup** — state `showVersionPopup`, conteúdo `AppVersion.current` e `AppVersion.fullDetails`, referência em `Profile.tsx:188-204, 945-953`. Usar o `expandedContent` do shell em vez de criar modal novo.
- [ ] **A5.** Restaurar os outros 5 popups: `showOnboardingWelcome`, `showHomeWelcomeMessage`, `showHomeStoriesStatus`, `showOverdueAlertPopup`, `showFinancialHealthPopup`.
- [ ] **A6.** **Eliminar os 3 toggles fictícios** (`ProfileAllureView.tsx:27-30`). Ou liga na persistência real, ou remove. Não deixar controle que finge funcionar.
- [ ] **A7.** Garantir que `WEB/tests/Profile.test.tsx` (que testa persistência de 5 toggles) continua passando — se a tela nova substituiu a antiga, os mesmos comportamentos precisam existir.
- [ ] **A8.** `npx tsc --noEmit` → 68 linhas. `npm test -- --run` → todos verdes.
- [ ] **A9.** **QA ao vivo:** abrir no navegador, nos 2 temas, e clicar em **cada item** do checklist. Confirmar que funciona, não só que aparece. Marcar os `[ ]` do arquivo de auditoria.
- [ ] **A10.** Commit.

---

## TASK B — Home: restaurar paridade

**Files:**
- Modify: `WEB/components/Home/HomeAllureView.tsx`
- Ler: `WEB/components/HomeView.tsx` (2730 linhas)

**14 componentes que a tela antiga monta e a nova não:** `StoryHighlights`, `StoryViewer`, `HomeBanners`, `ShopOffersBanner`, `NewsSection`, `WeeklyStreak`, `SpendingHeatmapSection`, `SpendingTrendsSection`, `PaymentTimelineChart`, `InvoiceSummarySheet`, `FinancialInsightsCarouselModal`, `OverdueAlertModal`, `BiometricModal`, `PasswordModal`.

**5 modais controlados que sumiram:** `isBiometricOpen`, `isCarouselInsightsOpen`, `isIntelligenceMenuOpen`, `isInvoiceSummaryOpen`, `isPasswordVerifyOpen`.

- [ ] **B1.** Ler `HomeView.tsx` inteiro e mapear cada componente/modal à seção do shell onde ele deve viver.
- [ ] **B2.** Distribuir nas seções existentes (`visaoGeral`, `extrato`, `limites`) ou criar seções novas se fizer sentido — decidir com base no que os componentes são, não por estética.
- [ ] **B3.** Modais (`Biometric`, `Password`, `OverdueAlert`, `FinancialInsights`) devem usar o `expandedContent` do shell, não modal próprio.
- [ ] **B4.** Conferir se os botões de ação (Depositar/PIX/Boleto) estão ligados aos modais reais — hoje são props `openDepositModal`/`openPixModal`/`openBoletoModal`, confirmar se o `Dashboard.tsx` passa de fato.
- [ ] **B5.** `tsc` 68 + testes verdes.
- [ ] **B6.** QA ao vivo, item por item, 2 temas.
- [ ] **B7.** Commit.

---

## TASK C — Faturas: ações no modal + navegação completa

**Bug confirmado:** `InvoicesAllureView.tsx:168` faz `onNavigate('currentInvoice')` e sai do layout Allure, caindo na tela antiga. Mesmo padrão em `:178` e `:244`.

**Decisão do usuário:** essas ações abrem no **modal grande dentro da tela**.

**Componentes reais existentes (verificados — não inventar outros):** `CurrentInvoice.tsx`, `ClosedInvoice.tsx`, `InvoiceInstallmentPlan.tsx`, `InvoiceSummarySheet.tsx`, `PaymentHistoryModal.tsx`, `PaymentMethods.tsx`.

- [ ] **C1.** "Pagar Fatura Atual" → `expandedContent` com `<CurrentInvoice />`. Ler o componente antes; se assumir tela cheia, tratar.
- [ ] **C2.** "Ver Todas as Faturas" e "Parcelamentos" → mesmo tratamento.
- [ ] **C3.** Ampliar a sidebar de Faturas com as seções: `Resumo` (atual), `Fatura Atual`, `Fatura Fechada`, `Parcelamentos`, `Histórico de Pagamentos`.
- [ ] **C4.** **Regra de negócio:** fatura FECHADA é imutável. A seção "Fatura Fechada" é somente leitura — nenhum controle que sugira editar ou alterar.
- [ ] **C5.** Atualizar `WEB/tests/InvoicesAllureView.test.tsx` com os títulos novos de sidebar.
- [ ] **C6.** `tsc` 68 + testes verdes + QA ao vivo + commit.

---

## TASK D — Sidebar com lado configurável

**Decisão do usuário:** esquerda por padrão, botão para trocar de lado, escolha persistida em `localStorage`.

**Files:** `WEB/components/shared/AllureShell.tsx` (só ele — as 4 telas herdam)

- [ ] **D1.** State `sidebarSide: 'left' | 'right'`, default `'left'`, lido de `localStorage` na chave `allure-sidebar-side` (global, vale para todas as telas).
- [ ] **D2.** O container já é `flex flex-col md:flex-row` (linha 54). Alternar para `md:flex-row-reverse` quando `right`. **Não duplique o JSX do `<aside>`** — só inverta a direção do flex.
- [ ] **D3.** Botão de trocar lado ao lado do de recolher (linha 131). Ícones `PanelLeft`/`PanelRight`. Grava no `localStorage` a cada clique.
- [ ] **D4.** Os ícones de recolher devem acompanhar o lado atual — hoje são fixos `PanelRightClose`/`PanelRightOpen` (linha 138).
- [ ] **D5.** Teste em `WEB/tests/AllureShell.test.tsx`: default esquerda; toggle troca; valor persistido é lido no mount.
- [ ] **D6.** QA ao vivo nas 4 telas + commit.

---

## TASK E — Textura ASCII como fundo (opcional, decisão estética do usuário)

Hoje a textura é um acento 120x40 no header (`WEB/components/Analytics/AsciiHeaderAccent.tsx`). O usuário sugeriu usá-la como fundo da tela.

**Restrição inegociável:** o fundo é superfície de leitura de dados densos. Contraste do texto **não pode cair abaixo de 4.5:1**.

- [ ] **E1.** Generalizar em `AsciiBackdrop.tsx` preenchendo o container, gerando o padrão em tile (não recalcular pixel a pixel numa área grande — custo de CPU).
- [ ] **E2.** Montar no `AllureShell` atrás do conteúdo, **opt-in por prop** (`backdrop?: boolean`). Não ligar em todas as telas de uma vez.
- [ ] **E3.** Opacidade inicial sugerida 0.04–0.06. `pointer-events: none`, `aria-hidden`.
- [ ] **E4.** Medir contraste nos 2 temas. Se reprovar, baixar opacidade até passar.
- [ ] **E5.** **Mostrar ao usuário antes de aplicar em todas as telas** — é decisão dele.

---

## TASK F — Verificação final

- [ ] **F1.** `npx tsc --noEmit` → exatamente 68 linhas.
- [ ] **F2.** `npm test -- --run` → tudo verde.
- [ ] **F3.** Navegar ao vivo pelas 4 telas (Analytics, Home, Faturas, Perfil), nos 2 temas: colapsar sidebar, trocar lado, arrastar cards, abrir/fechar modal, trocar de seção 5x seguidas (regressão da armadilha 1).
- [ ] **F4.** Mobile 375px em cada tela: 1 coluna, sem sidebar, sem scroll horizontal.
- [ ] **F5.** Console sem erro — **abrir aba nova**, porque o buffer do console não limpa em reload.
- [ ] **F6.** Confirmar que **Shop e Admin continuam intocados** (abrem por rota própria, fora deste escopo).
- [ ] **F7.** Percorrer o checklist inteiro de `docs/plans/2026-09-05-auditoria-paridade-telas-allure.md` e confirmar que cada item está marcado.

---

## TASK G — DESKTOP (bloqueada)

**Não iniciar** antes do usuário validar o WEB. Ordem explícita dele.

- [ ] Mapear `DESKTOP/` — confirmar se compartilha o bundle React do WEB ou é base separada.
- [ ] **Nunca rodar o `.exe` direto** — usar `DESKTOP/run.ps1`. Há duas saídas de build com CEFs diferentes disputando o mesmo cache; rodar o exe direto trava.

---

## Protocolo de verificação (vale para toda task)

1. `npx tsc --noEmit` → **68 linhas exatas**. Mais que isso = você introduziu erro.
2. `npm test -- --run` → todos verdes.
3. **Navegador, clicando de verdade**, nos 2 temas. Screenshot do resultado.
4. Marcar o item no arquivo de auditoria.
5. Commit granular por task, escopado por caminho (`git add <paths exatos>`). **Nunca `git add -A`** — o working tree tem bastante coisa não relacionada de outras sessões.

**Se algo não estiver no schema, no componente existente ou neste documento: pergunte ao usuário. Não invente.**
