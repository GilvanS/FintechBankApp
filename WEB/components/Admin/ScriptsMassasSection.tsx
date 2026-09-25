import React, { useState } from 'react';
import { Wrench, RefreshCw, FileText, BarChart3, CreditCard, AlertTriangle, Download, Scale, HeartPulse } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import {
    adminSyncOverdueDays, adminInvoicePdfPreview, adminMassaReport,
    adminActivatePendingCards, adminExportMassasCsv,
} from '../../services/api';
import ScriptActionModal, { ScriptActionResult } from './ScriptActionModal';
import LimiteDisponivelModal from './LimiteDisponivelModal';
import DiscrepanciasModal from './DiscrepanciasModal';
import UtiModal from './UtiModal';

type ScriptKey = 'audit-fix' | 'sync-overdue' | 'pdf-preview' | 'report' | 'activate-cards' | 'export-csv' | 'recalcular-limite' | 'uti-recuperacao' | null;

/** Cards de ação que rodam scripts de API/scripts/ direto do painel Admin —
 *  mesma lógica dos scripts de terminal, sem precisar abrir shell. */
const ScriptsMassasSection: React.FC = () => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const [activeScript, setActiveScript] = useState<ScriptKey>(null);

    const cardClass = isMidnight ? 'bg-[#1a1a1a] border border-white/10 text-white' : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black';
    const primaryBtnClass = isMidnight ? 'bg-volt-green text-black hover:bg-[#a3ff12]' : 'bg-volt-yellow border-2 border-black text-black font-black uppercase hover:bg-volt-yellow-pastel';

    const actions = [
        {
            key: 'audit-fix' as const,
            icon: Wrench,
            iconBg: 'bg-amber-500',
            title: 'Corrigir Discrepâncias',
            description: 'Simula primeiro e mostra o antes × depois de cada correção (pago a mais em fatura fechada → volta ao saldo, saldo negativo, limite negativo); só grava quando você aplicar. CPF opcional: vazio verifica todas as massas.',
            cpfMode: 'optional' as const,
            onClick: () => setActiveScript('audit-fix'),
        },
        {
            key: 'sync-overdue' as const,
            icon: RefreshCw,
            iconBg: 'bg-blue-500',
            title: 'Ressincronizar Dias de Atraso',
            description: 'Recalcula days_overdue/account_status de uma massa específica, sem rodar o ciclo completo.',
            cpfMode: 'required' as const,
            onClick: () => setActiveScript('sync-overdue'),
        },
        {
            key: 'pdf-preview' as const,
            icon: FileText,
            iconBg: 'bg-purple-500',
            title: 'Prévia de Fatura em PDF',
            description: 'Gera o PDF local da fatura de uma massa, sem enviar ao Telegram.',
            cpfMode: 'required' as const,
            onClick: () => setActiveScript('pdf-preview'),
        },
        {
            key: 'report' as const,
            icon: BarChart3,
            iconBg: 'bg-cyan-500',
            title: 'Relatório de Massa',
            description: 'Exporta relatório HTML com dados ao vivo de uma massa em atraso.',
            cpfMode: 'required' as const,
            onClick: () => setActiveScript('report'),
        },
        {
            key: 'activate-cards' as const,
            icon: CreditCard,
            iconBg: 'bg-rose-500',
            title: 'Ativar Cartões Pendentes',
            description: 'Ativa cartões em "manufacturing". CPF opcional: vazio ativa todos os pendentes da base.',
            cpfMode: 'optional' as const,
            onClick: () => setActiveScript('activate-cards'),
        },
        {
            key: 'export-csv' as const,
            icon: Download,
            iconBg: 'bg-emerald-500',
            title: 'Exportar CSV (Planilha de Teste)',
            description: 'Gera o CSV de massas (saldo, limites, fatura, cartão) para colar na TBL_DE_MASSAS. CPF opcional: vazio exporta todas.',
            cpfMode: 'optional' as const,
            onClick: () => setActiveScript('export-csv'),
        },
        {
            key: 'recalcular-limite' as const,
            icon: Scale,
            iconBg: 'bg-indigo-500',
            title: 'Recalcular Limite Disponível',
            description: 'Simula primeiro e mostra quem está com limite errado (banco × correto) pela fórmula canônica (limite total − fatura aberta); só grava quando você aplicar. Negativo é válido quando o limite estourou de verdade. CPF opcional: vazio verifica todas as massas.',
            cpfMode: 'optional' as const,
            onClick: () => setActiveScript('recalcular-limite'),
        },
        {
            key: 'uti-recuperacao' as const,
            icon: HeartPulse,
            iconBg: 'bg-red-500',
            title: 'UTI de Recuperação',
            description: 'Simula primeiro e lista as massas do cemitério com o que será feito em cada anomalia; cure uma massa ou todas. Tudo que é aplicado fica no histórico. CPF opcional: vazio mostra todas as massas na UTI.',
            cpfMode: 'optional' as const,
            onClick: () => setActiveScript('uti-recuperacao'),
        },
    ];

    return (
        <div className="p-6 w-full mx-auto space-y-6 animate-fade-in pb-24">
            <div className={`p-8 rounded-3xl ${cardClass} mb-6`}>
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-black/10 dark:border-white/10">
                    <div className={`p-4 rounded-xl ${isMidnight ? 'bg-white/5 text-volt-green' : 'bg-black/5 text-black'}`}>
                        <Wrench size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight">Scripts & Massas</h2>
                        <p className="opacity-70 text-sm md:text-base mt-1">
                            Ferramentas de manutenção e controle de massas de teste — mesma lógica dos scripts de terminal.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {actions.map(action => (
                        <div key={action.key} className={`p-5 rounded-2xl border ${isMidnight ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${action.iconBg}`}>
                                    <action.icon size={20} className="text-white" />
                                </div>
                                <h3 className="font-black text-sm uppercase">{action.title}</h3>
                            </div>
                            <p className="text-xs opacity-70 mb-4">{action.description}</p>
                            <button
                                onClick={action.onClick}
                                className={`w-full py-2.5 rounded-xl font-bold text-sm ${primaryBtnClass}`}
                            >
                                {action.cpfMode ? 'Informar CPF' : 'Executar'}
                            </button>
                        </div>
                    ))}
                </div>

                <div className={`mt-6 p-3 rounded-xl text-xs flex items-center gap-2 ${isMidnight ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-100 text-amber-800'}`}>
                    <AlertTriangle size={16} className="shrink-0" />
                    Ações desta aba sempre pedem confirmação — algumas afetam múltiplas massas de uma vez.
                </div>
            </div>

            <DiscrepanciasModal
                isOpen={activeScript === 'audit-fix'}
                isMidnight={isMidnight}
                onClose={() => setActiveScript(null)}
            />

            <ScriptActionModal
                isOpen={activeScript === 'sync-overdue'}
                title="Ressincronizar Dias de Atraso"
                icon={RefreshCw}
                description="Recalcula days_overdue/account_status com base na data atual, sem rodar o ciclo de faturamento completo."
                cpfMode="required"
                isMidnight={isMidnight}
                onClose={() => setActiveScript(null)}
                onExecute={async (cpf): Promise<ScriptActionResult> => adminSyncOverdueDays(cpf!)}
            />

            <ScriptActionModal
                isOpen={activeScript === 'pdf-preview'}
                title="Prévia de Fatura em PDF"
                icon={FileText}
                description="Gera o PDF local da fatura desta massa (aberta e fechada), sem enviar ao Telegram."
                cpfMode="required"
                isMidnight={isMidnight}
                onClose={() => setActiveScript(null)}
                onExecute={async (cpf): Promise<ScriptActionResult> => adminInvoicePdfPreview(cpf!)}
            />

            <ScriptActionModal
                isOpen={activeScript === 'report'}
                title="Relatório de Massa"
                icon={BarChart3}
                description="Gera relatório HTML com dados ao vivo desta massa em atraso."
                cpfMode="required"
                isMidnight={isMidnight}
                onClose={() => setActiveScript(null)}
                onExecute={async (cpf): Promise<ScriptActionResult> => adminMassaReport(cpf!)}
            />

            <ScriptActionModal
                isOpen={activeScript === 'activate-cards'}
                title="Ativar Cartões Pendentes"
                icon={CreditCard}
                confirmLabel="Confirmar"
                description="Sem CPF, afeta TODOS os cartões em status 'manufacturing' na base. Não é possível desfazer."
                cpfMode="optional"
                isMidnight={isMidnight}
                onClose={() => setActiveScript(null)}
                onExecute={async (cpf): Promise<ScriptActionResult> => adminActivatePendingCards(cpf)}
            />

            <ScriptActionModal
                isOpen={activeScript === 'export-csv'}
                title="Exportar CSV (Planilha de Teste)"
                icon={Download}
                confirmLabel="Gerar CSV"
                description="Sem CPF, exporta todas as massas (customer/user). Com CPF, exporta só essa massa."
                cpfMode="optional"
                isMidnight={isMidnight}
                onClose={() => setActiveScript(null)}
                onExecute={async (cpf): Promise<ScriptActionResult> => adminExportMassasCsv(cpf)}
            />

            <LimiteDisponivelModal
                isOpen={activeScript === 'recalcular-limite'}
                isMidnight={isMidnight}
                onClose={() => setActiveScript(null)}
            />

            <UtiModal
                isOpen={activeScript === 'uti-recuperacao'}
                isMidnight={isMidnight}
                onClose={() => setActiveScript(null)}
            />
        </div>
    );
};

export default ScriptsMassasSection;
