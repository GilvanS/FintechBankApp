# Dashboard "Analytics" (estilo Allure + decoração dither) — Plano de Implementação

**Goal:** Adicionar uma nova aba/view "Analytics" ao dashboard WEB do FintechBankApp, full-bleed em telas desktop (quebra o container mobile `md:max-w-md`, igual o Admin já faz), com layout denso de dados inspirado no Allure Report (donut de status, trend chart, breakdown por categoria, histogram, progress bars). Usa o design system VOLT oficial (`DESIGN.md`) — tema Midnight (`volt-green` como único wire de destaque) e Yellow (brutalista, hard-offset shadow), com GSAP + Three.js/R3F + Motion para as transições e um elemento 3D decorativo pontual no hero. Efeito de dithering (Floyd-Steinberg / Bayer 8x8 / ASCII-Halftone) entra como decoração pontual adicional, testável nas 3 variantes antes de escolher uma.

**Architecture:** Nova view React (`AnalyticsView.tsx`) montada dentro do shell existente `Dashboard.tsx` (view por state, não rota React Router — confirmado em `App.tsx`/`Dashboard.tsx`). Charts com `recharts` (já instalado). Layout full-bleed reaproveitando a condicional já existente em `Dashboard.tsx:762` (`(currentView === 'admin' || topLevelView === 'admin') ? 'max-w-screen-2xl mx-auto' : 'md:max-w-md mx-auto shadow-2xl relative'` — adicionar `topLevelView === 'analytics'` na mesma condição). Dither implementado como utilitário Canvas2D puro, sem lib nova.

**Tech Stack:** React 19 + TypeScript + Vite (existente). `recharts` v3.9.0, `motion` v12 (Framer Motion), `gsap` v3 + `@gsap/react`, `d3` v7 — todas já dependências do projeto, nenhuma lib nova exceto Three.js/R3F (ver Task 0). Canvas2D nativo para dither.

## Global Constraints

- **Não substituir** o dashboard mobile atual (`HomeView.tsx`) — Analytics é view adicional. Em telas mobile ela continua dentro do container `md:max-w-md`; em desktop (`md:` breakpoint+) ela quebra para `max-w-screen-2xl`, estilo Allure full-screen.
- **Design system é `DESIGN.md`** (raiz do repo) — VOLT oficial: tema Yellow = hard-offset shadow (`shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]`, `border-4 border-black`, zero blur); tema Midnight = tonal (steps `volt-dark → volt-surface → volt-surface-high → volt-surface-top`, `border border-white/5`, zero shadow). **Nunca inventar hex novo** — usar os tokens nomeados do frontmatter YAML de `DESIGN.md` (`volt-green #00ff9d`, `volt-surface #201f1f`, `volt-dark #131313`, `volt-cyan`, `volt-pink-focus`, etc).
- **The One Wire Rule** (`DESIGN.md`): Midnight usa só `volt-green` como accent principal — não introduzir um segundo verde nem usar `volt-cyan`/`volt-pink-focus` como destaque primário, só como terciário raro (ex: uma categoria de gasto específica).
- **Reusar `recharts`** — já em uso em `SpendingTrendsSection.tsx`, `FinancialHealthModal.tsx`, `PaymentTimelineChart.tsx`. Não trocar por outra lib de chart 2D.
- **Categorias de gasto já mapeadas**: `refeicao, mobilidade, cultura, saude, outros` (ver `SpendingTrendsSection.tsx:18-24`) — reusar essas chaves.
- **Dither é decoração pontual** — nunca no lugar de dados reais/números.
- **Efeitos GSAP/Three.js são pontuais, não decorativos-em-excesso** — `DESIGN.md` rejeita explicitamente "AI-slop" (gradientes genéricos, hero cards flutuantes clichê). O elemento 3D é UM objeto abstrato discreto no header da Analytics (ex: wireframe/particle mesh reagindo a scroll), não uma cena 3D full-screen; GSAP anima entrada dos cards (stagger/scroll-trigger), não decora cada pixel.
- Design DNA de referência (dados brutos extraídos do Allure) salvo em `docs/plans/design-dna-analytics-tab.json` — usar como referência de densidade/estrutura de grid, **não como fonte de cor** (cores vêm de `DESIGN.md`).
- Componentes em `PascalCase.tsx`, sem `any` explícito, testes em `WEB/tests/` com Vitest.

---

### Task 0: Layout full-bleed + stack de efeitos (GSAP / Three.js-R3F / Motion)

**Files:**
- Modify: `WEB/components/Dashboard.tsx` (linha ~762, condicional de container)
- Install: `three`, `@react-three/fiber` (Three.js + R3F — únicas libs novas deste plano; `gsap`, `@gsap/react`, `motion` já são dependências)

**Interfaces:**
- Produces: `topLevelView === 'analytics'` como terceiro valor válido de `topLevelView` (hoje só documentado `'admin'` vs default), reconhecido pela mesma condicional que já trata `'admin'`

- [ ] **Passo 1: Confirmar versão do React 19 é compatível com R3F antes de instalar**

Run: `cd WEB && npm info @react-three/fiber peerDependencies`
Expected: `react: ">=18.0"` ou similar (R3F v9+ suporta React 19)

- [ ] **Passo 2: Instalar Three.js + R3F**

```bash
cd WEB && npm install three @react-three/fiber
npm install -D @types/three
```

- [ ] **Passo 3: Adicionar `topLevelView === 'analytics'` na condicional de full-bleed**

Localizar em `WEB/components/Dashboard.tsx` linha ~762:
```tsx
// Antes
className={`h-[100dvh] w-full flex flex-col bg-volt-dark overflow-hidden ${(currentView === 'admin' || topLevelView === 'admin') ? 'max-w-screen-2xl mx-auto' : 'md:max-w-md mx-auto shadow-2xl relative'}`}

// Depois
className={`h-[100dvh] w-full flex flex-col bg-volt-dark overflow-hidden ${(currentView === 'admin' || topLevelView === 'admin' || topLevelView === 'analytics') ? 'max-w-screen-2xl mx-auto' : 'md:max-w-md mx-auto shadow-2xl relative'}`}
```

**Nota:** confirmar que `topLevelView` é o state real usado (não `currentView`) lendo o contexto ao redor da linha 762 antes de editar — o implementador deve verificar qual dos dois states controla a view no momento em que a Task 4 for implementada, já que os dois aparecem na mesma condicional hoje.

- [ ] **Passo 4: Commit**

```bash
git add WEB/package.json WEB/package-lock.json WEB/components/Dashboard.tsx
git commit -m "feat(web): three.js/r3f + layout full-bleed para view analytics (segue padrao ja usado pelo admin)"
```

---

### Task 1: Utilitário de dither (Canvas2D, 3 métodos)

**Files:**
- Create: `WEB/utils/ditherEffects.ts`
- Test: `WEB/tests/ditherEffects.test.ts`

**Interfaces:**
- Produces: `applyFloydSteinberg(ctx: CanvasRenderingContext2D, w: number, h: number): void`, `applyBayer8x8(ctx: CanvasRenderingContext2D, w: number, h: number): void`, `applyAsciiHalftone(ctx: CanvasRenderingContext2D, w: number, h: number, opts?: { chars?: string; cellSize?: number }): void`

- [ ] **Passo 1: Implementar Floyd-Steinberg**

```typescript
// WEB/utils/ditherEffects.ts
export function applyFloydSteinberg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const oldVal = gray[idx];
      const newVal = oldVal < 128 ? 0 : 255;
      const err = oldVal - newVal;
      gray[idx] = newVal;
      if (x + 1 < w) gray[idx + 1] += err * 7 / 16;
      if (x - 1 >= 0 && y + 1 < h) gray[idx + w - 1] += err * 3 / 16;
      if (y + 1 < h) gray[idx + w] += err * 5 / 16;
      if (x + 1 < w && y + 1 < h) gray[idx + w + 1] += err * 1 / 16;
    }
  }
  for (let i = 0; i < w * h; i++) {
    const v = gray[i] < 128 ? 0 : 255;
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
}
```

- [ ] **Passo 2: Implementar Bayer 8x8 (ordered dithering)**

```typescript
const BAYER_8X8 = [
  [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
];

export function applyBayer8x8(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const threshold = (BAYER_8X8[y % 8][x % 8] / 64) * 255;
      const v = gray < threshold ? 0 : 255;
      data[idx] = v; data[idx + 1] = v; data[idx + 2] = v;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}
```

- [ ] **Passo 3: Implementar ASCII/Halftone**

```typescript
export function applyAsciiHalftone(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  opts: { chars?: string; cellSize?: number } = {}
): void {
  const chars = opts.chars ?? ' .:-=+*#%@';
  const cellSize = opts.cellSize ?? 8;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.font = `${cellSize}px monospace`;
  ctx.fillStyle = '#D4FF3D';
  for (let y = 0; y < h; y += cellSize) {
    for (let x = 0; x < w; x += cellSize) {
      const idx = (y * w + x) * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const charIdx = Math.floor((gray / 255) * (chars.length - 1));
      ctx.fillText(chars[charIdx], x, y + cellSize);
    }
  }
}
```

- [ ] **Passo 4: Escrever testes**

```typescript
// WEB/tests/ditherEffects.test.ts
import { describe, it, expect } from 'vitest';
import { applyFloydSteinberg, applyBayer8x8, applyAsciiHalftone } from '../utils/ditherEffects';

function makeCanvasWithGradient(w: number, h: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#000'); grad.addColorStop(1, '#fff');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  return ctx;
}

describe('ditherEffects', () => {
  it('applyFloydSteinberg produces only pure black/white pixels', () => {
    const ctx = makeCanvasWithGradient(32, 32);
    applyFloydSteinberg(ctx, 32, 32);
    const data = ctx.getImageData(0, 0, 32, 32).data;
    for (let i = 0; i < data.length; i += 4) {
      expect([0, 255]).toContain(data[i]);
    }
  });

  it('applyBayer8x8 produces only pure black/white pixels', () => {
    const ctx = makeCanvasWithGradient(32, 32);
    applyBayer8x8(ctx, 32, 32);
    const data = ctx.getImageData(0, 0, 32, 32).data;
    for (let i = 0; i < data.length; i += 4) {
      expect([0, 255]).toContain(data[i]);
    }
  });

  it('applyAsciiHalftone does not throw on a small canvas', () => {
    const ctx = makeCanvasWithGradient(32, 32);
    expect(() => applyAsciiHalftone(ctx, 32, 32)).not.toThrow();
  });
});
```

- [ ] **Passo 5: Rodar testes**

Run: `cd WEB && npm test -- ditherEffects`
Expected: 3 testes passando

- [ ] **Passo 6: Commit**

```bash
git add WEB/utils/ditherEffects.ts WEB/tests/ditherEffects.test.ts
git commit -m "feat(web): utilitario de dither Canvas2D (Floyd-Steinberg, Bayer 8x8, ASCII-Halftone)"
```

---

### Task 2: Componente de preview lado a lado dos 3 métodos de dither

**Files:**
- Create: `WEB/components/Analytics/DitherPreview.tsx`
- Test: `WEB/tests/DitherPreview.test.tsx`

**Interfaces:**
- Consumes: `applyFloydSteinberg`, `applyBayer8x8`, `applyAsciiHalftone` de `WEB/utils/ditherEffects.ts` (Task 1)
- Produces: `<DitherPreview imageSrc={string} theme={'yellow'|'midnight'} />` — componente standalone, usado só para decisão visual (não fica em produção depois de escolhido o método)

- [ ] **Passo 1: Implementar componente com 3 canvases lado a lado**

```tsx
// WEB/components/Analytics/DitherPreview.tsx
import React, { useEffect, useRef } from 'react';
import { applyFloydSteinberg, applyBayer8x8, applyAsciiHalftone } from '../../utils/ditherEffects';

interface Props {
  imageSrc: string;
  theme: 'yellow' | 'midnight';
}

const METHODS = [
  { key: 'floyd', label: 'Floyd-Steinberg', apply: applyFloydSteinberg },
  { key: 'bayer', label: 'Bayer 8x8', apply: applyBayer8x8 },
  { key: 'ascii', label: 'ASCII / Halftone', apply: (ctx: CanvasRenderingContext2D, w: number, h: number) => applyAsciiHalftone(ctx, w, h) },
] as const;

const DitherPreview: React.FC<Props> = ({ imageSrc, theme }) => {
  const refs = useRef<Array<HTMLCanvasElement | null>>([null, null, null]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      METHODS.forEach((method, i) => {
        const canvas = refs.current[i];
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        method.apply(ctx, img.width, img.height);
      });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const isMidnight = theme === 'midnight';

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl border-4 border-black ${isMidnight ? 'bg-volt-surface' : 'bg-white'}`}>
      {METHODS.map((method, i) => (
        <div key={method.key} className="flex flex-col gap-2">
          <p className={`text-xs font-black uppercase tracking-wider ${isMidnight ? 'text-white' : 'text-black'}`}>{method.label}</p>
          <canvas ref={(el) => { refs.current[i] = el; }} className="w-full rounded-xl border-2 border-black" />
        </div>
      ))}
    </div>
  );
};

export default DitherPreview;
```

- [ ] **Passo 2: Escrever teste de smoke**

```tsx
// WEB/tests/DitherPreview.test.tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DitherPreview from '../components/Analytics/DitherPreview';

describe('DitherPreview', () => {
  it('renders 3 canvas elements (one per method)', () => {
    const { container } = render(<DitherPreview imageSrc="/vite.svg" theme="midnight" />);
    expect(container.querySelectorAll('canvas').length).toBe(3);
  });
});
```

- [ ] **Passo 3: Rodar teste**

Run: `cd WEB && npm test -- DitherPreview`
Expected: 1 teste passando

- [ ] **Passo 4: Commit**

```bash
git add WEB/components/Analytics/DitherPreview.tsx WEB/tests/DitherPreview.test.tsx
git commit -m "feat(web): preview lado a lado dos 3 metodos de dither para escolha visual"
```

**Nota de uso:** Este componente é temporário/de decisão — monta-lo numa rota de debug (`/dev/dither-preview` ou dentro do Admin) para o usuário escolher visualmente qual método vai pra produção. Depois da escolha, Task 5 usa só o método escolhido; `DitherPreview.tsx` pode ficar no repo como ferramenta interna ou ser removido.

---

### Task 3: Primitivas de chart estilo Allure (dark, midnight theme)

**Files:**
- Create: `WEB/components/Analytics/ChartCard.tsx` (shell compartilhado)
- Create: `WEB/components/Analytics/DonutStatusCard.tsx`
- Create: `WEB/components/Analytics/CategoryBarCard.tsx`
- Create: `WEB/components/Analytics/ProgressBarRow.tsx`
- Test: `WEB/tests/ChartCard.test.tsx`

**Interfaces:**
- Consumes: `Transaction` type de `WEB/types.ts`; padrão de cores por categoria de `SpendingTrendsSection.tsx:34-41` (`categoryColors`)
- Produces:
  - `<ChartCard title={string} subtitle?={string} theme={'yellow'|'midnight'}>{children}</ChartCard>`
  - `<DonutStatusCard data={{label: string, value: number, color: string}[]} centerLabel={string} theme={...} />`
  - `<CategoryBarCard data={{category: string, value: number}[]} theme={...} />`
  - `<ProgressBarRow label={string} current={number} max={number} theme={...} />`

- [ ] **Passo 1: Implementar `ChartCard` (shell reusado por todos os cards)**

```tsx
// WEB/components/Analytics/ChartCard.tsx
import React from 'react';

interface Props {
  title: string;
  subtitle?: string;
  theme: 'yellow' | 'midnight';
  children: React.ReactNode;
}

const ChartCard: React.FC<Props> = ({ title, subtitle, theme, children }) => {
  const isMidnight = theme === 'midnight';
  return (
    <section className={`rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-3 ${
      isMidnight ? 'bg-volt-surface' : 'bg-white'
    }`}>
      <div>
        <h3 className={`font-black text-xs uppercase tracking-wider ${isMidnight ? 'text-white' : 'text-black'}`}>{title}</h3>
        {subtitle && <p className={`text-[10px] font-bold ${isMidnight ? 'text-zinc-400' : 'text-gray-700'}`}>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
};

export default ChartCard;
```

- [ ] **Passo 2: Implementar `DonutStatusCard`**

```tsx
// WEB/components/Analytics/DonutStatusCard.tsx
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';

interface DonutDatum { label: string; value: number; color: string; }
interface Props {
  data: DonutDatum[];
  centerLabel: string;
  theme: 'yellow' | 'midnight';
}

const DonutStatusCard: React.FC<Props> = ({ data, centerLabel, theme }) => {
  const isMidnight = theme === 'midnight';
  return (
    <ChartCard title="Status" theme={theme}>
      <div className="relative w-full h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="70%" outerRadius="95%" startAngle={90} endAngle={-270}>
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-black ${isMidnight ? 'text-white' : 'text-black'}`}>{centerLabel}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {data.map((d) => (
          <span key={d.label} className={`flex items-center gap-1 text-[10px] font-bold ${isMidnight ? 'text-zinc-300' : 'text-gray-700'}`}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
            {d.label}
          </span>
        ))}
      </div>
    </ChartCard>
  );
};

export default DonutStatusCard;
```

- [ ] **Passo 3: Implementar `CategoryBarCard`**

```tsx
// WEB/components/Analytics/CategoryBarCard.tsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import ChartCard from './ChartCard';

interface Props {
  data: { category: string; value: number; color: string }[];
  theme: 'yellow' | 'midnight';
}

const CategoryBarCard: React.FC<Props> = ({ data, theme }) => {
  const isMidnight = theme === 'midnight';
  return (
    <ChartCard title="Gastos por categoria" theme={theme}>
      <div className="w-full h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 10 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="category" tick={{ fill: isMidnight ? '#a1a1aa' : '#374151', fontSize: 10, fontWeight: 700 }} width={90} tickLine={false} axisLine={false} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default CategoryBarCard;
```

- [ ] **Passo 4: Implementar `ProgressBarRow`**

```tsx
// WEB/components/Analytics/ProgressBarRow.tsx
import React from 'react';

interface Props {
  label: string;
  current: number;
  max: number;
  theme: 'yellow' | 'midnight';
}

const ProgressBarRow: React.FC<Props> = ({ label, current, max, theme }) => {
  const isMidnight = theme === 'midnight';
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10px] font-bold">
        <span className={isMidnight ? 'text-zinc-300' : 'text-gray-700'}>{label}</span>
        <span className={isMidnight ? 'text-white' : 'text-black'}>{current} / {max}</span>
      </div>
      <div className={`h-3 rounded-full border-2 border-black overflow-hidden ${isMidnight ? 'bg-zinc-900' : 'bg-gray-200'}`}>
        <div className="h-full bg-[#A2FF00]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default ProgressBarRow;
```

- [ ] **Passo 5: Escrever teste de smoke para `ChartCard` + `ProgressBarRow`**

```tsx
// WEB/tests/ChartCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ChartCard from '../components/Analytics/ChartCard';
import ProgressBarRow from '../components/Analytics/ProgressBarRow';

describe('ChartCard', () => {
  it('renders title and subtitle', () => {
    render(<ChartCard title="Teste" subtitle="Sub" theme="midnight"><div>conteudo</div></ChartCard>);
    expect(screen.getByText('Teste')).toBeInTheDocument();
    expect(screen.getByText('Sub')).toBeInTheDocument();
  });
});

describe('ProgressBarRow', () => {
  it('caps percentage at 100 when current exceeds max', () => {
    const { container } = render(<ProgressBarRow label="Meta" current={150} max={100} theme="midnight" />);
    const bar = container.querySelector('div[style]') as HTMLDivElement;
    expect(bar.style.width).toBe('100%');
  });
});
```

- [ ] **Passo 6: Rodar testes**

Run: `cd WEB && npm test -- ChartCard`
Expected: 2 testes passando

- [ ] **Passo 7: Commit**

```bash
git add WEB/components/Analytics/ChartCard.tsx WEB/components/Analytics/DonutStatusCard.tsx WEB/components/Analytics/CategoryBarCard.tsx WEB/components/Analytics/ProgressBarRow.tsx WEB/tests/ChartCard.test.tsx
git commit -m "feat(web): primitivas de chart estilo Allure (donut, bar, progress) sobre midnight theme"
```

---

### Task 4: `AnalyticsView.tsx` — monta os cards com dados reais

**Files:**
- Create: `WEB/components/Analytics/AnalyticsView.tsx`
- Modify: `WEB/components/Dashboard.tsx` (adicionar view + item de navegação)
- Test: `WEB/tests/AnalyticsView.test.tsx`

**Interfaces:**
- Consumes: `DonutStatusCard`, `CategoryBarCard`, `ProgressBarRow` (Task 3); `getUserStatement` de `WEB/services/api.ts`; `Transaction` de `WEB/types.ts`; categorias `refeicao/mobilidade/cultura/saude/outros` (`SpendingTrendsSection.tsx`)
- Produces: `<AnalyticsView transactions={Transaction[]} theme={'yellow'|'midnight'} />`, exportado para `Dashboard.tsx` consumir

- [ ] **Passo 1: Implementar `AnalyticsView`**

```tsx
// WEB/components/Analytics/AnalyticsView.tsx
import React, { useMemo } from 'react';
import DonutStatusCard from './DonutStatusCard';
import CategoryBarCard from './CategoryBarCard';
import ProgressBarRow from './ProgressBarRow';
import ChartCard from './ChartCard';
import type { Transaction } from '../../types';

interface Props {
  transactions: Transaction[];
  theme: 'yellow' | 'midnight';
}

const CATEGORY_COLORS: Record<string, string> = {
  refeicao: '#FF5C8D', mobilidade: '#00E5FF', cultura: '#FFAA00', saude: '#B026FF', outros: '#22c55e',
};
const CATEGORY_LABELS: Record<string, string> = {
  refeicao: 'Refeicao', mobilidade: 'Mobilidade', cultura: 'Cultura', saude: 'Saude', outros: 'Outros',
};

const AnalyticsView: React.FC<Props> = ({ transactions, theme }) => {
  const { entradas, saidas } = useMemo(() => {
    let e = 0, s = 0;
    transactions.forEach((t) => { if (t.amount >= 0) e += t.amount; else s += Math.abs(t.amount); });
    return { entradas: e, saidas: s };
  }, [transactions]);

  const categoryData = useMemo(() => {
    const sums: Record<string, number> = { refeicao: 0, mobilidade: 0, cultura: 0, saude: 0, outros: 0 };
    transactions.forEach((t) => {
      if (t.amount < 0) {
        const cat = (t as any).category || 'outros';
        if (cat in sums) sums[cat] += Math.abs(t.amount); else sums.outros += Math.abs(t.amount);
      }
    });
    return Object.entries(sums)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({ category: CATEGORY_LABELS[key], value: parseFloat(value.toFixed(2)), color: CATEGORY_COLORS[key] }));
  }, [transactions]);

  const donutData = [
    { label: 'Entradas', value: entradas, color: '#22c55e' },
    { label: 'Saidas', value: saidas, color: '#EF4444' },
  ];
  const resultado = entradas - saidas;
  const centerLabel = `R$ ${resultado.toFixed(0)}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      <DonutStatusCard data={donutData} centerLabel={centerLabel} theme={theme} />
      <CategoryBarCard data={categoryData} theme={theme} />
      <ChartCard title="Meta de gastos" theme={theme}>
        <div className="flex flex-col gap-3">
          <ProgressBarRow label="Gasto do mes" current={saidas} max={2000} theme={theme} />
        </div>
      </ChartCard>
    </div>
  );
};

export default AnalyticsView;
```

- [ ] **Passo 2: Integrar em `Dashboard.tsx`**

Ler `WEB/components/Dashboard.tsx` para localizar o bloco de views internas (padrão visto: `topLevelView === 'admin'`, blocos condicionais por view state) e adicionar:
1. Import: `import AnalyticsView from './Analytics/AnalyticsView';`
2. Novo case/condicional de view (`topLevelView === 'analytics'`) renderizando `<AnalyticsView transactions={transactions} theme={theme} />`
3. Novo item de navegação (botão/ícone) que seta a view para `'analytics'` — não remover nenhum item existente do `BottomNavBar`, adicionar como item extra ou dentro de "Acesso Rapido" (ver `HomeView.tsx`, seção `ACESSO RAPIDO` com PIX/Meus Cartoes/Faturas/Pagar/Extrato)

**Nota:** este passo depende da leitura do estado interno real de `Dashboard.tsx` (996 linhas, não totalmente lido nesta sessão) — o implementador deve localizar o padrão exato de state/switch de view antes de editar, não assumir a estrutura acima cegamente.

- [ ] **Passo 3: Escrever teste de smoke**

```tsx
// WEB/tests/AnalyticsView.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AnalyticsView from '../components/Analytics/AnalyticsView';
import type { Transaction } from '../types';

const mockTx: Transaction[] = [
  { id: '1', date: '2026-09-01', amount: 100, description: 'Salario' } as Transaction,
  { id: '2', date: '2026-09-02', amount: -50, description: 'Mercado', category: 'refeicao' } as any,
];

describe('AnalyticsView', () => {
  it('renders donut, category bar and progress cards', () => {
    render(<AnalyticsView transactions={mockTx} theme="midnight" />);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Gastos por categoria')).toBeInTheDocument();
    expect(screen.getByText('Meta de gastos')).toBeInTheDocument();
  });
});
```

- [ ] **Passo 4: Rodar testes**

Run: `cd WEB && npm test -- AnalyticsView`
Expected: 1 teste passando

- [ ] **Passo 5: Commit**

```bash
git add WEB/components/Analytics/AnalyticsView.tsx WEB/components/Dashboard.tsx WEB/tests/AnalyticsView.test.tsx
git commit -m "feat(web): AnalyticsView monta cards de status/categoria/meta com dados reais de transacoes"
```

---

### Task 5: Aplicar dither escolhido como decoração pontual

**Decisão do usuário (2026-09-05, via Artifact de comparação):** ASCII/Halftone. Justificativa observada: mantém uma cor de destaque em vez de virar preto/branco puro, então não briga com o "One Wire Rule" — o padrão de caracteres em `volt-green` (midnight) / preto (yellow) lê como uma textura, não como ruído aleatório.

**Files:**
- Modify: `WEB/components/Analytics/AnalyticsView.tsx` (header, ao lado/atrás do `Hero3D`)

**Interfaces:**
- Consumes: `applyAsciiHalftone` de `WEB/utils/ditherEffects.ts`

**Ponto de aplicação escolhido:** textura decorativa pequena (não dados reais) atrás/ao lado do `Hero3D` no header — um canvas discreto (~120x40px) com um gradiente sintético simples (mesma técnica do `DitherPreview`) processado por `applyAsciiHalftone`, cor de destaque seguindo o tema (`#00ff9d` midnight / preto yellow). Puramente ornamental, sem representar nenhum número real — não pode substituir nenhum dos charts existentes.

**Aguardando:** Task 10 (agente Motion, em background) termina de editar `AnalyticsView.tsx` antes desta task tocar o mesmo arquivo, pra não repetir a colisão de edição concorrente que já aconteceu com o agente do GSAP nesta sessão.

- [ ] **Passo 1:** Criar um pequeno componente `WEB/components/Analytics/AsciiHeaderAccent.tsx` (canvas ~120x40px, desenha gradiente sintético + roda `applyAsciiHalftone` no mount, `aria-hidden`, `pointerEvents: none`, respeita `prefers-reduced-motion` só no sentido de não animar nada — é um render estático único, sem loop).
- [ ] **Passo 2:** Montar `<AsciiHeaderAccent theme={theme} />` no header de `AnalyticsView.tsx`, ao lado do `Hero3D` (não sobrepondo).
- [ ] **Passo 3:** Rodar `cd WEB && npm test -- --run` (regressão) e `npx tsc --noEmit` (zero erro novo).
- [ ] **Passo 4:** Verificar visualmente nos dois temas (yellow/midnight) no Browser pane.
- [ ] **Passo 5: Commit**

```bash
git add WEB/components/Analytics/AsciiHeaderAccent.tsx WEB/components/Analytics/AnalyticsView.tsx
git commit -m "feat(web): aplica dither ASCII/Halftone como decoracao pontual no header da Analytics"
```

---

### Task 6: Verificação visual e regressão

- [ ] **Passo 1: Rodar suíte completa**

Run: `cd WEB && npm test`
Expected: todos os testes verdes, incluindo os novos de Tasks 1-4

- [ ] **Passo 2: Verificação visual no Browser pane**

1. `preview_start` com o dev server WEB (`npm run dev`, porta 3000)
2. Login com CPF de teste
3. Navegar até a nova aba Analytics
4. Screenshot em tema `yellow` e `midnight`
5. `resize_window` para mobile (375px) e conferir reflow para 1 coluna
6. Conferir console sem erros (`read_console_messages`)

- [ ] **Passo 3: Commit final se houver ajustes**

```bash
git add -A
git commit -m "fix(web): ajustes visuais pos-verificacao da aba Analytics"
```

---

### Task 8: Sidebar da Analytics passa para a lateral direita

**Contexto:** pedido original do usuário (mensagem "o legal desse novo design é que o menu é na lateral direita...") nunca foi atendido — a implementação atual (`AnalyticsView.tsx`) renderiza o `<aside>` **antes** do conteúdo no `flex`, o que o coloca na **esquerda**. Isso é bug de implementação, não decisão de design.

**Files:**
- Modify: `WEB/components/Analytics/AnalyticsView.tsx`

**O que muda:**
1. Reordenar o JSX: o bloco `<aside>` (linhas ~188-233 atuais) passa a vir **depois** do `<div className="flex-1 ...">` (não antes), dentro do mesmo `<motion.div className="flex ...">`.
2. `border-r` do aside vira `border-l` (a borda de separação muda de lado).
3. Ícones de colapsar trocam de `PanelLeftClose`/`PanelLeftOpen` para `PanelRightClose`/`PanelRightOpen` (import de `lucide-react`) — semântica visual correta pra um menu que abre/fecha à direita.
4. Nenhuma mudança de lógica (state `sidebarCollapsed`, `activeSection`, larguras `w-56`/`w-16`) — só reposicionamento.

**ASCII (expandida, sidebar à direita):**
```
┌─────────────────────────────────────────────┬──────────────┐
│  Analytics                          [Hero3D] │ Voltar    [x]│
│                                               │──────────────│
│  ┌──────────────────┬──────────────────┐     │ ▣ Visao Geral│
│  │   Status (donut)  │   Meta de gastos │     │ ◔ Categorias │
│  │      [maximize]   │      [maximize]  │     │ ↗ Tendencia  │
│  └──────────────────┴──────────────────┘     │──────────────│
│                                               │  [collapse >]│
└─────────────────────────────────────────────┴──────────────┘
```

**ASCII (colapsada, só ícones):**
```
┌────────────────────────────────────────────────────────┬───┐
│  Analytics                                    [Hero3D]  │[<]│
│  (grid ocupa mais largura)                               │▣  │
│                                                            │◔  │
│                                                            │↗  │
└────────────────────────────────────────────────────────┴───┘
```

- [ ] **Passo 1:** Reordenar `<aside>` para depois do `<div className="flex-1 flex flex-col overflow-y-auto">` no JSX de `AnalyticsView.tsx`.
- [ ] **Passo 2:** Trocar `border-r` → `border-l` na classe do `<aside>`.
- [ ] **Passo 3:** Trocar imports/usos de `PanelLeftClose`/`PanelLeftOpen` → `PanelRightClose`/`PanelRightOpen`.
- [ ] **Passo 4:** Rodar `cd WEB && npm test` (regressão) e verificar visualmente no Browser pane (sidebar deve aparecer à direita, expandida e colapsada).
- [ ] **Passo 5:** Commit:
```bash
git add WEB/components/Analytics/AnalyticsView.tsx
git commit -m "fix(web): sidebar da Analytics reposicionada para lateral direita (pedido original do usuario)"
```

---

### Task 9: Densidade de grid — principais em 2 colunas, menores em 3

**Contexto:** hoje só a seção "Geral" usa grid de 2 colunas (Status + Meta). As seções "Categorias" e "Tendencia" mostram 1 card sozinho em `grid-cols-1`, ocupando a tela inteira sem densidade — não bate com a referência Allure/FintechX (cards menores agrupados em fileira de 3).

**Duas opções de estrutura — preciso da sua escolha antes de codar:**

**Opção A — mescla Categorias+Tendencia numa seção "Detalhes" (3 cards juntos)**
- Sidebar passa de 3 itens pra 2: `Visao Geral` (2 cols) e `Detalhes` (3 cols: CategoryBarCard + TrendLineCard + novo `PeriodSummaryCard`)
```
┌─────────────────────────────────────────────┬──────────────┐
│  Analytics                          [Hero3D] │ Voltar    [x]│
│  ┌────────────┬────────────┬────────────┐   │──────────────│
│  │ Categoria  │ Tendencia  │  Resumo    │   │ ▣ Visao Geral│
│  │ (bar)      │ (line)     │  periodo   │   │ ◔ Detalhes ◀ │
│  │ [maximize] │ [maximize] │ [maximize] │   │──────────────│
│  └────────────┴────────────┴────────────┘   │              │
└─────────────────────────────────────────────┴──────────────┘
```

**Opção B — mantém 3 seções, cada uma ganha 2 mini-cards de preenchimento pra fechar a fileira de 3**
```
┌─────────────────────────────────────────────┬──────────────┐
│  Analytics > Categorias              [Hero3D]│ Voltar    [x]│
│  ┌────────────┬────────────┬────────────┐   │──────────────│
│  │ Categoria  │  Maior     │  Resumo    │   │ ▣ Visao Geral│
│  │ (bar)      │  categoria │  periodo   │   │ ◔ Categorias◀│
│  │ [maximize] │  (mini)    │  (mini)    │   │ ↗ Tendencia  │
│  └────────────┴────────────┴────────────┘   │──────────────│
└─────────────────────────────────────────────┴──────────────┘
```
Mesma estrutura se repete em "Tendencia" trocando o card principal.

Opção A é mais simples (1 componente novo, 2 nav items) — Opção B mantém a navegação atual mas precisa de 2 componentes novos por seção (4 no total) e dados novos ("maior categoria", "resumo periodo" por seção).

**Files (Opção A, se escolhida):**
- Create: `WEB/components/Analytics/PeriodSummaryCard.tsx` (mini stat: total de lançamentos + ticket médio do período)
- Modify: `WEB/components/Analytics/AnalyticsView.tsx` (`SECTIONS` array vira 2 itens; `renderSection()` funde os cases `'categorias'`/`'tendencia'` num só `'detalhes'` com `grid-cols-3`)

- [ ] **Passo 1:** Implementar `PeriodSummaryCard` (recebe `{ totalTransacoes: number; ticketMedio: number }`, layout `ChartCard` com 2 números grandes empilhados).
- [ ] **Passo 2:** Atualizar `type Section` de `'geral'|'categorias'|'tendencia'` para `'geral'|'detalhes'`; atualizar `SECTIONS` (label "Detalhes", ícone `LayoutList` ou similar).
- [ ] **Passo 3:** `renderSection()`: case `'detalhes'` retorna `grid-cols-1 md:grid-cols-3` com `CategoryBarCard`, `TrendLineCard`, `PeriodSummaryCard`.
- [ ] **Passo 4:** Atualizar `renderExpandedContent()` (remove cases `'categorias'`/`'tendencia'` separados se a expansão for por card individual, mantém 1 `ExpandableCard` por card).
- [ ] **Passo 5:** Rodar `npm test` + verificação visual no Browser pane.
- [ ] **Passo 6:** Commit:
```bash
git add WEB/components/Analytics/
git commit -m "feat(web): funde categorias+tendencia em secao Detalhes com grid de 3 colunas (densidade estilo Allure)"
```

---

### Task 10: Drag-to-reorder dos cards (feature real do Allure — confirmada em código)

**Contexto:** o Allure Report de verdade (`A:\Workspace\AUTOMACAO-Playwright-cms-for-qas-api\output\allure-report`) tem widgets arrastáveis na Overview — confirmado inspecionando `assets/index-BraRl9ss.js`: `onWidgetDragStart`, `widget_ghost`, `.draggable-icon`, `.widget__handle`, ordem persistida (`saveWidgetOrder`). Não é suposição visual, é comportamento real do produto de referência.

**Decisão técnica:** implementar com `Reorder.Group`/`Reorder.Item` de `motion/react` — **zero libs novas** (já é dependência, já importado em `AnalyticsView.tsx`). Alternativa seria `@dnd-kit`, mas violaria a constraint de "não trocar/adicionar lib sem necessidade" já que `motion` cobre o caso.

**Files:**
- Modify: `WEB/components/Analytics/ChartCard.tsx` (adicionar handle de drag — ícone `GripVertical` de `lucide-react` no header, ao lado do botão `Maximize2`)
- Modify: `WEB/components/Analytics/AnalyticsView.tsx` (envolver o grid de cada seção em `Reorder.Group`, state de ordem por seção)

**O que muda:**
1. `AnalyticsView` ganha state `cardOrder: Record<Section, string[]>` (ids dos cards por seção), inicializado com a ordem atual.
2. `renderSection()` troca `<div className="grid ...">` por `<Reorder.Group as="div" axis="both" values={cardOrder[activeSection]} onReorder={...} className="grid ...">`, cada card vira `<Reorder.Item as="div" value={cardId} key={cardId}>`.
3. Ordem persiste em `localStorage` (chave `analytics-card-order-${activeSection}`), lida no mount — mesmo padrão de persistência local que o Allure usa.
4. `ChartCard` ganha prop opcional `dragHandle?: boolean` que renderiza `<GripVertical size={14} className="cursor-grab" />` no header quando true.

**ASCII (handle de drag no header do card):**
```
┌──────────────────────────────┐
│ ⠿  STATUS              [⤢]  │  <- ⠿ = GripVertical (arrasta), ⤢ = Maximize2 (expande)
│ ┌───────────────────────────┐│
│ │       (donut chart)       ││
```

- [ ] **Passo 1:** Adicionar `dragHandle?: boolean` em `ChartCard.tsx`, renderizar `GripVertical` no header quando `true`.
- [ ] **Passo 2:** Em `AnalyticsView.tsx`, adicionar state `cardOrder` por seção + `useEffect` de leitura/gravação em `localStorage`.
- [ ] **Passo 3:** Trocar `<div className="grid ...">` por `<Reorder.Group>` e cada `<Card />` por `<Reorder.Item value={id}><Card /></Reorder.Item>` dentro de `renderSection()`.
- [ ] **Passo 4:** Testar arrastar no Browser pane — reordenar 2 cards na seção Geral, recarregar página, confirmar que a ordem persistiu (leu do `localStorage`).
- [ ] **Passo 5:** Rodar `npm test` (regressão) + commit:
```bash
git add WEB/components/Analytics/
git commit -m "feat(web): drag-to-reorder dos cards da Analytics via motion Reorder (paridade com Allure real)"
```

**Nota:** esta task depende da decisão da Task 9 (Opção A ou B) — o `Reorder.Group` reordena os cards *dentro* de uma seção; quanto mais cards numa seção (Opção A: 3 juntos em "Detalhes"), mais natural fica o caso de uso de arrastar. Com Opção B (cards menores espalhados em 3 seções), o reorder fica mais raso (nunca mais que 3 itens por seção do mesmo jeito).

---

### Fase futura (após Analytics fechada): expandir padrão full-bleed para o app inteiro

Decisão do usuário (2026-09-05, em sessão ao vivo testando a Analytics): o layout full-bleed + sidebar validado aqui na Analytics deve virar o padrão do projeto WEB inteiro, não só desta view. Cada tela (Extrato, Faturas, Limites, Shop, Perfil, Admin) vai precisar de um ou mais "modais correlacionados" ao lado do conteúdo principal — exemplo dado pelo usuário: ao abrir Extrato, um modal de "Gastos" aparece ao lado, correlacionado aos dados do extrato. Não iniciar esta fase até a Analytics estar fechada e aprovada — o usuário explicitamente adiou ("depois que finalizar nos acertamos os modais de cada função").

**ASCII conceitual (referência, não implementar ainda):**

Home:
```
┌───────────────────────────────────────┬──────────────┐
│ Ola, Fulano                  [Hero3D]  │ Voltar    [x]│
│ ┌────────┬────────┬────────┬────────┐ │──────────────│
│ │ Saldo  │ Gasto  │ Prox.  │ Limite │ │ ▣ Home       │
│ │        │ mes    │ fatura │ disp.  │ │ ▤ Extrato    │
│ └────────┴────────┴────────┴────────┘ │ ▥ Faturas    │
│ ┌──────────────────┬──────────────────┐│ ▦ Limites    │
│ │  Status (donut)   │  Trend 6 meses  ││ ◉ Perfil     │
│ │  [maximize]       │  [maximize]     ││──────────────│
│ └──────────────────┴──────────────────┘│  [collapse >]│
└───────────────────────────────────────┴──────────────┘
```

Extrato (clicado no sidebar — sub-tela com modal correlacionado "Gastos"):
```
┌───────────────────────────┬─────────────┬──────────────┐
│  Extrato (lista rolavel)  │ Gastos      │ Voltar    [x]│
│  - Pix enviado   -R$50    │ (modal      │──────────────│
│  - Deposito     +R$500    │  correlato) │ ▣ Home       │
│  - Compra shop   -R$120   │ donut por   │ ▤ Extrato ◀  │
│  ...  [rola pagina]       │ categoria   │ ▥ Faturas    │
│                           │ [maximize]  │ ▦ Limites    │
│                           │             │ ◉ Perfil     │
└───────────────────────────┴─────────────┴──────────────┘
```

Fatura:
```
┌───────────────────────────────────────┬──────────────┐
│ Fatura                       [Hero3D]  │ Voltar    [x]│
│ ┌────────┬────────┬────────┬────────┐ │──────────────│
│ │ Aberta │ Fechada│ Vencto │ Minimo │ │ ▣ Home       │
│ └────────┴────────┴────────┴────────┘ │ ▤ Extrato    │
│ ┌──────────────────┬──────────────────┐│ ▥ Faturas ◀  │
│ │ Gasto p/categoria │ Lancamentos      ││ ▦ Limites    │
│ │  (bar) [maximize] │ (lista rolavel)  ││ ◉ Perfil     │
│ └──────────────────┴──────────────────┘│──────────────│
└───────────────────────────────────────┴──────────────┘
```

Limites:
```
┌───────────────────────────────────────┬──────────────┐
│ Limites                      [Hero3D]  │ Voltar    [x]│
│ ┌────────┬────────┬────────┬────────┐ │──────────────│
│ │ Total  │ Usado  │ Disp.  │ % uso  │ │ ▣ Home       │
│ └────────┴────────┴────────┴────────┘ │ ▤ Extrato    │
│ ┌────────────┬────────────┬──────────┐│ ▥ Faturas    │
│ │ Credito    │ Pix diario │ Saque    ││ ▦ Limites ◀  │
│ │ (progress) │ (progress) │(progress)││ ◉ Perfil     │
│ │ [maximize] │ [maximize] │[maximize]││──────────────│
│ └────────────┴────────────┴──────────┘│              │
└───────────────────────────────────────┴──────────────┘
```

Perfil (foge do padrão chart-heavy — vira cards de configuracao):
```
┌───────────────────────────────────────┬──────────────┐
│ Perfil                                 │ Voltar    [x]│
│ ┌──────────────────┬──────────────────┐│──────────────│
│ │ Dados pessoais    │ Seguranca        ││ ▣ Home       │
│ │ nome, cpf, email  │ senha, 2FA       ││ ▤ Extrato    │
│ │ [editar]          │ [editar]         ││ ▥ Faturas    │
│ └──────────────────┴──────────────────┘│ ▦ Limites    │
│ ┌──────────────────────────────────────┐│ ◉ Perfil  ◀  │
│ │ Notificacoes (lista de toggles)      ││──────────────│
│ └──────────────────────────────────────┘│              │
└───────────────────────────────────────┴──────────────┘
```

### Task 7 (fase 2, após validação WEB): Portar para DESKTOP

**Não iniciar antes da Task 6 estar validada e aprovada pelo usuário.**

- [ ] Mapear estrutura equivalente em `DESKTOP/` (Electron/CEF) — identificar se é o mesmo bundle React do WEB ou uma base separada, antes de assumir reuso direto dos componentes `Analytics/*`
- [ ] Usar skill `desktop-principles` para ajustar hover states, atalhos de teclado e comportamento de janela que não existem no mobile-first atual
- [ ] Repetir Task 6 (verificação visual) dentro do `DESKTOP/run.ps1` — nunca rodar o `.exe` direto (ver memória de sessões anteriores sobre CEF)

---

## Resumo de skills usadas neste plano

| Skill/Agente | Papel |
|---|---|
| `WEB:design-dna` | Extraiu os tokens visuais do Allure Report (dark surface, donut/trend/bar charts, densidade de grid) — ver `docs/plans/design-dna-analytics-tab.json` |
| `canvas-generative` | Referência técnica para os algoritmos de dither (Canvas2D puro, sem lib nova) |
| `desktop-principles` | Reservada para a Task 7 (port DESKTOP) — hover/multi-window/atalhos que não existem no mobile |
| `design-audit` | Rodar como checklist final antes de considerar a Task 6 encerrada |
| Agente `ecc:react-reviewer` | Revisão de código React ao final de cada task (hooks, performance de render, acessibilidade) |
