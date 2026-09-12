# Planejamento de Testes (Admin) — Design

## Contexto e motivação

O repo `A:\Workspace\poc-fintech-playwright` mantém `data\MassaDados.xlsx` com 7 abas, entre elas:

- **TBL_CENARIOS** — 17 linhas, uma por cenário de teste E2E (`ID_CENARIO`, `NOME`, `FEATURE`, `ID_MASSA`, `CPF`, `SENHA`, `saldo_conta`, `fatura_fechada`, `fatura_aberta`, `dias_atraso`, `PIN`, etc.). Define qual massa (CPF) cada cenário Playwright usa.
- **tbl_de_massas** — 258 linhas, catálogo de massas de teste (saldo, limites, fatura aberta/fechada, `status` adimplente/inadimplente, dados de cartão). Alimentado pelo botão "Exportar CSV" já existente no admin (`ScriptsMassasSection.tsx` → `GET /api/admin/scripts/export-massas-csv`, fonte única em `API/utils/tblDeMassasExport.cjs`).

Hoje a atribuição de massa a cenário é manual: o usuário lê `tbl_de_massas` e digita os valores em `TBL_CENARIOS` na mão. Isso já causou erro real nesta sessão: o cenário CT03.2 (que exige fatura fechada em aberto) foi atribuído a um CPF sem nenhuma dívida, quebrando o teste Playwright com `[Fatura já quitada]`.

**Objetivo**: tela no admin que cruza as duas abas, sugere/valida a escolha, e ao clicar Salvar grava direto na aba `TBL_CENARIOS` do xlsx — eliminando a edição manual e o erro de escolha.

## Referência visual (Plane, `A:\Workspace\plane`)

Pesquisa num clone local do Plane (open-source, alternativa a Jira/Linear) trouxe 3 padrões reaproveitáveis do módulo "Cycles":

1. **Grupos colapsáveis por categoria** (`Disclosure` do Headless UI, ex. `list/root.tsx`) — massas agrupadas por `status` (adimplente/inadimplente), com contador no cabeçalho de cada grupo.
2. **Chips de filtro aplicado + "Limpar tudo"** (`applied-filters/root.tsx`, `PillButton`) — cada filtro ativo vira uma pill removível acima da lista, em vez de só um dropdown escondido.
3. **Aviso não-bloqueante = ícone circular + texto secundário cinza** (visto em `transfer-issues.tsx`: "Completed cycles are not editable") — nunca vermelho, nunca desabilita a ação. Padrão exato pro aviso "massa não bate com a regra do cenário".

Este documento pode ser atualizado se surgir referência melhor antes da implementação.

## Escopo

**Arquitetural** — feature nova (tela + fluxo de dados que não existe hoje), não é ajuste em fluxo existente.

Fora de escopo (YAGNI, adiado):
- Motor de regras genérico — só 17 cenários hoje, regras ficam hardcoded num objeto de mapeamento.
- Edição de qualquer outra aba do xlsx além de `TBL_CENARIOS`.
- Histórico/auditoria de quem mudou o quê (sem requisito hoje).

## Decisões confirmadas com o usuário

| Decisão | Escolha |
|---|---|
| Tela é só leitura ou grava no xlsx? | **Grava** — botão Salvar escreve na aba `TBL_CENARIOS` |
| O que grava por linha? | **Tudo**: `ID_MASSA`, `CPF`, `saldo_conta`, `fatura_fechada`, `fatura_aberta`, `dias_atraso`, `PIN` (snapshot completo, mesmo formato que a planilha já usa hoje) |
| Validação de regra do cenário | **Avisa, não bloqueia** — alerta visível, Salvar continua habilitado |
| Localização no admin | **Item novo no menu principal** (não dentro de "Scripts & Massas") |

## Arquitetura

### Frontend (`WEB`)

- Novo item em `AdminAllureView.tsx` `SECTIONS`: `{ key: 'test-planning', label: 'Planejamento de Testes', icon: ClipboardList, group: 'Testes' }`, com `case 'test-planning': return <TestPlanningSection />;`.
- Novo componente `WEB/components/Admin/TestPlanningSection.tsx`, layout 2 colunas:
  - **Esquerda**: lista de cenários (`GET` retorna as 17 linhas de `TBL_CENARIOS`), cada item mostra `ID_CENARIO`, `NOME`, e a massa vinculada hoje (com aviso inline se a massa atual não bate mais com a regra).
  - **Direita**: catálogo de massas (`tbl_de_massas`), agrupado por `status` (Disclosure colapsável, contador por grupo), com chips de filtro aplicado (status, `fatura_fechada > 0`, `fatura_aberta > 0`, busca por CPF) + botão "Limpar tudo".
- Ao selecionar cenário + massa: mostra painel de detalhe com os valores da massa escolhida e o resultado da validação (ícone + texto secundário, não bloqueia).
- Botão "Salvar no xlsx" dispara `POST`.

### Backend (`API`)

- Nova dependência: `xlsx` (SheetJS) — mesma lib já usada no `poc-fintech-playwright`, evita introduzir lib diferente.
- Novo `API/src/routes/admin/testPlanning.routes.js` + controller `testPlanningController.js`, mesmo padrão de auth de `admin/scripts.routes.js` (`bearerAuth() + authenticateAdmin`).
- `GET /api/admin/test-planning`:
  - Lê `A:\Workspace\poc-fintech-playwright\data\MassaDados.xlsx` inteiro com `XLSX.readFile`.
  - Extrai `TBL_CENARIOS` e `tbl_de_massas` via `XLSX.utils.sheet_to_json`.
  - Retorna os dois arrays.
- `POST /api/admin/test-planning/save`:
  - Body: `{ idCenario: string, massa: { idMassa, cpf, saldoConta, faturaFechada, faturaAberta, diasAtraso, pin } }`.
  - Reabre o workbook inteiro (`XLSX.readFile`), localiza a linha de `TBL_CENARIOS` cujo `ID_CENARIO` bate, atualiza só as células dessa linha nas colunas mapeadas, e regrava com `XLSX.writeFile` — as outras 6 abas permanecem intocadas (workbook inteiro é mantido em memória, só uma aba é mutada).
  - **Tratamento de erro**: se o arquivo estiver aberto no Excel (lock do Windows: `EBUSY`/`EPERM`), captura e retorna `503` com mensagem clara: "Feche o Excel e tente novamente." Não deixa estourar 500 cru.

### Regras de validação (hardcoded)

```js
// testPlanningRules.js — só 17 cenários hoje, mapa simples por ID_CENARIO/FEATURE
const REGRAS = {
  'CT03.1': (massa) => massa.fatura_aberta > 0,
  'CT03.2': (massa) => massa.fatura_fechada > 0,
  'CT03.3': (massa) => massa.fatura_fechada > 0,
  // ... demais cenários de fatura/pix conforme FEATURE da linha
};
```
Cenários sem regra definida (ex: cadastro) não mostram aviso.

## Fluxo de dados

```
[Admin abre "Planejamento de Testes"]
        │
        ▼
GET /api/admin/test-planning ──► lê MassaDados.xlsx (2 abas) ──► retorna JSON
        │
        ▼
[usuário filtra/agrupa massas, seleciona cenário + massa]
        │
        ▼
[validação client-side roda a regra do cenário sobre a massa] ──► mostra aviso (não bloqueia)
        │
        ▼
[clica Salvar] ──► POST /api/admin/test-planning/save
        │
        ▼
API relê o xlsx inteiro, atualiza só a linha do cenário em TBL_CENARIOS, regrava o arquivo inteiro
        │
        ▼
[sucesso: toast verde] / [arquivo travado: aviso "feche o Excel"]
```

## Testes

- Unitário do controller: mocka `XLSX.readFile`/`writeFile`, confirma que só a linha certa é alterada e que as outras abas permanecem no objeto retornado antes de `writeFile`.
- Manual (browser, Playwright MCP ou Chrome): fluxo completo — abrir tela, filtrar, selecionar, salvar, reabrir o xlsx e confirmar que só `TBL_CENARIOS` mudou.
- Caso de erro: com o xlsx aberto no Excel, confirmar que o POST retorna 503 com mensagem legível (não 500 cru).

## Aberto para atualização

Se aparecer um exemplo melhor (Plane ou outro) antes da implementação, este documento é atualizado antes de gerar o plano de execução.
