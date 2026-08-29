const { dayKey } = require('../../utils/timezone');

function createAdminNotificationsController({ dbService }) {
  const adminNotificationsMinimo = async (req, res) => {
    const quarentaEOitoHorasAtras = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const rows = await dbService.executeQuery(
      "SELECT t.cpf, u.full_name, ABS(t.amount::numeric) AS valor_pago, t.date AS data_pagamento " +
      "FROM " + dbService.fq("transactions") + " t " +
      "LEFT JOIN " + dbService.fq("users") + " u ON t.cpf = u.cpf " +
      "WHERE t.type = 'INVOICE_PAYMENT' AND t.date >= '" + quarentaEOitoHorasAtras + "' " +
      "ORDER BY t.date DESC"
    ).catch(() => []);
    res.json({ success: true, count: rows.length, items: rows });
  };

  const adminNotificationsAbaixo = async (req, res) => {
    res.json({ success: true, count: 0, items: [] });
  };

  const adminRegularizedTimeline = async (req, res) => {
    const quarentaEOitoHorasAtras = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const rows = await dbService.executeQuery(
      "SELECT t.date AS data_pagamento, ABS(t.amount::numeric) AS valor_total, ABS(t.amount::numeric) AS valor_pago " +
      "FROM " + dbService.fq("transactions") + " t " +
      "WHERE t.type = 'INVOICE_PAYMENT' AND t.date >= '" + quarentaEOitoHorasAtras + "' " +
      "ORDER BY t.date ASC"
    ).catch(() => []);

    const dayMap = new Map();
    for (const r of (rows || [])) {
      if (!r.data_pagamento) continue;
      const d = r.data_pagamento instanceof Date ? r.data_pagamento : new Date(r.data_pagamento);
      if (isNaN(d.getTime())) continue;
      const day = dayKey(d);
      if (!dayMap.has(day)) dayMap.set(day, { count: 0, totalAmount: 0 });
      const entry = dayMap.get(day);
      entry.count++;
      entry.totalAmount += parseFloat(r.valor_pago || r.valor_total || 0);
    }

    const timeline = [];
    for (let i = 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const k = dayKey(d);
      const entry = dayMap.get(k);
      timeline.push({
        date: k,
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        count: entry ? entry.count : 0,
        totalAmount: entry ? Math.round(entry.totalAmount * 100) / 100 : 0,
      });
    }

    const total = timeline.reduce((acc, curr) => acc + curr.count, 0);
    res.json({ success: true, timeline, total });
  };

  return {
    adminNotificationsMinimo,
    adminNotificationsAbaixo,
    adminRegularizedTimeline
  };
}

module.exports = createAdminNotificationsController;
