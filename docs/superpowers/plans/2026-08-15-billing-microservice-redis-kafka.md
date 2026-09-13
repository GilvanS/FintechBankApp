# Billing Microservice, Staggered Cron and Async Infra (Redis + Kafka-Ready) - Plano

Objetivo: separar motor de billing pra processo proprio (worker), horarios escalonados fora do pico, Redis pra cache/rate-limit/fila leve, e Kafka pronto (docker-compose com profile opcional) caso decida rodar multiplos microservicos no futuro. Tudo compartilhando o mesmo Postgres (pgdb).

## Constraints
- Nao separar banco - mesmo pgdb, mesmo dbAdapter.js.
- Checkout (shop.routes.js) continua sincrono pro usuario (aprovacao/recusa na hora); so o pos-processamento (alerta Telegram, log) vira evento assincrono.
- API principal roda sozinha se Redis/Kafka desligados (REDIS_ENABLED=false, KAFKA_ENABLED=false).

## Horarios escalonados (janela da noite, a partir das 17h - REVISADO)
- 17:00 - **Batch de Transacoes** (NOVO, roda 1o - antes de tudo): compras e
  pagamentos efetuados durante o dia sao armazenados na hora (raw), mas so
  esse batch consolida eles na fatura ABERTA. E uma etapa de seguranca: nada
  midifica a fatura aberta fora desse job.
- 17:15 - Invoice Engine (runEngine, fechamento/corte de fatura) - roda logo
  apos o batch de transacoes, pra cortar com os dados ja consolidados.
- 17:30 - Billing Validation (juros, multa, dias em atraso)
- 18:00 - Recurring Engine (assinaturas recorrentes)
- 18:30 - Daily Audit + Immutability Health
- 20:00 - **Geracao de PDF da fatura fechada** (NOVO, ver tarefa 5b) - so pras
  faturas que fecharam no corte das 17:15 desse mesmo dia. 2h de folga apos o
  corte pra billing validation/encargos ja estarem aplicados antes do PDF sair.
- 21:00 domingo - Orphan Payment Fix (semanal)

Nota: os horarios 17:15/17:30/18:00/18:30 sao um espacamento proposto (15-30min
entre jobs) pra nao empilhar tudo em cima do corte das 17h - ajustar se o
usuario quiser outro intervalo.

## Tarefas

Numeracao alinhada com as tasks rastreadas na sessao (TaskCreate #1-#10). Cada
task so fecha com DOIS portoes, nessa ordem:
1. Os testes NOVOS daquela task verdes - unit isolado por modulo/servico,
   integration quando toca banco/rota de verdade.
2. **Regressao: a suite INTEIRA que ja existe continua verde** -
   `npm run test:unit` + `npm run test:integration` (ou `npm test`) completos,
   nao so os arquivos tocados pela task. Zero teste pre-existente pode quebrar.
   Isso vale pra TODA task, nao so o rollout final - o billingWorker/batch de
   transacoes/PDF em lote mexem em caminho critico (checkout, corte de fatura,
   telegram) que ja tem cobertura (engineIdempotency, invoicePayment*,
   billingEngine, dailyAudit, etc.) e regressao ali e o risco real.
Se a suite completa nao roda local (falta redis/kafka do docker pra alguma
integration), documentar isso na task e rodar pelo menos os testes que nao
dependem da infra nova antes de marcar concluida.

### 0. Extrair runBillingValidation e runOrphanPaymentFix pro services/ [BLOQUEIA a 5]
- Gap achado na analise do plano: as duas funcoes vivem soltas dentro de index.cjs
  (linhas 4295 e 6101), reusadas pelas rotas admin on-demand (POST
  /admin/fix-orphan-payments:7119, billing validation manual:7209).
- Extrair pra API/services/billingValidation.js e API/services/orphanPaymentFix.js.
  index.cjs (rotas admin) e o futuro billingWorker.js importam do mesmo lugar -
  sem isso o worker duplica logica ou quebra as rotas admin.
- **Testes:** unit pra cada service extraido (comportamento identico ao pre-extracao,
  cobrir os mesmos casos de tests/unit/billingEngine.test.js); integration
  re-rodando engineIdempotency.integration.test.js e validando que POST
  /admin/fix-orphan-payments continua respondendo igual (mesmo payload/status).

### 1. API/docker-compose.yml + deps — infra DONE, falta deps/config
- [x] Servico redis (sempre ativo, restart:always) e zookeeper+kafka sob
  profiles: [kafka] (so sobe com docker compose --profile kafka up) - feito em
  API/docker-compose.yml e API/docker-compose.wsl.yml; scripts/start-docker.ps1
  atualizado (-Kafka).
- [ ] npm install ioredis bullmq rate-limit-redis kafkajs em API/.
- [ ] Criar API/config/eventBus.config.js: le EVENT_BUS_DRIVER (default redis),
  REDIS_HOST/PORT, KAFKA_BROKERS, KAFKA_ENABLED.
- **Testes:** unit do eventBus.config.js (defaults corretos, parsing de env vars,
  KAFKA_ENABLED=false por padrao). Sem integration aqui - so config parsing.

### 2. API/services/eventBus.js - abstracao unificada
- publish(topic, payload) e subscribe(topic, handler).
- Ordem de tentativa: Kafka (se KAFKA_ENABLED=true) -> Redis Pub/Sub -> fallback
  in-memory (EventEmitter) se nenhum disponivel - API nunca quebra sem infra
  externa.
- API/services/redisClient.js so cuida da conexao Redis (client normal + pub/sub
  separados).
- **Testes:** unit cobrindo os 3 caminhos (Kafka mockado, Redis mockado,
  fallback EventEmitter) e o caso "Redis cai no meio" nao derruba o processo;
  integration subindo o redis real do docker-compose e validando
  publish/subscribe round-trip.

### 3. shop.routes.js - evento assincrono na recusa
- No ponto de recusa por limite insuficiente (checkout, shop.routes.js:367-372),
  publica purchase.declined com cpf, requiredAmount, availableLimit, reason -
  non-blocking (.catch sem esperar).
- **Testes:** integration em tests/integration/ garantindo que o checkout
  continua respondendo 400 sincrono pro usuario mesmo se o publish falhar
  (evento nao pode travar nem quebrar a resposta HTTP); unit do handler que
  monta o payload do evento.

### 4. telegramService.js assina purchase.declined
- telegramService.js assina purchase.declined no init() e manda alerta pro
  grupo - desacoplado da resposta HTTP.
- **Testes:** unit mockando o eventBus e o client do Telegram, validando que o
  alerta e disparado com os campos certos e que erro no envio nao propaga.

### 5. API/workers/billingWorker.js - processo separado do Express [depende da 0]
- Roda os cron jobs escalonados a partir das 17h (ver secao acima), usando
  node-cron com o mesmo guard IS_TEST que index.cjs:205 ja usa (scheduleCron).
- **Job 1 (17:00) - Batch de Transacoes [NOVO]:** compras/pagamentos sao
  armazenados no momento em que acontecem (raw/pending), mas so este job
  consolida na fatura ABERTA - por seguranca, nada mais pode tocar na fatura
  aberta. Precisa mapear hoje onde compras/pagamentos sao gravados (shop.routes.js
  checkout, pagamento de fatura) pra confirmar se ja gravam como "pending" ou se
  vao precisar de um estado novo pra isso funcionar sem duplicar consolidacao.
- **Job 2 (17:15) - Invoice Engine (runEngine):** fechamento/corte de fatura,
  roda logo apos o batch de transacoes.
- **Job 3 (17:30) - Billing Validation:** juros, multa, dias em atraso. Decidir
  onde entra syncInvoiceDiasAtraso (hoje em index.cjs:277, nao citado no plano
  original) - provavel aqui.
- **Job 4 (18:00) - Recurring Engine:** assinaturas recorrentes.
- **Job 5 (18:30) - Daily Audit + Immutability Health:** hoje rodam separados
  (02:00/04:00) com isolamento de falha - replicar try/catch por bloco dentro
  do job unificado, nao um try/catch unico pro job inteiro (senao um trava o
  outro).
- **Job 6 (21:00 domingo) - Orphan Payment Fix:** semanal.
- **Testes:** unit por job do worker (cada bloco try/catch isolado, erro em um
  nao derruba os outros); unit do batch de transacoes confirmando que ele e o
  UNICO caminho que grava na fatura aberta; integration rodando o worker
  inteiro contra o banco de teste e conferindo que os jobs disparam na ordem
  certa (batch antes do corte) e que os resultados batem com engineIdempotency.
  integration.test.js.

### 5b. Geracao de PDF da fatura fechada em lote (20:00) [NOVO - depende da 5]
- Hoje `generateUniversalInvoicePDF` e chamado ON-DEMAND (index.cjs:3119, rota
  POST /admin/telegram/.../send) toda vez que alguem pede o PDF - pesado,
  gera na hora pra tipo 'open' e 'closed'. Achado 1 call-site mapeado; precisa
  varrer o resto das rotas de usuario (download de fatura) que podem chamar a
  mesma funcao antes de mexer.
- Mudanca: worker gera o PDF 1x as 20:00, SO pras faturas que fecharam no corte
  das 17:15 desse mesmo dia (nunca pra fatura aberta - ela nao gera PDF em
  momento nenhum). Salva o resultado (storage/tabela nova, ex: coluna
  pdf_generated_at + arquivo em disco ou blob) e as rotas de
  download/envio passam a SERVIR o arquivo ja pronto, sem chamar
  generateUniversalInvoicePDF de novo.
- Se o usuario pedir o PDF antes das 20:00 (fatura fechou hoje mas PDF ainda
  nao rodou), resposta deve ser "ainda nao disponivel, gera as 20h" - nao pode
  cair no fallback de gerar on-demand (era exatamente o comportamento que se
  quer eliminar).
- **Testes:** unit do job (so pega faturas fechadas HOJE, ignora aberta e
  fechadas de dias anteriores que ja tem PDF); integration validando que a
  rota de download passa a servir arquivo cacheado sem re-chamar
  generateUniversalInvoicePDF, e que pedir PDF de fatura aberta ou de fatura
  fechada-mas-ainda-nao-gerada (antes das 20h) retorna o status esperado sem
  gerar nada na hora.

### 6. Guard RUN_INTERNAL_WORKER no index.cjs + script npm [depende da 5]
- index.cjs ganha guard RUN_INTERNAL_WORKER - se false, nao agenda os crons
  internos atuais (index.cjs:237-330), evita rodar duas vezes quando o worker
  externo ja roda.
- Novo script npm run worker:billing -> node workers/billingWorker.js, roda
  como processo PM2/systemd separado da API.
- **Testes:** unit/boot test garantindo que com RUN_INTERNAL_WORKER=false
  nenhum scheduleCron interno e registrado (mock de node-cron.schedule contando
  chamadas).

### 7. Redis rate-limit distribuido [depende da 1]
- rate-limit-redis como store do loginLimiter existente (index.cjs:1381,
  /auth/login, 10/min) quando Redis esta ready; senao cai pro store in-memory
  padrao do express-rate-limit (comportamento atual preservado).
- **Testes:** integration batendo 11x em /auth/login com Redis no ar (docker)
  e confirmando bloqueio no 11; unit do fallback quando Redis esta indisponivel
  (nao quebra, usa store in-memory).

### 8. Rollout gradual e validacao [depende de 3, 4, 6, 7]
1. Subir redis no compose, testar API sem quebrar nada (fallback in-memory).
2. Mover 1 cron por vez pro worker, validar rodando em paralelo por alguns dias
   antes de desligar o RUN_INTERNAL_WORKER da API principal.
3. Kafka fica desligado (KAFKA_ENABLED=false) ate decisao de multi-servico -
   infra ja montada, so ligar a flag.
- **Testes:** rodar a suite completa (npm test) antes de cada desligamento de
  cron na API principal; smoke test manual do checkout + login + fatura apos
  cada etapa do rollout.
