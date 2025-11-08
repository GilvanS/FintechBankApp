full contents of registroMockado_I.md# Registro de Mocks e Lógicas Simuladas

Este documento serve como um guia para todas as partes do projeto que estão atualmente "mockadas" ou simuladas. Seu objetivo é facilitar a futura integração com um backend real, fornecendo um mapa claro do que precisa ser substituído por chamadas de API verdadeiras.

## 1. Fonte de Dados Principal: `localStorage`

Toda a persistência de dados da aplicação é gerenciada através do `localStorage` do navegador.

- **Chave**: `fintech_app_data`
- **O que armazena**: Um objeto JSON contendo `users`, `passwordRequests`, `limitRequests`, e `notifications`.
- **Por que está mockado**: Para permitir que o frontend seja desenvolvido e testado de forma totalmente independente, sem a necessidade de um banco de dados ou servidor real.
- **Futuro**: O `localStorage` será completamente substituído por um banco de dados (ex: PostgreSQL, MongoDB) gerenciado pelo backend.

## 2. Usuários de Teste

- **Localização**: `data/mockData.ts`
- **O que é**: Um array (`MOCK_USERS`) contendo objetos de usuários pré-configurados, incluindo:
  - **Usuário Administrador**: Com a role `admin` e credenciais para acessar o painel de gerenciamento.
  - **Usuários Comuns**: Com diferentes saldos, transações e configurações para testar os mais variados cenários.
- **Por que está mockado**: Para garantir que sempre haja dados consistentes para testar a aplicação, especialmente as funcionalidades de login e administração. A função `initializeMockUsers` em `mockApi.ts` garante que esses usuários sejam inseridos ou atualizados no `localStorage` a cada carregamento da aplicação.
- **Futuro**: Em um ambiente de produção, esses usuários não existiriam. Apenas o fluxo de cadastro (`/api/v1/auth/signup`) criaria novos usuários no banco de dados.

## 3. Simulação da API Backend

- **Localização**: `services/mockApi.ts`
- **O que é**: Um arquivo que exporta funções assíncronas que imitam o comportamento de uma API RESTful. Cada função manipula os dados no `localStorage` e retorna uma promessa com um resultado, simulando a latência de rede com um `delay`.

### Funções Mockadas e sua Futura Substituição:

| Função em `mockApi.ts`                  | Endpoint Backend Correspondente           | Descrição da Simulação                                                                 |
| --------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `login`                                 | `POST /auth/login`                        | Valida CPF e senha contra os dados no `localStorage`.                                  |
| `signUp`                                | `POST /auth/signup`                       | Adiciona um novo usuário ao `localStorage` se o CPF/email não existirem.               |
| `requestNewPassword`                    | `POST /auth/request-password-reset`       | Adiciona uma solicitação de senha à lista de `passwordRequests`.                       |
| `checkPasswordRequestStatus`            | `GET /auth/password-request-status/{cpf}` | Busca o status de uma solicitação no `localStorage`.                                   |
| `resetPassword`                         | `POST /auth/reset-password`               | Atualiza a senha de um usuário no `localStorage` após a aprovação.                     |
| `performPix`                            | `POST /pix/transfer`                      | Deduz o saldo do remetente e, se o destinatário for um usuário mockado, adiciona o saldo a ele. |
| `performPixCreditInstallment`           | `POST /pix/transfer/credit`               | Lança o valor do PIX como uma compra parcelada na fatura do cartão de crédito.           |
| `purchaseWithDebit`                     | `POST /shop/purchase/debit`               | Valida e deduz o saldo da conta, aplica cashback e registra a transação no extrato.      |
| `purchaseWithCard`                      | `POST /shop/purchase/credit`              | Valida o limite do cartão, aplica cashback, lança a compra (parcelada ou não) na fatura. |
| `payCreditCardInvoice`                  | `POST /cards/invoice/pay`                 | Deduz o valor da fatura do saldo da conta e libera o limite do cartão.                  |
| `parcelCreditCardInvoice`               | `POST /cards/invoice/parcel`              | Zera a fatura fechada e lança as novas parcelas com juros na fatura aberta.              |
| **Todas as funções de Admin**           | `/admin/*`                                | Manipulam diretamente os dados dos usuários no `localStorage` (bloquear, depositar, etc.). |
| **Todas as funções de `get` e `update`** | `GET` / `PUT` / `POST` / `DELETE`         | Buscam ou modificam arrays específicos (`pixKeys`, `pixContacts`, `notifications`) no `localStorage`. |

## 4. Chamadas de API Reais no Frontend

Existem componentes que, para fins de demonstração, fazem chamadas diretas a APIs públicas gratuitas.

- **Localização**:
  - `components/PromotionalBanner.tsx`
  - `components/GuardianBanner.tsx`
  - `components/NewsJournal.tsx`
  - `components/PreLoginNewsBanner.tsx`
- **APIs Consumidas**:
  - **NewsAPI.org**: Para notícias gerais e financeiras do Brasil.
  - **WorldNewsAPI.com**: Como fonte alternativa de notícias.
  - **IBGE Notícias**: Para notícias oficiais.
  - **The Guardian API**: Para notícias internacionais de tecnologia e negócios.
- **Por que estão no Frontend**: Para demonstrar a capacidade da aplicação de se integrar com serviços externos e enriquecer a interface do usuário com conteúdo dinâmico.
- **Futuro**: O ideal é que essas chamadas sejam movidas para o backend. O frontend faria uma única chamada para um endpoint do nosso backend (ex: `GET /external/news`), e o servidor seria responsável por se comunicar com as APIs externas. Isso oferece várias vantagens:
  1. **Segurança**: As chaves de API (`API Keys`) não ficam expostas no código do frontend.
  2. **Performance**: O backend pode implementar um cache para as notícias, reduzindo o número de chamadas às APIs externas e melhorando a velocidade de carregamento.
  3. **Manutenibilidade**: Se uma API externa mudar, apenas o backend precisa ser atualizado, sem a necessidade de uma nova compilação do frontend.
