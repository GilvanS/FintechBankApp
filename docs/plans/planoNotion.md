# Plano — Auditoria de Regras de Negócio (FintechBankApp × Notion)

**Data:** 2026-08-07
**Origem:** workspace Notion do usuário, base `BASE DE CONHECIMENTO`
**Espelho no Notion:** https://app.notion.com/p/3b6170c325fd814eb671f573694f9241?pvs=204
**Status:** plano escrito, **nenhuma fase executada**

Regras extraídas de documentação real de emissor de cartão (telas Vision Plus, tabelas de
produto, tickets de transação internacional) e cruzadas com o código deste repositório.

---

## Fase 0 — Segurança (urgente, independe de tudo)

Durante a leitura do Notion foram encontrados dados sensíveis em texto puro. **Nenhum valor
é reproduzido aqui, no Notion ou em qualquer log** — só a localização e o risco.

| Página no Notion | O que está exposto | Risco |
|---|---|---|
| `KNOWLEDGE BASE` | 2 pares de e-mail corporativo + senha (domínios `brq.com`, `prservicoes.com.br`) | credencial de terceiros ativa |
| `Transação Internacional` | PAN completo (16 dígitos), CPF, senha de cartão, e-mail de pessoa nomeada — colado do Slack | **PCI-DSS + LGPD** |
| `Cartões recebidos embossadoras` (database) | Inventário real: **número de cartão completo, CVV e senha** por linha, além de nome/agência/conta/bandeira. Senha aparece como valor único fixo (campo select), sugerindo reuso entre cartões | **PCI-DSS** — dado de cartão vivo, não só regra |
| `AUTOMAÇÃO` | 2 pares de e-mail corporativo + senha em texto puro (domínio `digio.com.br`, credencial Jira/Slack), logo no topo da página | credencial de terceiros ativa |

PAN e CPF juntos, em claro, é violação direta de PCI-DSS e LGPD. A integração Notion↔Claude
desta sessão provou que qualquer ferramenta conectada lê esse conteúdo — agora confirmado em
4 páginas, não 2.

- [ ] Rotacionar as senhas expostas
- [ ] Apagar os blocos (não só editar — o histórico de versão do Notion guarda)
- [ ] Avisar a segurança das empresas envolvidas, se contas e cartões ainda estiverem ativos
- [ ] Revisar quem mais tem acesso ao workspace

> Esta fase é do usuário. Rotação de senha e exclusão de bloco não são feitas por agente.

---

## As 13 regras extraídas

| # | Regra | Fonte no Notion | Onde no projeto |
|---|---|---|---|
| 1 | IOF de produção = **0,0082** — tabela SVC FEE, org 038, logos 038 e 022 | Aliquota IOF PROD | `API/services/invoiceEngine.js` |
| 2 | Parcelamento de Fatura: elegíveis apenas clientes **adimplentes** | Aliquota IOF PROD | `API/repositories/cardRepo.js` |
| 3 | Parcelado Fácil: quem pagou **entre o mínimo e o total**, mais inadimplentes com atraso **até 30 dias** | Aliquota IOF PROD | `API/repositories/cardRepo.js` |
| 4 | Toda oferta de parcelamento exige **CET** validado (Carta Carona) | Aliquota IOF PROD | **ausente no projeto** (não verificado) |
| 5 | Dia de vencimento: qualquer valor de **01 a 28** | 01.01 - Tipo de produto | `users.card_due_day`, default 10 |
| 6 | Idade mínima **18 anos**; 21 para representante legal | 01.01 - Tipo de produto | `users.age`, `has_tutor`, `tutor_*` |
| 7 | Limite **compartilhado** entre titular e adicionais | 01.01 - Tipo de produto | `MOBILE/src/components/LimitView.tsx` |
| 8 | Adicionais: até **2** no ato da venda, até **99** após adesão | 01.01 - Tipo de produto | tabela `fintech.cards` |
| 9 | Anuidade: **155,88** titular (12× 12,99), **77,88** adicional (12× 6,49), sem desconto no 1º ano | 01.01 - Tipo de produto | cobranças recorrentes |
| 10 | BIN por bandeira: 534112 MC Nacional, 534113 MC Internacional, 418051 Visa Nacional | 01.01 - Tipo de produto | `cards.bin` — **conflita, ver abaixo** |
| 11 | Fatura aberta e fechada são entidades **distintas** — telas ARTD e ARSD | REGULATORIOS | bug conhecido: fatura FECHADA mutável |
| 12 | Lançamentos ordenados por moeda e nº do cartão; **titular antes dos adicionais** | Transação Internacional | montagem da fatura |
| 13 | Câmbio: flag **P** = data de postagem, flag **T** = data da transação | Transação Internacional | — |

### Confiabilidade da coluna "Onde no projeto"

Os caminhos são **hipótese**, derivados de nomes de arquivo e do `git status`. Nenhum desses
arquivos foi aberto durante a extração. A Fase 2 existe justamente para confirmar ou derrubar
cada linha. Tratar como pista, não como fato.

---

## Conflito com documentação que já existe no repo

O repositório **já tem** documentação de regra de negócio, escrita antes desta extração:

| Arquivo | Tamanho | Sobreposição |
|---|---|---|
| `docs/REGRAS-NEGOCIO-FATURA.md` | 2141 linhas | regras 1, 2, 3, 11, 12 |
| `docs/regras-bins-cartoes-credito.md` | 77 linhas | **regra 10 — diverge** |

`docs/regras-bins-cartoes-credito.md` v2.0 (2026-07-22) define BINs Visa por whitelist
(`45767460`, `47660760`, `42031060`, `44466676`) e valida por Luhn. O Notion traz BINs de
6 dígitos por bandeira (`534112`, `534113`, `418051`). **São modelos diferentes de emissão.**

Antes de tocar em BIN, decidir qual é a fonte da verdade. O doc do repo é implementado e
testado; o do Notion é de produção real de outro emissor. Pode ser que os dois estejam certos
para propósitos diferentes — gerador de massa vs. emissão real.

---

## Fases

### Fase 1 — Consolidar a fonte da verdade
Reconciliar as 13 regras com `docs/REGRAS-NEGOCIO-FATURA.md`, que já cobre 5 delas.
**Não criar documento novo antes de ler esse.** Escopo real: adicionar o que falta e marcar
as divergências, não recomeçar do zero.

- [ ] Ler `docs/REGRAS-NEGOCIO-FATURA.md` e mapear quais das 13 já estão lá
- [ ] Registrar divergências (começando pela regra 10)
- [ ] Só então decidir se cabe documento novo

### Fase 2 — Auditoria (maior retorno)
Para cada regra: abrir o código, classificar em **bug** / **simplificação consciente** / **lacuna**.
Não precisa do Notion — a tabela acima basta como entrada.

- [ ] Regras 1–4 → `invoiceEngine.js`, `cardRepo.js`
- [ ] Regras 5–9 → `usersRepo.js`, schema `fintech.users` / `fintech.cards`
- [ ] Regra 10 → resolver o conflito de BIN antes
- [ ] Regras 11–13 → fatura fechada, ordenação, câmbio

### Fase 3 — Correção
Só o que a Fase 2 classificar como bug. Candidatos prováveis hoje: CET ausente,
validação de faixa em `card_due_day`, BIN fixo, elegibilidade de parcelamento.

### Fase 4 — Regressão de IOF
Portar o método antes/depois para runbook, usando `API/scripts/validate_skill_rules.js`.

### Fase 5 — Documentação final
Split: versionado no repo (fonte da verdade) × Notion (leitura de fora).

### Fase 6 — Páginas do Notion ainda não lidas ✅ LIDA (2026-08-07)

As 13 regras vieram **só** da base `BASE DE CONHECIMENTO`. As 6 páginas restantes foram lidas.
**Resultado: zero regras novas.** Todo o conteúdo era shell vazio, imagem sem texto, tutorial
genérico de QA, ou tabela de configuração — não regra de negócio de emissor. Duas novas
exposições de segurança, já registradas na Fase 0.

- [x] **IOF v1** (database) — schema com só 2 colunas genéricas (`DESCRIÇÃO`, `Sysout ID`). Sem linhas lidas; formato sugere catálogo de código de erro de sistema, não tabela de alíquota. Sem valor extraído.
- [x] **CHARGEBACK.one (28-07-2023)** — conteúdo é 2 imagens (`.jpeg`) + texto solto "ASQA COM ERRO". Sem texto extraível, sem OCR feito. Sem valor extraído.
- [x] **PAREAMENTE DE ADQUIRENTE** — página-shell com 4 databases aninhados. Abri o único nomeado, `Adquire Station`: tabela de pareamento código↔adquirente (colunas `264520`, `CIELO`) — configuração, não regra. Os outros 3 (sem nome) não foram abertos — retorno decrescente.
- [x] **Cartões recebidos embossadoras** (database) — **não é regra, é inventário real de cartão** (PAN, CVV, senha). Movido para achado de segurança na Fase 0.
- [x] **GHERKIN.one (16-10-2023)** — confirmado tutorial genérico de BDD/Gherkin (exemplos de login e "café na máquina"). Nenhum cenário específico de emissor de cartão. Sem valor extraído.
- [x] **AUTOMAÇÃO** — majoritariamente boilerplate Java/Appium/Selenium (captura de tela, leitura de Excel, scroll). Sem regra de negócio. Tinha credencial exposta, movida para Fase 0.

**Conclusão da Fase 6:** a tabela das 13 regras não ganha linha 14. O Notion está esgotado
como fonte de regra de negócio nova — o que sobrou é config de baixo valor (databases sem
nome dentro de `PAREAMENTE DE ADQUIRENTE`) e não vale reabrir sem motivo específico.

---

## Páginas do Notion já descartadas

Verificado sem valor para o projeto — não reler:

README · Import May 31 2025 Logs · 3149-boas-praticas-java-aula_5 · Calendário de Ressonância ·
CURSO NOTION · Weekly Agenda · Sky Blue · 4WIN (2 databases) · PYTHON · Office template ·
Invoicing Dashboard · Cornell Notes System (2 cópias) · ENG. TELECOM · API REST · REST API ·
Pasta1 · Import Jan 8 2022

Material de curso, agenda pessoal e templates. Nenhuma regra de emissor.

Páginas compartilhadas com o usuário: lista vazia na consulta de 2026-08-07.

---

## Ordem recomendada

**Fase 0 hoje** (segurança, não depende de nada) → **Fase 2** (é onde está o retorno) →
Fase 1 e 6 depois, quando a auditoria já tiver dito o que importa.

Uma sessão separada por fase. A extração do Notion custou ~$60 em uma sessão; releitura
sem necessidade repete esse custo.
