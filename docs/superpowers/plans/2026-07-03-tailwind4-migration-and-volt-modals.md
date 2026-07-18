# Tailwind 4 Migration + Volt Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar WEB e MOBILE de Tailwind 3 para Tailwind 4 e adicionar os modais Volt Fintech com AI mockada (sem Gemini API).

**Architecture:** React 19 e Vite 6 já estão instalados em ambos os projetos — o único upgrade de stack restante é Tailwind 3 → 4, que muda o sistema de configuração (de `tailwind.config.js` para `@theme {}` no CSS e `@tailwindcss/vite` plugin). Após a migração, dois novos modais AI são adicionados com dados 100% mockados.

**Tech Stack:** React 19.2, Vite 6.2, Tailwind 4.x, `@tailwindcss/vite`, Motion 12, Recharts 3, Lucide React

## Global Constraints

- Tailwind 4 usa `@import "tailwindcss"` no CSS — nunca `@tailwind base/components/utilities`
- Tailwind 4 plugin no Vite: `import tailwindcss from '@tailwindcss/vite'` adicionado ao array `plugins`
- `tailwind.config.js` é deletado — tokens de tema movem para `@theme {}` no CSS
- `@tailwindcss/container-queries` é built-in no Tailwind 4 — remover das devDependencies
- AI modals (AiAssistant, AiRecurringBill): dados e respostas 100% mockados, sem chamada de API externa
- Nenhum `Co-Authored-By` nos commits
- Arquivos ≤ 500 linhas
- Darkmode: `body.theme-midnight` / `body:not(.theme-midnight)` — padrão já existente, mantido

---

## Mapa de Arquivos

### WEB (Tailwind 4)

| Arquivo | Ação |
|---------|------|
| `WEB/package.json` | Modificar: trocar tailwind 3 deps por tailwind 4 |
| `WEB/vite.config.ts` | Modificar: adicionar `@tailwindcss/vite` plugin |
| `WEB/tailwind.config.js` | **Deletar** |
| `WEB/postcss.config.js` | Deletar se existir |
| `WEB/styles/global.css` | Modificar: `@tailwind *` → `@import "tailwindcss"` + `@theme {}` |
| `WEB/components/AiAssistantModal.tsx` | **Criar** — chatbot mockado |
| `WEB/components/AiRecurringBillModal.tsx` | **Criar** — contas recorrentes mockadas |
| `WEB/components/Dashboard.tsx` | Modificar: integrar dois novos modais |

### MOBILE (Tailwind 4)

| Arquivo | Ação |
|---------|------|
| `MOBILE/package.json` | Modificar: trocar tailwind 3 deps por tailwind 4 |
| `MOBILE/vite.config.ts` | Modificar: adicionar `@tailwindcss/vite` plugin |
| `MOBILE/tailwind.config.js` | **Deletar** |
| `MOBILE/postcss.config.js` | Deletar se existir |
| CSS principal do MOBILE | Modificar: mesma migração de sintaxe |
| `MOBILE/src/components/AiAssistantModal.tsx` | **Criar** — espelho do WEB |
| `MOBILE/src/components/AiRecurringBillModal.tsx` | **Criar** — espelho do WEB |
| `MOBILE/src/components/Dashboard.tsx` | Modificar: integrar dois novos modais |

### Spec Consolidation

| Arquivo | Ação |
|---------|------|
| `.spec/web/OVERVIEW.md` | Modificar: atualizar stack para Tailwind 4 |
| `.spec/web/DESIGN_SYSTEM.md` | **Criar** — tokens, temas, convenções de classe |
| `.spec/web/MODAIS.md` | **Criar** — spec dos 7 modais |

---

## Task 1: Spec Consolidation

**Files:**
- Modify: `.spec/web/OVERVIEW.md`
- Create: `.spec/web/DESIGN_SYSTEM.md`
- Create: `.spec/web/MODAIS.md`

**Interfaces:**
- Produces: spec unificada que os tasks seguintes implementam

- [ ] **Step 1: Atualizar .spec/web/OVERVIEW.md**

Substituir conteúdo atual por:

```markdown
# Spec Web: Visão Geral

**Pasta:** `WEB/`
**Stack:** React 19.2 + Vite 6.2 + Tailwind 4 + Motion 12 + Recharts 3
**Porta:** 3000
**Testes:** Vitest + Testing Library (`WEB/tests/`)

## Funcionalidades

- Login/Signup
- Dashboard com saldo e extrato
- PIX (transferência, chaves, contatos)
- Cartão de crédito (faturas, parcelamento)
- Shop, Investments, Loans
- Admin panel (role=admin)
- AI Assistant (mockado, sem Gemini)
- AI Recurring Bills (mockado)

## Conexão com API

- Base URL: `http://localhost:3001/api`
- Auth: `Authorization: Bearer <token>` via localStorage
- Demo mode: `VITE_USE_MOCK_API=true` → usa `services/mockApi.ts`

## Referências de spec

- Auth: `.spec/api/AUTH.md`
- PIX: `.spec/api/PIX.md`
- Billing: `.spec/api/BILLING.md`
- Cards: `.spec/api/CARDS.md`
- Design System: `.spec/web/DESIGN_SYSTEM.md`
- Modais: `.spec/web/MODAIS.md`
```

- [ ] **Step 2: Criar .spec/web/DESIGN_SYSTEM.md**

```markdown
# Spec Web: Design System — Volt Fintech

## Temas

Dois temas controlados pela classe no `<body>`:
- **Yellow Brutalist** — padrão, body sem classe extra
- **Midnight Dark Neon** — `body.theme-midnight`

Toggle salvo em `localStorage('theme')`, aplicado no mount do App.

## Tailwind 4 — Configuração

Não existe mais `tailwind.config.js`. Toda configuração fica em `@theme {}` no CSS:

```css
@import "tailwindcss";
@plugin "@tailwindcss/forms";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", sans-serif;
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

## Classes CSS semânticas (usadas nos componentes)

| Classe | Significado |
|--------|-------------|
| `bg-volt-dark` | Fundo principal do app |
| `bg-volt-surface` | Cards principais |
| `bg-volt-surface-high` | Items internos dos cards |
| `bg-volt-green` / `btn-primary` | Botão primário |
| `btn-secondary` | Botão secundário |
| `modal-card` | Wrapper de modal |
| `text-volt-green` | Texto de destaque primário |
| `text-on-surface` | Texto principal |
| `text-on-surface-variant` | Texto muted/secundário |
| `neon-glow` | Shadow adapta por tema |

## Tipografia

| Fonte | Uso |
|-------|-----|
| Inter | Interface geral (body, spans, labels) |
| Space Grotesk | h1–h3 no tema Yellow |
| JetBrains Mono | Chaves PIX, códigos, números de cartão |

## Animações

Todos os modais usam `motion` com spring transition padrão:

```typescript
{ type: "spring", stiffness: 300, damping: 28 }
```
```

- [ ] **Step 3: Criar .spec/web/MODAIS.md**

```markdown
# Spec Web: Modais

## Modais implementados

| Modal | Arquivo | Status |
|-------|---------|--------|
| DepositModal | `WEB/components/DepositModal.tsx` | ✅ |
| PixModal | `WEB/components/PixModal.tsx` | ✅ |
| BoletoModal | `WEB/components/BoletoModal.tsx` | ✅ |
| BiometricModal | `WEB/components/BiometricModal.tsx` | ✅ |
| FinancialHealthModal | `WEB/components/FinancialHealthModal.tsx` | ✅ |

## Modais AI (mockados)

### AiAssistantModal

**Arquivo:** `WEB/components/AiAssistantModal.tsx`
**Props:** `{ isOpen: boolean, onClose: () => void, user: User | null }`

- Chatbot com histórico de mensagens (`Message[]`)
- Delay de 1-2s simulado + animação de typing dots
- Respostas mockadas por keyword (saldo, pix, fatura, investimento, gasto)
- Sem chamada de API externa — 100% `useState` local

### AiRecurringBillModal

**Arquivo:** `WEB/components/AiRecurringBillModal.tsx`
**Props:** `{ isOpen: boolean, onClose: () => void }`

- Lista de contas recorrentes com 5 itens default
- Total mensal calculado
- Ordenação por próximos vencimentos
- Urgency color: vermelho (≤2 dias), amarelo (≤5 dias), muted (resto)
- Formulário inline para adicionar nova conta
- Sem chamada de API — 100% `useState` local
```

- [ ] **Step 4: Commit da spec**

```bash
git add .spec/web/
git commit -m "docs(spec): consolida spec web com Tailwind 4, design system e modais AI mockados"
```

---

## Task 2: WEB — Tailwind 4 Migration

**Files:**
- Modify: `WEB/package.json`
- Modify: `WEB/vite.config.ts`
- Delete: `WEB/tailwind.config.js`
- Modify: `WEB/styles/global.css`

**Interfaces:**
- Produces: `npm run build` e `npm run dev` funcionam com Tailwind 4, tema Yellow/Midnight intacto

- [ ] **Step 1: Verificar postcss.config existente**

Rodar no terminal: `ls WEB/postcss.config*`
Expected: saber se existe `postcss.config.js`

- [ ] **Step 2: Atualizar WEB/package.json**

Em `devDependencies`, fazer as trocas:

**Remover estas 5 entradas:**
```json
"@tailwindcss/container-queries": "^0.1.1",
"@tailwindcss/forms": "^0.5.11",
"autoprefixer": "^10.5.0",
"postcss": "^8.5.15",
"tailwindcss": "^3.4.19",
```

**Adicionar estas 3 entradas:**
```json
"@tailwindcss/vite": "^4.0.0",
"tailwindcss": "^4.0.0",
"@tailwindcss/forms": "^0.5.10-insiders.20240904"
```

> Se `@tailwindcss/forms` insiders não resolver, usar a versão `next` disponível no npm: `npm info @tailwindcss/forms dist-tags`

- [ ] **Step 3: Instalar dependências**

```bash
cd WEB && npm install
```

Expected: resolve sem erros. Se `@tailwindcss/forms` insiders falhar, substituir por `@tailwindcss/forms@next`.

- [ ] **Step 4: Atualizar WEB/vite.config.ts**

Adicionar import e plugin (o restante permanece idêntico):

```typescript
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';   // ← NOVO

export default defineConfig(() => {
    const isDemo = process.env.VITE_USE_MOCK_API === 'true';
    return {
      base: '/FintechBankApp/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } }
      },
      plugins: [react(), tailwindcss()],        // ← tailwindcss() adicionado
      esbuild: { target: 'es2020' },
      optimizeDeps: { esbuildOptions: { target: 'es2020' } },
      resolve: {
        alias: [
          { find: '@', replacement: path.resolve(__dirname, '.') },
          ...(isDemo ? [{ find: /.*\/services\/api$/, replacement: path.resolve(__dirname, 'services/mockApi.ts') }] : []),
        ]
      },
      test: {
        globals: true,
        environment: 'jsdom',
        pool: 'vmThreads',
        server: { deps: { inline: ['@reduxjs/toolkit', 'recharts'] } },
        setupFiles: './tests/setup.ts',
        include: ['tests/**/*.test.{ts,tsx}'],
        exclude: ['node_modules', 'server', 'tests/api.integration.test.ts'],
        coverage: {
          provider: 'v8', reporter: ['text', 'lcov'],
          include: ['components/**/*.tsx', 'services/**/*.ts', 'context/**/*.tsx'],
          exclude: ['**/*.test.*', 'components/Icons.tsx'],
          thresholds: { statements: 5, branches: 4, functions: 4, lines: 5 },
        },
      }
    };
});
```

- [ ] **Step 5: Deletar WEB/tailwind.config.js**

Deletar o arquivo — seus tokens migram para o CSS no próximo step.

- [ ] **Step 6: Deletar WEB/postcss.config.js (se existir)**

Deletar — `@tailwindcss/vite` substitui o plugin PostCSS.

- [ ] **Step 7: Migrar WEB/styles/global.css para Tailwind 4**

Substituir APENAS as primeiras linhas (header com `@tailwind *`):

**ANTES:**
```css
@import url('https://fonts.googleapis.com/...');

@tailwind base;
@tailwind components;
@tailwind utilities;
```

**DEPOIS:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=Space+Grotesk:wght@500;700;900&family=JetBrains+Mono:wght@400;700&display=swap');

@import "tailwindcss";

@plugin "@tailwindcss/forms";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", sans-serif;
  --font-mono: "JetBrains Mono", monospace;

  --color-primary:            #00e38b;
  --color-background-light:   #f6f8f6;
  --color-background-dark:    #131313;
  --color-surface-dark:       #201f1f;
  --color-text-dark:          #e5e2e1;
  --color-subtle-dark:        #b9cbbc;

  --color-volt-primary:       #00ff9d;
  --color-volt-primary-dark:  #00e38b;
  --color-volt-dark:          #131313;
  --color-volt-surface:       #201f1f;
  --color-volt-surface-low:   #1c1b1b;
  --color-volt-surface-high:  #2a2a2a;
  --color-volt-surface-top:   #353534;
  --color-volt-white:         #e5e2e1;
  --color-volt-muted:         #b9cbbc;
  --color-volt-black:         #000000;
  --color-volt-green:         #00ff9d;

  --color-volt-yellow:        #FFD700;
  --color-volt-yellow-pastel: #FFED86;
  --color-volt-lime:          #A2FF00;
  --color-volt-cyan:          #00E5FF;
  --color-volt-pink-focus:    #FF5C8D;

  --color-on-surface:         #e5e2e1;
  --color-on-surface-variant: #b9cbbc;
  --color-neon-secondary:     #c9bfff;
  --color-neon-outline:       #849587;
  --color-neon-error:         #ffb4ab;

  --radius-DEFAULT: 0.25rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-full: 9999px;
}
```

Todo o CSS a partir de `/* ─── Base reset ─── */` permanece **intacto**.

- [ ] **Step 8: Testar build**

```bash
cd WEB && npm run build
```

Expected: `dist/` gerado sem erros. Se houver `Unknown at rule @theme` significa que o plugin Vite não carregou — verificar se `tailwindcss()` está no array `plugins` do vite.config.ts.

- [ ] **Step 9: Testar dev server e verificar temas**

```bash
cd WEB && npm run dev
```

Abrir `http://localhost:3000/FintechBankApp/`:
- Tema Yellow: fundo `#FFD700`, cards brancos com `box-shadow: 6px 6px 0px black`
- Toggle Midnight: fundo `#131313` com dot grid, verde neon `#00ff9d`

- [ ] **Step 10: Rodar testes**

```bash
cd WEB && npm test
```

Expected: mesmo resultado de antes. Se snapshots quebrarem, aprovar com `npm test -- -u`.

- [ ] **Step 11: Commit**

```bash
git add WEB/package.json WEB/vite.config.ts WEB/styles/global.css
git commit -m "feat(web): migra Tailwind 3 para 4 com @tailwindcss/vite e tokens no @theme CSS"
```

---

## Task 3: MOBILE — Tailwind 4 Migration

**Files:**
- Modify: `MOBILE/package.json`
- Modify: `MOBILE/vite.config.ts`
- Delete: `MOBILE/tailwind.config.js`
- Modify: CSS principal do MOBILE

**Interfaces:**
- Produces: `npm run build` MOBILE funciona com Tailwind 4

- [ ] **Step 1: Localizar CSS principal do MOBILE**

Ler `MOBILE/vite.config.ts` para ver qual CSS é o entry point, ou verificar `MOBILE/index.html` para o script que importa o CSS. Comum ser `MOBILE/src/index.css` ou `MOBILE/src/main.css`.

- [ ] **Step 2: Atualizar MOBILE/package.json**

Em `devDependencies`:

**Remover:**
```json
"@tailwindcss/container-queries": "^0.1.1",
"@tailwindcss/forms": "^0.5.11",
"autoprefixer": "^10.4.23",
"postcss": "^8.5.6",
"tailwindcss": "^3.4.19",
```

**Adicionar:**
```json
"@tailwindcss/vite": "^4.0.0",
"tailwindcss": "^4.0.0",
"@tailwindcss/forms": "^0.5.10-insiders.20240904"
```

- [ ] **Step 3: Instalar**

```bash
cd MOBILE && npm install
```

- [ ] **Step 4: Atualizar MOBILE/vite.config.ts**

Ler o arquivo atual, depois adicionar:

```typescript
import tailwindcss from '@tailwindcss/vite';
// No array plugins: adicionar tailwindcss() ao lado do react()
plugins: [react(), tailwindcss()],
```

Remover qualquer `css: { postcss: ... }` ou referência ao postcss-tailwind.

- [ ] **Step 5: Deletar MOBILE/tailwind.config.js e postcss.config.js**

Deletar ambos.

- [ ] **Step 6: Migrar CSS principal do MOBILE**

No arquivo identificado no Step 1, substituir o header:

```css
/* ANTES */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* DEPOIS */
@import "tailwindcss";
@plugin "@tailwindcss/forms";

@theme {
  /* Copiar exatamente os mesmos tokens do WEB/styles/global.css Task 2 Step 7 */
}
```

O restante do CSS permanece intacto.

- [ ] **Step 7: Build MOBILE**

```bash
cd MOBILE && npm run build
```

Expected: `dist/` sem erros.

- [ ] **Step 8: Dev server MOBILE**

```bash
cd MOBILE && npm run dev:mobile
```

Verificar no browser (port 3002) que o app carrega com os temas corretos.

- [ ] **Step 9: Commit**

```bash
git add MOBILE/package.json MOBILE/vite.config.ts MOBILE/tailwind.config.js
git commit -m "feat(mobile): migra Tailwind 3 para 4 com @tailwindcss/vite e tokens no @theme CSS"
```

---

## Task 4: AiAssistantModal — WEB

**Files:**
- Create: `WEB/components/AiAssistantModal.tsx`
- Modify: `WEB/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `user: User | null` do AuthContext
- Produces: `<AiAssistantModal isOpen={bool} onClose={() => void} user={User | null} />`

- [ ] **Step 1: Criar WEB/components/AiAssistantModal.tsx**

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User as UserIcon, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { User } from '../types';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

function getMockResponse(input: string, user: User | null): string {
  const text = input.toLowerCase();
  const name = user?.fullName?.split(' ')[0] ?? 'você';
  const balance = user?.balance ?? 0;
  const invoice = (user as any)?.creditCard?.currentInvoice ?? 0;

  if (/saldo|dinheiro|conta/.test(text))
    return `${name}, seu saldo atual é R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Está dentro do esperado para o período!`;
  if (/pix/.test(text))
    return 'Transferências PIX estão disponíveis 24h. Limite padrão: R$ 1.000 entre 20h–6h e R$ 5.000 nos outros horários.';
  if (/fatura|cartão|compra/.test(text))
    return `Sua fatura atual é R$ ${invoice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Pagar antes do vencimento evita juros de 1% ao mês.`;
  if (/investimento|renda|aplicar/.test(text))
    return 'Para iniciantes, CDB com liquidez diária (100% CDI) é uma boa opção. Comece com R$ 100 e resgate quando quiser.';
  if (/gasto|economia|economizar/.test(text))
    return `${name}, regra 50/30/20: necessidades, desejos e poupança. Quer que eu analise seus gastos do mês?`;
  return `${name}, posso ajudar com saldo, PIX, faturas, investimentos e dicas de economia. O que você quer saber?`;
}

export default function AiAssistantModal({ isOpen, onClose, user }: Props) {
  const [messages, setMessages] = useState<Message[]>([{
    id: 0,
    role: 'assistant',
    text: `Olá${user ? ', ' + user.fullName?.split(' ')[0] : ''}! Sou seu assistente financeiro. Como posso ajudar?`,
  }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function handleSend() {
    if (!input.trim() || isTyping) return;
    const userMsg: Message = { id: Date.now(), role: 'user', text: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', text: getMockResponse(userMsg.text, user) }]);
      setIsTyping(false);
    }, 1200 + Math.random() * 800);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal-card w-full max-w-md flex flex-col"
            style={{ height: '70vh', maxHeight: 560 }}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 28 } }}
            exit={{ y: 60, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-black/10">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-volt-green" />
                <span className="font-bold text-base">AI Assistant</span>
              </div>
              <button onClick={onClose} className="p-1 rounded-full hover:bg-black/10 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === 'assistant' ? 'bg-volt-green' : 'bg-black/10'}`}>
                    {msg.role === 'assistant' ? <Bot size={14} className="text-black" /> : <UserIcon size={14} />}
                  </div>
                  <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-snug ${msg.role === 'assistant' ? 'bg-volt-surface-high rounded-tl-none' : 'bg-volt-green text-black rounded-tr-none font-medium'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-volt-green flex items-center justify-center">
                    <Bot size={14} className="text-black" />
                  </div>
                  <div className="bg-volt-surface-high px-3 py-2 rounded-2xl rounded-tl-none flex gap-1 items-center">
                    {[0, 1, 2].map(i => (
                      <motion.span key={i} className="w-1.5 h-1.5 bg-on-surface-variant rounded-full"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-black/10 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Pergunte sobre saldo, PIX, fatura..."
                className="flex-1 text-sm px-3 py-2 rounded-xl"
                disabled={isTyping}
              />
              <button onClick={handleSend} disabled={!input.trim() || isTyping}
                className="btn-primary px-3 py-2 rounded-xl disabled:opacity-40">
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Integrar no WEB/components/Dashboard.tsx**

Ler `Dashboard.tsx`, adicionar:
```tsx
import AiAssistantModal from './AiAssistantModal';

// No estado (junto dos outros modais):
const [showAiAssistant, setShowAiAssistant] = useState(false);

// No JSX (junto dos outros modais no final do return):
<AiAssistantModal isOpen={showAiAssistant} onClose={() => setShowAiAssistant(false)} user={user} />
```

Passar `setShowAiAssistant` para HomeView ou Quick Actions via prop `onOpenAiAssistant`.

- [ ] **Step 3: Verificar no browser**

- Clicar no atalho de AI
- Modal abre com spring animation
- Digitar "saldo" → resposta com valor do user após ~1.5s
- Typing dots animados durante o delay

- [ ] **Step 4: Commit**

```bash
git add WEB/components/AiAssistantModal.tsx WEB/components/Dashboard.tsx
git commit -m "feat(web): adiciona AiAssistantModal mockado com chat e typing animation"
```

---

## Task 5: AiRecurringBillModal — WEB

**Files:**
- Create: `WEB/components/AiRecurringBillModal.tsx`
- Modify: `WEB/components/Dashboard.tsx`

**Interfaces:**
- Consumes: nenhum prop de dados externos
- Produces: `<AiRecurringBillModal isOpen={bool} onClose={() => void} />`

- [ ] **Step 1: Criar WEB/components/AiRecurringBillModal.tsx**

```tsx
import React, { useState } from 'react';
import { X, Plus, Trash2, Calendar, TrendingUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface Bill {
  id: number;
  name: string;
  amount: number;
  dueDay: number;
}

const DEFAULT_BILLS: Bill[] = [
  { id: 1, name: 'Netflix',          amount: 39.90,  dueDay: 5  },
  { id: 2, name: 'Spotify',          amount: 21.90,  dueDay: 8  },
  { id: 3, name: 'Energia Elétrica', amount: 180.00, dueDay: 10 },
  { id: 4, name: 'Internet',         amount: 99.90,  dueDay: 15 },
  { id: 5, name: 'Plano de Saúde',   amount: 350.00, dueDay: 20 },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AiRecurringBillModal({ isOpen, onClose }: Props) {
  const [bills, setBills] = useState<Bill[]>(DEFAULT_BILLS);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDueDay, setNewDueDay] = useState('');

  const today = new Date().getDate();
  const total = bills.reduce((sum, b) => sum + b.amount, 0);
  const sorted = [...bills].sort((a, b) => {
    const dA = a.dueDay >= today ? a.dueDay - today : 31 - today + a.dueDay;
    const dB = b.dueDay >= today ? b.dueDay - today : 31 - today + b.dueDay;
    return dA - dB;
  });

  function addBill() {
    if (!newName.trim() || !newAmount || !newDueDay) return;
    setBills(prev => [...prev, { id: Date.now(), name: newName.trim(), amount: parseFloat(newAmount), dueDay: parseInt(newDueDay) }]);
    setNewName(''); setNewAmount(''); setNewDueDay('');
    setShowAdd(false);
  }

  function daysLabel(dueDay: number): string {
    const diff = dueDay >= today ? dueDay - today : 31 - today + dueDay;
    if (diff === 0) return 'Vence hoje';
    if (diff === 1) return 'Vence amanhã';
    return `Vence em ${diff} dias`;
  }

  function urgencyClass(dueDay: number): string {
    const diff = dueDay >= today ? dueDay - today : 31 - today + dueDay;
    if (diff <= 2) return 'text-red-400';
    if (diff <= 5) return 'text-yellow-400';
    return 'text-on-surface-variant';
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal-card w-full max-w-md flex flex-col overflow-hidden"
            style={{ maxHeight: '80vh' }}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 28 } }}
            exit={{ y: 60, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-black/10">
              <div className="flex items-center gap-2">
                <Calendar size={20} className="text-volt-green" />
                <span className="font-bold text-base">Contas Recorrentes</span>
              </div>
              <button onClick={onClose} className="p-1 rounded-full hover:bg-black/10 transition-colors"><X size={20} /></button>
            </div>

            <div className="px-4 py-3 bg-volt-surface-high flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <TrendingUp size={16} /><span>Total mensal</span>
              </div>
              <span className="font-bold text-lg">
                R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {sorted.map(bill => (
                <motion.div key={bill.id} layout
                  className="bg-volt-surface-high rounded-xl px-3 py-2.5 flex items-center justify-between"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                >
                  <div>
                    <p className="font-semibold text-sm">{bill.name}</p>
                    <p className={`text-xs mt-0.5 ${urgencyClass(bill.dueDay)}`}>
                      {daysLabel(bill.dueDay)} (dia {bill.dueDay})
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">
                      R$ {bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <button onClick={() => setBills(prev => prev.filter(b => b.id !== bill.id))}
                      className="p-1 rounded-full hover:bg-black/10 transition-colors text-on-surface-variant">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            <AnimatePresence>
              {showAdd && (
                <motion.div className="px-4 pb-2 pt-1 border-t border-black/10 space-y-2"
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Nome da conta" className="w-full text-sm px-3 py-2 rounded-xl" />
                  <div className="flex gap-2">
                    <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)}
                      placeholder="Valor R$" className="flex-1 text-sm px-3 py-2 rounded-xl" />
                    <input type="number" value={newDueDay} onChange={e => setNewDueDay(e.target.value)}
                      placeholder="Dia" min="1" max="31" className="w-20 text-sm px-3 py-2 rounded-xl" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAdd(false)} className="flex-1 btn-secondary py-2 rounded-xl text-sm">Cancelar</button>
                    <button onClick={addBill} className="flex-1 btn-primary py-2 rounded-xl text-sm">Adicionar</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!showAdd && (
              <div className="p-3 border-t border-black/10">
                <button onClick={() => setShowAdd(true)}
                  className="w-full btn-secondary py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
                  <Plus size={16} />Adicionar conta
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Integrar no Dashboard**

```tsx
import AiRecurringBillModal from './AiRecurringBillModal';

const [showAiRecurring, setShowAiRecurring] = useState(false);

<AiRecurringBillModal isOpen={showAiRecurring} onClose={() => setShowAiRecurring(false)} />
```

- [ ] **Step 3: Verificar no browser**

- Lista de 5 contas com total = R$ 691,70
- Ordenadas por proximidade do vencimento (relativo a hoje)
- Contas vencendo em ≤2 dias aparecem em vermelho
- Adicionar nova conta via formulário inline
- Remover conta com animação de layout

- [ ] **Step 4: Commit**

```bash
git add WEB/components/AiRecurringBillModal.tsx WEB/components/Dashboard.tsx
git commit -m "feat(web): adiciona AiRecurringBillModal com lista mockada e formulario de adicao"
```

---

## Task 6: Mirror dos Modais AI no MOBILE

**Files:**
- Create: `MOBILE/src/components/AiAssistantModal.tsx`
- Create: `MOBILE/src/components/AiRecurringBillModal.tsx`
- Modify: `MOBILE/src/components/Dashboard.tsx`

**Interfaces:**
- Produces: mesmos modais disponíveis no app Android

- [ ] **Step 1: Verificar tipos do MOBILE**

Ler `MOBILE/src/types.ts` (ou equivalente) e confirmar interface `User`. Ajustar o import em `AiAssistantModal` se o caminho for diferente do WEB.

- [ ] **Step 2: Criar MOBILE/src/components/AiAssistantModal.tsx**

Copiar o conteúdo de `WEB/components/AiAssistantModal.tsx`, ajustando apenas o import de `User`:

```tsx
import { User } from '../types';  // caminho MOBILE
```

- [ ] **Step 3: Criar MOBILE/src/components/AiRecurringBillModal.tsx**

Copiar `WEB/components/AiRecurringBillModal.tsx` para `MOBILE/src/components/AiRecurringBillModal.tsx` sem alterações (não usa tipos do projeto).

- [ ] **Step 4: Integrar no MOBILE Dashboard**

Mesmo padrão do WEB — ler `MOBILE/src/components/Dashboard.tsx` e adicionar os dois modais.

- [ ] **Step 5: Build MOBILE**

```bash
cd MOBILE && npm run build
```

Expected: sem erros de TypeScript.

- [ ] **Step 6: Commit**

```bash
git add MOBILE/src/components/AiAssistantModal.tsx MOBILE/src/components/AiRecurringBillModal.tsx MOBILE/src/components/Dashboard.tsx
git commit -m "feat(mobile): espelha AiAssistantModal e AiRecurringBillModal do WEB"
```

---

## Self-Review

### Spec coverage

| Requisito do usuário | Task |
|----------------------|------|
| Juntar specs em um só | Task 1 |
| Tailwind 4 — WEB | Task 2 |
| Tailwind 4 — MOBILE | Task 3 |
| AI Assistant mockado (sem Gemini) | Task 4 |
| AI Recurring Bills mockado | Task 5 |
| Modais disponíveis no MOBILE | Task 6 |
| React 19 ✅ (já instalado) | — |
| Vite 6 ✅ (já instalado) | — |

### Gaps / Avisos

- **`@tailwindcss/forms` v4**: se a versão `insiders` falhar no npm install, verificar versão com `npm info @tailwindcss/forms dist-tags` e usar a tag `next` ou `latest` que suporte v4.
- **postcss.config.js**: verificar se existe antes de deletar — alguns projetos têm apenas como stub vazio.
- **MOBILE CSS path**: confirmar o arquivo CSS correto no Step 1 da Task 3 — não assumir `src/index.css`.
- **Snapshots de teste**: classes CSS que mudaram entre v3 e v4 podem quebrar snapshots — aprovar com `npm test -- -u` após verificar que o visual está correto.
- **`(user as any)?.creditCard`**: se o tipo `User` do WEB não expõe `creditCard`, adicionar o campo como opcional em `types.ts` ao invés de usar `as any`.
