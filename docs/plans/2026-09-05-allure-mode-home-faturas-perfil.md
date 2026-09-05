# Modo Allure para Início, Faturas e Perfil — Plano de Implementação

> **Para quem for executar:** este plano é autocontido. A referência viva já implementada é `WEB/components/Analytics/` (view Analytics completa, aprovada pelo usuário em 2026-09-05). Leia `DESIGN.md` na raiz ANTES de qualquer código de UI.

**Goal:** Aplicar o padrão visual "modo Allure" — full-bleed + sidebar colapsável à direita + cards arrastáveis + modais expansíveis — nas telas **Início (Home)**, **Faturas** e **Perfil** do WEB, reutilizando os componentes já construídos na Analytics.

**Escopo — o que NÃO entra:** Shop e Admin ficam de fora (decisão do usuário, 2026-09-05). Ambos já abrem por rota/função própria separada; Admin já tem seu próprio full-bleed.

**Arquitetura:** Mesma estratégia da Analytics: view por state em `Dashboard.tsx` (não React Router), com a condicional de container full-bleed já existente em `Dashboard.tsx` (procure `currentView === 'analytics'` — a mesma linha trata `admin` e `analytics`). Sem lib nova: `motion` (Framer Motion), `recharts`, `gsap`, `three`/`@react-three/fiber` e `lucide-react` já são dependências.

---

## Componentes já prontos para reuso (NÃO reescrever)

| Componente | Caminho | O que faz |
|---|---|---|
| `ChartCard` | `WEB/components/Analytics/ChartCard.tsx` | Casca de card com título, botão expandir (`Maximize2`) e handle de drag opcional (`dragHandle?: boolean` → ícone `GripVertical`). Elevation por tema já resolvida (hard-offset no Yellow, tonal no Midnight). |
| `DonutStatusCard` | `.../DonutStatusCard.tsx` | Donut recharts com label central. |
| `CategoryBarCard` | `.../CategoryBarCard.tsx` | Barra horizontal por categoria. |
| `TrendLineCard` | `.../TrendLineCard.tsx` | Linha 6 meses, eixo Y já formatado em k/M. |
| `ProgressBarRow` | `.../ProgressBarRow.tsx` | Barra de progresso com valores em BRL. |
| `PeriodSummaryCard` | `.../PeriodSummaryCard.tsx` | Card pequeno de 2 métricas (lançamentos + ticket médio). |
| `Hero3D` | `.../Hero3D.tsx` | Icosaedro wireframe R3F decorativo no header (respeita `prefers-reduced-motion`). |
| `AsciiHeaderAccent` | `.../AsciiHeaderAccent.tsx` | Textura ASCII/Halftone decorativa do header (método de dither escolhido pelo usuário). |

**A view de referência a copiar é `WEB/components/Analytics/AnalyticsView.tsx`** — ela já resolve: sidebar direita colapsável, seções por state, `Reorder.Group`/`Reorder.Item` com persistência em `localStorage`, modal expansível e stagger de entrada.

---

## Global Constraints

- **`DESIGN.md` manda.** Nunca inventar hex novo. Midnight: `volt-green #00ff9d` é o ÚNICO accent primário (One Wire Rule). Yellow: hard-offset shadow (`shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]`, `border-4 border-black`), zero blur (No-Blur Rule).
- **Nenhuma lib nova.** Drag = `Reorder` do `motion`. Charts = `recharts`. Ícones = `lucide-react`.
- **Não substituir as telas mobile atuais.** O modo Allure é o layout ≥`md`; abaixo disso continua empilhado em 1 coluna, sem sidebar (`hidden md:flex`).
- **Densidade:** cards principais em `md:grid-cols-2`, cards menores em `md:grid-cols-3` (regra que o usuário definiu vendo o Allure).
- Componentes em `PascalCase.tsx`, sem `any`, testes em `WEB/tests/` com Vitest.

---

## Skills obrigatórias (checkpoints)

Este plano é sobre visual — não codar sem passar pelos checkpoints abaixo. Skills reais deste projeto (`WEB/.claude/skills/`), já usadas e validadas na Analytics:

| Quando | Skill | Por quê |
|---|---|---|
| Antes de começar QUALQUER task de UI nova (1, 3, 4, 5) | `frontend-design` (oficial Anthropic) + `ecc:frontend-design-direction` | Evita "AI-slop" — direção de design intencional antes de codar, não depois. |
| Ao escrever qualquer animação (`motion`/`gsap`) | `motion-principles` | Regras não-negociáveis: nunca animar width/height/top/left, nunca scale(0), sempre `prefers-reduced-motion`, exit sempre mais sutil que enter. |
| Ao final de CADA task de UI (1, 3, 4, 5), antes do commit | `design-audit` | Rodar os greps reais contra a pasta do componente novo (motion gaps, a11y, consistência de duration/easing) — feito na Analytics em 2026-09-05, resultado: 0 critical, 0 important, só nice-to-have (recharts sem reduced-motion). |
| Se for extrair tokens de alguma outra referência visual | `WEB:design-dna` (escopado a este projeto) | Já usado pra extrair a densidade do Allure Report original — não reinventar o processo. |

**Resultado da auditoria já rodada (2026-09-05) contra `WEB/components/Analytics/`:** 0 critical, 0 important. Nice-to-have pendente: recharts (Donut/Bar/Line) não respeita `prefers-reduced-motion` — a lib anima por padrão. Corrigir isso ao extrair o `AllureShell` (Task 1) se for prático, senão registrar como known-gap.

---

## Armadilhas já encontradas (não repetir)

1. **Stagger com GSAP em `.children` quebra.** `gsap.from(grid.children, ...)` ficava travado em `opacity: 0` quando o efeito re-executava (troca de seção). **Use `motion.div`/`Reorder.Item` com `variants`** — animação pelo ciclo de render do React, não por mutação direta do DOM. Ver `gridVariants`/`cardVariants` em `AnalyticsView.tsx`.
2. **`Reorder.Group axis` depende da direção do grid.** Em desktop os cards ficam em UMA linha (2-3 colunas) → `axis="x"`. Em mobile empilham → `axis="y"`. `AnalyticsView.tsx` já resolve com um state `isDesktopGrid` alimentado por `matchMedia('(min-width: 768px)')`.
3. **Modal precisa de `overflow-x-hidden`.** O `ResponsiveContainer` do recharts estoura ~12px por arredondamento e cria barra de rolagem horizontal feia. Classe correta: `w-full max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden relative`.
4. **`applyAsciiHalftone` pinta fundo preto sólido.** No tema Yellow o accent é preto → texto preto sobre fundo preto = invisível. `AsciiHeaderAccent.tsx` corrige tornando o fundo transparente no pós-processamento.
5. **Direção de transação vem de `t.type`, não do sinal de `t.amount`** (o schema sempre guarda positivo). Entradas: `DEPOSIT`, `PIX_RECEIVED`, `CASHBACK_CREDIT`, `POINTS_EARNED`.
6. **Toggle de tema fica inacessível dentro da view full-bleed** (o `fixed inset-0 z-[100]` cobre o Header). Se a nova tela precisar do toggle, replicar o botão dentro da própria sidebar.
7. **Teste automatizado não pega bug de animação/layout.** `tsc` + `vitest` passaram verdes em TODOS os bugs acima. Só verificação ao vivo no navegador pegou. Sempre testar clicando/arrastando de verdade.

---

## Task 1: Extrair o shell reutilizável (`AllureShell`)

**Problema a resolver:** hoje sidebar + header + modal + grid arrastável estão embutidos em `AnalyticsView.tsx`. Copiar isso 3x geraria duplicação.

**Files:**
- Create: `WEB/components/shared/AllureShell.tsx`
- Modify: `WEB/components/Analytics/AnalyticsView.tsx` (passa a consumir o shell)
- Test: `WEB/tests/AllureShell.test.tsx`

**Interface produzida:**
```tsx
interface AllureSection<K extends string> {
  key: K;
  label: string;
  icon: LucideIcon;
}

interface AllureShellProps<K extends string> {
  title: string;                              // ex: "Analytics", "Faturas"
  sections: AllureSection<K>[];               // itens da sidebar
  activeSection: K;
  onSectionChange: (key: K) => void;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  headerAccessory?: React.ReactNode;          // Hero3D + AsciiHeaderAccent
  expandedContent?: React.ReactNode | null;   // conteúdo do modal (null = fechado)
  onCloseExpanded: () => void;
  children: React.ReactNode;                  // o grid da seção ativa
}
```

- [ ] **Passo 1:** Extrair de `AnalyticsView.tsx` para `AllureShell.tsx`: o `<aside>` da sidebar (com `sidebarCollapsed`, ícones `PanelRightClose`/`PanelRightOpen`, `border-l`), o `<header>` (botão voltar mobile + título + `headerAccessory`) e o bloco de modal (`AnimatePresence` + backdrop + painel `max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden`).
- [ ] **Passo 2:** Reescrever `AnalyticsView.tsx` usando `<AllureShell>`, mantendo comportamento idêntico (sem mudança visual).
- [ ] **Passo 3:** Teste: renderiza título, renderiza N itens de sidebar, dispara `onSectionChange` no clique, mostra modal quando `expandedContent` != null.
- [ ] **Passo 4:** Rodar `cd WEB && npm test -- --run` (baseline atual: 136 testes) e `npx tsc --noEmit` (baseline: 68 erros pré-existentes, nenhum novo).
- [ ] **Passo 5:** Verificar ao vivo que a Analytics continua idêntica (regressão visual).
- [ ] **Passo 6:** Commit.

---

## Task 2: Hook de ordem persistida (`useCardOrder`)

**Files:**
- Create: `WEB/hooks/useCardOrder.ts`
- Modify: `WEB/components/Analytics/AnalyticsView.tsx`
- Test: `WEB/tests/useCardOrder.test.ts`

Extrai a lógica hoje duplicada em `AnalyticsView.tsx` (`loadCardOrder` + `handleReorder` + escrita em `localStorage`).

**Interface produzida:**
```tsx
function useCardOrder<T extends string>(
  storageKey: string,          // ex: "home-card-order-geral"
  defaultOrder: readonly T[]
): [T[], (next: T[]) => void];
```

- [ ] **Passo 1:** Implementar com a mesma reconciliação já existente (ignora chaves inválidas do storage, acrescenta chaves novas que faltarem no fim, cai no default se der erro/quota).
- [ ] **Passo 2:** Testes: default quando storage vazio; lê ordem salva; descarta chave inválida; acrescenta chave nova; não quebra com JSON corrompido.
- [ ] **Passo 3:** Trocar em `AnalyticsView.tsx`; rodar suíte; commit.

---

## Task 3: Início (Home) no modo Allure

**Files:**
- Create: `WEB/components/Home/HomeAllureView.tsx`
- Modify: `WEB/components/Dashboard.tsx` (nova view + condicional full-bleed)
- Test: `WEB/tests/HomeAllureView.test.tsx`

**Seções da sidebar:** `Visao Geral` (2 colunas) · `Extrato` (com modal correlacionado de Gastos) · `Limites` (3 colunas)

**Layout (ASCII):**
```
┌───────────────────────────────────────┬──────────────┐
│ Ola, {nome}       [ascii] [Hero3D]     │ Voltar    [<]│
│ ┌────────┬────────┬────────┬────────┐ │──────────────│
│ │ Saldo  │ Gasto  │ Prox.  │ Limite │ │ ▣ Visao Geral│
│ │        │ mes    │ fatura │ disp.  │ │ ▤ Extrato    │
│ └────────┴────────┴────────┴────────┘ │ ▦ Limites    │
│ ┌──────────────────┬──────────────────┐│──────────────│
│ │  Status (donut)   │  Trend 6 meses  ││              │
│ └──────────────────┴──────────────────┘│              │
└───────────────────────────────────────┴──────────────┘
```

**Modal correlacionado (pedido explícito do usuário):** ao entrar na seção `Extrato`, o grid mostra a lista de lançamentos E um card "Gastos" (donut por categoria) ao lado, alimentado pelas MESMAS transações filtradas do extrato — quando o usuário filtra o extrato, o card de Gastos acompanha.

- [ ] **Passo 1:** KPI row (4 cards pequenos, `md:grid-cols-4`): saldo, gasto do mês, próxima fatura, limite disponível. Fonte: `user` do `useAuth()` + `user.transactions`. Sem inventar número — se o dado não existir no `User`, não mostrar o card.
- [ ] **Passo 2:** Seção `Visao Geral`: `DonutStatusCard` + `TrendLineCard` (2 colunas), reusando os cálculos de `AnalyticsView.tsx` (extrair para `WEB/utils/analyticsCalcs.ts` se for duplicar).
- [ ] **Passo 3:** Seção `Extrato`: lista rolável + `CategoryBarCard`/donut correlacionado. Estado de filtro compartilhado entre os dois.
- [ ] **Passo 4:** Seção `Limites`: 3 `ProgressBarRow` (crédito, PIX diário, saque) em `md:grid-cols-3`.
- [ ] **Passo 5:** Ligar em `Dashboard.tsx` (novo `case` na view + incluir na condicional full-bleed junto de `admin`/`analytics`).
- [ ] **Passo 6:** Testes de smoke (renderiza seções, troca de seção, modal abre/fecha).
- [ ] **Passo 7:** Verificação ao vivo: 2 temas, drag, modal, mobile 375px, console limpo. Commit.

---

## Task 4: Faturas no modo Allure

**Files:**
- Create: `WEB/components/Invoices/InvoicesAllureView.tsx`
- Modify: `WEB/components/Dashboard.tsx`
- Test: `WEB/tests/InvoicesAllureView.test.tsx`

**Seções:** `Fatura Atual` (2 colunas) · `Historico` (3 colunas)

```
┌───────────────────────────────────────┬──────────────┐
│ Faturas           [ascii] [Hero3D]     │ Voltar    [<]│
│ ┌────────┬────────┬────────┬────────┐ │──────────────│
│ │ Aberta │ Fechada│ Vencto │ Minimo │ │ ▣ Fatura Atual│
│ └────────┴────────┴────────┴────────┘ │ ▤ Historico  │
│ ┌──────────────────┬──────────────────┐│──────────────│
│ │ Gasto p/categoria │ Lancamentos      ││              │
│ │  (bar)            │ (lista rolavel)  ││              │
│ └──────────────────┴──────────────────┘│              │
└───────────────────────────────────────┴──────────────┘
```

- [ ] **Passo 1:** KPI row: total aberta, total fechada, vencimento, pagamento mínimo. **Atenção:** o backend tem `currentInvoiceTotal` canônico — usar ele, NÃO recalcular no front (bug já corrigido em sessão anterior, ver memória do projeto).
- [ ] **Passo 2:** Seção `Fatura Atual`: `CategoryBarCard` dos gastos da fatura + lista de lançamentos rolável.
- [ ] **Passo 3:** Modal correlacionado: expandir um lançamento parcelado mostra o detalhe das parcelas.
- [ ] **Passo 4:** Seção `Historico`: 3 cards menores (faturas anteriores, evolução mensal, média de gasto).
- [ ] **Passo 5:** Ligar em `Dashboard.tsx`, testes, verificação ao vivo, commit.

**Cuidado:** fatura FECHADA é imutável — não introduzir nenhuma UI que sugira editar/alterar uma fatura fechada (regra de negócio já auditada no projeto).

---

## Task 5: Perfil no modo Allure

**Files:**
- Create: `WEB/components/Profile/ProfileAllureView.tsx`
- Modify: `WEB/components/Dashboard.tsx`
- Test: `WEB/tests/ProfileAllureView.test.tsx`

**Diferença importante:** Perfil NÃO é chart-heavy. Reusa só a casca (`AllureShell`: sidebar + full-bleed + modal), com cards de configuração em vez de gráficos. Não forçar gráfico onde não tem dado que justifique.

**Seções:** `Dados` (2 colunas) · `Seguranca` (2 colunas) · `Preferencias` (1 coluna, lista de toggles)

```
┌───────────────────────────────────────┬──────────────┐
│ Perfil                                 │ Voltar    [<]│
│ ┌──────────────────┬──────────────────┐│──────────────│
│ │ Dados pessoais    │ Seguranca        ││ ▣ Dados      │
│ │ nome, cpf, email  │ senha, 2FA       ││ ▤ Seguranca  │
│ │ [editar]          │ [editar]         ││ ◉ Preferencias│
│ └──────────────────┴──────────────────┘│──────────────│
│ ┌──────────────────────────────────────┐│              │
│ │ Notificacoes (lista de toggles)      ││              │
│ └──────────────────────────────────────┘│              │
└───────────────────────────────────────┴──────────────┘
```

- [ ] **Passo 1:** Reaproveitar os toggles que já existem em `WEB/components/Profile.tsx` (há testes cobrindo os 5 toggles + persistência em `localStorage` — não quebrar `WEB/tests/Profile.test.tsx`).
- [ ] **Passo 2:** Modal correlacionado: editar dados pessoais abre formulário no modal grande.
- [ ] **Passo 3:** Incluir o toggle de tema DENTRO da sidebar desta view (o Header fica coberto pelo full-bleed — ver Armadilha 6).
- [ ] **Passo 4:** Ligar em `Dashboard.tsx`, testes, verificação ao vivo, commit.

---

## Task 3.5: Corrigir campos inventados (bug encontrado em 2026-09-05)

**Causa raiz:** as Tasks 1-5 foram implementadas por outro processo (não a sessão que escreveu este plano) sem ler `WEB/types.ts` antes de codar. Usou campos genéricos de "app de banco" que não existem neste schema, com fallbacks fabricados que mascaram o erro em runtime (JS não quebra com `undefined`, só usa o valor falso). Isso é exatamente a violação que a Task 3 já proibia ("sem inventar número").

**8 erros de tsc encontrados, todos por campo inexistente:**

| Arquivo | Linha | Campo inventado | Campo real | Fallback fabricado a remover |
|---|---|---|---|---|
| `HomeAllureView.tsx` | 298 | `creditCard.limit` | `creditCard.totalLimit` | `?? 5000` |
| `HomeAllureView.tsx` | 404 | `creditCard.limit` (fallback) | usar só `availableLimit` | `?? user?.creditCard?.limit ?? 0` |
| `HomeAllureView.tsx` | 411 | `user.name` | `user.fullName` | — |
| `InvoicesAllureView.tsx` | 68 | `creditCard.limit` | `creditCard.totalLimit` | `?? 5000` |
| `ProfileAllureView.tsx` | 38 | `user.name` | `user.fullName` | — |
| `ProfileAllureView.tsx` | 66 | `user.agency` | **não existe** — app não tem conta corrente tradicional | `|| '0001'` |
| `ProfileAllureView.tsx` | 70 | `user.accountNumber` | **não existe** | `|| 'Não informada'` |
| `ProfileAllureView.tsx` | 74 | `user.accountType` | **não existe** | `|| 'CORRENTE'` |

**Files:**
- Modify: `WEB/components/Home/HomeAllureView.tsx`
- Modify: `WEB/components/Invoices/InvoicesAllureView.tsx`
- Modify: `WEB/components/Profile/ProfileAllureView.tsx`

- [ ] **Passo 1:** `HomeAllureView.tsx` linha 298 — trocar `user?.creditCard?.limit ?? 5000` por `user?.creditCard?.totalLimit ?? 0`.
- [ ] **Passo 2:** `HomeAllureView.tsx` linha 404 — trocar `user?.creditCard?.availableLimit ?? user?.creditCard?.limit ?? 0` por `user?.creditCard?.availableLimit ?? 0`.
- [ ] **Passo 3:** `HomeAllureView.tsx` linha 411 — trocar `user?.name || 'Cliente'` por `user?.fullName || 'Cliente'`.
- [ ] **Passo 4:** `InvoicesAllureView.tsx` linha 68 — trocar `creditCard?.limit ?? 5000` por `creditCard?.totalLimit ?? 0`.
- [ ] **Passo 5:** `ProfileAllureView.tsx` linha 38 — trocar `user?.name` por `user?.fullName`.
- [ ] **Passo 6:** `ProfileAllureView.tsx` linhas 62-77 — remover o `ChartCard` inteiro "Dados Bancários" (Agência/Conta Corrente/Tipo de Conta — produto não tem esse conceito). Substituir por dados reais que existem: número do cartão (`user.creditCard.number`, mascarado) e status da conta (`user.accountStatus`).
- [ ] **Passo 7:** Rodar `cd WEB && npx tsc --noEmit` — confirmar volta aos 68 erros de baseline (zero novo).
- [ ] **Passo 8:** Rodar `cd WEB && npm test -- --run` — confirmar 152 testes (ou mais, se Passo 6 mudar algo coberto por teste) continuam passando.
- [ ] **Passo 9:** Commit.

---

## Task 6: Verificação final e navegação

- [ ] **Passo 1:** `cd WEB && npm test -- --run` — tudo verde (baseline 136 + novos).
- [ ] **Passo 2:** `npx tsc --noEmit` — nenhum erro novo (baseline: 68 pré-existentes em arquivos não relacionados).
- [ ] **Passo 3:** Navegar ao vivo pelas 4 telas no modo Allure (Analytics, Início, Faturas, Perfil) nos 2 temas, testando: colapsar sidebar, arrastar cards, abrir/fechar modal, trocar seção 5x seguidas (regressão da Armadilha 1).
- [ ] **Passo 4:** `resize_window` mobile 375px em cada tela — 1 coluna, sem sidebar, sem scroll horizontal.
- [ ] **Passo 5:** Console sem erro em aba nova (o buffer do console não limpa em reload — abrir aba limpa).
- [ ] **Passo 6:** Confirmar que Shop e Admin continuam INTOCADOS.

---

## Task 7 (fase 3, só depois da aprovação do usuário): DESKTOP

**Não iniciar antes do usuário validar o WEB.** Ordem explícita do usuário (2026-09-05): "desktop quero só efetuar quando eu validar o web".

- [ ] Mapear `DESKTOP/` — confirmar se compartilha o bundle React do WEB ou é base separada.
- [ ] Usar skill `desktop-principles` (hover, atalhos de teclado, multi-janela).
- [ ] **Nunca rodar o `.exe` direto** — usar `DESKTOP/run.ps1` (há duas saídas de build com CEFs diferentes disputando o mesmo cache; rodar o exe direto trava).
