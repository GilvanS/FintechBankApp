# T1 — Auditoria de divergência: WEB (redesign) vs MOBILE

- **Data**: 2026-07-02
- **Branch**: feature/mobile-web-redesign
- **ADR**: docs/adr/ADR-001-revisar-plano-mobile-com-novo-design-web.md
- **Fonte de verdade do design**: `WEB/` (raiz — já recebeu o redesign do new-base-fintechbank; app live em localhost:3000)
- **Alvo**: `MOBILE/` (Capacitor + Ionic React)

## 1. Componentes que existem SÓ no WEB (redesign — portar para MOBILE)

| Componente | Papel |
|---|---|
| SpendingHeatmapSection.tsx | Mapa de Calor (rolling 3 meses, SVG, stats, anomalias) |
| SpendingTrendsSection.tsx | Tendências de Gastos |
| charts/ (D3AreaChart, D3Heatmap, D3RadialProgress, D3SparkLine) | Gráficos D3 do Painel de Análise |
| AiAssistantModal.tsx, AiRecurringBillModal.tsx | AI Assistant / Conta Recorrente IA |
| FinancialHealthModal.tsx | Saúde Financeira |
| WeeklyStreak.tsx | Weekly Streak |
| BiometricModal.tsx | Biometria (simulação web → T9 avalia plugin nativo) |
| DepositModal.tsx, PixModal.tsx | Modais novos de Depósito e Pix |
| CardsView.tsx, InvoiceView.tsx, LimitView.tsx, ShopView.tsx | Views novas (substituem fluxos antigos) |
| SmartAlerts.tsx | Alertas inteligentes |
| ProtectedRoute.tsx, Login.tsx (components), Onboarding.tsx, DemoBanner.tsx | Infra de auth/onboarding nova |

## 2. Componentes SÓ no MOBILE (preservar — não sobrescrever)

AddToCartModal, BlockedCardModal, ClosedInvoiceView, ConfirmDeleteModal, CurrentInvoiceView, ErrorState, ExtratoCompra, InfoCarousel, InstallmentReviewInvoice, InvoicePaymentReceipt, LoadingSpinner, Pix.tsx, PopupUM, WelcomePopup.

## 3. Em comum mas divergentes (~76 arquivos; 17 idênticos)

Maiores deltas (linhas web vs mobile) — indicam telas redesenhadas no WEB:

- **HomeView.tsx**: 2603 vs 519 — home totalmente nova (T4)
- **Header.tsx**: 1063 vs 34 — header novo (T3)
- **Dashboard.tsx**: 919 vs 527 (T4)
- **Profile.tsx**: 808 vs 162
- **Admin.tsx**: 778 vs 716
- **CardDashboard.tsx**: 522 vs 480 (T6)
- **ClosedInvoice.tsx**: 512 vs 169; **CurrentInvoice.tsx**: 224 vs 101 (T6)
- **Shop.tsx**: 328 vs 210 (T7)
- **StatementPaginated.tsx**: 332 vs 259; Statement: 282 vs 327 (T6)

Casos onde o MOBILE é MAIOR (evoluiu separado — mesclar com cuidado, não sobrescrever cegamente):
- **PixKeyManagement.tsx**: mobile 611 vs web 182 (tem IDs Appium e fluxos extras)
- **Notifications.tsx**: mobile 191 vs web 80
- **PreLoginDashboard.tsx**: mobile 156 vs web 63
- **ProductPage.tsx**: mobile 118 vs web 56
- **Insurance, Loans, Marketplace, NewsSection, TransactionReceipt**: mobile maior
- **CreditCardInfo.tsx**: web está VAZIO (0 linhas) — manter o do mobile

## 4. Infra / stack

| Item | WEB | MOBILE | Ação |
|---|---|---|---|
| Router | react-router-dom **v7** | react-router-dom **v5** + @ionic/react-router | Adaptar navegação ao portar (não portar rotas 1:1) |
| UI shell | React puro | **Ionic React 8** + Capacitor 7 | Manter shell Ionic |
| HTTP | services/api.ts (fetch) | services/api.ts + **axios** | Manter camada API do MOBILE |
| CSS | styles/global.css (496 l) + tailwind (64 l, plugins forms/container-queries) | theme/variables.css (55 l) + tailwind (31 l) | T2: portar global.css/tokens |
| Charts | **d3 7.9.0** (instalado mas NÃO declarado no package.json do WEB — dep fantasma) | — | T5: adicionar `d3` como dependência real no MOBILE |
| Ícones/anim | lucide-react, motion, recharts declarados | — | Adicionar conforme uso real ao portar |
| Contexts | AuthContext + AppStateContext (318 l) + GlobalDialogContext (110 l) | Só AuthContext | T10: portar os 2 contexts que faltam |
| types.ts | 133 l | 157 l | Mesclar (mobile tem tipos extras) |

## 5. Riscos mapeados

1. **Seletores Appium**: MOBILE tem dezenas de docs de seletores (resource-id via WebView). Sobrescrever componentes quebra os seletores — preservar `id`/`data-testid`/`aria-label` existentes ao portar.
2. **Dep fantasma d3**: declarar explicitamente no MOBILE/package.json.
3. **Router v5 vs v7**: sintaxe de navegação incompatível (`useHistory` vs `useNavigate`); portar componentes convertendo chamadas de navegação.
4. **Performance WebView**: SVG animado do Mapa de Calor precisa validação em device (T5/T12).
5. **CreditCardInfo.tsx do WEB está vazio** — nunca copiar por cima do mobile.

## 6. Ordem de execução confirmada

T2 (tokens) → T3 (Header/Nav) → T4 (Home) → T5 (Análise/Heatmap) → T6 (Cartões/Fatura/Limites/Extrato) → T7 (Pix/Shop) → T8 (AI/Streak/Saúde/Boleto) → T9 (Biometria) → T10 (Contexts/Auth) → T11 (nativo) → T12 (build/teste).
