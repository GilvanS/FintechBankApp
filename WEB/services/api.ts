// Top-level: base de API
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// Função para verificar se o servidor está online
export const healthCheck = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET', signal: AbortSignal.timeout(5000) });
    return res.status === 200;
  } catch (error) {
    console.log('Health check falhou:', error);
    return false;
  }
};

// Método: getAuthHeaders
export function getAuthHeaders(contentType: 'json' | 'none' = 'json') {
    const token = localStorage.getItem('authToken') || '';
    const base: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    if (contentType === 'json') base['Content-Type'] = 'application/json';
    return base;
}

// Método: login
// ... (restante do arquivo inalterado)
