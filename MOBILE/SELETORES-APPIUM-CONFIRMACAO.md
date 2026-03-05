# Confirmação: id, data-testid e aria-label nas telas (Appium)

Todas as **telas principais** e **componentes de vista cheia** foram atualizados com `id`, `data-testid` e/ou `aria-label` para aparecerem no dump do Appium (content-desc / resource-id).

---

## Páginas (src/pages)

| Arquivo | Container raiz | id | data-testid | aria-label |
|---------|----------------|----|-------------|------------|
| **PreLoginDashboard/index.tsx** | div, header, main, footer, cards, botões | prelogin-screen, prelogin-header, prelogin-feature-pix, etc. | Sim | Sim |
| **Login/index.tsx** | div, header, main, form, inputs, botões | login-screen, login-header, btn-login-back, btn-entrar, etc. | Sim | Tela de login, Voltar, etc. |
| **Home/index.tsx** | div (wrapper do app logado) | app-home | app-home | App principal |

---

## Componentes – telas de vista cheia

| Componente | Container raiz | id | data-testid | aria-label |
|------------|----------------|----|-------------|------------|
| **HomeView** | main | home-view | home-view | Início |
| **Profile** | div | profile-view | profile-view | Meu Perfil |
| **Shop** | div | shop-page | shop-page | Shop |
| **Cards** | div | cards-view | cards-view | Cartões |
| **Pix** | div | pix-page | pix-page | PIX |
| **Statement** | div | statement-page | statement-page | Extrato |
| **Notifications** | div | notifications-view | notifications-view | Notificações |
| **SignUp** | div | signup-page | signup-page | Cadastro |
| **ResetPassword** | div | reset-password-page | reset-password-page | Redefinir senha |
| **EditProfile** | div | edit-profile-view | edit-profile-view | Editar perfil |
| **Admin** | div | admin-page | admin-page | Painel do Admin |

---

## Componentes – navegação e cabeçalhos

| Componente | Elementos | id | data-testid | aria-label |
|------------|-----------|----|-------------|------------|
| **BottomNavBar** | nav, cada botão | bottom-nav, nav-home, nav-cards, nav-shop, nav-profile | Sim | Navegação principal, Início, Cartões, Shop, Perfil |
| **Profile** | header, botão voltar, título, cada SettingButton | profile-header, profile-back, profile-title, profile-meus-dados, etc. | Sim | Sim |
| **Shop** | header, voltar, título, carrinho | shop-header, btn-shop-back, shop-title, btn-shop-cart | Sim | Cabeçalho do Shop, Voltar, etc. |
| **Pix** | header, voltar, título | pix-header, btn-pix-back, pix-header-title | Sim | Voltar, Área PIX |
| **Statement** | header, voltar | statement-header, statement-back | Sim | Cabeçalho do extrato, Voltar |
| **Notifications** | header, voltar | notifications-header, notifications-back | Sim | Cabeçalho de notificações, Voltar |
| **ResetPassword** | header, voltar | reset-password-header, reset-password-back | Sim | Sim |
| **EditProfile** | header, voltar, título | edit-profile-header, edit-profile-back, edit-profile-title | Sim | Sim |
| **Admin** | header | admin-header, admin-title | Sim | (botões com aria-label) |

---

## PreLoginDashboard – cards e botões

| Elemento | id | aria-label |
|----------|----|------------|
| Título | prelogin-title | Olá! |
| PIX e transferir | prelogin-feature-pix | PIX e transferir |
| Pagar | prelogin-feature-pay | Pagar |
| Extrato | prelogin-feature-statement | Extrato |
| Cartões | prelogin-feature-cards | Cartões |
| Marketplace | prelogin-feature-marketplace | Marketplace |
| Botão Entre na conta | btn-prelogin-login | Entre na conta |
| Botão Não é cliente? Abra uma conta | btn-prelogin-signup | Não é cliente? Abra uma conta |

---

## Outros componentes

- **CardDashboard**, **ShoppingCart**, **ProductPage**, **StatementPaginated**, **CurrentInvoiceView**, **ClosedInvoiceView**, **Contacts**, **PixKeyManagement**, **MyData**, **Security**, **Settings**, **PointsDashboard**, **Limits**, etc.:  
  Já possuem ou recebem `id`/`data-testid`/`aria-label` via **accessibilityEnhancer** (processa `[id]`, `[data-testid]` e elementos interativos após ~400 ms do primeiro render e em telas novas via MutationObserver).

---

## Resumo

- **Páginas**: PreLoginDashboard, Login, Home – com id/data-testid/aria-label no raiz e nos elementos principais.
- **Telas de vista cheia**: HomeView, Profile, Shop, Cards, Pix, Statement, Notifications, SignUp, ResetPassword, EditProfile, Admin – container raiz com id, data-testid e aria-label.
- **BottomNavBar**: nav e cada aba com id, data-testid e aria-label.
- **Cabeçalhos e botões “Voltar”** das telas acima: com id, data-testid e aria-label onde aplicável.
- **accessibilityEnhancer**: roda ~400 ms após o primeiro render e preenche aria-label/id a partir de data-testid e id no resto do DOM (incluindo subviews e modais).

Se alguma tela ou componente não aparecer no dump do Appium, verifique se o elemento tem pelo menos um de: `id`, `data-testid` ou `aria-label`; o enhancer cobre o restante para elementos com id ou data-testid.
