// src/utils/formatters.ts

export const formatCPF = (cpf: string): string => {
  // Remove all non-digit characters
  const cleaned = cpf.replace(/\D/g, '');
  
  // Apply formatting based on the length of the cleaned string
  const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})$/);
  
  if (!match) {
    return cpf;
  }
  
  // Construct the formatted string, adding dots and hyphen only when necessary
  return [match[1], match[2], match[3]].filter(Boolean).join('.') + (match[4] ? `-${match[4]}` : '');
};
