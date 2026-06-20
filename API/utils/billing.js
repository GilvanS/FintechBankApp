'use strict';

/**
 * Computa o status do ciclo de faturamento atual.
 *
 * Diagrama do ciclo (ex: close_day=20, due_day=10, grace=3):
 *   Dia 1–9   → aberta (fatura aberta, aceitando lançamentos)
 *   Dia 10    → due_day: vencimento do ciclo anterior
 *   Dia 11–13 → vencida (dentro da carência)
 *   Dia 14–20 → inadimplente (carência esgotada; ainda aberta para novo ciclo)
 *   Dia 20+   → fechada (fatura fechou, aguardando pagamento até dia 10 do mês seguinte)
 *
 * Regra de "vencida / inadimplente":
 *   Quando due_day < day < close_day, o vencimento do CICLO ANTERIOR ocorreu
 *   neste mesmo mês (dia due_day). Verifica-se esse vencimento, não o do mês seguinte.
 *
 * @param {{ close_day: number, due_day: number, grace_period_days: number }} cfg
 * @param {Date} [now] - data de referência (padrão: hoje)
 */
function computeCurrentCycle(cfg, now = new Date()) {
    const day   = now.getDate();
    const month = now.getMonth();   // 0-based
    const year  = now.getFullYear();

    const closeDate = new Date(year, month, cfg.close_day);

    // Janela entre vencimento anterior e fechamento deste mês
    // Ex.: due_day=10, close_day=20 → dias 11-19 verificam se fatura anterior foi paga
    if (day < cfg.close_day && day > cfg.due_day) {
        const prevDueDate     = new Date(year, month, cfg.due_day);
        const overdueDeadline = new Date(prevDueDate.getTime() + cfg.grace_period_days * 86400000);
        // invoiceRef = este mês (o ciclo que venceu aqui)
        const invoiceRef = `${year}-${String(month + 1).padStart(2, '0')}`;
        const cycleStatus = now > overdueDeadline ? 'inadimplente' : 'vencida';
        return { invoiceRef, closeDate, dueDate: prevDueDate, overdueDeadline, cycleStatus };
    }

    // Caso normal: aberta (day < close_day) ou fechada (day >= close_day)
    const dueDate         = new Date(year, month + 1, cfg.due_day);
    const overdueDeadline = new Date(dueDate.getTime() + cfg.grace_period_days * 86400000);
    const rawRef          = month + 2;  // vence no mês seguinte → month é 0-based → +2
    const refYear         = rawRef > 12 ? year + 1 : year;
    const refMonth        = rawRef > 12 ? rawRef - 12 : rawRef;
    const invoiceRef      = `${refYear}-${String(refMonth).padStart(2, '0')}`;
    const cycleStatus     = day < cfg.close_day ? 'aberta' : 'fechada';

    return { invoiceRef, closeDate, dueDate, overdueDeadline, cycleStatus };
}

/**
 * Calcula encargos por inadimplência (padrão brasileiro).
 * Multa: 2% flat | Juros de mora: 1%/mês ≈ 0,03333%/dia
 *
 * @param {number} invoiceAmount  - saldo devedor
 * @param {number} daysOverdue    - dias em atraso
 * @returns {{ multa: number, juros: number, total: number }}
 */
function calcCharges(invoiceAmount, daysOverdue) {
    const multa = Math.round(invoiceAmount * 0.02 * 100) / 100;
    const juros = Math.round(invoiceAmount * 0.000333 * daysOverdue * 100) / 100;
    return { multa, juros, total: Math.round((multa + juros) * 100) / 100 };
}

module.exports = { computeCurrentCycle, calcCharges };
