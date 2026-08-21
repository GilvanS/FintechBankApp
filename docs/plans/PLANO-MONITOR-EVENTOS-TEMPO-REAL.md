# Plano — Monitor de Eventos em Tempo Real (janela lateral)

**Objetivo:** abrir uma janela separada (como os dashboards de auditoria já fazem) que mostra
eventos do sistema conforme acontecem, para deixar aberta ao lado do Shop ou do Admin em tela
dividida e acompanhar o efeito de cada ação sem dar refresh.

---

## Ponto de partida: o que já existe

A infraestrutura está construída, mas **as pontas nunca foram ligadas**.

| Peça | Arquivo | Estado |
|------|---------|--------|
| Serviço SSE (conexões por CPF, `sendToClient`, `broadcast`) | `API/services/sseService.js` | ✅ completo |
| Rota do stream | `API/index.cjs:7235` (`GET /api/events/stream`) | ✅ completo |
| Barramento de eventos (Kafka → Redis → memória) | `API/services/eventBus.js` | ✅ completo |
| Hook React com reconnect | `WEB/hooks/useRealtimeEvents.ts` | ✅ completo |
| Publicação nos pontos de negócio | — | ❌ só existe `purchase.declined` |
| Ligação eventBus → SSE | — | ❌ ninguém faz `subscribe` para repassar |
| Consumo no front | — | ❌ o hook não é importado em lugar nenhum |

**Consequência:** o hook escuta `purchase.completed`, `payment.completed`, `invoice.updated` e
`user.updated`, mas nada no backend publica esses quatro. O único evento publicado
(`purchase.declined`) não está na lista que o hook escuta. Hoje o stream conecta e fica mudo.

O trabalho, portanto, é de integração — não de arquitetura nova.

---

## Fase 1 — Soldar o barramento ao SSE

Um único ponto de ligação no bootstrap: para cada tópico de interesse, `eventBus.subscribe`
repassa para `sseService`. Eventos com `cpf` vão para o dono (`sendToClient`); eventos de sistema
vão para todos (`broadcast`).

Isso preserva o fallback do eventBus: com Redis ativo, dois processos da API entregam o evento
ao cliente conectado em qualquer um deles; sem Redis, o EventEmitter local resolve.

**Aceite:** publicar um evento de teste pelo eventBus e vê-lo chegar no `curl` do stream.

## Fase 2 — Publicar os eventos que faltam

Instrumentar os pontos onde o estado do usuário realmente muda:

| Evento | Onde | Carga |
|--------|------|-------|
| `purchase.completed` | `shop.routes.js` (checkout, após persistir) | cpf, valor, item, limite restante |
| `payment.completed` | rota de pagamento de fatura | cpf, valor, método, saldo novo |
| `invoice.updated` | `invoiceEngine` (fechamento) e ao aplicar encargos | cpf, status, total, dias de atraso |
| `user.updated` | ajustes de limite/saldo pelo admin | cpf, campo alterado, valor |
| `mass.created` | `POST /admin/users/mass` | cpf, nome, estado (adimplente/inadimplente) |

Regra: publicar **depois** do commit da transação, nunca dentro — um evento não pode anunciar algo
que ainda pode ser revertido. E sempre com `.catch(() => {})`, como o `purchase.declined` já faz:
falha de barramento não pode derrubar a operação de negócio.

**Aceite:** cada evento observado no stream após executar a ação real pela interface.

## Fase 3 — A janela do monitor

Rota `/monitor` como página independente, fora do shell do dashboard (sem menu, sem bottom nav) —
ela existe para ocupar meia tela.

Conteúdo:
- **Cabeçalho fixo**: indicador de conexão (verde/vermelho, vindo do `connected` do hook), contagem
  de eventos, botão de limpar.
- **Feed** em ordem cronológica inversa, cada item com hora, tipo (ícone + cor por categoria), CPF
  e resumo legível — "Compra de R$ 350,00 · limite restante R$ 4.650,00", não JSON cru.
- **Filtros** por tipo, persistidos em `localStorage` para sobreviver ao reload.
- **Detalhe sob demanda**: clicar no item expande a carga completa.

Sem backend novo: consome o `useRealtimeEvents` que já existe.

## Fase 4 — Abrir a janela do Shop e do Admin

Botão "Monitor ao vivo" seguindo o padrão já usado no `AuditSection` (`ExternalLink` + `window.open`),
com `window.open(url, 'monitor', 'width=520,height=900')` — janela nomeada, então clicar de novo
reaproveita a que já está aberta em vez de abrir outra.

Colocar em: cabeçalho do `ShopView` e do `AdminDashboard`.

## Fase 5 — Acabamento visual

Entrada de cada evento no feed com deslocamento curto + fade (120–160 ms, sem escala), respeitando
`prefers-reduced-motion`. Cor por categoria seguindo os tokens do tema (compra, pagamento, fatura,
sistema). Auto-scroll só quando o usuário já está no topo — quem rolou para ler algo não quer ser
puxado de volta.

---

## Skills a usar

| Skill | Onde entra |
|-------|-----------|
| `cast` (genjutsu) | Tese de interação do feed e das variantes visuais — mesmo caminho do Gerador 3.0 |
| `motion-principles` | Timing e easing da entrada dos eventos |
| `css-native` | Animação sem dependência nova (o WEB já tem GSAP, mas o feed não precisa) |
| `desktop-principles` | A janela é feita para tela dividida em desktop: foco, atalhos, hover |
| `web-design-guidelines` / `design-audit` | Revisão de acessibilidade e contraste antes de fechar |
| `superpowers:test-driven-development` | Fases 1 e 2 são lógica de backend testável antes da UI |

## Sobre harness e loop

Nas fases 1 e 2 o ciclo é: publicar evento → observar no stream → ajustar. É repetitivo e
verificável por comando, então **`/loop` cabe bem** para reexecutar a suíte e um teste de fumaça do
stream a cada mudança.

As fases 3–5 são de julgamento visual, com decisão humana no meio — **loop não ajuda**, e um harness
autônomo tende a produzir escolhas de layout que precisarão ser refeitas.

Subagentes valem se as fases 2 e 3 forem tocadas em paralelo: backend e UI têm superfícies
independentes. Abaixo disso, o custo de contexto de cada agente novo não se paga.

---

## Riscos

- **Autenticação no stream**: a rota recebe o token por query string (`?token=`), porque o
  `EventSource` do navegador não permite cabeçalhos. Query string aparece em log de servidor e no
  histórico — antes de expor isso além do ambiente local, trocar por cookie de sessão ou por um
  token efêmero de uso único emitido só para o stream.
- **Sem persistência**: quem abre a janela depois do evento não o vê. Se isso incomodar, um buffer
  curto em memória (últimos N) enviado no `connected` resolve.
- **Limite de conexões**: navegadores limitam 6 conexões por origem em HTTP/1.1, e o SSE segura uma
  delas de forma permanente. Com a janela do monitor aberta junto do app, sobram 4 para o resto.
  Em HTTP/2 o limite não se aplica — vale confirmar como o ambiente serve.
- **Escopo de quem vê o quê**: `broadcast` manda para todos os conectados. Eventos administrativos
  não podem vazar para a sessão de um cliente comum — filtrar por papel antes de enviar.
