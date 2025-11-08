
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
