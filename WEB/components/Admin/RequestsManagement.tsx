import React, { useState, useEffect, useRef } from 'react';
import { PasswordResetRequest, LimitIncreaseRequest, User } from '../../types';
import {
    adminGetPasswordRequests,
    adminApprovePasswordRequest,
    adminDenyPasswordRequest,
    adminGetLimitRequests,
    adminApproveLimitRequest,
    adminDenyLimitRequest,
    adminGetOverdueMasses
} from '../../services/api';
import { formatCPF } from '../../utils/formatters';
import { useAppState } from '../../contexts/AppStateContext';
import { Check, X, KeyRound, FileText, AlertTriangle, Users, DollarSign, Clock, Copy, ArrowUpDown, TrendingUp, Download, Zap } from 'lucide-react';
import { showToast } from '../../utils/toast';
import { adminCheckRegularized } from '../../services/api';
import RegularizedReportModal from './RegularizedReportModal';
import RegularizedTimelineChart from './RegularizedTimelineChart';
import PaymentHistoryDetailModal from './PaymentHistoryDetailModal';
import ChargeDetailModal from './ChargeDetailModal';

const RequestsManagement: React.FC = () => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    const [passwordRequests, setPasswordRequests] = useState<PasswordResetRequest[]>([]);
    const [limitRequests, setLimitRequests] = useState<LimitIncreaseRequest[]>([]);
    const [overdueDashboard, setOverdueDashboard] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingAction, setIsLoadingAction] = useState(false);

    // Modal State
    // Toggle: mostrar ou ocultar massas regularizadas
    const [showRegularized, setShowRegularized] = useState(true);

    // Filtro por Status Minimo (ACIMA / ABAIXO / SEM_PAG)
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACIMA' | 'ABAIXO' | 'SEM_PAG' | 'CRITICAS'>('ALL');

    // Contagem de massas por status de pagamento (para badges nos chips)
    const statusCounts = React.useMemo(() => {
        const masses = overdueDashboard?.overdueMasses || [];
        const counts = { ALL: masses.length, ABAIXO: 0, ACIMA: 0, SEM_PAG: 0 };
        for (const m of masses) {
            const ps = m.paymentSummary || {};
            const s = ps.statusMinimo || 'SEM_PAG';
            if (s === 'ABAIXO') counts.ABAIXO++;
            else if (s === 'ACIMA') counts.ACIMA++;
            else counts.SEM_PAG++;
        }
        return counts;
    }, [overdueDashboard?.overdueMasses]);

    const statusFilterOptions: Array<{ value: typeof statusFilter; label: string; color: string }> = [
        { value: 'ALL', label: 'Todos (' + statusCounts.ALL + ')', color: '' },
        { value: 'CRITICAS', label: '🔴 Apenas Críticas (' + statusCounts.ABAIXO + ')', color: 'text-red-500 border-red-500/40' },
        { value: 'ABAIXO', label: '⚠️ Abaixo (' + statusCounts.ABAIXO + ')', color: 'text-amber-500 border-amber-500/30' },
        { value: 'ACIMA', label: '✅ Acima (' + statusCounts.ACIMA + ')', color: 'text-emerald-500 border-emerald-500/30' },
        { value: 'SEM_PAG', label: '— Sem Pag. (' + statusCounts.SEM_PAG + ')', color: 'text-zinc-400 border-zinc-400/30' },
    ];

    // Modal de Relatório de Regularizadas
    const [isRegularizedReportOpen, setIsRegularizedReportOpen] = useState(false);

    // Modal de Histórico de Pagamentos
    const [paymentHistoryModal, setPaymentHistoryModal] = useState<{
        isOpen: boolean;
        mass: any;
    }>({ isOpen: false, mass: null });

    // Modal de Detalhamento de Encargos
    const [chargeDetailModal, setChargeDetailModal] = useState<{
        isOpen: boolean;
        mass: any;
    }>({ isOpen: false, mass: null });

    // Ref para detectar massas regularizadas que saíram do painel (24h expiradas)
    const prevRegularizedRef = useRef<Array<{ cpf: string; fullName: string; totalQuitacao: number }>>([]);

    // ── Alerta sonoro para novas regularizações ──
    const playNotificationSound = () => {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const now = ctx.currentTime;

            // Primeiro tom (frequência mais alta - Dó#)
            const osc1 = ctx.createOscillator();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(554.37, now);
            const gain1 = ctx.createGain();
            gain1.gain.setValueAtTime(0.3, now);
            gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc1.connect(gain1).connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.15);

            // Segundo tom (meio tom acima - Ré)
            const osc2 = ctx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(587.33, now + 0.12);
            const gain2 = ctx.createGain();
            gain2.gain.setValueAtTime(0.3, now + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            osc2.connect(gain2).connect(ctx.destination);
            osc2.start(now + 0.12);
            osc2.stop(now + 0.35);

            // Fechar contexto após 1s
            setTimeout(() => ctx.close(), 1000);
        } catch (e) {
            // Fallback silencioso se Web Audio API não estiver disponível
        }
    };

    // ── Polling de novas regularizações (via endpoint leve) ──
    const lastCheckedRef = useRef<string>(new Date().toISOString());
    const lastCountRef = useRef<number>(0);

    const checkNewRegularizations = async () => {
        try {
            const result = await adminCheckRegularized(lastCheckedRef.current);
            if (!result || !result.success) return;

            const newCount = result.count;
            const oldCount = lastCountRef.current;

            // Se o count aumentou, tem novas regularizações
            if (newCount > oldCount && oldCount > 0) {
                const newItems = result.items || [];
                // Remover duplicatas: itens que já estavam no ref anterior
                const trulyNew = newItems.filter(
                    (item: any) => !prevRegularizedRef.current.find(
                        (p: any) => p.cpf === item.cpf
                    )
                );

                if (trulyNew.length > 0) {
                    const first = trulyNew[0];
                    // ── Alerta sonoro para chamar atenção do admin ──
                    playNotificationSound();
                    showToast(
                        `🔔 ${trulyNew.length === 1
                            ? `${first.fullName} (${first.cpf}) regularizou — R$ ${first.valorPago.toFixed(2)}`
                            : `${trulyNew.length} massa(s) regularizaram — R$ ${trulyNew.reduce((s: number, i: any) => s + i.valorPago, 0).toFixed(2)} no total`
                        }`,
                        'success'
                    );

                    // Atualizar ref para não repetir notificação
                    for (const item of trulyNew) {
                        if (!prevRegularizedRef.current.find((p: any) => p.cpf === item.cpf)) {
                            prevRegularizedRef.current.push({
                                cpf: item.cpf,
                                fullName: item.fullName,
                                totalQuitacao: item.valorPago || 0
                            });
                        }
                    }
                }
            }

            lastCountRef.current = newCount;
            lastCheckedRef.current = new Date().toISOString();
        } catch (e) {
            // Silencia erros de polling (não interrompe o admin)
        }
    };

    // Iniciar polling a cada 30s
    useEffect(() => {
        const interval = setInterval(checkNewRegularizations, 30000);
        return () => clearInterval(interval);
    }, []);

    // Ordenação
    const [sortColumn, setSortColumn] = useState<string>('cpf');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const getPaymentSummary = (m: any) => m.paymentSummary || { totalPago: 0, saldoRestante: m.faturaFechada || 0, statusMinimo: 'SEM_PAG' };

    const getLastPaymentDate = (m: any): string | null => {
        const history = m.paymentHistory || [];
        if (history.length === 0) return null;
        // Find the most recent payment date
        let latest: string | null = null;
        for (const p of history) {
            if (p.date && (!latest || new Date(p.date) > new Date(latest))) {
                latest = p.date;
            }
        }
        return latest;
    };

    const formatLastPayment = (iso: string | null): string => {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    // ── Export CSV da lista filtrada ─────────────────────────────────────
    const generateDashboardCSV = (): string => {
        const masses = sortedMasses;
        const BOM = '\uFEFF';
        const sep = ',';
        const esc = (v: any): string => {
            const s = String(v ?? '');
            return '"' + s.replace(/"/g, '""') + '"';
        };
        const fmt = (v: number): string => v.toFixed(2).replace('.', ',');
        const fmtDateBr = (m: any): string => {
            const lp = getLastPaymentDate(m);
            if (!lp) return '—';
            const d = new Date(lp);
            if (isNaN(d.getTime())) return '—';
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
        };

        const headers = [
            'CPF', 'Cliente', 'Status', 'Fatura Fechada', 'Dias Atraso',
            'Encargos', 'Total Quitação', 'Total Pago', 'Últ. Pagto.',
            'Saldo Restante', 'Status Min.', 'Reg. há'
        ];

        const rows = masses.map((m: any) => {
            const ps = m.paymentSummary || {};
            const regHá = m.accountStatus === 'regularizada' && m.hoursAgo !== undefined
                ? (m.hoursAgo < 1 ? '<1h' : m.hoursAgo + 'h')
                : '—';
            const statusMinLabel = ps.statusMinimo === 'ACIMA' ? 'Acima'
                : ps.statusMinimo === 'ABAIXO' ? 'Abaixo' : 'Sem Pag.';

            return [
                m.cpf || '',
                m.fullName || '',
                m.accountStatus || '',
                fmt(m.faturaFechada || 0),
                String(m.daysOverdue || 0),
                fmt(m.encargos?.totalEncargos || 0),
                fmt(m.totalQuitacao || 0),
                fmt(ps.totalPago || 0),
                fmtDateBr(m),
                fmt(ps.saldoRestante || 0),
                statusMinLabel,
                regHá,
            ].map(esc).join(sep);
        });

        return BOM + 'sep=' + sep + '\r\n' + headers.map(esc).join(sep) + '\r\n' + rows.join('\r\n');
    };

    const downloadDashboardCSV = () => {
        const csv = generateDashboardCSV();
        const statusLabel = statusFilter === 'ALL' ? 'todas'
            : statusFilter === 'CRITICAS' ? 'criticas'
            : statusFilter.toLowerCase();
        const filename = `massas_atraso_${statusLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('CSV exportado com sucesso!', 'success');
    };
    // ── Fim CSV ──────────────────────────────────────────────────────────

    const getSortValue = (m: any, column: string): string | number => {
        switch (column) {
            case 'cpf': return m.cpf || '';
            case 'nome': return m.fullName || '';
            case 'status': return m.accountStatus || '';
            case 'fatura': return m.faturaFechada || 0;
            case 'dias': return m.daysOverdue || 0;
            case 'encargos': return m.encargos?.totalEncargos || 0;
            case 'quitacao': return m.totalQuitacao || 0;
            case 'totalPago': return getPaymentSummary(m).totalPago || 0;
            case 'ultimoPagamento': {
                const d = getLastPaymentDate(m);
                return d ? new Date(d).getTime() : 0;
            }
            case 'saldoRestante': return getPaymentSummary(m).saldoRestante || 0;
            case 'statusMinimo': return getPaymentSummary(m).statusMinimo || 'SEM_PAG';
            case 'regularizada': return m.hoursAgo !== undefined ? m.hoursAgo : -1;
            default: return '';
        }
    };

    const sortedMasses = React.useMemo(() => {
        const masses = overdueDashboard?.overdueMasses || [];
        let filtered = [...masses];
        if (!showRegularized) {
            filtered = filtered.filter((m: any) => m.accountStatus !== 'regularizada');
        }
        // Filtro por Status Minimo
        if (statusFilter !== 'ALL') {
            if (statusFilter === 'CRITICAS') {
                // View especial: filtra ABAIXO + ordena por maior saldo restante
                filtered = filtered.filter((m: any) => {
                    const ps = m.paymentSummary || {};
                    return ps.statusMinimo === 'ABAIXO';
                });
                // Ordena por saldoRestante DESC (maior dívida primeiro)
                filtered.sort((a: any, b: any) => {
                    const psA = a.paymentSummary || {};
                    const psB = b.paymentSummary || {};
                    return (psB.saldoRestante || 0) - (psA.saldoRestante || 0);
                });
                return filtered;
            } else {
                filtered = filtered.filter((m: any) => {
                    const ps = m.paymentSummary || {};
                    return ps.statusMinimo === statusFilter;
                });
            }
        }
        return filtered.sort((a: any, b: any) => {
            const valA = getSortValue(a, sortColumn);
            const valB = getSortValue(b, sortColumn);
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortDirection === 'asc' ? valA - valB : valB - valA;
            }
            return sortDirection === 'asc'
                ? String(valA).localeCompare(String(valB))
                : String(valB).localeCompare(String(valA));
        });
    }, [overdueDashboard?.overdueMasses, sortColumn, sortDirection, showRegularized, statusFilter]);

    // Paginação
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const ITEMS_PER_PAGE = itemsPerPage;
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(sortedMasses.length / ITEMS_PER_PAGE);
    const paginatedMasses = sortedMasses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    // Resetar página quando dados, ordenação ou filtro mudarem
    useEffect(() => {
        setCurrentPage(1);
    }, [sortedMasses.length, sortColumn, sortDirection, showRegularized, statusFilter]);

    // Resumo textual da view CRITICAS (aparece acima da tabela)
    const criticasSummary = React.useMemo(() => {
        if (statusFilter !== 'CRITICAS' || sortedMasses.length === 0) return null;
        const totalDebt = sortedMasses.reduce((sum: number, m: any) => {
            const ps = m.paymentSummary || {};
            return sum + (ps.saldoRestante || 0);
        }, 0);
        const maxDebt = sortedMasses.reduce((max: number, m: any) => {
            const ps = m.paymentSummary || {};
            return Math.max(max, ps.saldoRestante || 0);
        }, 0);
        return {
            totalMassas: sortedMasses.length,
            totalDebt,
            maxDebt,
            biggestDebtor: sortedMasses[0],
        };
    }, [statusFilter, sortedMasses]);

    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        action: 'approve' | 'deny' | null;
        type: 'password' | 'limit' | null;
        data: any;
    }>({ isOpen: false, action: null, type: null, data: null });
    const [denyReason, setDenyReason] = useState('');

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const [passReqsResult, limReqsResult, overdueResult] = await Promise.all([
                adminGetPasswordRequests(),
                adminGetLimitRequests(),
                adminGetOverdueMasses()
            ]);
            
            const passReqs = passReqsResult.success ? passReqsResult.requests : [];
            const limReqs = limReqsResult.success ? limReqsResult.requests : [];
            
            setPasswordRequests(passReqs || []);
            setLimitRequests(limReqs || []);
            if (overdueResult && overdueResult.success) {
                const currentMasses = overdueResult.overdueMasses || [];
                const currentRegularized = currentMasses.filter((m: any) => m.accountStatus === 'regularizada');
                const currentRegularizedCpfs = new Set(currentRegularized.map((m: any) => m.cpf));

                // Detectar massas que estavam regularizadas antes e agora sumiram (24h expiradas)
                const removed = prevRegularizedRef.current.filter(
                    prev => !currentRegularizedCpfs.has(prev.cpf)
                );
                for (const r of removed) {
                    showToast(
                        `⏳ Massa saiu do painel: ${r.fullName} (${r.cpf}) — quitou R$ ${r.totalQuitacao.toFixed(2)}`,
                        'success'
                    );
                }

                // Atualizar ref com as regularizadas atuais para próxima comparação
                prevRegularizedRef.current = currentRegularized.map((m: any) => ({
                    cpf: m.cpf,
                    fullName: m.fullName,
                    totalQuitacao: m.totalQuitacao || 0
                }));

                setOverdueDashboard(overdueResult);
            }
        } catch (error: any) {
            console.error('Erro ao buscar solicitações:', error);
            setPasswordRequests([]);
            setLimitRequests([]);
            showToast('Erro ao carregar solicitações.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Ao montar, inicializa lastCountRef com o count atual do dashboard
    useEffect(() => {
        if (overdueDashboard?.regularizedReport?.length !== undefined) {
            lastCountRef.current = overdueDashboard.regularizedReport.length;
        }
    }, [overdueDashboard?.regularizedReport?.length]);

    // Força um check imediato quando o dashboard carrega
    useEffect(() => {
        if (overdueDashboard && !isLoading) {
            lastCountRef.current = (overdueDashboard?.regularizedReport || []).length;
        }
    }, [!isLoading]);

    useEffect(() => {
        fetchRequests();
    }, []);

    const btnClass = `py-2 px-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2`;
    const primaryBtnClass = isMidnight ? 'bg-volt-green text-black hover:bg-[#a3ff12]' : 'bg-volt-yellow border-2 border-black text-black font-black uppercase hover:bg-volt-yellow-pastel shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none';
    const dangerBtnClass = isMidnight ? 'border border-red-500 text-red-500 hover:bg-red-500/10' : 'border border-red-500 text-red-500 hover:bg-red-50';
    const outlineBtnClass = isMidnight ? 'border border-white/20 text-white hover:bg-white/5' : 'border border-black/20 text-black hover:bg-black/5';
    const inputClass = isMidnight ? 'bg-[#1a1a1a] border border-white/10 text-white placeholder-white/40 focus:border-volt-green' : 'bg-white border-2 border-black text-black placeholder-black/40 focus:border-black';
    const cardClass = isMidnight ? 'bg-[#1a1a1a] border border-white/10 text-white' : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black';
    const innerCardClass = isMidnight ? 'bg-[#0f0f0f] border border-white/5' : 'bg-gray-50 border border-gray-200';

    const openModal = (action: typeof modalState.action, type: typeof modalState.type, data: any) => {
        setModalState({ isOpen: true, action, type, data });
    };

    const closeModal = () => {
        setModalState({ isOpen: false, action: null, type: null, data: null });
        setDenyReason('');
    };

    const handleConfirmAction = async () => {
        if (!modalState.action || !modalState.data || !modalState.type) return;

        setIsLoadingAction(true);
        let result: { success: boolean; message: string; user?: User } = { success: false, message: 'Erro' };

        try {
            if (modalState.type === 'limit') {
                if (modalState.action === 'approve') {
                    result = await adminApproveLimitRequest(modalState.data.cpf);
                } else {
                    if (!denyReason.trim()) {
                        showToast('Informe o motivo da recusa.', 'error');
                        setIsLoadingAction(false);
                        return;
                    }
                    result = await adminDenyLimitRequest(modalState.data.cpf, denyReason);
                }
            } else {
                if (modalState.action === 'approve') {
                    result = await adminApprovePasswordRequest(modalState.data.cpf);
                } else {
                    if (!denyReason.trim()) {
                        showToast('Informe o motivo da recusa.', 'error');
                        setIsLoadingAction(false);
                        return;
                    }
                    result = await adminDenyPasswordRequest(modalState.data.cpf, denyReason);
                }
            }

            if (result.success) {
                showToast(result.message, 'success');
                fetchRequests();
            } else {
                showToast(result.message, 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Erro ao processar', 'error');
        } finally {
            setIsLoadingAction(false);
            closeModal();
        }
    };

    return (
        <>
        <style>{`
            @keyframes blink-red {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.25; }
            }
            .blink-red {
                animation: blink-red 1.2s ease-in-out infinite;
            }
            /* Pause blink on hover for readability */
            .blink-red:hover {
                animation: none;
                opacity: 1 !important;
            }
        `}</style>
        <div className="p-6 w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Dashboard de Inadimplência & Massas em Atraso */}
            <div className={`col-span-1 md:col-span-2 p-6 rounded-2xl flex flex-col gap-6 ${cardClass}`}>
                <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4 pb-4 border-b border-black/10 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${isMidnight ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700'}`}>
                            <AlertTriangle size={26} />                                    </div>

                    {/* Botão: Relatório de Regularizadas */}
                    {overdueDashboard?.regularizedReport && overdueDashboard.regularizedReport.length > 0 && (
                        <button
                            onClick={() => setIsRegularizedReportOpen(true)}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                                isMidnight
                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                            }`}
                        >
                            <TrendingUp size={14} />
                            Relatório ({overdueDashboard.regularizedReport.length})
                        </button>
                    )}
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-wider">Painel de Massas em Atraso</h2>
                            <p className="opacity-70 text-xs md:text-sm">Monitoramento de inadimplência e cálculo de encargos por massa de teste.</p>                                    </div>

                    {/* Botão: Relatório de Regularizadas */}
                    {overdueDashboard?.regularizedReport && overdueDashboard.regularizedReport.length > 0 && (
                        <button
                            onClick={() => setIsRegularizedReportOpen(true)}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                                isMidnight
                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                            }`}
                        >
                            <TrendingUp size={14} />
                            Relatório ({overdueDashboard.regularizedReport.length})
                        </button>
                    )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={downloadDashboardCSV}
                            disabled={sortedMasses.length === 0}
                            className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-30 ${
                                isMidnight
                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                            }`}
                            title="Exportar lista filtrada como CSV"
                        >
                            <Download size={14} />
                            CSV
                        </button>
                        <button
                            onClick={fetchRequests}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                                isMidnight ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-black text-white hover:bg-zinc-800'
                            }`}
                        >
                            Atualizar Auditoria
                        </button>
                    </div>
                </div>

                {/* Toggle: Mostrar regularizadas */}
                <div className="flex items-center gap-3 px-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <button
                            onClick={() => setShowRegularized(v => !v)}
                            className={`relative w-10 h-5 rounded-full transition-all duration-200 ${
                                showRegularized
                                    ? isMidnight ? 'bg-volt-green' : 'bg-emerald-500'
                                    : isMidnight ? 'bg-zinc-700' : 'bg-gray-300'
                            }`}
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow-sm ${
                                    showRegularized ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                        <span className="text-xs font-bold uppercase tracking-wider">
                            Mostrar regularizadas (72h)
                        </span>
                    </label>
                    {!showRegularized && overdueDashboard?.stats?.regularizedCount > 0 && (
                        <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400">
                            {overdueDashboard.stats.regularizedCount} ocultas
                        </span>
                    )}
                </div>

                {/* Gráfico de Evolução Diária */}
                <RegularizedTimelineChart />

                {/* Filtro por Status Minimo */}
                <div className="flex items-center gap-2 flex-wrap px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-50 mr-1">Status Min.:</span>
                    {statusFilterOptions.map(opt => {
                        const isActive = statusFilter === opt.value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => setStatusFilter(isActive ? 'ALL' : opt.value)}
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                                    isActive
                                        ? isMidnight
                                            ? 'bg-volt-green text-black border-volt-green'
                                            : 'bg-black text-white border-black'
                                        : isMidnight
                                            ? 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800'
                                            : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
                                }`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                    {statusFilter !== 'ALL' && (
                        <span className="text-[10px] opacity-40 ml-1">
                            {sortedMasses.length} massa(s)
                        </span>
                    )}
                </div>

                {/* Cards de KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className={`p-4 rounded-xl border flex items-center justify-between ${
                        isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-rose-50 border-rose-200'
                    }`}>
                        <div>
                            <p className="text-xs font-bold opacity-70 uppercase tracking-wider">Massas em Atraso</p>
                            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">
                                {overdueDashboard?.stats?.overdueCount || 0} / {overdueDashboard?.stats?.totalUsers || 1}
                            </h3>
                            <p className="text-[10px] font-bold opacity-60">
                                Taxa: {overdueDashboard?.stats?.overdueRatePercentage || 0}%
                            </p>                                    </div>

                    {/* Botão: Relatório de Regularizadas */}
                    {overdueDashboard?.regularizedReport && overdueDashboard.regularizedReport.length > 0 && (
                        <button
                            onClick={() => setIsRegularizedReportOpen(true)}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                                isMidnight
                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                            }`}
                        >
                            <TrendingUp size={14} />
                            Relatório ({overdueDashboard.regularizedReport.length})
                        </button>
                    )}
                        <Users className="text-rose-500 opacity-80" size={32} />
                    </div>

                    <div className={`p-4 rounded-xl border flex items-center justify-between ${
                        isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-emerald-50 border-emerald-200'
                    }`}>
                        <div>
                            <p className="text-xs font-bold opacity-70 uppercase tracking-wider">Regularizadas (24h)</p>
                            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                {overdueDashboard?.stats?.regularizedCount || 0}
                            </h3>
                            <p className="text-[10px] font-bold opacity-60">Pagaram nos últimos 24h</p>                                    </div>

                    {/* Botão: Relatório de Regularizadas */}
                    {overdueDashboard?.regularizedReport && overdueDashboard.regularizedReport.length > 0 && (
                        <button
                            onClick={() => setIsRegularizedReportOpen(true)}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                                isMidnight
                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                            }`}
                        >
                            <TrendingUp size={14} />
                            Relatório ({overdueDashboard.regularizedReport.length})
                        </button>
                    )}
                        <Check className="text-emerald-500 opacity-80" size={32} />
                    </div>

                    <div className={`p-4 rounded-xl border flex items-center justify-between ${
                        isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-emerald-50 border-emerald-200'
                    }`}>
                        <div>
                            <p className="text-xs font-bold opacity-70 uppercase tracking-wider">Montante Inadimplente</p>
                            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                R$ {(overdueDashboard?.stats?.totalOverdueAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h3>
                            <p className="text-[10px] font-bold opacity-60">Faturas Fechadas + Encargos</p>                                    </div>

                    {/* Botão: Relatório de Regularizadas */}
                    {overdueDashboard?.regularizedReport && overdueDashboard.regularizedReport.length > 0 && (
                        <button
                            onClick={() => setIsRegularizedReportOpen(true)}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                                isMidnight
                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                            }`}
                        >
                            <TrendingUp size={14} />
                            Relatório ({overdueDashboard.regularizedReport.length})
                        </button>
                    )}
                        <DollarSign className="text-emerald-500 opacity-80" size={32} />
                    </div>

                    <div className={`p-4 rounded-xl border flex items-center justify-between ${
                        isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-amber-50 border-amber-200'
                    }`}>
                        <div>
                            <p className="text-xs font-bold opacity-70 uppercase tracking-wider">Média de Atraso</p>
                            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">
                                {overdueDashboard?.stats?.avgDaysOverdue || 0} dias
                            </h3>
                            <p className="text-[10px] font-bold opacity-60">Acima do Vencimento</p>                                    </div>

                    {/* Botão: Relatório de Regularizadas */}
                    {overdueDashboard?.regularizedReport && overdueDashboard.regularizedReport.length > 0 && (
                        <button
                            onClick={() => setIsRegularizedReportOpen(true)}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                                isMidnight
                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                            }`}
                        >
                            <TrendingUp size={14} />
                            Relatório ({overdueDashboard.regularizedReport.length})
                        </button>
                    )}
                        <Clock className="text-amber-500 opacity-80" size={32} />
                    </div>
                </div>

                {/* Banner da View CRITICAS */}
                {criticasSummary && (
                    <div className={`p-4 rounded-xl border-2 flex flex-col gap-2 ${
                        isMidnight
                            ? 'bg-red-500/10 border-red-500/30 text-red-300'
                            : 'bg-red-50 border-red-300 text-red-800'
                    }`}>
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🚨</span>
                            <span className="font-black uppercase text-sm tracking-wider">View Apenas Críticas</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                                <p className="text-[10px] font-bold uppercase opacity-60">Massas</p>
                                <p className="font-black text-lg">{criticasSummary.totalMassas}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase opacity-60">Dívida Total</p>
                                <p className="font-black text-lg">R$ {criticasSummary.totalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase opacity-60">Maior Débito</p>
                                <p className="font-black text-lg">R$ {criticasSummary.maxDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase opacity-60">Prioridade</p>
                                <p className="font-black text-sm">
                                    {criticasSummary.biggestDebtor?.fullName || ''}
                                    <span className="opacity-60 ml-1">
                                        (                                    {criticasSummary.biggestDebtor?.cpf ? formatCPF(criticasSummary.biggestDebtor.cpf) : ''})
                                    </span>
                                </p>
                            </div>
                        </div>
                        <p className="text-[10px] italic opacity-60">
                            Ordenado por saldo restante decrescente — maior dívida primeiro.
                        </p>
                    </div>
                )}

                {/* Tabela de Detalhamento de Massas */}
                <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
                    <table className="w-full text-left text-xs">
                        <thead className={`font-black uppercase tracking-wider border-b ${
                            isMidnight ? 'bg-zinc-900 text-zinc-400 border-zinc-800' : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
                            <tr>
                                {[
                                    { key: 'cpf', label: 'CPF', align: '' },
                                    { key: 'nome', label: 'Nome / Massa', align: '' },
                                    { key: 'status', label: 'Status', align: '' },
                                    { key: 'fatura', label: 'Fatura Fechada', align: 'right' },
                                    { key: 'dias', label: 'Dias Atraso', align: 'center' },
                                    { key: 'encargos', label: 'Encargos', align: 'right' },
                                    { key: 'quitacao', label: 'Total Quitação', align: 'right' },
                                    { key: 'totalPago', label: 'Total Pago', align: 'right' },
                                    { key: 'ultimoPagamento', label: 'Últ. Pagto.', align: 'center' },
                                    { key: 'saldoRestante', label: 'Saldo Rest.', align: 'right' },
                                    { key: 'statusMinimo', label: 'Status Min.', align: 'center' },
                                    { key: 'regularizada', label: 'Reg. há', align: 'center' },
                                ].map(col => (
                                    <th key={col.key} className="p-3">
                                        <button
                                            onClick={() => handleSort(col.key)}
                                            className={`flex items-center gap-1 font-black uppercase tracking-wider transition-all ${
                                                col.align === 'right' ? 'ml-auto' : col.align === 'center' ? 'mx-auto' : ''
                                            } ${
                                                sortColumn === col.key
                                                    ? isMidnight ? 'text-volt-green' : 'text-black'
                                                    : 'opacity-70 hover:opacity-100'
                                            }`}
                                            title={`Ordenar por ${col.label}`}
                                        >
                                            {col.label}
                                            <span className="text-[10px]">
                                                {sortColumn === col.key
                                                    ? sortDirection === 'asc' ? '▲' : '▼'
                                                    : <ArrowUpDown size={10} className="opacity-30" />
                                                }
                                            </span>
                                        </button>
                                    </th>
                                ))}
                                <th className="p-3 text-center" colSpan={2}>Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {paginatedMasses.length > 0 ? (
                                paginatedMasses.map((mass: any, idx: number) => {
                                    const isRegularizada = mass.accountStatus === 'regularizada';
                                    const ps = mass.paymentSummary || { statusMinimo: 'SEM_PAG', totalPago: 0, saldoRestante: mass.faturaFechada || 0 };
                                    return (
                                    <tr key={idx} className={`${isMidnight ? 'hover:bg-zinc-900/50' : 'hover:bg-gray-50'} ${isRegularizada ? 'opacity-60' : ''} ${
                                        !isRegularizada && ps.statusMinimo === 'ABAIXO'
                                            ? isMidnight
                                                ? 'bg-red-500/10 border-l-4 border-l-red-500 animate-pulse'
                                                : 'bg-red-100 border-l-4 border-l-red-600 animate-pulse'
                                            : ''
                                    }`}>
                                        <td className="p-3 font-mono font-bold">{formatCPF(mass.cpf)}</td>
                                        <td className="p-3 font-bold">
                                            <button
                                                onClick={() => {
                                                    window.dispatchEvent(new CustomEvent('admin-navigate-to-legacy', {
                                                        detail: { cpf: mass.cpf }
                                                    }));
                                                }}
                                                className={`text-left font-bold transition-all cursor-pointer hover:underline ${
                                                    isMidnight ? 'text-volt-green hover:text-white' : 'text-blue-600 hover:text-black'
                                                }`}
                                                title="Gerenciar cliente no Legado"
                                            >
                                                {mass.fullName}
                                            </button>
                                        </td>
                                        <td className="p-3">
                                            {isRegularizada ? (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                                    REGULARIZADA
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-500/20 text-rose-500 border border-rose-500/30">
                                                    {mass.accountStatus}
                                                </span>
                                            )}
                                        </td>
                                        <td className={`p-3 text-right font-bold ${isRegularizada ? 'text-zinc-400' : ''}`}>
                                            R$ {mass.faturaFechada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className={`p-3 text-center font-bold ${isRegularizada ? 'text-zinc-400' : 'text-rose-500'}`}>{mass.daysOverdue} d</td>
                                        <td className={`p-3 text-right font-bold ${isRegularizada ? 'text-zinc-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                            R$ {(mass.encargos?.totalEncargos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className={`p-3 text-right font-black ${isRegularizada ? 'text-zinc-400' : 'text-volt-green'}`}>
                                            R$ {mass.totalQuitacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        {/* Dashboard de Pagamentos */}
                                        {(() => {
                                            const ps = mass.paymentSummary || { totalPago: 0, saldoRestante: mass.faturaFechada || 0, statusMinimo: 'SEM_PAG' };
                                            const statusColor = ps.statusMinimo === 'ACIMA' ? 'text-emerald-500' : ps.statusMinimo === 'ABAIXO' ? 'text-amber-500' : 'text-zinc-400';
                                            const statusLabel = ps.statusMinimo === 'ACIMA' ? '✅ Acima' : ps.statusMinimo === 'ABAIXO' ? '⚠️ Abaixo' : '—';
                                            return (
                                                <>
                                                    <td className={`p-3 text-right font-bold ${ps.totalPago > 0 ? 'text-emerald-500' : 'text-zinc-400'}`}>
                                                        <button
                                                            onClick={() => setPaymentHistoryModal({ isOpen: true, mass })}
                                                            className={`font-bold transition-all cursor-pointer ${
                                                                ps.totalPago > 0
                                                                    ? 'text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 underline decoration-emerald-500/30 hover:decoration-emerald-500/80'
                                                                    : 'text-zinc-400 cursor-default'
                                                            }`}
                                                            title="Ver histórico de pagamentos"
                                                        >
                                                            R$ {ps.totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </button>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {(() => {
                                                            const lp = getLastPaymentDate(mass);
                                                            const formatted = formatLastPayment(lp);
                                                            const hasPayment = lp !== null;
                                                            return (
                                                                <span className={`text-[10px] font-bold whitespace-nowrap ${
                                                                    hasPayment ? 'text-emerald-500' : 'text-zinc-400'
                                                                }`}>
                                                                    {formatted}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className={`p-3 text-right font-bold ${ps.saldoRestante > 0 ? 'text-amber-500' : 'text-zinc-400'}`}>
                                                        <button
                                                            onClick={() => setChargeDetailModal({ isOpen: true, mass })}
                                                            className={`font-bold transition-all cursor-pointer ${
                                                                ps.saldoRestante > 0
                                                                    ? 'text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 underline decoration-amber-500/30 hover:decoration-amber-500/80'
                                                                    : 'text-zinc-400 cursor-default'
                                                            }`}
                                                            title="Ver detalhamento de encargos"
                                                        >
                                                            R$ {ps.saldoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </button>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-1.5 py-1 rounded text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${
                                                        ps.statusMinimo === 'ABAIXO'
                                                            ? (isMidnight ? 'text-red-400 bg-red-500/15 border border-red-500/50 blink-red' : 'text-red-700 bg-red-200 border-2 border-red-500 blink-red')
                                                            : `${statusColor} border border-current/30`
                                                    }`}>
                                                            {ps.statusMinimo === 'ABAIXO' ? <><Zap size={12} className="fill-current" /> {statusLabel}</> : statusLabel}
                                                        </span>
                                                    </td>
                                                </>
                                            );
                                        })()}
                                        <td className="p-3 text-center">
                                            {isRegularizada && mass.hoursAgo !== undefined ? (
                                                <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 whitespace-nowrap">
                                                    {mass.hoursAgo < 1 ? '<1h' : `${mass.hoursAgo}h`}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-zinc-400">—</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(mass.cpf);
                                                    showToast('CPF copiado para a área de transferência!', 'success');
                                                }}
                                                className={`p-1.5 rounded-lg border transition-all ${isRegularizada ? 'opacity-50' : ''} ${
                                                    isMidnight ? 'border-zinc-700 hover:bg-zinc-800' : 'border-gray-300 hover:bg-gray-200'
                                                }`}
                                                title="Copiar CPF"
                                            >
                                                <Copy size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                    );
                                })                                ) : (
                                    <tr>
                                        <td colSpan={13} className="p-4 text-center opacity-60">
                                        {!showRegularized
                                            ? 'Nenhuma massa inadimplente ativa.'
                                            : 'Nenhuma massa em atraso encontrada.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all disabled:opacity-30 ${
                                isMidnight ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-black border border-gray-300'
                            }`}
                        >
                            ← Anterior
                        </button>

                        <div className="flex items-center gap-1">
                            {(() => {
                                const pages = [];
                                const start = Math.max(1, currentPage - 2);
                                const end = Math.min(totalPages, currentPage + 2);
                                
                                if (start > 1) {
                                    pages.push(
                                        <button
                                            key="page-1"
                                            onClick={() => setCurrentPage(1)}
                                            className={`w-7 h-7 text-xs font-bold rounded-lg transition-all ${
                                                isMidnight ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-500'
                                            }`}
                                        >
                                            1
                                        </button>
                                    );
                                    if (start > 2) pages.push(<span key="dots-start" className="text-xs opacity-40 px-1">…</span>);
                                }

                                for (let i = start; i <= end; i++) {
                                    pages.push(
                                        <button
                                            key={`page-${i}`}
                                            onClick={() => setCurrentPage(i)}
                                            className={`w-7 h-7 text-xs font-bold rounded-lg transition-all ${
                                                i === currentPage
                                                    ? isMidnight
                                                        ? 'bg-volt-green text-black'
                                                        : 'bg-black text-white'
                                                    : isMidnight
                                                        ? 'hover:bg-zinc-800 text-zinc-400'
                                                        : 'hover:bg-gray-100 text-gray-500'
                                            }`}
                                        >
                                            {i}
                                        </button>
                                    );
                                }

                                if (end < totalPages) {
                                    if (end < totalPages - 1) pages.push(<span key="dots-end" className="text-xs opacity-40 px-1">…</span>);
                                    pages.push(
                                        <button
                                            key={`page-${totalPages}`}
                                            onClick={() => setCurrentPage(totalPages)}
                                            className={`w-7 h-7 text-xs font-bold rounded-lg transition-all ${
                                                isMidnight ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-500'
                                            }`}
                                        >
                                            {totalPages}
                                        </button>
                                    );
                                }

                                return pages;
                            })()}                                    </div>

                    {/* Botão: Relatório de Regularizadas */}
                    {overdueDashboard?.regularizedReport && overdueDashboard.regularizedReport.length > 0 && (
                        <button
                            onClick={() => setIsRegularizedReportOpen(true)}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                                isMidnight
                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                            }`}
                        >
                            <TrendingUp size={14} />
                            Relatório ({overdueDashboard.regularizedReport.length})
                        </button>
                    )}

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all disabled:opacity-30 ${
                                isMidnight ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-black border border-gray-300'
                            }`}
                        >
                            Próximo →
                        </button>

                        <span className="text-[10px] opacity-50 ml-1">
                            {currentPage}/{totalPages}
                        </span>
                    </div>
                )}
            </div>
            {/* Solicitações de Senha */}
            <div className={`p-6 rounded-2xl flex flex-col h-full ${cardClass}`}>
                <div className="flex items-center gap-3 mb-6">
                    <KeyRound className={isMidnight ? 'text-volt-green' : 'text-black'} />
                    <h2 className="text-xl font-black uppercase tracking-wider">Reset de Senha</h2>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-4">
                    {isLoading ? (
                        <p className="text-center opacity-50 py-8">Carregando...</p>
                    ) : passwordRequests.length > 0 ? (
                        passwordRequests.map(req => (
                            <div key={req.cpf} className={`p-4 rounded-xl flex flex-col gap-4 ${innerCardClass}`}>
                                <div className="flex justify-between items-center">
                                    <p className="font-bold">{formatCPF(req.cpf)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openModal('deny', 'password', req)} className={`flex-1 ${btnClass} ${dangerBtnClass}`}>
                                        <X size={16} /> Recusar
                                    </button>
                                    <button onClick={() => openModal('approve', 'password', req)} className={`flex-1 ${btnClass} ${primaryBtnClass}`}>
                                        <Check size={16} /> Aprovar
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center opacity-50 py-8 text-sm font-bold">Nenhuma solicitação pendente.</p>
                    )}
                </div>
            </div>

            {/* Solicitações de Limite */}
            <div className={`p-6 rounded-2xl flex flex-col h-full ${cardClass}`}>
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/10 dark:border-white/10">
                    <div className={`p-3 rounded-xl ${isMidnight ? 'bg-white/5 text-volt-green' : 'bg-black/5 text-black'}`}>
                        <FileText size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg md:text-xl font-black uppercase tracking-tight leading-tight">Solicitações de Limite</h2>
                        <p className="opacity-70 text-xs md:text-sm mt-1">Aprove ou recuse pedidos de aumento de limite dos usuários.</p>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-4">
                    {isLoading ? (
                        <p className="text-center opacity-50 py-8">Carregando...</p>
                    ) : limitRequests.length > 0 ? (
                        limitRequests.map(req => (
                            <div key={req.cpf} className={`p-4 rounded-xl flex flex-col gap-4 ${innerCardClass}`}>
                                <div>
                                    <p className="font-bold text-lg mb-1">{formatCPF(req.cpf)}</p>
                                    <p className="text-xs opacity-70">Valor Solicitado:</p>
                                    <p className="text-lg font-black text-volt-green">R$ {Number(req.amount).toFixed(2).replace('.', ',')}</p>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button onClick={() => openModal('deny', 'limit', req)} className={`flex-1 ${btnClass} ${dangerBtnClass}`}>
                                        <X size={16} /> Recusar
                                    </button>
                                    <button onClick={() => openModal('approve', 'limit', req)} className={`flex-1 ${btnClass} ${primaryBtnClass}`}>
                                        <Check size={16} /> Aprovar
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center opacity-50 py-8 text-sm font-bold">Nenhuma solicitação pendente.</p>
                    )}
                </div>
            </div>

            {/* Modal de Confirmação */}
            {modalState.isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className={`w-full max-w-md p-6 rounded-3xl ${isMidnight ? 'bg-[#1a1a1a] text-white border border-white/10' : 'bg-white text-black border-4 border-black'}`}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black uppercase">Confirmar {modalState.action === 'approve' ? 'Aprovação' : 'Recusa'}</h3>
                            <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>                                    </div>

                    {/* Botão: Relatório de Regularizadas */}
                    {overdueDashboard?.regularizedReport && overdueDashboard.regularizedReport.length > 0 && (
                        <button
                            onClick={() => setIsRegularizedReportOpen(true)}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                                isMidnight
                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                            }`}
                        >
                            <TrendingUp size={14} />
                            Relatório ({overdueDashboard.regularizedReport.length})
                        </button>
                    )}

                        <p className="text-sm font-bold opacity-70 mb-6">
                            Tem certeza que deseja {modalState.action === 'approve' ? 'aprovar' : 'recusar'} a solicitação de {modalState.type === 'limit' ? 'aumento de limite' : 'reset de senha'} para o CPF {formatCPF(modalState.data?.cpf)}?
                        </p>

                        {modalState.action === 'deny' && (
                            <div className="mb-6">
                                <label className="text-xs font-bold uppercase opacity-70 block mb-2">Motivo da Recusa</label>
                                <textarea
                                    value={denyReason}
                                    onChange={(e) => setDenyReason(e.target.value)}
                                    placeholder="Digite o motivo..."
                                    className={`w-full px-4 py-3 rounded-2xl outline-none resize-none h-24 ${inputClass}`}
                                />
                            </div>
                        )}

                        <div className="flex gap-4 mt-4">
                            <button onClick={closeModal} className={`flex-1 py-3 px-6 rounded-2xl font-bold transition-all ${outlineBtnClass}`} disabled={isLoadingAction}>Cancelar</button>
                            <button onClick={handleConfirmAction} className={`flex-1 py-3 px-6 rounded-2xl font-bold transition-all ${modalState.action === 'approve' ? primaryBtnClass : 'bg-red-500 text-white hover:bg-red-600 border-none'}`} disabled={isLoadingAction}>
                                {isLoadingAction ? 'Processando...' : 'Confirmar'}
                            </button>                                    </div>

                    {/* Botão: Relatório de Regularizadas */}
                    {overdueDashboard?.regularizedReport && overdueDashboard.regularizedReport.length > 0 && (
                        <button
                            onClick={() => setIsRegularizedReportOpen(true)}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                                isMidnight
                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                            }`}
                        >
                            <TrendingUp size={14} />
                            Relatório ({overdueDashboard.regularizedReport.length})
                        </button>
                    )}
                    </div>
                </div>
            )}

            {/* Modal: Relatório de Regularizadas */}
            <RegularizedReportModal
                isOpen={isRegularizedReportOpen}
                onClose={() => setIsRegularizedReportOpen(false)}
                items={overdueDashboard?.regularizedReport || []}
            />

            {/* Modal: Histórico de Pagamentos */}
            <PaymentHistoryDetailModal
                isOpen={paymentHistoryModal.isOpen}
                onClose={() => setPaymentHistoryModal({ isOpen: false, mass: null })}
                massCpf={paymentHistoryModal.mass?.cpf || ''}
                massName={paymentHistoryModal.mass?.fullName || ''}
                totalPago={(() => {
                    const ps = paymentHistoryModal.mass?.paymentSummary || {};
                    return ps.totalPago || 0;
                })()}
                faturaOriginal={paymentHistoryModal.mass?.faturaFechada || 0}
                saldoRestante={(() => {
                    const ps = paymentHistoryModal.mass?.paymentSummary || {};
                    return ps.saldoRestante || 0;
                })()}
                statusMinimo={(() => {
                    const ps = paymentHistoryModal.mass?.paymentSummary || {};
                    return ps.statusMinimo || 'SEM_PAG';
                })()}
                payments={paymentHistoryModal.mass?.paymentHistory || []}
            />

            {/* Modal: Detalhamento de Encargos */}
            <ChargeDetailModal
                isOpen={chargeDetailModal.isOpen}
                onClose={() => setChargeDetailModal({ isOpen: false, mass: null })}
                massCpf={chargeDetailModal.mass?.cpf || ''}
                massName={chargeDetailModal.mass?.fullName || ''}
                saldoRestante={(() => {
                    const ps = chargeDetailModal.mass?.paymentSummary || {};
                    return ps.saldoRestante || 0;
                })()}
                faturaOriginal={chargeDetailModal.mass?.faturaFechada || 0}
                daysOverdue={chargeDetailModal.mass?.daysOverdue || 0}
                encargos={(() => {
                    const enc = chargeDetailModal.mass?.encargos || {};
                    // Map backend encargos to the ChargeDetail interface
                    return {
                        multa: enc.multa || 0,
                        jurosMora: enc.jurosMora || 0,
                        jurosRemuneratorios: enc.jurosRemuneratorios || 0,
                        iof: enc.iof || 0,
                        iofAdicional: enc.iofAdicional || enc.iof || 0,
                        iofDiario: enc.iofDiario || 0,
                        totalEncargos: enc.totalEncargos || 0,
                    };
                })()}
            />
        </div>
        </>
    );
};

export default RequestsManagement;
