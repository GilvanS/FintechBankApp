import { Preferences } from '@capacitor/preferences';

/**
 * Cache de codigos de pagamento (boleto + PIX) de fatura.
 * Portado de WEB/utils/paymentCodeCache.ts, trocando localStorage por
 * @capacitor/preferences (storage nativo). Por isso a API e assincrona.
 */

const CACHE_PREFIX = 'volt_payment_codes_';
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutos (padrao PIX)
const MAX_CACHE_ENTRIES = 20;

export interface PaymentCodesData {
    invoice: {
        id: string;
        amount: number;
        amountFormatted: string;
        dueDate: string;
        dueDateFormatted: string;
        payerName: string;
        payerCpf: string;
    };
    boleto: {
        barcode: string;
        linhaDigitavel: string;
        linhaDigitavelRaw: string;
        amount: number;
        amountFormatted: string;
        dueDate: string;
        dueDateFormatted: string;
        dueDateFactor: number;
        beneficiary: { name: string; cnpj: string; bankCode: string; bankName: string };
        payer: { name: string; cpf: string; cpfFormatted: string };
        invoiceId: string;
    };
    pix: {
        payload: string;
        qrcodeSvg: string;
        amount: number;
        amountFormatted: string;
        pixKey: string;
        txid: string;
        beneficiary: { name: string; cnpj: string };
        payer: { name: string; cpf: string; cpfFormatted: string };
        invoiceId: string;
    };
    generatedAt: string;
}

export interface CachedInvoiceSummary {
    invoiceId: string;
    amount: number;
    savedAt: string;
    expiresAt: string;
    hasBoleto: boolean;
    hasPix: boolean;
}

interface CacheEntry {
    data: PaymentCodesData;
    savedAt: string;
    expiresAt: string;
    invoiceId: string;
    amount: number;
}

/** Gera chave unica de cache. Usa CPF + invoiceId para evitar conflito entre usuarios. */
function buildKey(cpf: string, invoiceId: string): string {
    return `${CACHE_PREFIX}${cpf}_${invoiceId}`;
}

function indexKey(cpf: string): string {
    return `${CACHE_PREFIX}index_${cpf}`;
}

async function readRaw(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value ?? null;
}

/** Salva os paymentCodes no storage nativo com TTL e registra no indice. */
export async function savePaymentCodesToCache(
    cpf: string,
    invoiceId: string,
    data: PaymentCodesData,
    ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> {
    try {
        const now = Date.now();
        const entry: CacheEntry = {
            data,
            savedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + ttlMs).toISOString(),
            invoiceId,
            amount: data.invoice?.amount || 0,
        };

        await Preferences.set({ key: buildKey(cpf, invoiceId), value: JSON.stringify(entry) });
        await updateIndex(cpf, invoiceId);
        await pruneExpired(cpf);
    } catch (err) {
        console.warn('[paymentCodeCache] Erro ao salvar em cache:', err);
    }
}

/** Recupera paymentCodes do cache se ainda nao expirou. Retorna null se ausente ou expirado. */
export async function getPaymentCodesFromCache(
    cpf: string,
    invoiceId: string,
): Promise<PaymentCodesData | null> {
    try {
        const raw = await readRaw(buildKey(cpf, invoiceId));
        if (!raw) return null;

        const entry: CacheEntry = JSON.parse(raw);
        if (Date.now() >= new Date(entry.expiresAt).getTime()) {
            await Preferences.remove({ key: buildKey(cpf, invoiceId) });
            return null;
        }

        return entry.data;
    } catch {
        return null;
    }
}

/** Lista todas as entradas de cache nao expiradas para um CPF. */
export async function listCachedInvoices(cpf: string): Promise<CachedInvoiceSummary[]> {
    try {
        const index = await getIndex(cpf);
        const now = Date.now();
        const result: CachedInvoiceSummary[] = [];

        for (const invId of index) {
            const raw = await readRaw(buildKey(cpf, invId));
            if (!raw) continue;

            try {
                const entry: CacheEntry = JSON.parse(raw);
                if (now >= new Date(entry.expiresAt).getTime()) {
                    await Preferences.remove({ key: buildKey(cpf, invId) });
                    continue;
                }
                result.push({
                    invoiceId: entry.invoiceId,
                    amount: entry.amount,
                    savedAt: entry.savedAt,
                    expiresAt: entry.expiresAt,
                    hasBoleto: !!entry.data.boleto,
                    hasPix: !!entry.data.pix,
                });
            } catch {
                await Preferences.remove({ key: buildKey(cpf, invId) });
            }
        }

        return result;
    } catch {
        return [];
    }
}

/** Remove uma entrada especifica do cache. */
export async function removePaymentCodesFromCache(cpf: string, invoiceId: string): Promise<void> {
    try {
        await Preferences.remove({ key: buildKey(cpf, invoiceId) });
        await removeFromIndex(cpf, invoiceId);
    } catch {
        // Silencio
    }
}

/** Remove todas as entradas expiradas para um CPF. */
export async function clearExpiredCache(cpf: string): Promise<void> {
    try {
        const index = await getIndex(cpf);
        const now = Date.now();
        const valid: string[] = [];

        for (const invId of index) {
            const raw = await readRaw(buildKey(cpf, invId));
            if (!raw) continue;
            try {
                const entry: CacheEntry = JSON.parse(raw);
                if (now < new Date(entry.expiresAt).getTime()) {
                    valid.push(invId);
                } else {
                    await Preferences.remove({ key: buildKey(cpf, invId) });
                }
            } catch {
                await Preferences.remove({ key: buildKey(cpf, invId) });
            }
        }

        if (valid.length === 0) {
            await Preferences.remove({ key: indexKey(cpf) });
        } else {
            await Preferences.set({ key: indexKey(cpf), value: JSON.stringify(valid) });
        }
    } catch {
        // Silencio
    }
}

/* --- Helpers internos --- */

async function getIndex(cpf: string): Promise<string[]> {
    try {
        const raw = await readRaw(indexKey(cpf));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

async function updateIndex(cpf: string, invoiceId: string): Promise<void> {
    try {
        const index = await getIndex(cpf);
        // Remove duplicata se existir e adiciona no final (mais recente)
        const filtered = index.filter(id => id !== invoiceId);
        filtered.push(invoiceId);

        // Mantem apenas os ultimos MAX_CACHE_ENTRIES
        while (filtered.length > MAX_CACHE_ENTRIES) {
            const oldId = filtered.shift();
            if (oldId) await Preferences.remove({ key: buildKey(cpf, oldId) });
        }

        await Preferences.set({ key: indexKey(cpf), value: JSON.stringify(filtered) });
    } catch {
        // Silencio
    }
}

async function removeFromIndex(cpf: string, invoiceId: string): Promise<void> {
    try {
        const index = await getIndex(cpf);
        const filtered = index.filter(id => id !== invoiceId);
        if (filtered.length === 0) {
            await Preferences.remove({ key: indexKey(cpf) });
        } else {
            await Preferences.set({ key: indexKey(cpf), value: JSON.stringify(filtered) });
        }
    } catch {
        // Silencio
    }
}

async function pruneExpired(cpf: string): Promise<void> {
    try {
        const index = await getIndex(cpf);
        if (index.length < MAX_CACHE_ENTRIES * 0.8) return; // So limpa se estiver cheio
        await clearExpiredCache(cpf);
    } catch {
        // Silencio
    }
}