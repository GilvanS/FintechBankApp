import React, { useState } from 'react';
import { X, Loader2, CheckCircle2, AlertTriangle, HeartPulse, FlaskConical, History, Stethoscope } from 'lucide-react';
import { adminUtiRecuperacao, adminUtiHistorico } from '../../services/api';
import { UtiCura, UtiMassa, UtiReport } from '../../types';

interface Props {
    isOpen: boolean;
    isMidnight: boolean;
    onClose: () => void;
}

type Phase = 'idle' | 'simulating' | 'preview' | 'applying' | 'applied' | 'history' | 'error';

const fmtCpf = (cpf: string) => cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
const fmtData = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

const STATUS: Record<UtiMassa['status'], { rotulo: string; cor: string }> = {
    ja_saudavel: { rotulo: 'Já saudável — só sai da UTI', cor: 'bg-emerald-500/20 text-emerald-600' },
    com_plano: { rotulo: 'Será curada', cor: 'bg-amber-500/20 text-amber-600' },
    curada: { rotulo: 'Curada', cor: 'bg-emerald-500/20 text-emerald-600' },
    falhou: { rotulo: 'Falhou', cor: 'bg-[#FF5C8D]/20 text-[#FF5C8D]' },
    nao_verificavel: { rotulo: 'Sem cura automática', cor: 'bg-black/10 opacity-70' },
};

// Massa que um clique em "Curar" consegue tirar da UTI (nada manual/sem handler).
const curavel = (m: UtiMassa) => m.status === 'ja_saudavel'
    || (m.status === 'com_plano' && m.anomalias.every((a) => a.plano && !a.plano.manual));

/**
 * UTI de Recuperação em 2 passos, igual ao Recalcular Limite: SIMULA (lista as massas
 * do cemitério e o que seria feito em cada anomalia, sem gravar) e cura por massa ou
 * todas. Tudo que é aplicado fica no histórico (uti_curas) — aba "Histórico".
 */
const UtiModal: React.FC<Props> = ({ isOpen, isMidnight, onClose }) => {
    const [cpf, setCpf] = useState('');
    const [phase, setPhase] = useState<Phase>('idle');
    const [report, setReport] = useState<UtiReport | null>(null);
    const [historico, setHistorico] = useState<UtiCura[]>([]);
    const [message, setMessage] = useState('');
    const [alvo, setAlvo] = useState<string | null>(null);

    if (!isOpen) return null;

    const cpfDigits = cpf.replace(/\D/g, '');
    const cpfArg = cpfDigits.length === 11 ? cpfDigits : undefined;
    const cpfInvalido = cpfDigits.length > 0 && cpfDigits.length !== 11;

    const cardClass = isMidnight ? 'bg-[#1a1a1a] border border-white/10 text-white' : 'bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black';
    const inputClass = isMidnight ? 'bg-[#252525] border border-white/10 text-white placeholder-white/40 focus:border-volt-green' : 'bg-[#f0f0f0] border-2 border-transparent text-black placeholder-black/40 focus:border-black';
    const primaryBtnClass = isMidnight ? 'bg-volt-green text-black hover:bg-[#a3ff12]' : 'bg-volt-yellow border-2 border-black text-black font-black uppercase hover:bg-volt-yellow-pastel';
    const neutralBtnClass = isMidnight ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-black/5 text-black border border-black/20 hover:bg-black/10';
    const panelClass = isMidnight ? 'bg-black/40' : 'bg-black/5';

    const simular = async () => {
        setPhase('simulating');
        const res = await adminUtiRecuperacao(cpfArg, true);
        if (!res.success || !res.data) { setMessage(res.message || 'Falha ao simular a UTI.'); setPhase('error'); return; }
        setReport(res.data);
        setPhase('preview');
    };

    // cpfAlvo: cura só essa massa; sem ele, cura todas as da simulação (ou o CPF do filtro).
    const curar = async (cpfAlvo?: string) => {
        setAlvo(cpfAlvo || null);
        setPhase('applying');
        const res = await adminUtiRecuperacao(cpfAlvo || cpfArg, false);
        if (!res.success || !res.data) { setMessage(res.message || 'Falha ao curar.'); setPhase('error'); return; }
        setReport(res.data);
        setPhase('applied');
    };

    const verHistorico = async () => {
        setPhase('simulating');
        const res = await adminUtiHistorico(cpfArg);
        if (!res.success || !res.data) { setMessage(res.message || 'Falha ao ler o histórico.'); setPhase('error'); return; }
        setHistorico(res.data);
        setPhase('history');
    };

    const handleClose = () => {
        setCpf(''); setPhase('idle'); setReport(null); setHistorico([]); setMessage(''); setAlvo(null);
        onClose();
    };

    const curaveis = report?.relatorio.filter(curavel) ?? [];

    const resumo = report && (
        <div className="grid grid-cols-4 gap-2 text-center">
            {[
                { label: 'Na UTI', value: report.totalProcessadas },
                { label: report.modo === 'dry-run' ? 'Curáveis' : 'Curadas', value: report.modo === 'dry-run' ? curaveis.length : report.resumo.curadas + report.resumo.semAnomaliaAtual },
                { label: 'Sem cura', value: report.relatorio.filter((m) => !curavel(m) && m.status !== 'curada' && m.status !== 'falhou').length },
                { label: 'Falhas', value: report.resumo.falhas ?? 0 },
            ].map((c) => (
                <div key={c.label} className={`p-2 rounded-xl ${panelClass}`}>
                    <p className="text-[9px] font-black uppercase tracking-wide opacity-60">{c.label}</p>
                    <p className="text-lg font-black tabular-nums">{c.value}</p>
                </div>
            ))}
        </div>
    );

    const lista = (podeCurar: boolean) => (
        <div className={`rounded-xl overflow-auto max-h-80 divide-y ${isMidnight ? 'divide-white/5' : 'divide-black/5'} ${panelClass}`}>
            {report!.relatorio.map((m) => (
                <div key={m.cpf} className="p-3 text-[11px] space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                            <p className="font-bold truncate">{m.nome || '—'}</p>
                            <p className="font-mono opacity-60">{fmtCpf(m.cpf)}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${STATUS[m.status].cor}`}>{STATUS[m.status].rotulo}</span>
                        {podeCurar && curavel(m) && (
                            <button onClick={() => curar(m.cpf)} className={`px-3 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 ${primaryBtnClass}`}>
                                <Stethoscope size={12} /> Curar
                            </button>
                        )}
                    </div>
                    {m.anomalias.map((a, i) => (
                        <div key={`${a.type}-${i}`} className="pl-2 border-l-2 border-current/20">
                            <p><b>{a.type}</b> <span className="opacity-60">— {a.detail}</span></p>
                            {a.plano && (
                                <p className={a.plano.falhou ? 'text-[#FF5C8D]' : 'opacity-80'}>
                                    → {a.plano.acao}{a.plano.erro ? ` (${a.plano.erro})` : ''}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className={`w-full max-w-3xl p-6 rounded-3xl max-h-[92vh] overflow-auto ${cardClass}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 font-black text-sm uppercase">
                        <HeartPulse size={20} />
                        UTI de Recuperação
                    </div>
                    <button onClick={handleClose} className="p-1 opacity-60 hover:opacity-100" aria-label="Fechar">
                        <X size={20} />
                    </button>
                </div>

                {phase === 'idle' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase mb-1 opacity-80">
                                CPF da massa <span className="opacity-60 normal-case">(opcional — vazio mostra todas as massas na UTI)</span>
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
                            Simula primeiro: mostra cada massa do cemitério e o que será feito em cada anomalia. Depois você cura uma
                            massa ou todas. Tudo que for aplicado fica gravado no histórico. Fatura FECHADA nunca é alterada.
                        </p>
                        <div className="flex gap-2 pt-2">
                            <button onClick={verHistorico} disabled={cpfInvalido} className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-40 ${neutralBtnClass}`}>
                                <History size={16} /> Histórico
                            </button>
                            <button onClick={simular} disabled={cpfInvalido} className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-40 ${primaryBtnClass}`}>
                                <FlaskConical size={16} /> Simular
                            </button>
                        </div>
                    </div>
                )}

                {(phase === 'simulating' || phase === 'applying') && (
                    <div className="py-8 flex flex-col items-center gap-3 text-sm opacity-80">
                        <Loader2 size={28} className="animate-spin" />
                        <p>{phase === 'simulating' ? 'Consultando (nada é gravado)...' : `Curando ${alvo ? fmtCpf(alvo) : 'todas as massas curáveis'}...`}</p>
                    </div>
                )}

                {phase === 'preview' && report && (
                    <div className="space-y-4">
                        {resumo}
                        {report.relatorio.length > 0
                            ? lista(true)
                            : <p className="text-sm flex items-center gap-2"><CheckCircle2 size={16} className="text-volt-green" /> Nenhuma massa na UTI.</p>}
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setPhase('idle')} className={`flex-1 py-3 rounded-2xl font-bold ${neutralBtnClass}`}>Voltar</button>
                            <button onClick={() => curar()} disabled={curaveis.length === 0} className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-40 ${primaryBtnClass}`}>
                                <Stethoscope size={16} /> Curar todas ({curaveis.length})
                            </button>
                        </div>
                    </div>
                )}

                {phase === 'applied' && report && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 font-bold text-volt-green">
                            <CheckCircle2 size={20} /> {report.resumo.curadas + report.resumo.semAnomaliaAtual} massa(s) saíram da UTI — gravado no histórico
                        </div>
                        {resumo}
                        {report.relatorio.length > 0 && lista(false)}
                        <div className="flex gap-2 pt-2">
                            <button onClick={verHistorico} className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 ${neutralBtnClass}`}><History size={16} /> Histórico</button>
                            <button onClick={simular} className={`flex-1 py-3 rounded-2xl font-bold ${primaryBtnClass}`}>Simular de novo</button>
                        </div>
                    </div>
                )}

                {phase === 'history' && (
                    <div className="space-y-4">
                        <p className="text-xs font-black uppercase opacity-70">Curas aplicadas{cpfArg ? ` — ${fmtCpf(cpfArg)}` : ''} ({historico.length})</p>
                        {historico.length === 0
                            ? <p className="text-sm opacity-70">Nenhuma cura registrada ainda.</p>
                            : (
                                <div className={`rounded-xl overflow-auto max-h-80 text-[11px] ${panelClass}`}>
                                    {historico.map((h) => (
                                        <div key={h.id} className={`p-2 border-t first:border-t-0 ${isMidnight ? 'border-white/5' : 'border-black/5'}`}>
                                            <p><span className="font-mono opacity-60">{fmtData(h.aplicado_em)}</span> · <b>{h.tipo}</b> · {h.full_name || '—'} <span className="font-mono opacity-60">({fmtCpf(h.cpf)})</span></p>
                                            <p className="opacity-80">{h.acao}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        <button onClick={() => setPhase('idle')} className={`w-full py-3 rounded-2xl font-bold ${neutralBtnClass}`}>Voltar</button>
                    </div>
                )}

                {phase === 'error' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[#FF5C8D] font-bold">
                            <AlertTriangle size={20} /> Erro na UTI
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

export default UtiModal;
