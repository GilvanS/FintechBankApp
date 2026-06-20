# .spec — Spec-Driven Development

Esta pasta contém as especificações de cada módulo e funcionalidade do FintechBankApp.
Claude Code lê esses arquivos antes de implementar, garantindo que o código entregue
o que foi especificado.

## Convenção

| Pasta | Escopo |
|-------|--------|
| `.spec/api/` | Contratos de endpoints, regras de negócio, schemas |
| `.spec/mobile/` | UI, navegação, comportamento das telas do app |
| `.spec/web/` | UI e comportamento do frontend web |
| `.spec/PROJECT.md` | Visão geral, objetivos e arquitetura do projeto |

## Como usar com Claude Code

### Implementar uma feature
```
Leia .spec/mobile/FATURAS.md e implemente a tela de faturas
```

### Gerar spec de uma nova fase (via GSD)
```
/gsd-spec-phase "nome da fase"
```

### Auditoria visual de UI implementada
```
/gsd-ui-review
```

### Revisão de código pós-implementação
```
/gsd-code-review
```

### Mapa de conhecimento do projeto
```
/graphify .
```

## Skills disponíveis para spec-driven

| Skill | Quando usar |
|-------|-------------|
| `/gsd-spec-phase` | Antes de planejar — define O QUE uma fase entrega |
| `/gsd-discuss-phase` | Levanta contexto por perguntas antes do plano |
| `/gsd-plan-phase` | Cria PLAN.md executável a partir do spec |
| `/gsd-execute-phase` | Executa os planos com commits atômicos |
| `/gsd-verify-work` | UAT conversacional — valida o que foi construído |
| `/gsd-ui-phase` | Gera UI-SPEC.md para fases de frontend |
| `/gsd-ui-review` | Auditoria visual de frontend implementado |
| `/gsd-code-review` | Review de bugs, segurança e qualidade |
| `/gsd-debug` | Debug sistemático com estado persistente |
| `/visual-plan` | Plano visual interativo antes de implementar |
| `/visual-recap` | Recap visual de um PR ou branch |
| `/graphify .` | Knowledge graph navegável do codebase |

## Fluxo spec-driven recomendado

```
1. Escrever/atualizar .spec/<módulo>/<FEATURE>.md
2. /gsd-spec-phase "feature"   → SPEC.md validado
3. /gsd-plan-phase             → PLAN.md com tarefas
4. /gsd-execute-phase          → implementação com commits
5. /gsd-verify-work            → UAT
6. /gsd-code-review            → quality gate
7. /gsd-ship                   → PR + merge
```
