import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Painel "Pendências encontradas" da aba Auditoria: uma linha por problema achado, com o que ele
 * significa, quantas massas, quais CPFs (e o valor divergente), o botão de correção (quando existe
 * cura automática) e o resultado da revalidação depois de corrigir (antes → depois).
 */

export interface PendenciaDetalhe {
    cpf: string;
    texto: string;
}

export interface Pendencia {
    id: string;
    titulo: string;
    /** Em linguagem simples: o que é e por que aparece. */
    descricao: string;
    contagem: number;
    detalhes: PendenciaDetalhe[];
    /** Cura automática. Sem ela, `semCura` explica o que fazer. */
    acao?: { rotulo: string; run: () => Promise<string> };
    semCura?: string;
}

export interface ResultadoCorrecao {
    antes: number;
    depois: number;
    mensagem: string;
}

const fmt = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

interface AuditResults {
    consistency?: any;
    doubleCount?: any;
    csv?: any;
    ciclos?: any;
    charges?: any;
}

/** Converte o retorno bruto das auditorias na lista de pendências exibida. */
export function buildPendencias(
    r: AuditResults,
    acoes: { sincronizarDias: () => Promise<string>; curarCiclos: () => Promise<string>; corrigirEncargos: () => Promise<string> },
): Pendencia[] {
    const cons = r.consistency;
    const consN = (cons?.summary?.usersDesatualizados ?? 0) + (cons?.summary?.invoicesDesatualizadas ?? 0);

    const dc = r.doubleCount;
    const dcN = dc?.discrepancies ?? 0;

    const csv = r.csv;
    const csvN = csv?.summary?.divergent ?? 0;

    const ciclos = r.ciclos;
    const ciclosN = ciclos?.summary?.divergent ?? 0;

    const ch = r.charges;
    const chN = ch?.summary?.divergent ?? 0;

    return [
        {
            id: 'ciclos',
            titulo: 'Ciclo de fatura não fechado',
            descricao: 'O vencimento do cartão já avançou um mês, mas a fatura do ciclo anterior nunca foi fechada. O app soma dois ciclos na fatura aberta e o valor diverge do CSV.',
            contagem: ciclosN,
            detalhes: (ciclos?.details ?? []).map((d: any) => ({
                cpf: d.cpf,
                texto: `vencimento em ${String(d.dueAtual).slice(0, 10)} (esperado ${String(d.dueEsperado).slice(0, 10)}), ${fmt(d.valorNaoFaturado)} sem fatura fechada${d.curavelAuto ? '' : ' — muitos ciclos: regenerar a massa'}`,
            })),
            acao: { rotulo: 'Fechar ciclos pendentes', run: acoes.curarCiclos },
        },
        {
            id: 'consistencia',
            titulo: 'Dias de atraso desatualizados',
            descricao: 'Os dias de atraso gravados no usuário ou na fatura não batem com o calculado hoje. Afeta multa, juros e o status da massa.',
            contagem: consN,
            detalhes: (cons?.details ?? []).map((d: any) => ({
                cpf: d.cpf,
                texto: `atraso gravado: usuário ${d.userDaysOverdue}d, fatura ${d.invoiceDiasAtraso}d — real hoje: ${d.realTimeDays}d`,
            })),
            acao: { rotulo: 'Sincronizar dias de atraso', run: acoes.sincronizarDias },
        },
        {
            id: 'encargos',
            titulo: 'Encargos divergentes',
            descricao: 'Multa, juros ou IOF pendentes gravados diferem do que deveria valer pelos dias de atraso reais.',
            contagem: chN,
            detalhes: (ch?.details ?? []).filter((d: any) => d.divergence).map((d: any) => ({
                cpf: d.cpf,
                texto: `encargos gravados ${fmt(d.stored?.total)} × esperados ${fmt(d.computed?.total)} (dif ${fmt(d.diff?.total)})`,
            })),
            acao: { rotulo: 'Recalcular encargos', run: acoes.corrigirEncargos },
        },
        {
            id: 'csv',
            titulo: 'CSV de massas diferente do backend',
            descricao: 'Fatura aberta ou fechada do CSV não bate com o que o app calcula. Se o CPF também aparece em "Ciclo de fatura não fechado", corrija lá primeiro; se não, é problema na query do CSV.',
            contagem: csvN,
            detalhes: (csv?.details ?? []).map((d: any) => ({
                cpf: d.cpf,
                texto: `aberta: CSV ${fmt(d.csvAberta)} × app ${fmt(d.realAberta)} (dif ${fmt(d.diffAberta)}); fechada: CSV ${fmt(d.csvFechada)} × app ${fmt(d.realFechada)} (dif ${fmt(d.diffFechada)}) — status ${d.statusCsv}`,
            })),
            semCura: 'Não há botão: o CSV é só leitura do banco. Corrija a causa (ciclo não fechado, encargos, dias de atraso) e atualize.',
        },
        {
            id: 'double',
            titulo: 'Pagamento contado em duplicidade',
            descricao: 'A soma dos pagamentos registrados não bate com o valor pago nas faturas (pagamento aplicado duas vezes ou faltando).',
            contagem: dcN,
            detalhes: (dc?.details ?? []).filter((d: any) => d.status && d.status !== 'ok').map((d: any) => ({
                cpf: d.cpf,
                texto: `pagamentos ${fmt(d.paymentTotal)} × pago nas faturas ${fmt(d.invoiceTotalPago)} (dif ${fmt(d.diff)})`,
            })),
            semCura: 'Correção assistida: use "Corrigir Discrepâncias" no Admin, simulando com o CPF antes de aplicar.',
        },
    ];
}

interface Props {
    pendencias: Pendencia[];
    resultados: Record<string, ResultadoCorrecao>;
    executando: string | null;
    loading: boolean;
    isMidnight: boolean;
    onCorrigir: (p: Pendencia) => void;
    onEscolherCpf: (cpf: string) => void;
}

const AuditPendencias: React.FC<Props> = ({ pendencias, resultados, executando, loading, isMidnight, onCorrigir, onEscolherCpf }) => {
    const [abertos, setAbertos] = useState<Record<string, boolean>>({});
    const total = pendencias.reduce((s, p) => s + p.contagem, 0);
    const cardCls = `p-5 rounded-3xl border ${isMidnight ? 'bg-[#151515] border-white/10 text-white' : 'bg-white border-black/10 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`;
    const btnPrimary = isMidnight ? 'bg-volt-green text-black focus-visible:outline-volt-green' : 'bg-black text-white focus-visible:outline-black';
    const btnGhost = isMidnight ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-black/10 text-black hover:bg-black/20';

    return (
        <section className={cardCls} aria-labelledby="audit-pendencias-title">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <h2 id="audit-pendencias-title" className="text-sm font-black uppercase tracking-tight">Pendências encontradas</h2>
                {loading ? (
                    <span className="text-xs opacity-60">Consultando…</span>
                ) : total === 0 ? (
                    <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5"><CheckCircle2 size={14} /> Nenhuma inconsistência encontrada</span>
                ) : (
                    <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5"><AlertTriangle size={14} /> {total} massa(s) com problema — corrija abaixo</span>
                )}
            </div>

            <ul className="space-y-3">
                {pendencias.map((p) => {
                    const res = resultados[p.id];
                    const aberto = !!abertos[p.id];
                    const ok = p.contagem === 0;
                    return (
                        <li key={p.id} className={`p-3.5 rounded-2xl border ${isMidnight ? 'border-white/10 bg-white/5' : 'border-black/10 bg-gray-50'}`}>
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex-1 min-w-[220px]">
                                    <p className="text-xs font-bold uppercase tracking-wide flex items-center gap-2 flex-wrap">
                                        {ok ? <CheckCircle2 size={14} className="text-emerald-500" /> : <AlertTriangle size={14} className="text-amber-500" />}
                                        {p.titulo}
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${ok ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
                                            {ok ? 'OK' : `${p.contagem} massa(s)`}
                                        </span>
                                    </p>
                                    <p className="text-xs opacity-70 mt-1">{p.descricao}</p>
                                </div>
                                {!ok && (
                                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                        {p.detalhes.length > 0 && (
                                            <button
                                                onClick={() => setAbertos((s) => ({ ...s, [p.id]: !aberto }))}
                                                aria-expanded={aberto}
                                                className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold ${btnGhost}`}
                                            >
                                                {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {aberto ? 'Ocultar CPFs' : 'Ver CPFs'}
                                            </button>
                                        )}
                                        {p.acao && (
                                            <button
                                                onClick={() => onCorrigir(p)}
                                                disabled={executando !== null}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${btnPrimary}`}
                                            >
                                                <RefreshCw size={14} className={executando === p.id ? 'animate-spin motion-reduce:animate-none' : ''} />
                                                {executando === p.id ? 'Corrigindo…' : p.acao.rotulo}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {!ok && !p.acao && p.semCura && <p className="text-xs opacity-60 mt-2">{p.semCura}</p>}

                            {aberto && p.detalhes.length > 0 && (
                                <ul className="mt-3 space-y-1 max-h-56 overflow-y-auto text-xs">
                                    {p.detalhes.slice(0, 50).map((d) => (
                                        <li key={d.cpf} className="flex items-start gap-2">
                                            <button
                                                onClick={() => onEscolherCpf(d.cpf)}
                                                title="Usar este CPF no filtro da aba Correções"
                                                className="font-bold underline tabular-nums shrink-0"
                                            >
                                                {d.cpf}
                                            </button>
                                            <span className="opacity-80">{d.texto}</span>
                                        </li>
                                    ))}
                                    {p.contagem > p.detalhes.length && (
                                        <li className="opacity-60">… e mais {p.contagem - p.detalhes.length} massa(s) (a lista mostra até 50).</li>
                                    )}
                                </ul>
                            )}

                            {res && (
                                <p className={`text-xs font-bold mt-3 flex items-center gap-1.5 flex-wrap ${res.depois === 0 ? 'text-emerald-500' : res.depois < res.antes ? 'text-amber-500' : 'text-red-500'}`}>
                                    {res.depois === 0 ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                                    {res.depois === 0
                                        ? `Corrigido e validado: ${res.antes} → 0 pendência(s).`
                                        : res.depois < res.antes
                                            ? `Corrigido em parte: ${res.antes} → ${res.depois} pendência(s) ainda restam.`
                                            : `Não resolveu: continuam ${res.depois} pendência(s).`}
                                    <span className="font-normal opacity-70">{res.mensagem}</span>
                                </p>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

export default AuditPendencias;
