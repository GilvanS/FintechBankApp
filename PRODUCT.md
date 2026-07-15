# Product

## Register

product

## Users

Two overlapping audiences, both real:

- **Developers training on Clean Code / SOLID / automated testing** (E2E, Vitest, Jest). The UI is a showcase of code and UX quality, not just a throwaway prototype — it's meant to look and behave like production.
- **End users simulating real banking routines**: PIX transfers, credit card invoices, statements, shopping with cashback. The experience needs to be credible as a real digital bank, not an obviously-fake demo.

The job to be done, for both audiences at once: make every banking flow (PIX, cards, invoices, shop) feel indistinguishable from a real fintech product, while the codebase underneath stays clean enough to teach from.

## Product Purpose

FintechBankApp is a didactic full-stack banking simulation (Node/Express API + React/Vite WEB + Ionic MOBILE) used to practice web/API development, SOLID principles, and end-to-end testing. It replicates real digital-bank flows — PIX, credit card invoices with late-fee calculation, virtual/physical card management, statements, shop with cashback — closely enough that testing and demoing it feels like working with production software.

Success looks like: a developer can point to any screen and use it as a portfolio-quality example of both code architecture and UI craft, and a user testing the app never feels like they're clicking through a toy.

## Brand Personality

VOLT runs two deliberate skins on the same underlying product, switched by theme:

- **Yellow (neo-brutalist / light)** — bold, energetic, playful. Saturated yellow background, thick black borders, hard offset shadows, high-contrast geometric shapes. Confidence bordering on irreverence.
- **Midnight (dark)** — sleek, restrained, trustworthy. Near-black surfaces, neon `volt-green` (#00ff9d) accents used sparingly, glowing highlights on key numbers. Premium/tech feel.

Both are the same brand at different times of day, not two different products — components should be built theme-aware from the start (light brutalist / dark neon), not designed once and reskinned after.

## Anti-references

- **Generic fintech "AI slop"**: purple-blue gradients, gradient-clipped text, identical floating cards, the SaaS hero-metric template. VOLT should never look like a templated fintech landing page.
- **Old-school corporate banking** (Itaú/Bradesco-style): navy-serious palettes, dense bureaucratic forms, heavy visual red tape. VOLT is a modern challenger bank, not a legacy institution.

## Design Principles

1. **Two skins, one product** — every new component must work in both Yellow (brutalist/light) and Midnight (neon/dark) themes; never design against only one.
2. **Credible over cute** — banking flows (PIX, invoices, cards) must read as real and trustworthy first; personality (brutalist edges, neon glows) is the seasoning, not the meal.
3. **Show, don't tell** — since this app doubles as a teaching artifact, UI quality and clear data (real dates, real R$ values, correct math on invoices/charges) matters as much as visual polish.
4. **Bold contrast, no middle ground** — Yellow theme commits to hard black borders and offset shadows; Midnight commits to near-black + neon green. Avoid timid, washed-out in-between states in either theme.
5. **Brazilian fintech fluency** — PIX, boleto, fatura/CDI language and formatting (pt-BR dates, R$ currency, CPF) are first-class, not translated afterthoughts.

## Accessibility & Inclusion

WCAG AA as the minimum bar: body text ≥4.5:1 contrast against its background in both themes (the Midnight theme's `on-surface-variant` gray-green must be checked against near-black, and Yellow theme's black-on-yellow must stay legible at all opacities), visible focus states, and `prefers-reduced-motion` alternatives for all `motion/react` animations already in use across the codebase.
