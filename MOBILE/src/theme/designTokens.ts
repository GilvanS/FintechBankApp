/**
 * Design tokens — Direção "Dark Glass Neon", aprovada como base do redesign.
 * Espelha as CSS custom properties de variables.css (mesmos hex, nunca inventa
 * novo) e acrescenta os tokens específicos da direção (vidro, gradiente,
 * tipografia) que ainda não existem em CSS. Fonte: docs/plans/2026-08-27-plano-de-para-web-mobile.md
 * (Fase 1 pede este arquivo) + canvas "Volt — Direções Visuais" (Direção C).
 *
 * Contraste validado WCAG AA — ver scratchpad/volt-directions/design-dna-clean.json.
 */

export const colors = {
  background: '#131313',
  surface: '#1c1b1b',
  surfaceHigh: '#2a2a2a',
  surfaceLow: '#201f1f',
  border: '#2a2a2a',

  textPrimary: '#e5e2e1',
  textSecondary: '#b9cbbc',
  textMuted: '#849587', // --color-neon-outline — único válido p/ texto pequeno (5,87:1); nunca usar cinza fora deste token

  accent: '#00ff9d', // --color-volt-green
  accentPressed: '#00e38b', // --color-volt-primary-dark
  accentSecondary: '#c9bfff', // --color-neon-secondary — segundo tom do gradiente/glow
  warning: '#ffb4ab', // --color-neon-error — usar também p/ avisos (vencimento etc.)
} as const;

export const typography = {
  display: "'Unbounded', 'Sora', system-ui, sans-serif",
  body: "'Manrope', system-ui, -apple-system, sans-serif",
  googleFontsImport:
    "https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Manrope:wght@400;500;600;700&display=swap",
} as const;

export const glass = {
  background: 'rgba(255,255,255,0.055)',
  border: '1px solid rgba(255,255,255,0.09)',
  blur: '14px',
} as const;

export const gradientMesh = [
  { pos: '15% 5%', color: 'rgba(0,255,157,0.20)', radius: '480px 380px' },
  { pos: '95% 30%', color: 'rgba(201,191,255,0.14)', radius: '420px 340px' },
  { pos: '30% 100%', color: 'rgba(0,255,157,0.10)', radius: '500px 420px' },
] as const;

export const radius = {
  sm: '10px',
  md: '16px',
  lg: '20px',
  pill: '9999px',
} as const;

export const spacing = {
  base: 4,
  sectionGap: 20,
  itemGap: 10,
} as const;
