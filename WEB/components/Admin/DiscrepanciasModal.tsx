import React, { useState } from 'react';
import { X, Loader2, CheckCircle2, AlertTriangle, Wrench, FlaskConical } from 'lucide-react';
import { adminAuditFix } from '../../services/api';
import { DiscrepanciaCorrecao, DiscrepanciasReport, DiscrepanciaTipo } from '../../types';

interface Props {
    isOpen: boolean;
    isMidnight: boolean;
    onClose: () => void;
}

type Phase = 'idle' | 'simulating' | 'preview' | 'applying' | 'applied' | 'error';

const brl = (n?: number) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtCpf = (cpf: string) => cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

const TIPO_LABEL: Record<DiscrepanciaTipo, string> = {
    DUPLA_COBRANCA: 'Pago a mais (fechada)',
    PAGAMENTO_EXCESSIVO: 'Pagamento excessivo',
    SALDO_NEGATIVO: 'Saldo negativo',
    LIMITE_NEGATIVO: 'Limite negativo',
};

/**
 * Corrigir Discrepâncias em 2 passos, igual ao Recalcular Limite: SIMULA (mesma
 * detecção/correção do audit_completo.js --fix, sem gravar) e mostra antes × depois
 * de cada correção antes de APLICAR. O modal genérico de scripts aplicava direto e
 * exibia JSON cru (ou o log inteiro, quando o parse falhava).
 */
const DiscrepanciasModal: React.FC<Props> = ({ isOpen, isMidnight, onClose }) => {
    const [cpf, setCpf] = useState('');
    const [phase, setPhase] = useState<Phase>('idle');
    const [report, setReport] = useState<DiscrepanciasReport | null>(null);
    const [message, setMessage] = useState('');

    if (!isOpen) return null;

    const cpfDigits = cpf.replace(/\D/g, '');
    const cpfArg = cpfDigits.length === 11 ? cpfDigits : undefined;
    const cpfInvalido = cpfDigits.length > 0 && cpfDigits.length !== 11;

    const cardClass = isMidnight ? 'bg-[#1a1a1a] border border-white/10 text-white' : 'bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black';
    const inputClass = isMidnight ? 'bg-[#252525] border border-white/10 text-white placeholder-white/40 focus:border-volt-green' : 'bg-[#f0f0f0] border-2 border-transparent text-black placeholder-black/40 focus:border-black';
    const primaryBtnClass = isMidnight ? 'bg-volt-green text-black hover:bg-[#a3ff12]' : 'bg-volt-yellow border-2 border-black text-black font-black uppercase hover:bg-volt-yellow-pastel';
    const neutralBtnClass = isMidnight ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-black/5 text-black border border-black/20 hover:bg-black/10';
    const panelClass = isMidnight ? 'bg-black/40' : 'bg-black/5';
    const rowBorder = isMidnight ? 'border-white/5' : 'border-black/5';

    const run = async (dryRun: boolean) => {
        setPhase(dryRun ? 'simulating' : 'applying');
        const res = await adminAuditFix(cpfArg, dryRun);
        if (!res.success || !res.data) {
            setMessage(res.message || 'Falha ao corrigir discrepâncias.');
            setPhase('error');
            return;
        }
        setReport(res.data);
        setPhase(dryRun ? 'preview' : 'applied');
    };

    const handleClose = () => {
        setCpf('');
        setPhase('idle');
        setReport(null);
        setMessage('');
        onClose();
    };

    const resumo = report && (
        <div className="grid grid-cols-4 gap-2 text-center">
            {[
                { label: 'Anomalias', value: report.anomalias },
                { label: report.modo === 'SIMULACAO' ? 'A corrigir' : 'Corrigidas', value: report.totalCorrecoes },
                { label: 'Manual', value: report.totalPulados },
                { label: 'Erros', value: report.totalErros },
            ].map((c) => (
                <div key={c.label} className={`p-2 rounded-xl ${panelClass}`}>
                    <p className="text-[9px] font-black uppercase tracking-wide opacity-60">{c.label}</p>
                    <p className="text-lg font-black tabular-nums">{c.value}</p>
                </div>
            ))}
        </div>
    );

    const tabela = (itens: DiscrepanciaCorrecao[]) => (
        <div className={`rounded-xl overflow-auto max-h-64 ${panelClass}`}>
            <table className="w-full text-[11px]">
                <thead className="sticky top-0">
                    <tr className={`text-left uppercase text-[9px] font-black tracking-wide ${isMidnight ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
                        <th className="p-2">Massa</th>
                        <th className="p-2">Correção</th>
                        <th className="p-2 text-right">Antes</th>
                        <th className="p-2 text-right">Depois</th>
                    </tr>
                </thead>
                <tbody>
                    {itens.map((c, i) => (
                        <tr key={`${c.tipo}-${c.cpf}-${c.alvo}-${i}`} className={`border-t ${rowBorder}`} title={c.motivo}>
                            <td className="p-2">
                                <p className="font-bold truncate max-w-[9rem]">{c.fullName || '—'}</p>
                                <p className="font-mono opacity-60">{fmtCpf(c.cpf)}</p>
                            </td>
                            <td className="p-2">
                                <p className="font-bold">{TIPO_LABEL[c.tipo]}</p>
                                <p className="opacity-60 truncate max-w-[10rem]">{c.alvo}</p>
                            </td>
                            <td className="p-2 text-right font-mono opacity-70 line-through">{brl(c.antes)}</td>
                            <td className="p-2 text-right font-mono font-bold">
                                {brl(c.depois)}
                                {c.estourado && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#FF5C8D] text-black" title="Dívida real acima do limite total — negativo é o estado correto">
                                        estourado
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const listas = report && (
        <>
            {report.pulados.length > 0 && (
                <div className="text-[11px] space-y-1">
                    <p className="font-black uppercase text-[10px] text-[#FF5C8D]">Exigem análise manual (não serão alteradas)</p>
                    {report.pulados.map((p, i) => (
                        <p key={`${p.cpf}-${i}`} className="opacity-80"><span className="font-mono">{fmtCpf(p.cpf)}</span> — {p.motivo}</p>
                    ))}
                </div>
            )}
            {report.erros.length > 0 && (
                <div className="text-[11px] space-y-1">
                    <p className="font-black uppercase text-[10px] text-[#FF5C8D]">Falharam</p>
                    {report.erros.map((e, i) => (
                        <p key={`${e.cpf}-${i}`} className="font-mono opacity-80">{fmtCpf(e.cpf)} ({TIPO_LABEL[e.etapa as DiscrepanciaTipo] || e.etapa}) — {e.erro}</p>
                    ))}
                </div>
            )}
            {(report.pagamentosSemFatura?.transacoes ?? 0) > 0 && (
                <p className="text-[11px] opacity-60">
                    {report.pagamentosSemFatura!.transacoes} pagamento(s) antigo(s) sem fatura vinculada em{' '}
                    {report.pagamentosSemFatura!.massas} massa(s) ({brl(report.pagamentosSemFatura!.valor)}) — só informativo, sem correção.
                </p>
            )}
            {report.alertas.length > 0 && (
                <details className="text-[11px]">
                    <summary className="cursor-pointer font-black uppercase text-[10px] opacity-70">
                        {report.alertas.length} alerta(s) sem correção automática
                    </summary>
                    <div className={`mt-1 rounded-xl p-2 max-h-32 overflow-auto space-y-1 ${panelClass}`}>
                        {report.alertas.map((a, i) => (
                            <p key={`${a.cpf}-${i}`} className="opacity-80">
                                <span className="font-mono">{fmtCpf(a.cpf)}</span> — {a.motivo} (saldo {brl(a.saldo)}, dívida {brl(a.divida)})
                            </p>
                        ))}
                    </div>
                </details>
            )}
        </>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className={`w-full max-w-2xl p-6 rounded-3xl max-h-[90vh] overflow-auto ${cardClass}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 font-black text-sm uppercase">
                        <Wrench size={20} />
                        Corrigir Discrepâncias
                    </div>
                    <button onClick={handleClose} className="p-1 opacity-60 hover:opacity-100" aria-label="Fechar">
                        <X size={20} />
                    </button>
                </div>

                {phase === 'idle' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase mb-1 opacity-80">
                                CPF da massa <span className="opacity-60 normal-case">(opcional — vazio verifica todas as massas)</span>
                            </label>
                            <input
                                type="text"
                                value={cpf}
                                onChange={(e) => setCpf(e.target.value)}
                                placeholder="000.000.000-00 (deixe vazio para todas)"
                                maxLength={14}
                                className={`w-full p-3 rounded-xl outline-none font-mono ${inputClass}`}
                            />
                            {cpfInvalido && <p className="mt-1 text-[11px] text-[#FF5C8D]">CPF precisa de 11 dígitos.</p>}
                        </div>
                        <p className="text-xs opacity-70">
                            Verifica <b>pago a mais em fatura fechada</b> (massa já cortada: a fechada não muda, o excedente
                            volta ao <b>saldo da conta</b> como lançamento), <b>saldo negativo</b> e <b>limite negativo</b>
                            (recalculado pela fórmula canônica). Primeiro simula e mostra o antes × depois; só grava quando
                            você aplicar.
                        </p>
                        <div className="flex gap-2 pt-2">
                            <button onClick={handleClose} className={`flex-1 py-3 rounded-2xl font-bold ${neutralBtnClass}`}>Cancelar</button>
                            <button
                                onClick={() => run(true)}
                                disabled={cpfInvalido}
                                className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-40 ${primaryBtnClass}`}
                            >
                                <FlaskConical size={16} /> Simular
                            </button>
                        </div>
                    </div>
                )}

                {(phase === 'simulating' || phase === 'applying') && (
                    <div className="py-8 flex flex-col items-center gap-3 text-sm opacity-80">
                        <Loader2 size={28} className="animate-spin" />
                        <p>{phase === 'simulating' ? 'Simulando (nada é gravado)...' : 'Aplicando correções...'}</p>
                        <p className="text-xs opacity-60">{cpfArg ? '1 massa' : 'Todas as massas — pode levar alguns segundos'}</p>
                    </div>
                )}

                {phase === 'preview' && report && (
                    <div className="space-y-4">
                        {resumo}
                        {report.correcoes.length > 0
                            ? tabela(report.correcoes)
                            : <p className="text-sm flex items-center gap-2"><CheckCircle2 size={16} className="text-volt-green" /> Nenhuma discrepância corrigível — nada a aplicar.</p>}
                        {listas}
                        {report.correcoes.length > 1 && (
                            <p className="text-[11px] opacity-60">
                                As correções são aplicadas em sequência (o estorno de pagamento excessivo credita o saldo antes da
                                checagem de saldo negativo), então o resultado final pode diferir um pouco da prévia.
                            </p>
                        )}
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setPhase('idle')} className={`flex-1 py-3 rounded-2xl font-bold ${neutralBtnClass}`}>Voltar</button>
                            <button
                                onClick={() => run(false)}
                                disabled={report.totalCorrecoes === 0}
                                className={`flex-1 py-3 rounded-2xl font-bold disabled:opacity-40 ${primaryBtnClass}`}
                            >
                                Aplicar correções ({report.totalCorrecoes})
                            </button>
                        </div>
                    </div>
                )}

                {phase === 'applied' && report && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 font-bold text-volt-green">
                            <CheckCircle2 size={20} /> {report.totalCorrecoes} correção(ões) aplicada(s)
                        </div>
                        {resumo}
                        {report.correcoes.length > 0 && tabela(report.correcoes)}
                        {listas}
                        <button onClick={handleClose} className={`w-full py-3 rounded-2xl font-bold ${neutralBtnClass}`}>Fechar</button>
                    </div>
                )}

                {phase === 'error' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[#FF5C8D] font-bold">
                            <AlertTriangle size={20} /> Erro ao corrigir discrepâncias
                        </div>
                        <p className="text-xs opacity-80">{message}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setPhase('idle')} className={`flex-1 py-3 rounded-2xl font-bold ${neutralBtnClass}`}>Voltar</button>
                            <button onClick={handleClose} className={`flex-1 py-3 rounded-2xl font-bold ${neutralBtnClass}`}>Fechar</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DiscrepanciasModal;
