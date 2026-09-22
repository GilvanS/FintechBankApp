import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, Wrench } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { adminAuditConsistency, adminAuditDoubleCount, adminAuditCsvConsistency, adminFixOrphanInstallments, adminFixChargesProactive } from '../../services/api';

type AuditSubTab = 'consistency' | 'double-count' | 'csv-consistency' | 'corrections';

// Mesmo base path hardcoded em index.tsx (BrowserRouter basename="/FintechBankApp"
// e vite.config base) — os dashboards HTML ficam em WEB/public/audit/, servidos
// pelo Vite sob o mesmo base, mesma origem que o SPA (necessário para o token
// de admin em localStorage funcionar nos dois dashboards).
const reportUrl = (file: string) => `/FintechBankApp/audit/${file}`;

interface KpiCardProps {
    label: string;
    value: number | string;
    tone: 'neutral' | 'good' | 'bad';
    isMidnight: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, tone, isMidnight }) => {
    const toneColor = tone === 'bad'
        ? (isMidnight ? 'text-red-400' : 'text-red-600')
        : tone === 'good'
            ? (isMidnight ? 'text-volt-green' : 'text-emerald-600')
            : (isMidnight ? 'text-white' : 'text-black');
    return (
        <div className={`p-4 rounded-2xl border ${isMidnight ? 'bg-white/5 border-white/10' : 'bg-white border-black/10'}`}>
            <div className={`text-[11px] font-bold uppercase tracking-wide ${isMidnight ? 'text-white/50' : 'text-black/50'}`}>{label}</div>
            <div className={`text-2xl font-black tabular-nums ${toneColor}`}>{value}</div>
        </div>
    );
};

const AuditSection: React.FC = () => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const [subTab, setSubTab] = useState<AuditSubTab>('consistency');

    const [consistency, setConsistency] = useState<Awaited<ReturnType<typeof adminAuditConsistency>> | null>(null);
    const [doubleCount, setDoubleCount] = useState<Awaited<ReturnType<typeof adminAuditDoubleCount>> | null>(null);
    const [csvConsistency, setCsvConsistency] = useState<Awaited<ReturnType<typeof adminAuditCsvConsistency>> | null>(null);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    const [fixingOrphans, setFixingOrphans] = useState(false);
    const [fixingCharges, setFixingCharges] = useState(false);
    const [orphansResult, setOrphansResult] = useState<Awaited<ReturnType<typeof adminFixOrphanInstallments>> | null>(null);
    const [chargesResult, setChargesResult] = useState<Awaited<ReturnType<typeof adminFixChargesProactive>> | null>(null);

    const runFixOrphans = useCallback(async () => {
        if (!window.confirm('Corrigir transações INVOICE_INSTALLMENT órfãs? Vai criar o installment_plans que falta pra cada uma (backfill), sem alterar as transações.')) return;
        setFixingOrphans(true);
        try {
            const r = await adminFixOrphanInstallments();
            setOrphansResult(r);
        } finally {
            setFixingOrphans(false);
        }
    }, []);

    const runFixCharges = useCallback(async () => {
        if (!window.confirm('Corrigir encargos (billing_charges) pending divergentes do days_overdue real? Regera multa/juros/IOF de cada fatura afetada (FECHADA + ABERTA) com o valor correto.')) return;
        setFixingCharges(true);
        try {
            const r = await adminFixChargesProactive();
            setChargesResult(r);
        } finally {
            setFixingCharges(false);
        }
    }, []);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setStatusMessage('Consultando auditorias...');
        try {
            const [c, d, cc] = await Promise.all([adminAuditConsistency(), adminAuditDoubleCount(), adminAuditCsvConsistency()]);
            setConsistency(c);
            setDoubleCount(d);
            setCsvConsistency(cc);
            setStatusMessage('Auditorias atualizadas.');
        } catch {
            setStatusMessage('Falha ao consultar auditorias.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const subTabs: { id: AuditSubTab; label: string }[] = [
        { id: 'consistency', label: 'Consistência' },
        { id: 'double-count', label: 'Double-Counting' },
        { id: 'csv-consistency', label: 'CSV × Backend' },
        { id: 'corrections', label: 'Correções' },
    ];

    const cardCls = `p-5 rounded-3xl border ${isMidnight ? 'bg-[#151515] border-white/10 text-white' : 'bg-white border-black/10 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={20} className={isMidnight ? 'text-volt-green' : 'text-black'} />
                    <h2 className="text-lg font-black uppercase tracking-tight">Auditoria</h2>
                </div>
                <button
                    onClick={fetchAll}
                    disabled={loading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${
                        isMidnight
                            ? 'bg-white/10 hover:bg-white/20 text-white focus-visible:outline-volt-green'
                            : 'bg-white border-2 border-black hover:bg-gray-50 focus-visible:outline-black'
                    }`}
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} />
                    Atualizar
                </button>
            </div>

            <span className="sr-only" role="status" aria-live="polite">{statusMessage}</span>

            <div className="flex items-center gap-2">
                {subTabs.map(t => {
                    const active = subTab === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setSubTab(t.id)}
                            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                                active
                                    ? isMidnight
                                        ? 'bg-volt-green text-black focus-visible:outline-volt-green'
                                        : 'bg-black text-white focus-visible:outline-black'
                                    : isMidnight
                                        ? 'bg-white/5 text-white/70 hover:bg-white/10 focus-visible:outline-volt-green'
                                        : 'bg-white border-2 border-black/20 text-black/70 hover:border-black focus-visible:outline-black'
                            }`}
                        >
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {subTab === 'consistency' && (
                <section className={cardCls} aria-labelledby="audit-consistency-title">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <h2 id="audit-consistency-title" className="text-sm font-black uppercase tracking-tight">
                            Consistência de Dias em Atraso
                        </h2>
                        <a
                            href={reportUrl('audit_consistency_dashboard.html')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-1.5 text-xs font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${isMidnight ? 'text-volt-green focus-visible:outline-volt-green' : 'text-black focus-visible:outline-black'}`}
                        >
                            Abrir relatório completo <ExternalLink size={12} />
                        </a>
                    </div>

                    {!consistency ? (
                        <p className="text-xs opacity-60">{loading ? 'Carregando…' : 'Sem dados.'}</p>
                    ) : consistency.success === false ? (
                        <p className="text-xs text-red-500 font-bold flex items-center gap-1.5">
                            <AlertTriangle size={14} /> {consistency.message || 'Erro ao consultar.'}
                        </p>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <KpiCard label="Usuários" value={consistency.summary?.totalScanned ?? 0} tone="neutral" isMidnight={isMidnight} />
                                <KpiCard
                                    label="Desatualizados"
                                    value={consistency.summary?.usersDesatualizados ?? 0}
                                    tone={(consistency.summary?.usersDesatualizados ?? 0) > 0 ? 'bad' : 'good'}
                                    isMidnight={isMidnight}
                                />
                                <KpiCard label="Invoices OK" value={`${consistency.summary?.invoicesConsistent ?? 0}/${consistency.summary?.totalInvoices ?? 0}`} tone="neutral" isMidnight={isMidnight} />
                                <KpiCard
                                    label="Invoices Desatualizadas"
                                    value={consistency.summary?.invoicesDesatualizadas ?? 0}
                                    tone={(consistency.summary?.invoicesDesatualizadas ?? 0) > 0 ? 'bad' : 'good'}
                                    isMidnight={isMidnight}
                                />
                            </div>
                            {consistency.tip && (
                                <p className="text-xs opacity-70 flex items-start gap-1.5">
                                    {(consistency.summary?.usersDesatualizados ?? 0) === 0 && (consistency.summary?.invoicesDesatualizadas ?? 0) === 0
                                        ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                                        : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />}
                                    {consistency.tip}
                                </p>
                            )}
                        </>
                    )}
                </section>
            )}

            {subTab === 'double-count' && (
                <section className={cardCls} aria-labelledby="audit-double-count-title">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <h2 id="audit-double-count-title" className="text-sm font-black uppercase tracking-tight">
                            Double-Counting de Pagamentos
                        </h2>
                        <a
                            href={reportUrl('audit_dashboard.html')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-1.5 text-xs font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${isMidnight ? 'text-volt-green focus-visible:outline-volt-green' : 'text-black focus-visible:outline-black'}`}
                        >
                            Abrir relatório completo <ExternalLink size={12} />
                        </a>
                    </div>

                    {!doubleCount ? (
                        <p className="text-xs opacity-60">{loading ? 'Carregando…' : 'Sem dados.'}</p>
                    ) : doubleCount.success === false ? (
                        <p className="text-xs text-red-500 font-bold flex items-center gap-1.5">
                            <AlertTriangle size={14} /> {doubleCount.message || 'Erro ao consultar.'}
                        </p>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                                <KpiCard label="Com Pagamentos" value={doubleCount.withPayments ?? 0} tone="neutral" isMidnight={isMidnight} />
                                <KpiCard
                                    label="Discrepâncias"
                                    value={doubleCount.discrepancies ?? 0}
                                    tone={(doubleCount.discrepancies ?? 0) > 0 ? 'bad' : 'good'}
                                    isMidnight={isMidnight}
                                />
                                <KpiCard label="Escaneados" value={doubleCount.scanned ?? 0} tone="neutral" isMidnight={isMidnight} />
                            </div>
                            {doubleCount.tip && (
                                <p className="text-xs opacity-70 flex items-start gap-1.5">
                                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                                    {doubleCount.tip}
                                </p>
                            )}
                        </>
                    )}
                </section>
            )}
            {subTab === 'csv-consistency' && (
                <section className={cardCls} aria-labelledby="audit-csv-consistency-title">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <h2 id="audit-csv-consistency-title" className="text-sm font-black uppercase tracking-tight">
                            CSV de Massas × Backend
                        </h2>
                        <a
                            href={reportUrl('audit_csv_consistency_dashboard.html')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-1.5 text-xs font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${isMidnight ? 'text-volt-green focus-visible:outline-volt-green' : 'text-black focus-visible:outline-black'}`}
                        >
                            Abrir relatório completo <ExternalLink size={12} />
                        </a>
                    </div>

                    {!csvConsistency ? (
                        <p className="text-xs opacity-60">{loading ? 'Carregando…' : 'Sem dados.'}</p>
                    ) : csvConsistency.success === false ? (
                        <p className="text-xs text-red-500 font-bold flex items-center gap-1.5">
                            <AlertTriangle size={14} /> {csvConsistency.message || 'Erro ao consultar.'}
                        </p>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                                <KpiCard label="Massas Escaneadas" value={csvConsistency.summary?.totalScanned ?? 0} tone="neutral" isMidnight={isMidnight} />
                                <KpiCard label="Consistentes" value={csvConsistency.summary?.consistent ?? 0} tone="good" isMidnight={isMidnight} />
                                <KpiCard
                                    label="Divergentes"
                                    value={csvConsistency.summary?.divergent ?? 0}
                                    tone={(csvConsistency.summary?.divergent ?? 0) > 0 ? 'bad' : 'good'}
                                    isMidnight={isMidnight}
                                />
                            </div>
                            <p className="text-xs opacity-70 flex items-start gap-1.5">
                                {(csvConsistency.summary?.divergent ?? 0) === 0
                                    ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                                    : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />}
                                {csvConsistency.tip ?? 'Compara fatura_fechada/fatura_aberta do CSV de massas (botão "Exportar CSV") contra o cálculo real do backend (enrichUserCreditCardData) — pega regressão na query do CSV antes que vire massa de teste ruim.'}
                            </p>
                        </>
                    )}
                </section>
            )}
            {subTab === 'corrections' && (
                <section className={cardCls} aria-labelledby="audit-corrections-title">
                    <div className="flex items-center gap-2 mb-4">
                        <Wrench size={16} className={isMidnight ? 'text-volt-green' : 'text-black'} />
                        <h2 id="audit-corrections-title" className="text-sm font-black uppercase tracking-tight">
                            Correções de Anomalia
                        </h2>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide">Transações Órfãs</p>
                                    <p className="text-xs opacity-60">TRANSACAO_ORFA — cria o installment_plans que falta pra parcelas sem plano correspondente. Não altera as transações.</p>
                                </div>
                                <button
                                    onClick={runFixOrphans}
                                    disabled={fixingOrphans}
                                    className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${
                                        isMidnight
                                            ? 'bg-volt-green text-black focus-visible:outline-volt-green'
                                            : 'bg-black text-white focus-visible:outline-black'
                                    }`}
                                >
                                    <RefreshCw size={14} className={fixingOrphans ? 'animate-spin motion-reduce:animate-none' : ''} />
                                    {fixingOrphans ? 'Corrigindo…' : 'Corrigir Órfãs'}
                                </button>
                            </div>
                            {orphansResult && (
                                orphansResult.success === false ? (
                                    <p className="text-xs text-red-500 font-bold flex items-center gap-1.5">
                                        <AlertTriangle size={14} /> {orphansResult.message || 'Erro ao corrigir.'}
                                    </p>
                                ) : (
                                    <p className="text-xs opacity-80 flex items-center gap-1.5">
                                        <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                                        {orphansResult.summary?.orphansFound ?? 0} órfã(s) encontrada(s), {orphansResult.summary?.fixed ?? 0} corrigida(s), {orphansResult.summary?.skipped ?? 0} pulada(s).
                                    </p>
                                )
                            )}
                        </div>

                        <div className={`border-t pt-5 ${isMidnight ? 'border-white/10' : 'border-black/10'}`}>
                            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide">Encargos Divergentes</p>
                                    <p className="text-xs opacity-60">ENCARGOS_ORFAOS_REGERADOS — regera multa/juros/IOF pending com o days_overdue real (FECHADA + ABERTA), antes do próximo corte/vencimento. Mesma correção que roda sozinha a cada 2h.</p>
                                </div>
                                <button
                                    onClick={runFixCharges}
                                    disabled={fixingCharges}
                                    className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${
                                        isMidnight
                                            ? 'bg-volt-green text-black focus-visible:outline-volt-green'
                                            : 'bg-black text-white focus-visible:outline-black'
                                    }`}
                                >
                                    <RefreshCw size={14} className={fixingCharges ? 'animate-spin motion-reduce:animate-none' : ''} />
                                    {fixingCharges ? 'Corrigindo…' : 'Corrigir Encargos'}
                                </button>
                            </div>
                            {chargesResult && (
                                chargesResult.success === false ? (
                                    <p className="text-xs text-red-500 font-bold flex items-center gap-1.5">
                                        <AlertTriangle size={14} /> {chargesResult.message || 'Erro ao corrigir.'}
                                    </p>
                                ) : (
                                    <p className="text-xs opacity-80 flex items-center gap-1.5">
                                        <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                                        {chargesResult.summary?.invoicesFound ?? 0} fatura(s) divergente(s), {chargesResult.summary?.fixed ?? 0} corrigida(s), {chargesResult.summary?.skipped ?? 0} pulada(s).
                                    </p>
                                )
                            )}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
};

export default AuditSection;
