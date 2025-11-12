# Relatorio de Execucao — Fluxo de Usuarios e Compras

Data: 2025-11-11  
Ambiente: `http://localhost:3001/api` (Swagger: `/api-docs/`)  
Autenticacao: JWT (`token.txt`)

## Usuarios Criados
- Usuario A
  - Nome: `Usuario Teste A`
  - CPF: `11111111111`
  - Email: `userA@test.com`
  - Senha: `Senha123`
  - Endpoint: `POST /api/auth/signup`
  - Resultado: `200 OK`, `{"success":true,"message":"Conta criada com sucesso!"}`

- Usuario B
  - Nome: `Usuario Teste B`
  - CPF: `22222222222`
  - Email: `userB@test.com`
  - Senha: `Senha123`
  - Endpoint: `POST /api/auth/signup`
  - Resultado: `200 OK`, `{"success":true,"message":"Conta criada com sucesso!"}`

## Admin (Login e Token)
- Admin padrao
  - CPF: `99999999999`
  - Senha: `admin999`
  - Endpoint: `POST /api/auth/login`
  - Resposta: `200 OK` com `token` JWT
  - Persistencia:
    - Resposta salva em: `loginResp.json`
    - Token salvo em: `token.txt`  
      Exemplo (mascarado): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....`

## Compras Efetuadas (Fatura ABERTA — Admin)
- Usuario A — A vista (desconto 10%)
  - Endpoint: `POST /api/admin/users/11111111111/card/purchase/open`
  - Payload: `{ amount: 120.5, description: "Compra a vista teste A", installments: 1 }`
  - Resultado: `201 Created`, `success: true`, `message: "Compra registrada na fatura aberta."`
  - `transactionId`: `6de00947-3e51-48b6-b16...` (gerado pelo sistema)

- Usuario B — A vista (desconto 10%)
  - Endpoint: `POST /api/admin/users/22222222222/card/purchase/open`
  - Payload: `{ amount: 250.0, description: "Compra a vista teste B", installments: 1 }`
  - Resultado: `201 Created`, `success: true`, `message: "Compra registrada na fatura aberta."`
  - `transactionId`: `fd89f724-11fb-4f6d-b63...`

- Usuario A — Parcelado (2x, sem juros)
  - Endpoint: `POST /api/admin/users/11111111111/card/purchase/open`
  - Payload: `{ amount: 600.0, description: "Notebook 2x", installments: 2 }`
  - Resultado: `201 Created`, `success: true`, `message: "Compra registrada na fatura aberta."`
  - `transactionId`: `fb75d824-14f9-498b-937...`

- Usuario B — Parcelado (18x, juros 5%)
  - Endpoint: `POST /api/admin/users/22222222222/card/purchase/open`
  - Payload: `{ amount: 2000.0, description: "TV 75 18x", installments: 18, interestRate: 0.05 }`
  - Resultado: `201 Created`, `success: true`, `message: "Compra registrada na fatura aberta."`
  - `transactionId`: `0a690277-1658-46ca-bdc...`

## Extratos (Statement)
- Usuario A (`GET /api/users/11111111111/statement`)
  - Resultado: `200 OK`
  - Conteudo: `success: true`, `transactions: [...]`
  - Observacao: Inclui `CREDIT` (a vista com -10% no valor) e `INVOICE_INSTALLMENT` negativos quando parcelado (`2x`), com vencimentos a partir do proximo mes.

- Usuario B (`GET /api/users/22222222222/statement`)
  - Resultado: `200 OK`
  - Conteudo: `success: true`, `transactions: [...]`
  - Observacao: Historico anterior de `PIX_RECEIVED` e `PAYMENT` mais novos registros da compra (a vista e parcelada com juros).

## Erros Ocorridos e Solucoes
- `400 Bad Request` — `Payload invalido.` ao usar `curl.exe` com `--data-binary "@purchaseX.json"`
  - Causa provavel: Diferencas de parse/codificacao do `curl.exe` no Windows, afetando tipos de dados do JSON.
  - Solucao adotada: Uso de `Invoke-RestMethod` com objetos PowerShell e `ConvertTo-Json` (tipagem correta), que funcionou em todas as compras.

- `401 Unauthorized` — `Token de acesso requerido.`
  - Causa: Chamadas sem cabeçalho `Authorization: Bearer {TOKEN}` (antes de salvar/extrair token).
  - Solucao: Login admin → salvar `token.txt` → usar sempre `Authorization: Bearer`.

## Observacoes de Regras de Negocio (Confirmadas)
- A vista (`installments = 1`): registra `CREDIT` com desconto 10%; nao gera parcelas.
- Parcelado (`2..12`): sem juros; gera `INVOICE_INSTALLMENT` negativos com vencimentos futuros.
- Parcelado (`13..24`): com juros (`interestRate` obrigatorio entre `0.01..0.07`); gera `INVOICE_INSTALLMENT` com total acrescido.

## Referencias
- Swagger: `http://localhost:3001/api-docs/`
- Endpoints envolvidos:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `POST /api/admin/users/{cpf}/card/purchase/open`
  - `GET  /api/users/{cpf}/statement`