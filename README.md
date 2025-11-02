# FintechBankApp — Frontend React (Vite) integrado a API

Este projeto é um app bancário com frontend em React (Vite). Após as correções, o frontend deixou de usar dados mockados e passou a consumir endpoints reais de API para cadastro, login, carregamento de dados do usuário e transações PIX.

## Visao Geral

- Frontend: React + Vite (SPA).
- Servicos: `services/mockApi.ts` ajustado para usar chamadas HTTP reais (via `axios`) e deixar de usar `localStorage` ou mocks locais.
- Fluxos principais suportados:
  - Cadastro de usuario (`/api/signup`)
  - Login (`/api/login`)
  - Carregar dados do usuario por CPF (`/api/user/:cpf`)
  - Executar PIX (`/api/pix`)
- Fluxos ainda indisponiveis (aguardando endpoints no backend):
  - Limite diario PIX (atualizacao)
  - Gerenciamento de contatos PIX (adicionar/remover)
  - Deposito/admin e bloqueio/desbloqueio de usuario
  - Esses fluxos exibem mensagens de "endpoint indisponivel" no frontend.

## Requisitos

- Node.js LTS instalado
- Backend acessivel com os endpoints acima (local ou remoto)
- Opcional: configurar a base URL da API caso nao esteja no mesmo host/porta do frontend

## Configuracao

- Caso sua API nao esteja em `http://localhost:3000`, ajuste a base de URL utilizada pelo `axios` no arquivo `services/mockApi.ts`.
- Se voce utiliza variavel de ambiente para base URL (ex: `VITE_API_BASE_URL`), defina-a em `.env` na raiz do projeto.

## Executar o Frontend (Windows)

1. Instalar dependencias:
   ```bash
   npm install```
