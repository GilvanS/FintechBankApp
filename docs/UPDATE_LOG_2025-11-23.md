# Atualizações - 23/11/2025

## Alterações realizadas hoje

- **WEB/services/api.ts**
  - Corrigida a função `getUserStatement` para chamar a rota correta `/users/:cpf/statement` em vez de `/users/:cpf/transactions`.
  - Comentário removido e ajuste no endpoint garante que o extrato inclua transações PIX (`PIX_SENT` e `PIX_RECEIVED`).

> Essa mudança alinha o frontend com a lógica já existente no backend (`API/index.cjs`), que filtra os tipos de transação adequados.

## Próximos passos sugeridos

- Reiniciar o servidor backend para garantir que a nova chamada seja utilizada.
- Testar a funcionalidade de transferência PIX e verificar se a transação aparece no extrato.
- Caso necessário, ajustar a UI do componente `Statement` para melhorar a visualização das transações PIX.

*Este resumo foi gerado em 23/11/2025 às 15:16 (UTC‑3).*
