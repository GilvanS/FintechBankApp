# WEB — FintechBankApp Frontend

React 19 + TypeScript + Vite. SPA de banco digital com modo demo para GitHub Pages.

## Como rodar

```bash
npm install
npm run dev        # localhost:3000
npm run build      # dist/
npm test           # Vitest
VITE_USE_MOCK_API=true npm run build  # Build modo demo (sem backend)
```

## Estrutura

```
WEB/
├── App.tsx              # Root: AuthContext.Provider + React Router Routes
├── index.tsx            # Entry point: BrowserRouter
├── types.ts             # Tipos de domínio (User, Transaction, CreditCard...)
├── components/          # Todos os componentes React
│   ├── Login.tsx        # Tela de login
│   ├── Dashboard.tsx    # Shell do dashboard autenticado (view interna por estado)
│   ├── ProtectedRoute.tsx  # Redireciona /login se não autenticado
│   └── ...
├── context/
│   └── AuthContext.tsx  # user, login, logout, updateUser, view, navigateTo
├── services/
│   ├── api.ts           # API real (Node.js backend em :3001)
│   └── mockApi.ts       # Mock via localStorage (usado no demo/GitHub Pages)
├── data/
│   └── mockData.ts      # Usuários demo: CPF 11111111111 / senha 1234
└── utils/
    └── formatters.ts    # formatCPF, formatCurrency, etc.
```

## Rotas (React Router)

| Rota | Componente | Auth |
|------|-----------|------|
| `/` | PreLoginDashboard | Pública |
| `/login` | Login | Pública |
| `/signup` | SignUp | Pública |
| `/reset-password` | ResetPassword | Pública |
| `/dashboard` | Dashboard | Protegida |

Base URL em produção: `/FintechBankApp/` (GitHub Pages)

## Modo Demo vs Produção

Controlado por `VITE_USE_MOCK_API=true`. O alias Vite troca `./services/api` por `./services/mockApi.ts`.
- **Demo**: dados em localStorage, sem backend
- **Produção**: proxy `/api` → `localhost:3001`

## Convenções

- Componentes em `PascalCase.tsx`
- Hooks customizados em `use*.ts`
- Sem `any` explícito — usar tipos em `types.ts`
- Props de navegação: callbacks do pai OU `useNavigate()` diretamente
- Testes em `tests/` com Vitest + Testing Library
