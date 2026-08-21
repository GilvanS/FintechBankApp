/**
 * Rodízio da Oferta da Semana.
 *
 * O produto em destaque não é sorteado nem agendado por um job: ele é derivado
 * do relógio. Dividindo o tempo em janelas do tamanho do intervalo escolhido, a
 * janela atual aponta para um índice do catálogo — então o destaque troca
 * sozinho quando o tempo vira, e duas pessoas que abrem a vitrine no mesmo
 * momento veem o mesmo produto, sem precisar de estado compartilhado.
 */

export type IntervaloOferta = '1h' | '3h' | '24h';

export const CHAVE_INTERVALO_OFERTA = 'volt_shop_oferta_intervalo';

const HORA_MS = 60 * 60 * 1000;

export const INTERVALOS_OFERTA: { id: IntervaloOferta; rotulo: string; descricao: string; ms: number }[] = [
    { id: '1h', rotulo: '1 hora', descricao: 'troca rápida', ms: HORA_MS },
    { id: '3h', rotulo: '3 horas', descricao: 'ritmo médio', ms: 3 * HORA_MS },
    { id: '24h', rotulo: '24 horas', descricao: 'uma por dia', ms: 24 * HORA_MS },
];

const PADRAO: IntervaloOferta = '24h';

export function intervaloEmMs(intervalo: IntervaloOferta): number {
    return INTERVALOS_OFERTA.find((i) => i.id === intervalo)?.ms ?? 24 * HORA_MS;
}

export function lerIntervaloOferta(): IntervaloOferta {
    if (typeof window === 'undefined') return PADRAO;
    const salvo = localStorage.getItem(CHAVE_INTERVALO_OFERTA) as IntervaloOferta | null;
    return INTERVALOS_OFERTA.some((i) => i.id === salvo) ? (salvo as IntervaloOferta) : PADRAO;
}

export function salvarIntervaloOferta(intervalo: IntervaloOferta): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CHAVE_INTERVALO_OFERTA, intervalo);
    // O evento `storage` só chega às outras abas; esta precisa ser avisada à parte
    // para que uma vitrine aberta no mesmo documento reaja na hora.
    window.dispatchEvent(new CustomEvent('volt:oferta-intervalo', { detail: intervalo }));
}

/** Índice do destaque para o momento atual, dentro de um catálogo de `total` itens. */
export function indiceDestaque(total: number, intervalo: IntervaloOferta, agora: number = Date.now()): number {
    if (total <= 0) return 0;
    const janela = Math.floor(agora / intervaloEmMs(intervalo));
    return janela % total;
}

/** Quanto falta, em milissegundos, para a próxima troca de destaque. */
export function proximaTrocaEm(intervalo: IntervaloOferta, agora: number = Date.now()): number {
    const ms = intervaloEmMs(intervalo);
    return ms - (agora % ms);
}
