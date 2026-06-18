
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

/**
 * Formata um valor monetário enquanto o usuário digita
 * Converte para formato brasileiro: R$ 0,00
 */
export const formatCurrency = (value: string): string => {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');
  
  if (!numbers) return '';
  
  // Converte para número e divide por 100 para obter os centavos
  const amount = parseInt(numbers, 10) / 100;
  
  // Formata como moeda brasileira
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Converte valor formatado de volta para número
 * Ex: "R$ 1.234,56" -> 1234.56
 */
export const parseCurrency = (formattedValue: string): number => {
  const cleaned = formattedValue.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

const BR_TZ = 'America/Sao_Paulo';

export const formatDateTimeBR = (date: string | Date): string =>
    new Date(date).toLocaleString('pt-BR', {
        timeZone: BR_TZ,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

export const formatDateBR = (date: string | Date): string =>
    new Date(date).toLocaleDateString('pt-BR', {
        timeZone: BR_TZ,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

export const formatTimeBR = (date: string | Date): string =>
    new Date(date).toLocaleTimeString('pt-BR', {
        timeZone: BR_TZ,
        hour: '2-digit',
        minute: '2-digit',
    });

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
