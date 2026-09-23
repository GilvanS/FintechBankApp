import React, { useState } from 'react';
import { X, Loader2, CheckCircle2, AlertTriangle, Scale, FlaskConical } from 'lucide-react';
import { adminRecalcularLimiteDisponivel } from '../../services/api';
import { LimiteRecalculoItem, LimiteRecalculoReport } from '../../types';

interface Props {
    isOpen: boolean;
    isMidnight: boolean;
    onClose: () => void;
}

type Phase = 'idle' | 'simulating' | 'preview' | 'applying' | 'applied' | 'error';

const brl = (n?: number) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtCpf = (cpf: string) => cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

/**
 * Recalcular Limite Disponível em 2 passos: SIMULA (mesma fórmula canônica, sem gravar)
 * e mostra quem diverge — banco × correto — antes de APLICAR. O modal genérico de
 * scripts só aplicava direto e exibia JSON cru.
 */
const LimiteDisponivelModal: React.FC<Props> = ({ isOpen, isMidnight, onClose }) => {
    const [cpf, setCpf] = useState('');
    const [phase, setPhase] = useState<Phase>('idle');
    const [report, setReport] = useState<LimiteRecalculoReport | null>(null);
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

    const run = async (dryRun: boolean) => {
        setPhase(dryRun ? 'simulating' : 'applying');
        const res = await adminRecalcularLimiteDisponivel(cpfArg, dryRun);
        if (!res.success || !res.data) {
            setMessage(res.message || 'Falha ao recalcular o limite disponível.');
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

    const divergentes = report?.detalhes.filter((d) => !d.erro) ?? [];
    const comErro = report?.detalhes.filter((d) => d.erro) ?? [];

    const resumo = report && (
        <div className="grid grid-cols-4 gap-2 text-center">
            {[
                { label: 'Verificadas', value: report.totalVerificado },
                { label: report.modo === 'SIMULACAO' ? 'Divergentes' : 'Corrigidas', value: report.divergentes },
                { label: 'Estouradas', value: report.estourados },
                { label: 'Erros', value: report.erros },
            ].map((c) => (
                <div key={c.label} className={`p-2 rounded-xl ${panelClass}`}>
                    <p className="text-[9px] font-black uppercase tracking-wide opacity-60">{c.label}</p>
                    <p className="text-lg font-black tabular-nums">{c.value}</p>
                </div>
            ))}
        </div>
    );

    const tabela = (itens: LimiteRecalculoItem[]) => (
        <div className={`rounded-xl overflow-auto max-h-64 ${panelClass}`}>
            <table className="w-full text-[11px]">
                <thead className="sticky top-0">
                    <tr className={`text-left uppercase text-[9px] font-black tracking-wide ${isMidnight ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
                        <th className="p-2">Massa</th>
                        <th className="p-2 text-right">Banco</th>
                        <th className="p-2 text-right">Correto</th>
                        <th className="p-2 text-right">Fatura aberta</th>
                    </tr>
                </thead>
                <tbody>
                    {itens.map((d) => (
                        <tr key={d.cpf} className={`border-t ${isMidnight ? 'border-white/5' : 'border-black/5'}`}>
                            <td className="p-2">
                                <p className="font-bold truncate max-w-[10rem]">{d.fullName || '—'}</p>
                                <p className="font-mono opacity-60">{fmtCpf(d.cpf)}</p>
                            </td>
                            <td className="p-2 text-right font-mono opacity-70 line-through">{brl(d.limiteAnterior)}</td>
                            <td className="p-2 text-right font-mono font-bold">
                                {brl(d.limiteNovo)}
                                {d.estourado && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#FF5C8D] text-black" title="Dívida real acima do limite total — negativo é o estado correto">
                                        estourado
                                    </span>
                                )}
                            </td>
                            <td className="p-2 text-right font-mono opacity-70">{brl(d.currentInvoiceTotal)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const listaErros = comErro.length > 0 && (
        <div className="text-[11px] space-y-1">
            <p className="font-black uppercase text-[10px] text-[#FF5C8D]">Falharam ao calcular</p>
            {comErro.map((d) => (
                <p key={d.cpf} className="font-mono opacity-80">{fmtCpf(d.cpf)} — {d.erro}</p>
            ))}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className={`w-full max-w-2xl p-6 rounded-3xl ${cardClass}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 font-black text-sm uppercase">
                        <Scale size={20} />
                        Recalcular Limite Disponível
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
                            Fórmula canônica: <b>limite total − fatura aberta</b> (mesma fonte do "Próxima Fatura"). Primeiro
                            simula e mostra quem está errado; só grava quando você aplicar. Negativo é válido quando a dívida
                            real passou do limite total.
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
                        <p>{phase === 'simulating' ? 'Simulando (nada é gravado)...' : 'Aplicando correção...'}</p>
                        <p className="text-xs opacity-60">{cpfArg ? '1 massa' : 'Todas as massas — pode levar alguns segundos'}</p>
                    </div>
                )}

                {phase === 'preview' && report && (
                    <div className="space-y-4">
                        {resumo}
                        {divergentes.length > 0
                            ? tabela(divergentes)
                            : <p className="text-sm flex items-center gap-2"><CheckCircle2 size={16} className="text-volt-green" /> Nenhuma divergência — nada a corrigir.</p>}
                        {listaErros}
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setPhase('idle')} className={`flex-1 py-3 rounded-2xl font-bold ${neutralBtnClass}`}>Voltar</button>
                            <button
                                onClick={() => run(false)}
                                disabled={report.divergentes === 0}
                                className={`flex-1 py-3 rounded-2xl font-bold disabled:opacity-40 ${primaryBtnClass}`}
                            >
                                Aplicar correção ({report.divergentes})
                            </button>
                        </div>
                    </div>
                )}

                {phase === 'applied' && report && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 font-bold text-volt-green">
                            <CheckCircle2 size={20} /> {report.divergentes} massa(s) corrigida(s)
                        </div>
                        {resumo}
                        {divergentes.length > 0 && tabela(divergentes)}
                        {listaErros}
                        <button onClick={handleClose} className={`w-full py-3 rounded-2xl font-bold ${neutralBtnClass}`}>Fechar</button>
                    </div>
                )}

                {phase === 'error' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[#FF5C8D] font-bold">
                            <AlertTriangle size={20} /> Erro ao recalcular
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

export default LimiteDisponivelModal;
