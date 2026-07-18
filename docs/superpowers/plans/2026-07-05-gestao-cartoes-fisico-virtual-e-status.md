# Plano: Gestão de Cartões Físico/Virtual + Status Melhorado

**Data:** 2026-07-05 · **Branch:** `feature/mobile-web-redesign`
**Fonte:** `WEB/new-base-fintechbank` (working tree não commitado) + spec `.spec/6_gestao_cartoes_fisico_e_virtual.md`

## Escopo da atualização (o que a nova base entrega)

| Arquivo (new-base) | Δ | Conteúdo |
|---|---|---|
| `CardDeliveryTracking.tsx` | +417 (novo) | Timeline logística do cartão físico com 4 estados (`manufacturing → shipping → tracking → delivered`), SVGs animados via `motion/react`, stepper clicável e botão "Avançar Logística" (debug/demo) |
| `CardsView.tsx` | +964 | Cartões virtuais (criação instantânea, CVV com expiração de 180s, bloqueio, exclusão), rastreamento do físico integrado, desbloqueio pós-entrega (validade `08/30` + CVV `123` mockados), persistência em `localStorage` (`volt_physical_status`, `volt_physical_unlocked`, `volt_virtual_cards`, `volt_active_virtual_card_id`) |
| `PixModal.tsx` | +12 | Restyle do painel de Auto-categorização IA (Brain + % de certeza + razão). A chamada `POST /api/gemini/categorize` já existia na base |
| `HomeView.tsx` | +131 | **Status melhorado**: Alerta de Orçamento Diário com ícones SVG (substitui emojis) e 4 cards de status brancos dentro das Stories (Simulador, Economia, Transferência Segura, Recebimento) |
| `index.css` | +79 | Classes de isenção do override brutalista: `.stories-dark`, `.credit-card-shell`, `.exempt-brutalist` |

## Correção de premissa (IMPORTANTE)

O plano gerado anteriormente assumiu que o MOBILE é **React Native** (react-native-svg, reanimated, AsyncStorage). **Isso está errado para este repositório**: o `MOBILE/` é **Ionic/Capacitor rodando React DOM + Tailwind**, espelhado 1:1 com o WEB (mesmos componentes, hash idêntico em vários arquivos). Consequências:

- **Não há conversão de SVG** — os SVGs/`motion` rodam como estão no WebView.
- **Não há AsyncStorage** — `localStorage` funciona normalmente no Capacitor.
- A Fase 2 vira **espelhamento por cópia** (`Copy-Item` + ajuste de imports se necessário), não uma reescrita.
- O diretório `mobileAppRN/` na raiz é outro projeto e está **fora do escopo**.

## Respostas às Open Questions

1. **`/api/gemini/categorize` existe?** Não — e **decisão do usuário (2026-07-05): não criar rota no backend**. A categorização será **totalmente mockada no cliente**: função `categorizePixTransaction(description)` em `services/api.ts` e `services/mockApi.ts` com heurística local por palavras-chave (retorna `{ category, confidence, reason }` com um pequeno delay simulado). Sem `fetch` para `/api/gemini/categorize`.
2. **localStorage vs AsyncStorage?** Manter `localStorage` nos dois apps (ver correção de premissa acima).
3. **Mock `08/30` + `123`?** Manter — é o fluxo de teste documentado na spec (seção 4) e aparece na própria UI como dica.

## Estado atual do working tree (pré-requisito)

O working tree já contém WIP não commitado (rename `PixModal.tsx → PixView.tsx` nos dois apps, ajustes de tema no `StoryViewer`, `HomeView`, `Dashboard`, etc.). **Fase 0 = validar builds e commitar esse WIP** antes de portar coisas novas, para não misturar mudanças.

## Fases de execução

### Fase 0 — Estabilizar WIP atual
- `npm run build` (WEB e MOBILE) + `npm test` → commitar o rename PixView + ajustes de tema pendentes.

### Fase 1 — WEB
1. **CSS**: portar as isenções (+79 linhas) para `WEB/styles/global.css` (adaptar: a base usa `index.css`, nós usamos `global.css` com o mesmo sistema de overrides `body:not(.theme-midnight)`).
2. **`CardDeliveryTracking.tsx`** (novo em `WEB/components/`): copiar da base **corrigindo os findings do react-review** (ver seção abaixo; ex.: stepper com `<div onClick>` → `<button>` com teclado/aria).
3. **`CardDashboard.tsx`**: integrar a seção de Cartões Virtuais + rastreamento do físico + desbloqueio (equivalente ao `CardsView` da base, adaptado ao nosso layout/tema Yellow). Aplicar `.credit-card-shell`/`.exempt-brutalist` onde o override brutalista quebraria o visual.
4. **`PixView.tsx`**: portar o painel de auto-categorização (estado `aiConfidence`/`aiReason`/`isAutoCategorizing`) chamando a `categorizePixTransaction` mockada (debounce + cancelamento ao desmontar; sem fetch real).
5. **`HomeView.tsx`**: portar os 4 cards de status das Stories (`stories-dark`) e os ícones SVG do Alerta de Orçamento Diário (adaptar aos hunks equivalentes do nosso HomeView).
6. `services/api.ts` + `services/mockApi.ts`: função `categorizePixTransaction(description)` — heurística local mockada, mesma assinatura nos dois serviços.

### Fase 2 — MOBILE (espelhamento)
- Copiar `CardDeliveryTracking.tsx`, `CardDashboard.tsx`, `PixView.tsx`, `HomeView.tsx` (verificar hash pós-cópia, padrão da sessão).
- Portar isenções CSS para `MOBILE/src/theme/variables.css`.
- `services/api.ts`/`mockApi.ts` do MOBILE: mesma função.

### ~~Fase 3 — Backend~~ (removida por decisão do usuário — categorização mockada no cliente)

### Fase 3 — Verificação
- **Automatizada**: Vitest — lógica de criação/bloqueio/exclusão de cartão virtual e expiração do CVV (timers fake); testes existentes continuam verdes (23 WEB / 68 MOBILE).
- **Manual** (dev servers `:3000`/`:3002`, pgdb real via Docker): aba Cartões → avançar logística até `delivered` → desbloquear com `08/30`/`123`; criar/excluir cartão virtual e observar timer do CVV; "Classificar com IA" no PixView (com e sem backend); Stories e Alerta de Orçamento nos DOIS temas (Yellow e Midnight).
- Commits por fase (padrão `feat(mobile,web): ...`).

## Riscos
- **Conflito de overrides**: o CSS brutalista do tema Yellow usa `!important` agressivo; as classes de isenção precisam vir DEPOIS das regras existentes no arquivo. Testar visual nos dois temas a cada componente.
- **`CardsView` (base) ≠ `CardDashboard` (nosso)**: não é cópia direta — é porte de seções. Maior esforço da tarefa.
- **HomeView divergente**: nosso HomeView e o da base compartilham design mas divergiram; portar por hunk, não por arquivo.

## Revisão React (`/ecc:react-review`) — resultado

**Veredito: FAIL (corrigir durante o porte).** 1 CRITICAL · 4 HIGH · 3 MEDIUM. Correções obrigatórias ao portar:

| Sev | Onde (base) | Problema | Correção no porte |
|---|---|---|---|
| CRITICAL | `CardDeliveryTracking.tsx:17-52` | `getStatusDetails` sem `default` → se o `localStorage` (`volt_physical_status`) tiver valor sujo (ex.: `'unlocked'`, que o próprio CardsView grava), retorna `undefined` e **crasha a tela de Cartões** | Adicionar `default:` com fallback seguro **e** validar o valor lido do localStorage contra a união antes do `setState` |
| HIGH | `CardDeliveryTracking.tsx:114-118` | Stepper é `<div onClick>` sem teclado/role | Converter para `<button type="button">` com `aria-label` |
| HIGH | `CardsView.tsx:428-432, 738-749` | Criar cartão / selecionar cartão em `<div onClick>` | `<button>` ou `role="button"` + `tabIndex` + Enter/Space |
| HIGH | `CardsView.tsx:123-126, 152-160, 256-259` | `setTimeout` sem cleanup → `setState` após unmount (pior no Capacitor) | Guardar ids em ref + cleanup em `useEffect` |
| HIGH | `PixModal.tsx:28-53` | Categorização sem AbortController/debounce/guard de unmount; falha silenciosa | Como será **mockada** (decisão do usuário), implementar com cancelamento ao desmontar + estado de erro visível |
| MEDIUM | `HomeView.tsx` (diff) | SVGs decorativos sem `aria-hidden` | Adicionar `aria-hidden="true"` |
| MEDIUM | `index.css:78-152` | 3 estratégias de isenção diferentes (hex manual / `unset`), traição de manutenção com o override `!important` | Padronizar: preferir `unset`/exclusão via `:where(.stories-dark, .credit-card-shell, .exempt-brutalist)` na regra brutalista |
| MEDIUM | subprojeto | Sem ESLint (hooks/a11y não fiscalizados) | Nossos projetos já têm lint; rodar após o porte |
