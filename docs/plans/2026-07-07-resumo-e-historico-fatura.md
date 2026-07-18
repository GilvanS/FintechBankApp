# Resumo da Fatura e Histórico Detalhado Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the detailed Invoice Summary modal, late charges calculator (2% Multa, 0.38% flat + 0.0082% daily IOF, 1% a.m. Mora, 15.39% a.m. Rotativo), past invoices history table, dashboard credit card card (horizontal scroll buttons, cut-off date), physical card delivery modal, and HEXA25 shop promo popup.

**Architecture:** Extend the PostgreSQL schema for the `invoices` table to store detailed charges upon closing. Build dynamic summary and history API endpoints, update the billing engine, and create high-fidelity UI components matching the reference designs.

**Tech Stack:** Node.js (Express), PostgreSQL, React (Vite/TailwindCSS/Ionic).

---

## Reference Screenshots

Below are all the screenshots provided for design reference and layout alignment:

### 1. Resumo da Fatura (Sem Atraso vs Com Atraso)
![Fatura Fechada Sem Atraso](file:///C:/Users/GilvanS/.gemini/antigravity-ide/brain/425e03c6-ec37-425a-8a3e-98ccda8b3da7/fatura_fechada_1783436546445.png)
*Exemplo de resumo para fatura fechada normal.*

![Fatura Aberta Com Atraso](file:///C:/Users/GilvanS/.gemini/antigravity-ide/brain/425e03c6-ec37-425a-8a3e-98ccda8b3da7/fatura_aberta_1783436582708.png)
*Exemplo com o cálculo de juros remuneratórios (15.39% a.m.), IOF fixo e diário, multa de 2% e juros de mora (1.00% a.m.).*

### 2. Imagens de Resumo de Fatura Adicionais
![Resumo de Fatura Exemplo 1](file:///C:/Users/GilvanS/.gemini/antigravity-ide/brain/425e03c6-ec37-425a-8a3e-98ccda8b3da7/fatura_resumo_exemplo_1.jpg)
*Exemplo 1 de resumo de fatura e encargos.*

![Resumo de Fatura Exemplo 2](file:///C:/Users/GilvanS/.gemini/antigravity-ide/brain/425e03c6-ec37-425a-8a3e-98ccda8b3da7/fatura_resumo_exemplo_2.jpg)
*Exemplo 2 de resumo de fatura detalhada.*

![Resumo de Fatura Exemplo 3](file:///C:/Users/GilvanS/.gemini/antigravity-ide/brain/425e03c6-ec37-425a-8a3e-98ccda8b3da7/fatura_resumo_exemplo_3.jpg)
*Exemplo 3 de extrato de fatura.*

![Resumo de Fatura Exemplo 4](file:///C:/Users/GilvanS/.gemini/antigravity-ide/brain/425e03c6-ec37-425a-8a3e-98ccda8b3da7/fatura_resumo_exemplo_4.jpg)
*Exemplo 4 de detalhamento de fatura fechada.*

### 3. Detalhes Adicionais da Fatura e Histórico
![Fatura Detalhes 1](file:///C:/Users/GilvanS/.gemini/antigravity-ide/brain/425e03c6-ec37-425a-8a3e-98ccda8b3da7/fatura_detalhes_1.png)
*Detalhes adicionais da fatura do usuário.*

![Fatura Detalhes 2](file:///C:/Users/GilvanS/.gemini/antigravity-ide/brain/425e03c6-ec37-425a-8a3e-98ccda8b3da7/fatura_detalhes_2.png)
*Informações de taxas, encargos e histórico complementar de resumo.*

![Histórico de Faturas Complementar](file:///C:/Users/GilvanS/.gemini/antigravity-ide/brain/425e03c6-ec37-425a-8a3e-98ccda8b3da7/media__1783441133815.png)
*Layout da tabela com o histórico das últimas faturas.*

![Próximas Parcelas](file:///C:/Users/GilvanS/.gemini/antigravity-ide/brain/425e03c6-ec37-425a-8a3e-98ccda8b3da7/media__1783441180112.png)
*Visual das próximas parcelas e lançamentos futuros no app.*

### 4. Layout de Cartão e Scroll Lateral (Home)
![Scroll Lateral e Melhor Dia](file:///C:/Users/GilvanS/.gemini/antigravity-ide/brain/425e03c6-ec37-425a-8a3e-98ccda8b3da7/media__1783440761494.jpg)
*Referência para o card de fatura aberta com scroll lateral de botões de ações rápidas.*

![Opções de Rastreamento de Cartão](file:///C:/Users/GilvanS/.gemini/antigravity-ide/brain/425e03c6-ec37-425a-8a3e-98ccda8b3da7/media__1783441073931.jpg)
*Visual do card inicial de logística de entrega do cartão com os botões "Rastrear" e "Recebi meu cartão".*

### 5. Promoção Hexa (Shop)
![Promoção HEXA25](file:///C:/Users/GilvanS/.gemini/antigravity-ide/brain/425e03c6-ec37-425a-8a3e-98ccda8b3da7/hexa_promo_1783441374292.png)
*Layout da promoção verde-amarela HEXA25.*

### 6. Comprovantes de Pix / Transferência
![Comprovante Pix 1](file:///C:/Users/GilvanS/.gemini/antigravity-ide/brain/425e03c6-ec37-425a-8a3e-98ccda8b3da7/media__1783441240058.png)
*Layout para validar o comprovante de transferências e transações Pix.*

---

## Proposed Changes and Tasks

### Task 1: Database Schema Migration

**Files:**
- Modify: `API/index.cjs` (inside `initializeDatabase()`)
- Test: Verify tables and columns via query tool.

**Step 1: Write SQL migrations in API startup**
Add code in `initializeDatabase()` in `API/index.cjs` after the `users` column checks:
```javascript
            // Garantir colunas de encargos/resumo na tabela invoices
            const invoiceCols = await databricksService.executeQuery(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'fintech' AND table_name = 'invoices'
                AND column_name IN ('saldo_anterior','valor_iof','valor_juros_remuneratorios','valor_juros_mora')
            `);
            const hasInvCols = invoiceCols.map(c => c.column_name);
            if (!hasInvCols.includes('saldo_anterior')) {
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('invoices')} ADD COLUMN saldo_anterior DECIMAL(15,2) DEFAULT 0.00`);
                console.log('✅ Coluna saldo_anterior adicionada em invoices.');
            }
            if (!hasInvCols.includes('valor_iof')) {
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('invoices')} ADD COLUMN valor_iof DECIMAL(15,2) DEFAULT 0.00`);
                console.log('✅ Coluna valor_iof adicionada em invoices.');
            }
            if (!hasInvCols.includes('valor_juros_remuneratorios')) {
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('invoices')} ADD COLUMN valor_juros_remuneratorios DECIMAL(15,2) DEFAULT 0.00`);
                console.log('✅ Coluna valor_juros_remuneratorios adicionada em invoices.');
            }
            if (!hasInvCols.includes('valor_juros_mora')) {
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('invoices')} ADD COLUMN valor_juros_mora DECIMAL(15,2) DEFAULT 0.00`);
                console.log('✅ Coluna valor_juros_mora adicionada em invoices.');
            }
```

**Step 2: Run and verify migrations**
Restart the API server, ensuring the log output shows the columns successfully added.
Command: `node -r dotenv/config -e "const db = require('./services/database/DatabaseFactory.js').createDatabaseService(); db.connect().then(() => db.executeQuery('SELECT column_name FROM information_schema.columns WHERE table_name = \'invoices\'')).then(console.log).then(() => process.exit(0))"`
Expected: Columns `saldo_anterior`, `valor_iof`, `valor_juros_remuneratorios`, `valor_juros_mora` are listed.

---

### Task 2: Update Billing Engine and Calculations

**Files:**
- Modify: `API/index.cjs` (inside `/admin/billing/force-cycle` route)
- Modify: `API/services/invoiceEngine.js` (inside `runEngine`)

**Step 1: Implement Daily Charge Recalculation**
In `API/index.cjs` inside the `/admin/billing/force-cycle` route, replace the transition check with a daily recalculation block:
```javascript
        if (newStatus === 'inadimplente') {
            const invoiceAmount = Math.max(0,
                parseFloat(u.credit_card_total_limit) - parseFloat(u.credit_card_available_limit)
            );
            if (invoiceAmount > 0) {
                // Limpar encargos pendentes anteriores deste ciclo
                await databricksService.executeQuery(`
                    DELETE FROM ${databricksService.fq('billing_charges')}
                    WHERE cpf = '${u.cpf}' AND invoice_reference = '${cycle.invoiceRef}' AND status = 'pending'
                `);

                // Fórmulas exatas do extrato
                const multa = Math.round(invoiceAmount * 0.02 * 100) / 100;
                const iofAdicional = Math.round(invoiceAmount * 0.0038 * 100) / 100;
                const iofDiario = Math.round(invoiceAmount * 0.000082 * daysOverdue * 100) / 100;
                const iofTotal = Math.round((iofAdicional + iofDiario) * 100) / 100;

                const jurosRem = Math.round(invoiceAmount * 0.00513 * daysOverdue * 100) / 100;
                const jurosMora = Math.round(invoiceAmount * 0.000333 * daysOverdue * 100) / 100;

                const idBase = `${u.cpf}_${cycle.invoiceRef}_${Date.now()}`;
                await databricksService.executeQuery(`
                    INSERT INTO ${databricksService.fq('billing_charges')} (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount)
                    VALUES
                    ('${idBase}_multa', '${u.cpf}', '${cycle.invoiceRef}', 'multa', ${multa}, ${daysOverdue}, ${invoiceAmount}),
                    ('${idBase}_iof', '${u.cpf}', '${cycle.invoiceRef}', 'iof', ${iofTotal}, ${daysOverdue}, ${invoiceAmount}),
                    ('${idBase}_juros_rem', '${u.cpf}', '${cycle.invoiceRef}', 'juros_remuneratorios', ${jurosRem}, ${daysOverdue}, ${invoiceAmount}),
                    ('${idBase}_juros_mora', '${u.cpf}', '${cycle.invoiceRef}', 'juros_mora', ${jurosMora}, ${daysOverdue}, ${invoiceAmount})
                `);
            }
        }
```

**Step 2: Update Close Invoice Persist**
In `API/services/invoiceEngine.js` inside `runEngine`, fetch the pending charges from `billing_charges` and write them when inserting the `invoices` table record:
```javascript
        // 5. Inserir fatura fechada na tabela invoices
        const invoiceId = uuidv4();
        
        // Buscar saldo anterior (última fatura fechada anterior que não foi paga)
        const prevUnpaidInvoice = (await db.executeQuery(`
          SELECT valor_total FROM ${db.fq('invoices')}
          WHERE cpf = ${esc(user.cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
          ORDER BY due_date DESC LIMIT 1
        `))[0];
        const saldoAnterior = prevUnpaidInvoice ? parseFloat(prevUnpaidInvoice.valor_total || 0) : 0.00;

        // Buscar charges pendentes geradas para o ciclo que está fechando
        const charges = await db.executeQuery(`
          SELECT charge_type, SUM(amount) as amount FROM ${db.fq('billing_charges')}
          WHERE cpf = ${esc(user.cpf)} AND invoice_reference = ${esc(invoiceRef)} AND status = 'pending'
          GROUP BY charge_type
        `);
        const getCharge = (type) => parseFloat(charges.find(c => c.charge_type === type)?.amount || 0);
        
        const multa = getCharge('multa');
        const iof = getCharge('iof');
        const jurosRem = getCharge('juros_remuneratorios');
        const jurosMora = getCharge('juros_mora');

        await db.executeQuery(`
          INSERT INTO ${db.fq('invoices')} (id, cpf, status, due_date, valor_total, created_at, updated_at, saldo_anterior, valor_iof, valor_juros_remuneratorios, valor_juros_mora, valor_multa)
          VALUES (${esc(invoiceId)}, ${esc(user.cpf)}, 'FECHADA', ${esc(dueDate.toISOString())}, ${invoiceAmount.toFixed(2)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${saldoAnterior}, ${iof}, ${jurosRem}, ${jurosMora}, ${multa})
        `);

        // Marcar charges como pagas/fechadas
        await db.executeQuery(`
          UPDATE ${db.fq('billing_charges')}
          SET status = 'paid'
          WHERE cpf = ${esc(user.cpf)} AND invoice_reference = ${esc(invoiceRef)}
        `);
```

---

### Task 3: Backend Summary and History Endpoints

**Files:**
- Modify: `API/index.cjs` (add new api routes)
- Test: Query routes directly with curl.

**Step 1: Implement GET `/api/credit/invoices/summary/:type`**
Add the summary API endpoint:
```javascript
apiRouter.get('/credit/invoices/summary/:type', bearerAuth(), asyncHandler(async (req, res) => {
    const { type } = req.params;
    const { cpf } = req.user;
    
    const configRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`);
    const cfg = configRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3 };
    const cycle = computeCurrentCycle(cfg);

    if (type === 'fechada') {
        const closed = (await databricksService.executeQuery(`
            SELECT * FROM ${databricksService.fq('invoices')}
            WHERE cpf = '${cpf}' AND status = 'FECHADA'
            ORDER BY due_date DESC LIMIT 1
        `))[0];

        if (!closed) {
            return res.json({ success: true, summary: null });
        }

        const iof = parseFloat(closed.valor_iof || 0);
        const multa = parseFloat(closed.valor_multa || 0);
        const jurosRem = parseFloat(closed.valor_juros_remuneratorios || 0);
        const jurosMora = parseFloat(closed.valor_juros_mora || 0);
        const saldoAnterior = parseFloat(closed.saldo_anterior || 0);
        const totalPurchases = parseFloat(closed.valor_total || 0);
        const finalBalance = totalPurchases + iof + multa + jurosRem + jurosMora + saldoAnterior;

        return res.json({
            success: true,
            summary: {
                saldoAnterior,
                jurosRemuneratorios: jurosRem,
                iof,
                jurosMora,
                multa,
                totalDespesas: totalPurchases,
                totalPagamentos: parseFloat(closed.data_pagamento ? finalBalance : 0),
                totalCreditos: 0.00,
                saldoFinal: finalBalance,
                pagamentoMinimo: Math.max(finalBalance * 0.15, 10.00),
                dataVencimento: new Date(closed.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(' de ', '/'),
                melhorDataCompra: new Date(new Date(closed.due_date).setDate(new Date(closed.due_date).getDate() - 7)).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(' de ', '/')
            }
        });
    } else {
        // Fatura Aberta
        const overdueInvoice = (await databricksService.executeQuery(`
            SELECT * FROM ${databricksService.fq('invoices')}
            WHERE cpf = '${cpf}' AND status = 'FECHADA' AND data_pagamento IS NULL
            ORDER BY due_date DESC LIMIT 1
        `))[0];

        const saldoAnterior = overdueInvoice ? parseFloat(overdueInvoice.valor_total || 0) : 0;
        
        const charges = await databricksService.executeQuery(`
            SELECT charge_type, SUM(amount) as amount FROM ${databricksService.fq('billing_charges')}
            WHERE cpf = '${cpf}' AND invoice_reference = '${cycle.invoiceRef}'
            GROUP BY charge_type
        `);

        const getCharge = (type) => parseFloat(charges.find(c => c.charge_type === type)?.amount || 0);
        const iof = getCharge('iof');
        const multa = getCharge('multa');
        const jurosRem = getCharge('juros_remuneratorios');
        const jurosMora = getCharge('juros_mora');

        const cardTransactions = await databricksService.executeQuery(`
            SELECT amount, type, date FROM ${databricksService.fq('transactions')}
            WHERE cpf = '${cpf}' AND payment_method = 'credit'
        `);
        const _prevCloseMs = new Date(cycle.closeDate).setMonth(cycle.closeDate.getMonth() - 1);
        const openPurchases = cardTransactions.filter(tx => {
            const txDate = new Date(tx.date).getTime();
            return txDate > _prevCloseMs && txDate <= cycle.dueDate.getTime();
        }).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

        const totalCharges = iof + multa + jurosRem + jurosMora;
        const valorPendente = openPurchases + totalCharges;

        return res.json({
            success: true,
            summary: {
                saldoAnterior,
                jurosRemuneratorios: jurosRem,
                iof,
                jurosMora,
                multa,
                totalDespesas: openPurchases,
                totalPagamentos: 0.00,
                totalCreditos: 0.00,
                saldoFinal: valorPendente + saldoAnterior,
                pagamentoMinimo: 0.00,
                dataVencimento: cycle.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(' de ', '/'),
                melhorDataCompra: cycle.closeDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(' de ', '/')
            }
        });
    }
}));
```

**Step 2: Implement GET `/api/credit/invoices/history`**
Add the history API endpoint returning past closed invoices and current cycle:
```javascript
apiRouter.get('/credit/invoices/history', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf } = req.user;
    const configRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`);
    const cfg = configRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3 };
    const cycle = computeCurrentCycle(cfg);

    const closed = await databricksService.executeQuery(`
        SELECT * FROM ${databricksService.fq('invoices')}
        WHERE cpf = '${cpf}' AND status = 'FECHADA'
        ORDER BY due_date DESC
    `);

    const history = [];

    // Adicionar fatura aberta (AGO)
    history.push({
        month: cycle.dueDate.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase(),
        amount: 0.00, // Será recalculado no front
        status: 'Fatura aberta',
        period: `${new Date(new Date(cycle.closeDate).setMonth(cycle.closeDate.getMonth() - 1)).toLocaleDateString('pt-BR')} a ${cycle.closeDate.toLocaleDateString('pt-BR')}`
    });

    for (const inv of closed) {
        const iof = parseFloat(inv.valor_iof || 0);
        const multa = parseFloat(inv.valor_multa || 0);
        const jurosRem = parseFloat(inv.valor_juros_remuneratorios || 0);
        const jurosMora = parseFloat(inv.valor_juros_mora || 0);
        const saldoAnterior = parseFloat(inv.saldo_anterior || 0);
        const purchases = parseFloat(inv.valor_total || 0);
        const total = purchases + iof + multa + jurosRem + jurosMora + saldoAnterior;

        const due = new Date(inv.due_date);
        const close = new Date(new Date(inv.due_date).setDate(due.getDate() - 7));
        const prevClose = new Date(new Date(close).setMonth(close.getMonth() - 1));

        history.push({
            month: due.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase(),
            amount: total,
            status: inv.data_pagamento ? `R$ ${total.toLocaleString('pt-BR')}` : 'Esta fatura',
            period: `${prevClose.toLocaleDateString('pt-BR')} a ${close.toLocaleDateString('pt-BR')}`
        });
    }

    res.json({ success: true, history });
}));
```

---

### Task 4: Frontend Services Integration

**Files:**
- Modify: `WEB/services/api.ts` & `MOBILE/src/services/api.ts`
- Modify: `WEB/services/mockApi.ts` & `MOBILE/src/services/mockApi.ts`

Expose methods in both environments calling `/api/credit/invoices/summary/:type` and `/api/credit/invoices/history`.

---

### Task 5: Dashboard Credit Card Bento Card UI

**Files:**
- Modify: `WEB/components/HomeView.tsx`
- Modify: `MOBILE/src/components/HomeView.tsx`

**Step 1: Re-design Credit Card Bento Box**
Replace the hardcoded credit card block with dynamic data:
- Status title: `Fatura aberta` (or closed).
- Eye toggle: State variable `hideHomeInvoice` to mask value.
- Add label: `Melhor dia de compra` (corte date) and `Vencimento`.
- Add scroll lateral buttons container:
  ```html
  <div className="flex gap-2.5 overflow-x-auto hide-scrollbar py-2">
      <button className="flex items-center gap-1.5 px-4 py-2.5 bg-white/5 rounded-full text-xs font-bold whitespace-nowrap text-white">
          <Barcode size={14} /> Pagar fatura
      </button>
      <button onClick={() => onNavigate('cards')} className="flex items-center gap-1.5 px-4 py-2.5 bg-white/5 rounded-full text-xs font-bold whitespace-nowrap text-white">
          <CreditCard size={14} /> Meus cartões
      </button>
      <button onClick={() => openSummaryModal()} className="flex items-center gap-1.5 px-4 py-2.5 bg-white/5 rounded-full text-xs font-bold whitespace-nowrap text-white">
          <FileText size={14} /> Resumo da fatura
      </button>
  </div>
  ```

---

### Task 6: Resumo da Fatura Modal and Histórico Tab

**Files:**
- Modify: `WEB/components/ClosedInvoice.tsx`
- Modify: `MOBILE/src/components/ClosedInvoiceView.tsx`

**Step 1: Create Resumo Bottom Sheet Modal**
Build the bottom sheet containing the full itemized additions and subtractions list:
- `Saldo Anterior`
- `(+) Juros Moratórios` (remuneratórios)
- `(+) IOF`
- `(+) IOF Adicional`
- `(+) Juros de Mora`
- `(+) Multa por Atraso`
- `(+) Total Despesas/Débitos`
- `(=) Saldo Desta Fatura`

**Step 2: Update Histórico Tab**
Replace the default placeholder with a 3-column table:
`Mês` | `Pagamento` | `Período das Compras`
Displaying May, June, July, August dynamic items.

---

### Task 7: Physical Card Delivery tracking modal

**Files:**
- Modify: `WEB/components/CardsView.tsx`
- Modify: `MOBILE/src/components/CardsView.tsx`

**Step 1: Separate Logistics view from main layout**
Replace the inline timeline with a bento card displaying:
- Title: `Cartão FintechBank`
- Description: `Acompanhe a entrega do seu cartão. Enquanto isso, comece a usar seu cartão virtual.`
- Buttons:
  - **Rastrear:** Triggers a dialog modal containing the `CardDeliveryTracking` stepper and anim animation.
  - **Recebi meu cartão:** Triggers the CVV/Expiry unlock form.

---

### Task 8: Shop Promotional Popup Campaign

**Files:**
- Modify: `WEB/components/PromotionalPopup.tsx`
- Modify: `MOBILE/src/components/PromotionalPopup.tsx`

**Step 1: Style the Campaign HEXA25**
- Set background color to Cream `#F6F3EB` and text color to Teal `#0C4A43`.
- Render a golden ticket for the coupon `HEXA25` with a trophy icon.
- Banner image: `/hexa_promo.png` (using the generated asset).
- Button: `APROVEITE` styled in black.
