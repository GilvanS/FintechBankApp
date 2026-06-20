# Spec: PIX

**Arquivo de implementação:** `API/index.cjs` (rotas `/pix/*`), `API/repositories/pixRepo.js`
**Status:** Implementado

## Endpoints

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/pix/transfer` | user | Transferência PIX |
| GET | `/pix/keys` | user | Listar chaves PIX do usuário |
| POST | `/pix/keys` | user | Cadastrar chave PIX |
| DELETE | `/pix/keys/:key` | user | Remover chave PIX |
| GET | `/pix/contacts` | user | Listar contatos PIX |
| POST | `/pix/contacts` | user | Adicionar contato |
| GET | `/pix/recipient-info/:key` | user | Consultar destinatário por chave |

## Regras de Negócio

### Transferência
- Valida saldo suficiente antes de transferir
- Respeita `pix_daily_limit` do usuário
- Soma transferências do dia para verificar limite diário
- Cria transação `PIX_SENT` no remetente e `PIX_RECEIVED` no destinatário
- Operação atômica — falha em qualquer passo reverte tudo

### Chaves PIX
- Tipos suportados: `CPF` | `EMAIL`
- Chave CPF: automática no cadastro (igual ao CPF do usuário)
- Limite por usuário: configurável

### Limite diário
- Campo `pix_daily_limit` na tabela `users`
- Admin pode alterar via `PUT /admin/users/:cpf/pix-limit`

## Schema de transferência

```json
{
  "toKey": "chave-pix-destinatario",
  "amount": 100.00,
  "description": "Pagamento aluguel"
}
```

## Tipos de transação gerados

| Tipo | Quando |
|------|--------|
| `PIX_SENT` | Remetente — débito |
| `PIX_RECEIVED` | Destinatário — crédito |
| `PIX_CREDIT_SENT` | Transferência via crédito |
