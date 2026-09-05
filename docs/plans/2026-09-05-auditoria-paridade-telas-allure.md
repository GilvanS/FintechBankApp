# Auditoria de Paridade — Telas Allure vs Telas Antigas

**Motivo:** as telas `HomeAllureView`, `InvoicesAllureView` e `ProfileAllureView` **substituíram** as telas antigas no `Dashboard.tsx` sem paridade de funcionalidade. O usuário identificou a falta do botão "Sair" e do botão "Versão do Projeto"; a auditoria abaixo mostra que a perda é muito maior.

**Status:** ⚠️ REGRESSÃO EM PRODUÇÃO NO BRANCH `developer` (commit `ad3c9b20`). Nenhuma correção aplicada ainda.

**Regra para a correção:** nenhuma tela Allure pode ir pra frente enquanto cada item abaixo não estiver ✅ ou explicitamente descartado pelo usuário. Marcar como feito só depois de **testar ao vivo no navegador** (Armadilha 7 — `tsc`/`vitest` não pegam funcionalidade faltando).

---

## Tamanho da perda

| Tela | Antiga | Nova (Allure) | Perda de código |
|---|---|---|---|
| Perfil | `Profile.tsx` — 959 linhas, 6 popups | `ProfileAllureView.tsx` — 201 linhas, 0 popups | ~79% |
| Home | `HomeView.tsx` — 2730 linhas, 14 componentes, 5 modais | `HomeAllureView.tsx` — 427 linhas | ~84% |
| Faturas | `InvoicesView.tsx` — 118 linhas (+ `CurrentInvoice`, `ClosedInvoice`, `InvoiceInstallmentPlan`) | `InvoicesAllureView.tsx` — 290 linhas | ver Task 9/10 do plano principal |

---

## PERFIL — checklist de paridade

### Popups/modais que existiam e sumiram (6)

- [ ] `showVersionPopup` — **botão "Versão do App"** + popup com `AppVersion.current` e `AppVersion.fullDetails` (`Profile.tsx:188-204, 945-953`)
- [ ] `showOnboardingWelcome` — controle do onboarding
- [ ] `showHomeWelcomeMessage` — mensagem de boas-vindas da Home
- [ ] `showHomeStoriesStatus` — stories/status da Home
- [ ] `showOverdueAlertPopup` — alerta de fatura em atraso
- [ ] `showFinancialHealthPopup` — popup de saúde financeira

### Ações que sumiram

- [ ] **Botão "Sair da Conta Volt"** — `logout` do `useAuth()` (`Profile.tsx:934-941`)
- [ ] "Editar Nome do Titular"
- [ ] "Detalhes da Build"

### Configurações que existiam (verificar uma a uma)

- [ ] Aparência do Aplicativo — alternar Amarelo Volt / Midnight
- [ ] Preferências da Tela Inicial (grupo)
- [ ] Mostrar Onboarding
- [ ] Mensagem de Boas-Vindas
- [ ] Stories/Status do Home
- [ ] Popup de Saúde Financeira
- [ ] Aviso de Fatura em Atraso
- [ ] Notificações em Tempo Real
- [ ] Alertas Inteligentes
- [ ] Alerta de Limite
- [ ] Aviso de Compra Elevada
- [ ] Limite de Gastos Mensal
- [ ] Faturas & Ciclo de Faturamento
- [ ] Segurança e Biometria

### ⚠️ Achado grave: toggles falsos na tela nova

`ProfileAllureView.tsx:27-30` tem o comentário literal **"Toggle states fictícios/UI"**:

```tsx
// Toggle states fictícios/UI
const [notifications, setNotifications] = useState(true);
const [biometrics, setBiometrics] = useState(false);
const [darkMode, setDarkMode] = useState(isMidnight);
```

São 3 toggles que **não fazem nada** — não persistem, não mudam comportamento nenhum. A tela antiga tinha toggles reais persistidos em `localStorage` (comprovado por `WEB/tests/Profile.test.tsx`, que testa a persistência de 5 deles). Ou seja: a tela nova não só perdeu funcionalidade, como apresenta controles que enganam o usuário fingindo funcionar.

- [ ] Substituir os 3 toggles fictícios por ligação real (ou removê-los)

---

## HOME — checklist de paridade

### Componentes que a tela antiga monta e a nova não (14)

- [ ] `StoryHighlights` + `StoryViewer` — stories do topo
- [ ] `HomeBanners`
- [ ] `ShopOffersBanner`
- [ ] `NewsSection`
- [ ] `WeeklyStreak` — streak semanal de gastos
- [ ] `SpendingHeatmapSection` — heatmap de gastos
- [ ] `SpendingTrendsSection` — tendências
- [ ] `PaymentTimelineChart`
- [ ] `InvoiceSummarySheet`
- [ ] `FinancialInsightsCarouselModal`
- [ ] `OverdueAlertModal`
- [ ] `BiometricModal`
- [ ] `PasswordModal`
- [ ] Menu de inteligência (`isIntelligenceMenuOpen`)

### Modais controlados que sumiram (5)

- [ ] `isBiometricOpen`
- [ ] `isCarouselInsightsOpen`
- [ ] `isIntelligenceMenuOpen`
- [ ] `isInvoiceSummaryOpen`
- [ ] `isPasswordVerifyOpen`

---

## Causa raiz

As telas Allure **reimplementaram** o conteúdo do zero em versão simplificada, em vez de reaproveitar os componentes existentes. O `AllureShell` é só a casca (sidebar + header + modal) — o conteúdo de cada seção podia ter sido o componente antigo renderizado dentro, preservando tudo.

Somado a isso: os mocks de teste das telas novas foram escritos com um schema de `User`/`CreditCard` inventado (já corrigido na Task 3.5), então os testes validavam a versão simplificada sem detectar nada faltando.

**Decisão do usuário (2026-09-05):** reconstruir as telas novas com paridade total, e **nada avança no plano Allure enquanto esta auditoria não estiver fechada**.

---

## Ordem de correção sugerida

1. **Perfil primeiro** (menor, e é onde estão os 2 itens que o usuário citou nominalmente: Sair e Versão).
2. **Home depois** (maior, 14 componentes a religar).
3. **Faturas por último** (Tasks 9 e 10 do plano principal já cobrem).
4. Só então retomar Tasks 8 e 11 (sidebar configurável, fundo ASCII).

**Verificação obrigatória por tela:** abrir no navegador, clicar em cada item do checklist, confirmar que funciona de verdade — não só que renderiza.
