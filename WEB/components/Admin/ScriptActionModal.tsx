import React, { useState } from 'react';
import { X, Loader2, CheckCircle2, AlertTriangle, Download } from 'lucide-react';

export type ScriptActionResult = { success: boolean; data?: any; message?: string };

interface ScriptActionModalProps {
    isOpen: boolean;
    title: string;
    icon: React.ElementType;
    description: string;
    /** 'required' bloqueia Executar sem CPF; 'optional' mostra o campo mas
     *  permite rodar vazio (ação geral); undefined = sem campo de CPF. */
    cpfMode?: 'required' | 'optional';
    /** Conteúdo extra mostrado antes de confirmar (ex.: lista de CPFs afetados numa ação bulk). */
    preview?: React.ReactNode;
    /** Texto do botão de confirmação (default "Executar"). */
    confirmLabel?: string;
    isMidnight: boolean;
    onClose: () => void;
    onExecute: (cpf?: string) => Promise<ScriptActionResult>;
}

/** Modal genérico reaproveitado pelas 5 ações de "Scripts & Massas": estado
 *  local antes (input) → durante (loading) → depois (resultado formatado). */
const ScriptActionModal: React.FC<ScriptActionModalProps> = ({
    isOpen, title, icon: Icon, description, cpfMode, preview, confirmLabel = 'Executar',
    isMidnight, onClose, onExecute,
}) => {
    const [cpf, setCpf] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
    const [result, setResult] = useState<ScriptActionResult | null>(null);

    if (!isOpen) return null;

    const cardClass = isMidnight ? 'bg-[#1a1a1a] border border-white/10 text-white' : 'bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black';
    const inputClass = isMidnight ? 'bg-[#252525] border border-white/10 text-white placeholder-white/40 focus:border-volt-green' : 'bg-[#f0f0f0] border-2 border-transparent text-black placeholder-black/40 focus:border-black';
    const primaryBtnClass = isMidnight ? 'bg-volt-green text-black hover:bg-[#a3ff12]' : 'bg-volt-yellow border-2 border-black text-black font-black uppercase hover:bg-volt-yellow-pastel';
    const neutralBtnClass = isMidnight ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-black/5 text-black border border-black/20 hover:bg-black/10';

    const cpfDigits = cpf.replace(/\D/g, '');
    const cpfBlocksExecute = cpfMode === 'required' && cpfDigits.length !== 11;

    const handleExecute = async () => {
        if (cpfBlocksExecute) return;
        setStatus('loading');
        const res = await onExecute(cpfDigits.length === 11 ? cpf : undefined);
        setResult(res);
        setStatus(res.success ? 'done' : 'error');
    };

    const handleDownloadCsv = () => {
        if (!result?.data?.csv) return;
        const blob = new Blob([result.data.csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tbl_de_massas_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const handleClose = () => {
        setCpf('');
        setStatus('idle');
        setResult(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className={`w-full max-w-lg p-6 rounded-3xl ${cardClass}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 font-black text-sm uppercase">
                        <Icon size={20} />
                        {title}
                    </div>
                    <button onClick={handleClose} className="p-1 opacity-60 hover:opacity-100" aria-label="Fechar">
                        <X size={20} />
                    </button>
                </div>

                {status === 'idle' && (
                    <div className="space-y-4">
                        {cpfMode && (
                            <div>
                                <label className="block text-xs font-bold uppercase mb-1 opacity-80">
                                    CPF da massa {cpfMode === 'optional' && <span className="opacity-60 normal-case">(opcional — vazio roda geral, em todas as massas)</span>}
                                </label>
                                <input
                                    type="text"
                                    value={cpf}
                                    onChange={(e) => setCpf(e.target.value)}
                                    placeholder="000.000.000-00 (deixe vazio para todas)"
                                    maxLength={14}
                                    className={`w-full p-3 rounded-xl outline-none font-mono ${inputClass}`}
                                />
                            </div>
                        )}
                        {preview}
                        <p className="text-xs opacity-70">{description}</p>
                        <div className="flex gap-2 pt-2">
                            <button onClick={handleClose} className={`flex-1 py-3 rounded-2xl font-bold ${neutralBtnClass}`}>Cancelar</button>
                            <button
                                onClick={handleExecute}
                                disabled={cpfBlocksExecute}
                                className={`flex-1 py-3 rounded-2xl font-bold disabled:opacity-40 ${primaryBtnClass}`}
                            >
                                {confirmLabel}
                            </button>
                        </div>
                    </div>
                )}

                {status === 'loading' && (
                    <div className="py-8 flex flex-col items-center gap-3 text-sm opacity-80">
                        <Loader2 size={28} className="animate-spin" />
                        <p>Executando script...</p>
                        <p className="text-xs opacity-60">(pode levar alguns segundos)</p>
                    </div>
                )}

                {status === 'done' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-emerald-500 font-bold">
                            <CheckCircle2 size={20} /> Executado com sucesso
                        </div>
                        {typeof result?.data?.csv === 'string' ? (
                            <p className="text-sm">{result.data.count} massa(s) encontrada(s) — pronto para baixar.</p>
                        ) : (
                            <pre className={`text-[11px] font-mono p-3 rounded-xl overflow-auto max-h-64 whitespace-pre-wrap ${isMidnight ? 'bg-black/40' : 'bg-black/5'}`}>
                                {typeof result?.data?.log === 'string' ? result.data.log : JSON.stringify(result?.data, null, 2)}
                            </pre>
                        )}
                        {typeof result?.data?.csv === 'string' && (
                            <button onClick={handleDownloadCsv} className={`w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 ${primaryBtnClass}`}>
                                <Download size={16} /> Baixar CSV
                            </button>
                        )}
                        <button onClick={handleClose} className={`w-full py-3 rounded-2xl font-bold ${neutralBtnClass}`}>Fechar</button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-red-500 font-bold">
                            <AlertTriangle size={20} /> Erro ao executar
                        </div>
                        <p className="text-xs opacity-80">{result?.message}</p>
                        <button onClick={handleClose} className={`w-full py-3 rounded-2xl font-bold ${neutralBtnClass}`}>Fechar</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScriptActionModal;
