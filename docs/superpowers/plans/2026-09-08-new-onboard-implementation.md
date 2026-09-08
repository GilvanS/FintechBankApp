# New Onboard (WEB Allure 360°) & Admin Theme Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the new 50%/50% WEB Allure native fullscreen onboarding wizard ("New Onboard") with 3D card preview + safety masking, alongside an Admin preference control for system default WEB theme (Dark/Midnight vs Light/Yellow).

**Architecture:** Build React components `NewOnboardView`, `OnboardFormContainer`, and `CardPreview3D` under `WEB/components/Onboard/`. Extend `AppStateContext` to support Admin default theme initialization. Update routing in `WEB/App.tsx`.

**Tech Stack:** React 19, TypeScript, Lucide Icons, GSAP / Motion, Vitest, Tailwind CSS / Allure CSS tokens.

## Global Constraints
- Clean default status for all public onboardings (Adimplente / 100% limpo — no overdue selector on public onboarding).
- Security masking for card preview: card number `•••• •••• •••• 8832` (only last 4 visible), CVV `•••` masked.
- Layout: 50% left (scrollable form) / 50% right (interactive 3D card + cost summary) WEB Allure fullscreen style.

---

### Task 1: Admin Default Theme Selection in AppStateContext & Admin Panel

**Files:**
- Create: `WEB/tests/AppStateContextTheme.test.tsx`
- Modify: `WEB/contexts/AppStateContext.tsx`
- Modify: `WEB/components/Admin/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `localStorage.getItem('volt_admin_default_theme')`, `localStorage.getItem('volt_theme')`
- Produces: `adminDefaultTheme: 'midnight' | 'yellow'`, `setAdminDefaultTheme: (theme: 'midnight' | 'yellow') => void`

- [ ] **Step 1: Write failing test for Admin Theme Selection**

```tsx
// WEB/tests/AppStateContextTheme.test.tsx
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { AppStateProvider, AppStateContext } from '../contexts/AppStateContext';

describe('AppStateContext Admin Default Theme', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses admin default theme when user has no explicit preference', () => {
    localStorage.setItem('volt_admin_default_theme', 'midnight');
    
    let currentTheme = '';
    render(
      <AppStateProvider>
        <AppStateContext.Consumer>
          {({ theme }) => {
            currentTheme = theme;
            return <div>{theme}</div>;
          }}
        </AppStateContext.Consumer>
      </AppStateProvider>
    );

    expect(currentTheme).toBe('midnight');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run WEB/tests/AppStateContextTheme.test.tsx`
Expected: FAIL (theme defaults to 'yellow' ignoring volt_admin_default_theme)

- [ ] **Step 3: Implement Admin Theme support in AppStateContext & AdminDashboard**

Update `WEB/contexts/AppStateContext.tsx`:
```tsx
const [theme, setThemeState] = useState<'midnight' | 'yellow'>(() => {
    const userPref = localStorage.getItem('volt_theme') as 'midnight' | 'yellow' | null;
    if (userPref) return userPref;
    const adminDefault = localStorage.getItem('volt_admin_default_theme') as 'midnight' | 'yellow' | null;
    return adminDefault || 'yellow';
});

const setAdminDefaultTheme = (newTheme: 'midnight' | 'yellow') => {
    localStorage.setItem('volt_admin_default_theme', newTheme);
    if (!localStorage.getItem('volt_theme')) {
        setThemeState(newTheme);
    }
};
```

Update `WEB/components/Admin/AdminDashboard.tsx` to include theme configuration toggle card.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run WEB/tests/AppStateContextTheme.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add WEB/contexts/AppStateContext.tsx WEB/components/Admin/AdminDashboard.tsx WEB/tests/AppStateContextTheme.test.tsx
git commit -m "feat(admin): adiciona suporte ao tema padrao do sistema configuravel pelo admin"
```

---

### Task 2: 3D Interactive Card Preview Component (`CardPreview3D`)

**Files:**
- Create: `WEB/components/Onboard/CardPreview3D.tsx`
- Create: `WEB/tests/CardPreview3D.test.tsx`

**Interfaces:**
- Consumes: `{ brand: 'VISA'|'MASTERCARD'|'ELO'|'AMEX', tier: 'GOLD'|'PLATINUM'|'BLACK', printedName: string, billingDueDay: number, plan: 'FREE'|'PRO'|'VIP_BLACK' }`
- Produces: React Component rendering 3D interactive card with masked numbers (`•••• •••• •••• 8832`), masked CVV (`•••`), and cost breakdown summary.

- [ ] **Step 1: Write failing test for CardPreview3D**

```tsx
// WEB/tests/CardPreview3D.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import CardPreview3D from '../components/Onboard/CardPreview3D';

describe('CardPreview3D Component', () => {
  it('renders card holder name and masks card number and CVV for security', () => {
    render(
      <CardPreview3D
        brand="VISA"
        tier="BLACK"
        printedName="SILVA M SILVA"
        billingDueDay={10}
        plan="PRO"
      />
    );

    expect(screen.getByText('SILVA M SILVA')).toBeInTheDocument();
    expect(screen.getByText(/•••• •••• ••••/i)).toBeInTheDocument();
    expect(screen.getByText(/•••/i)).toBeInTheDocument();
    expect(screen.getByText(/VENC DIA 10/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run WEB/tests/CardPreview3D.test.tsx`
Expected: FAIL (Component does not exist)

- [ ] **Step 3: Implement CardPreview3D Component**

Create `WEB/components/Onboard/CardPreview3D.tsx` with Lucide icons, Motion hover/tilt physics, Tier gradient themes (Gold, Platinum satin, Black carbon), and security-masked card number/CVV.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run WEB/tests/CardPreview3D.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add WEB/components/Onboard/CardPreview3D.tsx WEB/tests/CardPreview3D.test.tsx
git commit -m "feat(onboard): cria componente CardPreview3D com mascaramento de seguranca"
```

---

### Task 3: Form Container Component (`OnboardFormContainer`)

**Files:**
- Create: `WEB/components/Onboard/OnboardFormContainer.tsx`
- Create: `WEB/tests/OnboardFormContainer.test.tsx`

**Interfaces:**
- Consumes: `onFormDataChange: (data: NewOnboardFormData) => void`, `onSubmit: () => void`
- Produces: Scrollable multi-step form section (Personal Info, Tutor conditional for < 18, Global Address, Card Brand/Tier/Due Day selection, Account Plan).

- [ ] **Step 1: Write failing test for OnboardFormContainer**

```tsx
// WEB/tests/OnboardFormContainer.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import OnboardFormContainer from '../components/Onboard/OnboardFormContainer';

describe('OnboardFormContainer Component', () => {
  it('shows Tutor Legal fields when age is under 18', () => {
    const handleChange = vi.fn();
    render(<OnboardFormContainer onFormDataChange={handleChange} onSubmit={vi.fn()} />);

    const birthInput = screen.getByLabelText(/Data de Nascimento/i);
    fireEvent.change(birthInput, { target: { value: '2010-05-15' } });

    expect(screen.getByText(/Dados do Tutor Legal/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run WEB/tests/OnboardFormContainer.test.tsx`
Expected: FAIL (Component does not exist)

- [ ] **Step 3: Implement OnboardFormContainer Component**

Create `WEB/components/Onboard/OnboardFormContainer.tsx` with all inputs, validation logic, mask formatting, and step pills.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run WEB/tests/OnboardFormContainer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add WEB/components/Onboard/OnboardFormContainer.tsx WEB/tests/OnboardFormContainer.test.tsx
git commit -m "feat(onboard): cria componente OnboardFormContainer com campos 360 e tutor condicional"
```

---

### Task 4: Main View & Route Integration (`NewOnboardView` & `App.tsx`)

**Files:**
- Create: `WEB/components/Onboard/NewOnboardView.tsx`
- Modify: `WEB/App.tsx`
- Modify: `WEB/components/PreLoginDashboard.tsx`
- Create: `WEB/tests/NewOnboardView.test.tsx`

**Interfaces:**
- Consumes: `onNavigateToLogin: () => void`, `onSignUpSuccess: () => void`
- Produces: Fullscreen Allure 50%/50% view combining `OnboardFormContainer` & `CardPreview3D`.

- [ ] **Step 1: Write failing test for NewOnboardView**

```tsx
// WEB/tests/NewOnboardView.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import NewOnboardView from '../components/Onboard/NewOnboardView';

describe('NewOnboardView Component', () => {
  it('renders 50/50 split layout with form and card preview', () => {
    render(<NewOnboardView onNavigateToLogin={vi.fn()} onSignUpSuccess={vi.fn()} />);
    
    expect(screen.getByText(/Criar Sua Conta Fintech/i)).toBeInTheDocument();
    expect(screen.getByText(/Resumo do Pedido/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run WEB/tests/NewOnboardView.test.tsx`
Expected: FAIL (Component does not exist)

- [ ] **Step 3: Implement NewOnboardView & wire up routes in App.tsx**

Create `WEB/components/Onboard/NewOnboardView.tsx` and integrate route `/signup` and `/new-onboard` in `WEB/App.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run WEB/tests/NewOnboardView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add WEB/components/Onboard/NewOnboardView.tsx WEB/App.tsx WEB/components/PreLoginDashboard.tsx WEB/tests/NewOnboardView.test.tsx
git commit -m "feat(onboard): integra nova tela New Onboard Allure 50/50 e rotas de cadastro"
```
