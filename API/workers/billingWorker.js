require("dotenv").config();
const cron = require("node-cron");
const invoiceEngine = require("../services/invoiceEngine");
const billingValidation = require("../services/billingValidation");
const recurringEngine = require("../services/recurringEngine");
const orphanFix = require("../services/orphanPaymentFix");
const invoicePdfService = require("../services/invoicePdfService");
const DatabaseFactory = require("../services/database/DatabaseFactory");
const dbService = DatabaseFactory.createDatabaseService();
const telegramService = require("../services/telegramService");

telegramService.init(dbService);
console.log("[BillingWorker] Worker de Faturamento Iniciado...");

// 1. 17:00 - Batch de Transacoes
cron.schedule("0 17 * * *", async () => {
  console.log("[BillingWorker][17:00] Rodando Batch de Transacoes...");
  try {
    const pending = await dbService.executeQuery("SELECT id, cpf, amount, type FROM " + dbService.fq("transactions") + " WHERE status = 'pending'");
    let count = 0;
    for (const tx of pending) {
      await dbService.executeQuery("UPDATE " + dbService.fq("transactions") + " SET status = 'completed' WHERE id = '" + tx.id + "'");
      count++;
    }
    console.log("[BillingWorker] Batch concluido. " + count + " transacoes consolidadas.");
  } catch (e) {
    console.error("[BillingWorker] Erro no Batch:", e.message);
  }
});

// 2. 17:15 - Invoice Engine
cron.schedule("15 17 * * *", async () => {
  console.log("[BillingWorker][17:15] Rodando Invoice Engine...");
  try {
    const res = await invoiceEngine.runEngine();
    console.log("[BillingWorker] Invoice Engine concluido:", res);
  } catch (e) {
    console.error("[BillingWorker] Erro no Invoice Engine:", e.message);
  }
});

// 3. 17:30 - Billing Validation
cron.schedule("30 17 * * *", async () => {
  console.log("[BillingWorker][17:30] Rodando Billing Validation...");
  try {
    const res = await billingValidation.runBillingValidation();
    console.log("[BillingWorker] Billing Validation concluido:", res && res.message);
  } catch (e) {
    console.error("[BillingWorker] Erro no Billing Validation:", e.message);
  }
});

// 4. 18:00 - Recurring Engine
cron.schedule("0 18 * * *", async () => {
  console.log("[BillingWorker][18:00] Rodando Recurring Engine...");
  try {
    const res = await recurringEngine.runEngine();
    console.log("[BillingWorker] Recurring Engine concluido:", res);
  } catch (e) {
    console.error("[BillingWorker] Erro no Recurring Engine:", e.message);
  }
});

// 5. 18:30 - Daily Audit
cron.schedule("30 18 * * *", async () => {
  console.log("[BillingWorker][18:30] Rodando Daily Audit...");
  try {
    const res = await billingValidation.syncInvoiceDiasAtraso();
    console.log("[BillingWorker] Sincronizacao concluida:", res);
  } catch (e) {
    console.error("[BillingWorker] Erro na sincronizacao:", e.message);
  }
});

// 6. 20:00 - Geracao de PDF em Lote
cron.schedule("0 20 * * *", async () => {
  console.log("[BillingWorker][20:00] Rodando Geracao de PDF em Lote...");
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const closedInvoices = await dbService.executeQuery("SELECT id, cpf FROM " + dbService.fq("invoices") + " WHERE status = 'closed' AND DATE(updated_at) = '" + todayStr + "'");
    let pdfCount = 0;
    for (const inv of closedInvoices) {
      if (invoicePdfService && typeof invoicePdfService.generateUniversalInvoicePDF === "function") {
        await invoicePdfService.generateUniversalInvoicePDF(inv.cpf, "closed");
        pdfCount++;
      }
    }
    console.log("[BillingWorker] Geracao de PDFs concluida. " + pdfCount + " PDFs gerados.");
  } catch (e) {
    console.error("[BillingWorker] Erro na geracao de PDFs:", e.message);
  }
});

// 7. 21:00 Dom - Orphan Fix
cron.schedule("0 21 * * 0", async () => {
  console.log("[BillingWorker][21:00 Dom] Rodando Orphan Payment Fix...");
  try {
    const res = await orphanFix.runOrphanPaymentFix();
    console.log("[BillingWorker] Orphan Fix concluido:", res);
  } catch (e) {
    console.error("[BillingWorker] Erro no Orphan Fix:", e.message);
  }
});
