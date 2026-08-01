import type { PaymentCodesResponse } from '../services/api';

const CACHE_PREFIX = 'volt_payment_codes_';
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutos (padrão PIX)
const MAX_CACHE_ENTRIES = 20;

interface CacheEntry {
  data: PaymentCodesResponse['data'];
  savedAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp
  invoiceId: string;
  amount: number;
}

/**
 * Gera uma chave de cache única para uma fatura.
 * Usa CPF + invoiceId para evitar conflitos entre usuários.
 */
function buildKey(cpf: string, invoiceId: string): string {
  return `${CACHE_PREFIX}${cpf}_${invoiceId}`;
}

/**
 * Salva os paymentCodes no localStorage com TTL.
 * Também registra em um índice para facilitar a limpeza.
 */
export function savePaymentCodesToCache(
  cpf: string,
  invoiceId: string,
  data: PaymentCodesResponse['data'],
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  try {
    const now = Date.now();
    const entry: CacheEntry = {
      data,
      savedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      invoiceId,
      amount: data.invoice?.amount || 0,
    };

    // Salva a entrada
    localStorage.setItem(buildKey(cpf, invoiceId), JSON.stringify(entry));

    // Mantém um índice para gerenciar limite de entradas
    updateIndex(cpf, invoiceId);

    // Limpa entradas expiradas se estiver próximo do limite
    pruneExpired(cpf);
  } catch (err) {
    // localStorage pode estar cheio ou indisponível — falha silenciosa
    console.warn('[paymentCodeCache] Erro ao salvar em cache:', err);
  }
}

/**
 * Recupera paymentCodes do cache se ainda não expirou.
 * Retorna null se não encontrado ou expirado.
 */
export function getPaymentCodesFromCache(
  cpf: string,
  invoiceId: string,
): PaymentCodesResponse['data'] | null {
  try {
    const raw = localStorage.getItem(buildKey(cpf, invoiceId));
    if (!raw) return null;

    const entry: CacheEntry = JSON.parse(raw);
    const now = Date.now();
    const expiresAt = new Date(entry.expiresAt).getTime();

    // Verifica se expirou
    if (now >= expiresAt) {
      localStorage.removeItem(buildKey(cpf, invoiceId));
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Lista todas as entradas de cache não-expirádas para um CPF.
 */
export function listCachedInvoices(cpf: string): Array<{
  invoiceId: string;
  amount: number;
  savedAt: string;
  expiresAt: string;
  hasBoleto: boolean;
  hasPix: boolean;
}> {
  try {
    const index = getIndex(cpf);
    const now = Date.now();
    const result: Array<{
      invoiceId: string;
      amount: number;
      savedAt: string;
      expiresAt: string;
      hasBoleto: boolean;
      hasPix: boolean;
    }> = [];

    for (const invId of index) {
      const raw = localStorage.getItem(buildKey(cpf, invId));
      if (!raw) continue;

      try {
        const entry: CacheEntry = JSON.parse(raw);
        const expTime = new Date(entry.expiresAt).getTime();
        if (now >= expTime) {
          localStorage.removeItem(buildKey(cpf, invId));
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
        localStorage.removeItem(buildKey(cpf, invId));
      }
    }

    return result;
  } catch {
    return [];
  }
}

/**
 * Remove uma entrada específica do cache.
 */
export function removePaymentCodesFromCache(cpf: string, invoiceId: string): void {
  try {
    localStorage.removeItem(buildKey(cpf, invoiceId));
    removeFromIndex(cpf, invoiceId);
  } catch {
    // Silêncio
  }
}

/**
 * Remove todas as entradas expiradas para um CPF.
 */
export function clearExpiredCache(cpf: string): void {
  try {
    const index = getIndex(cpf);
    const now = Date.now();
    const valid: string[] = [];

    for (const invId of index) {
      const raw = localStorage.getItem(buildKey(cpf, invId));
      if (!raw) continue;
      try {
        const entry: CacheEntry = JSON.parse(raw);
        if (now < new Date(entry.expiresAt).getTime()) {
          valid.push(invId);
        } else {
          localStorage.removeItem(buildKey(cpf, invId));
        }
      } catch {
        localStorage.removeItem(buildKey(cpf, invId));
      }
    }

    // Atualiza índice apenas com entradas válidas
    if (valid.length === 0) {
      localStorage.removeItem(`${CACHE_PREFIX}index_${cpf}`);
    } else {
      localStorage.setItem(`${CACHE_PREFIX}index_${cpf}`, JSON.stringify(valid));
    }
  } catch {
    // Silêncio
  }
}

// ─── Helpers internos ───────────────────────────────────────────

function getIndex(cpf: string): string[] {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}index_${cpf}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function updateIndex(cpf: string, invoiceId: string): void {
  try {
    const index = getIndex(cpf);
    // Remove duplicata se existir e adiciona no final (mais recente)
    const filtered = index.filter(id => id !== invoiceId);
    filtered.push(invoiceId);

    // Mantém apenas os últimos MAX_CACHE_ENTRIES
    while (filtered.length > MAX_CACHE_ENTRIES) {
      const oldId = filtered.shift();
      if (oldId) localStorage.removeItem(buildKey(cpf, oldId));
    }

    localStorage.setItem(`${CACHE_PREFIX}index_${cpf}`, JSON.stringify(filtered));
  } catch {
    // Silêncio
  }
}

function removeFromIndex(cpf: string, invoiceId: string): void {
  try {
    const index = getIndex(cpf);
    const filtered = index.filter(id => id !== invoiceId);
    if (filtered.length === 0) {
      localStorage.removeItem(`${CACHE_PREFIX}index_${cpf}`);
    } else {
      localStorage.setItem(`${CACHE_PREFIX}index_${cpf}`, JSON.stringify(filtered));
    }
  } catch {
    // Silêncio
  }
}

function pruneExpired(cpf: string): void {
  try {
    const index = getIndex(cpf);
    if (index.length < MAX_CACHE_ENTRIES * 0.8) return; // Só limpa se estiver cheio
    clearExpiredCache(cpf);
  } catch {
    // Silêncio
  }
}
