# demo-data — massas de demonstração

Export direto do PostgreSQL de desenvolvimento. Serve a dois propósitos ao mesmo tempo:

1. **Amostra navegável do modelo de dados** — o GitHub renderiza `.csv` como tabela, então dá pra inspecionar o schema real sem clonar nada nem subir banco.
2. **Fonte de dados do modo demo** — o WEB publicado no GitHub Pages (`VITE_USE_MOCK_API=true`) carrega estes arquivos em runtime. **Só loga quem existe aqui.**

## Login da demo

| CPF | Senha |
|-----|-------|
| `34310951783` | `admin999` |

Qualquer outro CPF listado em `users.csv` também loga, sempre com a mesma senha.
As senhas reais (hash bcrypt) **nunca** saem do banco — ver "Segurança" abaixo.

## Arquivos

| Arquivo | Conteúdo | Chave de junção |
|---------|----------|-----------------|
| `users.csv` | Perfil, saldo, limites, endereço, status de adimplência | `cpf` |
| `cards.csv` | Cartões físicos/virtuais, bandeira, validade, ativação | `user_cpf` → `users.cpf` |
| `transactions.csv` | Compras, PIX, pagamentos, parcelas, assinaturas | `cpf` → `users.cpf` |
| `invoices.csv` | Faturas fechadas com encargos calculados pelo motor | `cpf` → `users.cpf` |
| `pix_keys.csv` | Chaves PIX cadastradas | `cpf` → `users.cpf` |

### Detalhes que valem nota

- **Encargos são do banco, não recalculados no front.** `invoices.csv` traz `valor_multa`,
  `valor_juros_mora`, `valor_juros_remuneratorios` e `valor_iof` já computados pelo motor de
  faturamento da API — o front só soma e exibe.
- **Fatura aberta não é uma linha.** Só existe fatura `FECHADA` na tabela; a fatura em aberto é
  derivada das compras de crédito que ainda não entraram no snapshot da fechada
  (coluna `itemized_transactions`, um JSON com os lançamentos congelados no fechamento).
- **Datas em ISO-8601 UTC** (`2026-08-10T18:00:00.000Z`).

## Regerar

Depois de qualquer mudança de schema:

```bash
cd API && node scripts/export_demo_csv.cjs
```

As colunas são lidas ao vivo do `information_schema` — nada é hardcoded no script, então
colunas novas aparecem sozinhas no CSV. Portfólio e modo demo atualizam juntos.

## Segurança

O export descarta automaticamente qualquer coluna cujo nome contenha
`password`, `hash`, `secret`, `token`, `pin`, `cvv`, `salt` ou `_raw` — o filtro roda **antes**
do `SELECT`, então esses dados nunca chegam a sair do banco. Na prática isso remove
`password_hash` de `users` e `card_number_raw`, `cvv` e `pin` de `cards`.

Os dados são massas de teste geradas artificialmente (nomes, CPFs e endereços fictícios).
Nenhum dado pessoal real está aqui.
