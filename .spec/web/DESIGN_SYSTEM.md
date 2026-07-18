# Spec Web: Design System — Volt Fintech

## Temas

Dois temas controlados por classe no `<body>`:
- **Yellow Brutalist** — padrão (body sem classe extra): fundo `#FFD700`, cards
  brancos com borda preta 4px e hard-shadow (`6px 6px 0px black`), fonte display
  Space Grotesk.
- **Midnight Dark Neon** — `body.theme-midnight`: fundo `#131313`, surfaces
  escuras, acento verde-neon `#00ff9d`.

Toggle salvo em `localStorage('volt_theme')` (`'yellow' | 'midnight'`), aplicado no
mount pelo `AppStateContext`, que adiciona/remove `theme-midnight` no `<body>`.

## Tailwind 4 — Configuração

Não existe mais `tailwind.config.js` nem `postcss.config.js`. A configuração vive no
CSS (`WEB/styles/global.css`; no MOBILE, `MOBILE/src/theme/variables.css`):

```css
@import "tailwindcss";
@plugin "@tailwindcss/forms";

/* Preserva o darkMode ['selector','.theme-midnight'] do Tailwind 3:
   utilitarios dark: ativam pela classe, nao por prefers-color-scheme. */
@custom-variant dark (&:where(.theme-midnight, .theme-midnight *));

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", "Manrope", sans-serif;
  --font-mono: "JetBrains Mono", monospace;

  --color-volt-primary:       #00ff9d;
  --color-volt-primary-dark:  #00e38b;
  --color-volt-dark:          #131313;
  --color-volt-surface:       #201f1f;
  --color-volt-surface-low:   #1c1b1b;
  --color-volt-surface-high:  #2a2a2a;
  --color-volt-surface-top:   #353534;
  --color-volt-white:         #e5e2e1;
  --color-volt-muted:         #b9cbbc;
  --color-volt-green:         #00ff9d;

  --color-volt-yellow:        #FFD700;
  --color-volt-yellow-pastel: #FFED86;
  --color-volt-lime:          #A2FF00;
  --color-volt-cyan:          #00E5FF;
  --color-volt-pink-focus:    #FF5C8D;

  --color-on-surface:         #e5e2e1;
  --color-on-surface-variant: #b9cbbc;
  --color-neon-error:         #ffb4ab;
}
```

> **Importante:** o `@custom-variant dark` é obrigatório. Sem ele, as ~148
> ocorrências de `dark:` no WEB (e equivalentes no MOBILE) passariam a usar
> `@media (prefers-color-scheme: dark)` e o tema Midnight quebraria.

Os plugins v3 `@tailwindcss/forms` continuam via `@plugin`. O
`@tailwindcss/container-queries` foi removido — é built-in no Tailwind 4.
`@tailwindcss/vite` é o plugin do build (array `plugins` no `vite.config.ts`).

## Overrides do tema Yellow

Além dos tokens, `global.css`/`variables.css` mantêm ~490 linhas de regras
`body:not(.theme-midnight) …` com `!important` que reestilizam classes semânticas
(ex.: `.bg-volt-surface` vira card branco brutalista, `.text-volt-green` vira preto
bold) e garantem legibilidade de texto branco dentro de containers escuros no tema
amarelo. Esse bloco permanece intacto após a migração v4.

## Classes CSS semânticas

| Classe | Significado |
|--------|-------------|
| `bg-volt-dark` | Fundo principal do app |
| `bg-volt-surface` | Cards principais |
| `bg-volt-surface-high` | Items internos dos cards |
| `bg-volt-green` / `btn-primary` | Botão primário |
| `text-volt-green` | Texto de destaque primário |
| `text-on-surface` | Texto principal |
| `text-on-surface-variant` | Texto muted/secundário |

## Tipografia

| Fonte | Uso |
|-------|-----|
| Inter | Interface geral (body, spans, labels) |
| Space Grotesk | Headings / display |
| JetBrains Mono | Chaves PIX, códigos de barras, números de cartão |

## Animações

Modais usam `motion` (`motion/react`) com spring transition. Padrão comum:

```typescript
{ type: "spring", stiffness: 300, damping: 28 }
```
