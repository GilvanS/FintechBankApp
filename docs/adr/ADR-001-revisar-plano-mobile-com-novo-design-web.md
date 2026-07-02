# ADR-001: Revisar plano de atualização do MOBILE com o novo design do WEB

- **Status**: proposed
- **Date**: 2026-07-02
- **Deciders**:
- **Tags**: mobile, web, design-system, capacitor

## Context

O `MOBILE` (`F:\GITHUB\FintechBankApp\MOBILE`) é um app Capacitor (React 19 + Vite 6, wrapper nativo Android/iOS a partir de um build web) que ainda usa a estrutura de componentes antiga do projeto (`Dashboard.tsx`, `HomeView.tsx`, `Cards.tsx`, `Marketplace.tsx`, etc.).

O `WEB/new-base-fintechbank` é a base de design mais atual do projeto — mesma stack (React 19, Vite 6) — já com o novo redesign: paleta Yellow Brutalist, Painel de Análise (6 cards), Mapa de Calor (SVG multi-mês, rolling 3 meses, stats/anomalias), Meta de Gastos, Saúde Financeira, AI Assistant, modais de Biometria/Boleto/Conta Recorrente, Weekly Streak.

Um plano inicial de atualização foi discutido em conversa (não commitado em nenhum arquivo) dividindo o trabalho em 12 tasks (T1–T12), cobrindo desde auditoria de divergência até build/APK final. Este ADR registra essa decisão de arquitetura/escopo antes da execução, para que a atualização do MOBILE fique rastreável e revisável.

## Decision

Adotar `WEB/new-base-fintechbank` como fonte única de verdade de design e portar suas telas/componentes para o `MOBILE`, substituindo a estrutura antiga, dividido nas seguintes tasks sequenciais:

1. **T1 — Auditoria de divergência**: comparar `WEB/new-base-fintechbank/src` vs `MOBILE/src` e listar gaps/duplicidades.
2. **T2 — Design tokens e tema**: portar CSS/Tailwind/paleta, validar touch targets (mín. 44px).
3. **T3 — Navbar/Header/navegação**: portar componentes novos, decidir bottom-nav nativo vs. padrão WEB.
4. **T4 — Home/Dashboard**: substituir view antiga pela nova (saldo, Pix, Depositar, Meta de Gastos, Saúde Financeira).
5. **T5 — Painel de Análise + Mapa de Calor**: portar os 6 cards e o SVG animado, validar performance em WebView.
6. **T6 — Cartões, Fatura, Limites, Extrato**: portar views novas reconciliando com integrações de backend existentes.
7. **T7 — Pix e Shop**: portar modais/views novos validando fluxos de pagamento/carrinho já existentes.
8. **T8 — Recursos novos exclusivos do WEB**: AI Assistant, AI Recurring Bill, Weekly Streak, Financial Health, Boleto.
9. **T9 — Biometria nativa**: substituir simulação web por plugin Capacitor real de biometria.
10. **T10 — Auth flow e Contexts**: alinhar AuthContext/GlobalModalContext, usar storage seguro nativo em vez de localStorage puro.
11. **T11 — Ajustes nativos**: safe-area, back button Android, teclado, splash screen, permissões.
12. **T12 — Build, APK e testes**: `vite build` → `cap sync`, gerar APK, smoke test, atualizar seletores Appium.

Nenhuma execução de código foi feita como parte deste ADR — é um registro de decisão/escopo, a implementação ocorre em sessão(ões) separada(s), task por task.

## Consequences

### Positive
- Unifica visualmente e funcionalmente MOBILE e WEB, evitando divergência de features.
- Divisão em tasks permite execução incremental com checkpoints e commits atômicos por task.
- Registra o racional da decisão para consulta futura, evitando retrabalho de análise.

### Negative
- Esforço de portar telas novas (AI Assistant, Mapa de Calor, etc.) para WebView pode exigir ajustes de performance não previstos em desktop.
- Biometria e storage seguro exigem plugins nativos Capacitor adicionais, aumentando a superfície de dependências nativas.
- Seletores Appium existentes (`APPIUM-SELETORES-ANDROID.md` e correlatos) tendem a quebrar e precisarão ser atualizados após cada task de UI.

### Neutral
- A ordem das tasks (T1–T12) é sequencial mas pode ser reordenada/paralelizada conforme prioridade do usuário.

## Links

- **Superseded (parcial)** pela [ADR-002](ADR-002-fonte-de-verdade-de-design-apos-remocao-do-web-new-base.md): a cláusula "fonte única de verdade de design = `WEB/new-base-fintechbank`" foi revista após a pasta ser removida do versionamento (commit `239e9c0c`). O restante deste ADR permanece válido.
