# FintechBankApp Frontend (Vite + React + TypeScript)

Aplicação web para interação com a API FintechBankApp. Este README descreve como configurar, executar, construir e replicar o frontend em outro projeto.

## Visão Geral
- Stack: Vite, React, TypeScript
- Diretório raiz: `f:\GITHUB\FintechBankApp`
- Páginas e componentes em `./components` e arquivos raiz `.tsx`

## Pré-requisitos
- Node.js 18+ (recomendado 18 LTS ou 20 LTS)
- npm 8+

## Instalação
Execute a instalação das dependências no diretório raiz do projeto.

```bash
npm install
```

Se você usa ambientes reprodutíveis, pode preferir:

```bash
npm ci
```

## Executar em desenvolvimento
Inicie o servidor de desenvolvimento do Vite.

```bash
npm run dev
```

- Acesse `http://localhost:5173/` (porta padrão do Vite) ou a porta configurada pelo Vite.
- Certifique-se de que o backend está rodando em `http://localhost:3001` para a integração completa.

## Build de produção
Gere os artefatos de produção.

```bash
npm run build
```

Pré-visualize o build localmente (útil para validação):

```bash
npm run preview
```

## Integração com Backend
- Base URL prevista: `http://localhost:3001`
- Endpoints principais:
  - Health: `GET /api/v1/health`
  - Login: `POST /api/v1/auth/login`
  - Perfil do usuário: `GET /api/v1/user/me/{cpf}`
  - Swagger: `http://localhost:3001/api-docs`

Se necessário, configure variáveis no frontend (por exemplo `VITE_API_BASE_URL`) e consuma via `import.meta.env`.

## Replicação do Frontend em Outro Projeto
1. Copie os seguintes itens para o novo diretório:
   - `index.html`, `index.tsx`, `App.tsx` e os `.tsx` de páginas/`components`.
   - `package.json`, `tsconfig.json`, `vite.config.ts`.
2. Atualize `name`, `version` e scripts no `package.json` conforme seu projeto.
3. Ajuste endpoints ou variáveis de ambiente (`VITE_API_BASE_URL`) se a API tiver outra URL.
4. Instale as dependências no novo projeto:
   ```bash
   npm install
   ```
5. Rode em desenvolvimento:
   ```bash
   npm run dev
   ```
6. Faça o build:
   ```bash
   npm run build
   ```

## Testes e Qualidade
- Valide a integração com o backend acessando o fluxo de login.
- Para testes de API, use o README do backend (Newman/Postman).
- Padronize mensagens e estados da UI conforme respostas do backend (status, erros).

## Problemas Comuns
- CORS: se o backend estiver em outra origem, habilite CORS no backend.
- Porta ocupada: ajuste a porta do Vite em `vite.config.ts` se necessário.
- Falha ao logar: verifique se o backend está com Databricks conectado e se o usuário admin foi criado.