/**
 * Configuracao Centralizada da API
 *
 * Agora a URL nao e mais uma constante fixa — ela pode ser
 * lida/salva do armazenamento local pelo HiddenMenu de Ajustes.
 *
 * Para alterar o IP padrao de build-time, mude API_DEFAULT_URL abaixo.
 */

// IP fixado no momento do build (fallback caso o menu oculto nunca seja usado)
export const API_DEFAULT_URL = 'http://192.168.0.106:3001';

// Sub-redes candidatas para descoberta automatica quando o IP mudar por DHCP.
export const PROBE_SUBNETS = ['192.168.0', '192.168.1', '10.0.0', '10.0.1'];
export const API_PORT = 3001;

// Compatibilidade com imports antigos — aponta para o default de build-time
export const API_BASE_URL = API_DEFAULT_URL;