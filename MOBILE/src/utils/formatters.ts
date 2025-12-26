
export const formatCPF = (cpf: string): string => {
  const cleaned = (cpf || '').replace(/\D/g, '').slice(0, 11); // Limita a 11 dígitos
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