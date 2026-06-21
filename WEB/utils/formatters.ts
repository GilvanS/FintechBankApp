
export const formatCPF = (cpf: string): string => {
  const cleaned = (cpf || '').replace(/\D/g, '');
  if (!cleaned) return '';
  const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})$/);
  if (!match) return cleaned;

  let formatted = match[1];
  if (match[2]) {
    formatted += `.${match[2]}`;
  }
  if (match[3]) {
    formatted += `.${match[3]}`;
  }
  if (match[4]) {
    formatted += `-${match[4]}`;
  }
  return formatted;
};

export const formatCurrency = (value: string): string => {
  const numbers = value.replace(/\D/g, '');

  if (!numbers) return '';

  const amount = parseInt(numbers, 10) / 100;

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const parseCurrency = (formattedValue: string): number => {
  const cleaned = formattedValue.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

// BRT = UTC-3, fixo desde 2019 (Brasil aboliu horário de verão)
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

// Garante que strings sem fuso (ex: "2026-06-18 00:23:23") sejam tratadas como UTC
function asUTC(date: string | Date): Date {
    if (date instanceof Date) return date;
    if (/Z$|[+-]\d{2}:\d{2}$/.test(date)) return new Date(date);
    return new Date(date.replace(' ', 'T') + 'Z');
}

// Converte UTC → BRT subtraindo 3h manualmente (sem depender de Intl.DateTimeFormat)
function toBRT(date: string | Date): Date {
    return new Date(asUTC(date).getTime() - BRT_OFFSET_MS);
}

export const formatDateBR = (date: string | Date): string => {
    const brt = toBRT(date);
    const d = brt.getUTCDate().toString().padStart(2, '0');
    const m = (brt.getUTCMonth() + 1).toString().padStart(2, '0');
    const y = brt.getUTCFullYear();
    return `${d}/${m}/${y}`;
};

export const formatTimeBR = (date: string | Date): string => {
    const utc = asUTC(date);
    const brt = new Date(utc.getTime() - BRT_OFFSET_MS);
    console.log('[BRT-DEBUG] input:', date, '| UTC:', utc.toISOString(), '| BRT h:', brt.getUTCHours(), 'min:', brt.getUTCMinutes());
    const h = brt.getUTCHours().toString().padStart(2, '0');
    const min = brt.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${min}`;
};

export const formatDateTimeBR = (date: string | Date): string =>
    `${formatDateBR(date)} ${formatTimeBR(date)}`;

export const isValidCPF = (cpf: string): boolean => {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(clean[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  return rem === parseInt(clean[10]);
};
