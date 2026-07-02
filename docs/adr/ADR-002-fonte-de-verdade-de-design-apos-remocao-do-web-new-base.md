# ADR-002: Fonte de verdade de design após remoção do `WEB/new-base-fintechbank` do versionamento

- **Status**: proposed
- **Date**: 2026-07-02
- **Deciders**:
- **Tags**: mobile, web, design-system, source-of-truth, git
- **Supersedes**: parcialmente o ADR-001 (apenas a cláusula de "fonte única de verdade de design")

## Context

O [ADR-001](ADR-001-revisar-plano-mobile-com-novo-design-web.md) decidiu adotar `WEB/new-base-fintechbank` como **fonte única de verdade de design**, a ser portada para o `MOBILE` nas tasks T1–T12.

Após a redação do ADR-001, a realidade do repositório divergiu dessa premissa:

- O commit `239e9c0c chore: ignore WEB/new-base-fintechbank and remove from tracking` **removeu** `WEB/new-base-fintechbank` do controle de versão.
- O diretório foi adicionado ao `.gitignore` (linha 60: `WEB/new-base-fintechbank/`).
- A pasta **ainda existe em disco**, porém como conteúdo *untracked/ignored* — não é mais rastreável pelo git, não aparece em diffs, PRs ou histórico.
- Nesse meio-tempo, o redesign (paleta Yellow Brutalist, Painel de Análise com 6 cards, Mapa de Calor SVG, Meta de Gastos, Saúde Financeira, AI Assistant, modais de Biometria/Boleto/Conta Recorrente) já foi **migrado para o código versionado**: o app WEB tracked (commits `feat(web)`/`fix(web)`) e um grande port para `MOBILE/src/` (≈328 arquivos, +39.765 linhas: `pages/Home`, `pages/Login`, `pages/PreLoginDashboard`, `services/api.ts`, `theme/variables.css`).

Consequência: a "fonte única de verdade" nomeada pelo ADR-001 não é mais versionada, criando risco de drift invisível ao git e contradizendo a própria premissa do ADR-001. A revisão de conformidade (ADR Compliance Report, 2026-07-02) sinalizou essa colisão entre código e decisão.

## Decision

Registrar que a fonte de verdade de design **deixa de ser** `WEB/new-base-fintechbank` (que permanece apenas como *snapshot de referência local, não versionado*) e passa a ser o **código versionado do redesign já aplicado**:

1. **Fonte de verdade canônica = o app WEB tracked** que recebeu o redesign (commits `feat(web)`/`fix(web)` na branch de trabalho). É ele que reflete a paleta, os componentes e os fluxos aprovados.

2. **`WEB/new-base-fintechbank` = referência histórica local.** Continua ignorado pelo git (`.gitignore:60`), servindo apenas como material de consulta na máquina do dev. **Não deve** ser citado como fonte normativa em novas decisões nem em PRs. Se algum artefato dele ainda for necessário, deve ser **portado para o código tracked** antes de ser considerado válido.

3. **MOBILE espelha a WEB tracked, não a pasta ignorada.** As tasks remanescentes do ADR-001 (T6–T12) passam a usar a WEB versionada como referência de portabilidade, garantindo que qualquer divergência apareça em diff.

4. **Toda evolução de design entra pelo código versionado.** Novos tokens, telas ou componentes de design são commitados no app tracked (WEB e/ou MOBILE), nunca mantidos apenas na pasta ignorada.

Esta decisão **não altera** o código atualmente em uso na branch de trabalho — é um registro de decisão/escopo. Nenhum arquivo de aplicação é modificado por este ADR.

## Consequences

### Positive
- Elimina a contradição entre o ADR-001 e o estado real do repositório (fonte de verdade agora é rastreável).
- Drift de design volta a ser visível em diffs/PRs, pois a referência canônica é versionada.
- Remove ambiguidade sobre "de onde copiar" ao executar as tasks restantes do MOBILE.

### Negative
- Perde-se a pasta `new-base-fintechbank` como referência versionada; se algo dela ainda não foi portado, precisará ser recuperado do disco local (que pode se perder em outra máquina/reset).
- Exige disciplina: qualquer coisa "só na pasta ignorada" passa a ser considerada não-oficial.

### Neutral
- O `.gitignore` permanece como está (`WEB/new-base-fintechbank/` continua ignorado); nenhuma re-inclusão no tracking é exigida por esta decisão.
- O ADR-001 continua válido em tudo, exceto na cláusula de fonte de verdade, agora superseted por este ADR.

## Links

- Supersedes (parcial): [ADR-001](ADR-001-revisar-plano-mobile-com-novo-design-web.md)
- Origem: ADR Compliance Report de 2026-07-02 (branch `feature/mobile-web-redesign`)
- Commit relacionado: `239e9c0c` (remoção de `WEB/new-base-fintechbank` do tracking)
