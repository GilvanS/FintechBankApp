# Spec Mobile: Navegação e App Shell

**Arquivo de implementação:** `MOBILE/src/App.tsx`, `MOBILE/src/context/AuthContext.tsx`
**Status:** Implementado

## State Machine de Views

O app usa uma string `view` no lugar de router. `AuthContext` expõe `navigateTo(view)`.

```
(não autenticado)
  └── login
  └── signup

(autenticado)
  ├── home               ← default após login
  ├── cards
  │   ├── currentInvoice
  │   ├── closedInvoice
  │   ├── installmentOptions
  │   ├── installmentReviewInvoice
  │   ├── invoicePaymentReceipt
  │   └── anticipateInstallments
  ├── pix
  ├── statement
  │   └── transactionReceipt
  ├── shop
  │   ├── shoppingCart
  │   ├── paymentMethods
  │   ├── purchaseConfirmation
  │   └── closedInvoice
  ├── products
  │   ├── investments
  │   ├── loans
  │   ├── insurance
  │   └── marketplace
  ├── notifications
  ├── profile
  ├── menu
  ├── points
  └── admin              ← apenas role=admin
```

## Session Restore

1. Mount: `localStorage.getItem('authToken')`
2. Se token existe → `GET /users/me`
3. Sucesso → seta `user` + `view = 'home'`
4. Falha → `view = 'login'`

## Back Button (Android)

```
CapApp.addListener('backButton', handler)
→ Se pode voltar: navega para view anterior
→ Se não pode: minimizeApp()
```

## AuthContext API

```typescript
interface AuthContextValue {
  user: User | null
  login(user: User, token: string): void
  logout(): void
  updateUser(partial: Partial<User>): void
  view: View
  navigateTo(view: View): void
}
```

## BottomNavBar

Tabs: Home | Cards | PIX | Extrato | Mais

- `paddingBottom: env(safe-area-inset-bottom)`
- `height: auto` (não fixo — safe area dinâmica)
- Ícones em `text-primary` (verde) para tab ativa

## Capacitor Android

- Origin no WebView: `http://localhost` — CORS deve aceitar
- Safe area: `viewport-fit=cover` no `index.html`
- API URL: `http://10.0.2.2:3001` (emulador) ou LAN IP detectado
