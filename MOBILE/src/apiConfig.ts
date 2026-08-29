/**
 * Configuracao Centralizada da API
 *
 * Agora a URL nao e mais uma constante fixa — ela pode ser
 * lida/salva do armazenamento local pelo HiddenMenu de Ajustes.
 *
 * Para alterar o IP padrao de build-time, mude API_DEFAULT_URL abaixo.
 */

// IP fixado no momento do build (fallback caso o menu oculto nunca seja usado)
export const API_DEFAULT_URL = 'http://192.168.10.105:3001';

// Sub-redes candidatas para descoberta automatica quando o IP mudar por DHCP.
// '10.0.2' cobre o AVD do emulador Android: sua rede virtual NAT usa sempre
// 10.0.2.x, com 10.0.2.2 como alias fixo para o host (o notebook) — por isso
// o emulador nunca acha o servidor pelo IP de Wi-Fi real do notebook sem essa
// entrada, mesmo que o celular fisico na mesma rede ache normalmente.
export const PROBE_SUBNETS = ['192.168.10', '192.168.0', '192.168.1', '10.0.0', '10.0.1', '10.0.2'];
export const API_PORT = 3001;

// Compatibilidade com imports antigos — aponta para o default de build-time
export const API_BASE_URL = API_DEFAULT_URL;