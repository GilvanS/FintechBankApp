import React, { useState } from 'react';
import {
    adminSeedTestScenario,
    adminSaveAsMock,
    adminClearMockBaseline,
    adminResetTestData,
} from '../../services/api';
import AuditResultCard from './AuditResultCard';

interface BillingMockSectionProps {
    isMidnight: boolean;
    titleClass: string;
    subTextClass: string;
    innerCardClass: string;
    btnTypographyClass: string;
    btnTypographySmallClass: string;
    primaryOutlineBtnClass: string;
    dangerOutlineBtnClass: string;
    neutralBtnClass: string;
    onOpenModal: (action: string, data?: any) => void;
}

const BillingMockSection: React.FC<BillingMockSectionProps> = ({
    isMidnight, titleClass, subTextClass, innerCardClass,
    btnTypographyClass, btnTypographySmallClass,
    primaryOutlineBtnClass, dangerOutlineBtnClass, neutralBtnClass,
    onOpenModal
}) => {
    const [billingCpf, setBillingCpf] = useState('11111111111');
    const [billingLoading, setBillingLoading] = useState(false);
    const [billingMsg, setBillingMsg] = useState<{ text: string; ok: boolean } | null>(null);
    const [auditResult, setAuditResult] = useState<any>(null);

    const applyBillingScenario = async (scenario: string) => {
        setBillingLoading(true); setBillingMsg(null);
        const res = await adminSeedTestScenario(billingCpf || null, scenario);
        setBillingMsg({ text: res.success ? `Cenário "${scenario}" aplicado.` : res.message || 'Erro.', ok: !!res.success });
        setBillingLoading(false);
    };
    const saveBillingBaseline = async () => {
        if (!billingCpf) return;
        setBillingLoading(true); setBillingMsg(null);
        const res = await adminSaveAsMock(billingCpf);
        setBillingMsg({ text: res.success ? 'Baseline salvo. Reset restaurará este estado.' : res.message || 'Erro.', ok: !!res.success });
        setBillingLoading(false);
    };
    const clearBillingBaseline = async () => {
        if (!billingCpf) return;
        setBillingLoading(true); setBillingMsg(null);
        const res = await adminClearMockBaseline(billingCpf);
        setBillingMsg({ text: res.success ? 'Baseline limpo. Reset usará o padrão.' : res.message || 'Erro.', ok: !!res.success });
        setBillingLoading(false);
    };
    const resetAllTestData = async () => {
        setBillingLoading(true); setBillingMsg(null);
        const res = await adminResetTestData();
        setBillingMsg({ text: res.success ? 'Dados de teste resetados.' : res.message || 'Erro.', ok: !!res.success });
        setBillingLoading(false);
    };

    const handleAuditConsistency = async () => {
        const { adminAuditConsistency } = await import('../../services/api');
        setBillingLoading(true); setBillingMsg(null);
        const res = await adminAuditConsistency();
        if (res.success && res.summary) {
            setAuditResult(res);
            setBillingMsg({ text: `📊 ${res.summary.usersConsistent} consistentes, ${res.summary.usersDesatualizados} desatualizados`, ok: true });
        } else {
            setBillingMsg({ text: res.message || 'Erro ao auditar.', ok: false });
        }
        setBillingLoading(false);
    };

    const handleAuditFull = async () => {
        const { adminRunFullAudit } = await import('../../services/api');
        setBillingLoading(true); setBillingMsg(null);
        const res = await adminRunFullAudit();
        if (res.success) {
            setAuditResult(res);
            const c = res.consistency;
            const p = res.payments;
            setBillingMsg({
                text: `📊 ${c?.usersConsistent || 0} consistentes, ${c?.usersDesatualizados || 0} desatualizados | 💳 ${p?.doubleCount?.discrepancies || 0} double-count, ${p?.negativeBalance?.issues || 0} saldo negativo`,
                ok: true
            });
        } else {
            setBillingMsg({ text: res.message || 'Erro na auditoria.', ok: false });
        }
        setBillingLoading(false);
    };

    const handleAuditCharges = async () => {
        const { adminHealthCharges } = await import('../../services/api');
        setBillingLoading(true); setBillingMsg(null);
        const res = await adminHealthCharges();
        if (res.success) {
            setAuditResult(res);
            const s = res.summary || { totalUsers: 0, consistent: 0, divergent: 0, noInvoice: 0 };
            setBillingMsg({ text: `🧾 ${s.consistent} consistentes, ${s.divergent} divergentes, ${s.noInvoice} sem fatura`, ok: true });
        } else {
            setBillingMsg({ text: res.message || 'Erro ao auditar encargos.', ok: false });
        }
        setBillingLoading(false);
    };

    return (
        <div className={`p-6 rounded-2xl flex flex-col items-center text-center ${isMidnight ? 'bg-volt-surface border border-white/5 shadow-md' : 'bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}`}>
            <h2 className={isMidnight ? `text-xl font-bold mb-2 ${titleClass}` : `text-xl font-black uppercase tracking-wider mb-2 ${titleClass}`}>Massa de Teste (Billing)</h2>
            <p className={isMidnight ? `text-xs mb-6 ${subTextClass}` : `text-xs font-bold mb-6 uppercase ${subTextClass}`}>Aplica cenários de faturamento para automação. Não afeta dados de produção.</p>

            <p className={`text-xs mb-3 ${isMidnight ? 'font-semibold' : 'font-black uppercase tracking-wider'} ${titleClass}`}>CPF alvo</p>
            <div className="flex gap-2 flex-wrap mb-4">
                {[
                    { label: 'Todos', value: '' },
                    { label: '111', value: '11111111111' },
                    { label: '222', value: '22222222222' },
                    { label: '333', value: '33333333333' },
                    { label: '444', value: '44444444444' },
                ].map(opt => (
                    <button key={opt.value || 'all'} onClick={() => setBillingCpf(opt.value)}
                        className={`text-xs px-3 py-2 rounded-xl transition-all ${
                            billingCpf === opt.value
                                ? (isMidnight ? 'bg-volt-green text-black font-semibold' : 'border-4 border-black bg-volt-yellow text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black')
                                : (isMidnight ? 'bg-volt-dark text-white/50 border border-white/5 hover:border-white/20 hover:text-white' : 'border-4 border-black/20 text-black/50 hover:border-black hover:text-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black')
                        }`}>
                        {opt.label}
                    </button>
                ))}
            </div>
            <input value={billingCpf} onChange={e => setBillingCpf(e.target.value.replace(/\D/g, ''))}
                placeholder="ou CPF personalizado…"
                className={`w-full p-3 rounded-xl focus:outline-none transition-all mb-6 ${
                    isMidnight
                        ? 'bg-volt-dark text-white border border-white/5 focus:border-volt-green font-medium'
                        : 'bg-white text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:translate-y-1 focus:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] font-bold'
                }`} />

            <p className={`text-xs mb-3 ${isMidnight ? 'font-semibold' : 'font-black uppercase tracking-wider'} ${titleClass}`}>Cenário</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                    { key: 'adimplente',   label: 'Adimplente',   cls: isMidnight ? 'text-volt-green bg-volt-green/10 border-volt-green/20 hover:bg-volt-green/20' : 'text-green-600 bg-green-500/10 border-green-500/30 hover:bg-green-500/20' },
                    { key: 'vencida',      label: 'Vencida',      cls: isMidnight ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20 hover:bg-yellow-400/20' : 'text-yellow-700 bg-yellow-500/10 border-yellow-600/30 hover:bg-yellow-500/20' },
                    { key: 'inadimplente', label: 'Inadimplente', cls: isMidnight ? 'text-red-500 bg-red-500/10 border-red-500/20 hover:bg-red-500/20' : 'text-red-600 bg-red-500/10 border-red-600/30 hover:bg-red-500/20' },
                    { key: 'reset',        label: '↺ Reset',      cls: isMidnight ? 'text-white/70 bg-volt-dark border border-white/5 hover:bg-white/10' : 'text-black/70 bg-black/5 border-black/20 hover:bg-black/10' },
                ].map(s => (
                    <button key={s.key} onClick={() => applyBillingScenario(s.key)}
                        disabled={billingLoading}
                        className={`text-xs py-3 px-3 rounded-xl border transition-all ${isMidnight ? 'font-semibold normal-case' : 'font-bold uppercase tracking-wider'} ${s.cls}`}>
                        {s.label}
                    </button>
                ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-4 w-full justify-center max-w-sm">
                <button onClick={saveBillingBaseline} disabled={billingLoading || !billingCpf}
                    className={`flex-1 text-xs py-3 px-6 rounded-xl disabled:opacity-40 transition-all ${btnTypographySmallClass} ${primaryOutlineBtnClass}`}>
                    Salvar Mock
                </button>
                <button onClick={clearBillingBaseline} disabled={billingLoading || !billingCpf}
                    className={`flex-1 text-xs py-3 px-6 rounded-xl disabled:opacity-40 transition-all ${btnTypographySmallClass} ${neutralBtnClass}`}>
                    Limpar
                </button>
            </div>
            <button onClick={resetAllTestData} disabled={billingLoading}
                className={`w-full max-w-sm text-xs py-3 px-6 rounded-xl disabled:opacity-40 transition-all ${btnTypographySmallClass} ${dangerOutlineBtnClass}`}>
                Reset Dados Teste
            </button>

            <div className="mt-6 pt-6 border-t border-black/10 dark:border-white/10 w-full space-y-4">
                <button
                    onClick={() => onOpenModal('fixOrphan', { cpf: 'all' })}
                    disabled={billingLoading}
                    className={`w-full max-w-sm text-xs py-3 px-6 rounded-xl disabled:opacity-40 transition-all ${btnTypographySmallClass} ${dangerOutlineBtnClass}`}
                >
                    🔧 Corrigir Pagamentos Órfãos
                </button>
                <p className={`text-[10px] mt-2 ${isMidnight ? 'text-white/40' : 'text-black/40'}`}>
                    Cruza INVOICE_PAYMENT com valor_pago das invoices e corrige discrepâncias automaticamente.
                </p>

                <button
                    onClick={handleAuditConsistency}
                    disabled={billingLoading}
                    className={`w-full max-w-sm text-xs py-3 px-6 rounded-xl disabled:opacity-40 transition-all ${btnTypographySmallClass} ${primaryOutlineBtnClass}`}
                >
                    📊 Auditar Consistência
                </button>
                <p className={`text-[10px] mt-2 ${isMidnight ? 'text-white/40' : 'text-black/40'}`}>
                    Compara users.days_overdue e invoices.dias_atraso com o cálculo em tempo real (hoje - vencimento).
                </p>

                <button
                    onClick={handleAuditFull}
                    disabled={billingLoading}
                    className={`w-full max-w-sm text-xs py-3 px-6 rounded-xl disabled:opacity-40 transition-all ${btnTypographySmallClass} ${primaryOutlineBtnClass}`}
                >
                    🧪 Executar Auditoria COMPLETA
                </button>
                <p className={`text-[10px] mt-2 ${isMidnight ? 'text-white/40' : 'text-black/40'}`}>
                    Executa ambas as auditorias (Consistência + Pagamentos/Double-Count) em sequência e exibe resumo unificado.
                </p>

                <button
                    onClick={handleAuditCharges}
                    disabled={billingLoading}
                    className={`w-full max-w-sm text-xs py-3 px-6 rounded-xl disabled:opacity-40 transition-all ${btnTypographySmallClass} ${primaryOutlineBtnClass}`}
                >
                    🧾 Auditar Encargos (calcAllCharges vs BD)
                </button>
                <p className={`text-[10px] mt-2 ${isMidnight ? 'text-white/40' : 'text-black/40'}`}>
                    Recalcula encargos via invoiceMath.js e compara com billing_charges armazenados — alerta divergências.
                </p>

                <AuditResultCard
                    auditResult={auditResult}
                    isMidnight={isMidnight}
                    innerCardClass={innerCardClass}
                />
            </div>

            {billingMsg && (
                <p className={`text-sm mt-4 text-center font-bold uppercase tracking-wider ${billingMsg.ok ? (isMidnight ? 'text-green-400' : 'text-green-600') : (isMidnight ? 'text-red-400' : 'text-red-600')}`}>
                    {billingMsg.text}
                </p>
            )}
        </div>
    );
};

export default BillingMockSection;
