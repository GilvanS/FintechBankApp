import React, { useState, useEffect } from 'react';
import { User, PasswordResetRequest, LimitIncreaseRequest } from '../types';
import {
    adminGetUserByCpf,
    blockUser,
    unblockUser,
    adminDeposit,
    adminGetPasswordRequests,
    adminApprovePasswordRequest,
    adminDenyPasswordRequest,
    adminGetLimitRequests,
    adminApproveLimitRequest,
    adminDenyLimitRequest,
    adminUpdateCardDetails,
    adminGetStats,
    adminSeedTestScenario,
    adminSaveAsMock,
    adminClearMockBaseline,
    adminResetTestData,
} from '../services/api';
import { formatCPF } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { useAppState } from '../contexts/AppStateContext';

import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Shield, KeyRound, ArrowUpCircle, Users, Activity, Check, X, Eye, EyeOff, FileSpreadsheet, CheckCheck, LucideIcon } from 'lucide-react';

const StatCard: React.FC<{ title: string; value: string | number; icon: LucideIcon; isMidnight: boolean }> = ({ title, value, icon: Icon, isMidnight }) => (
    <div className={`p-6 rounded-2xl flex flex-col justify-between border transition-colors ${
        isMidnight
            ? 'bg-volt-surface border-white/5 shadow-md text-white hover:border-volt-green/20'
            : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black hover:bg-gray-50'
    }`}>
        <div className="flex items-center space-x-3 mb-3">
            <Icon className={`w-6 h-6 ${isMidnight ? 'text-volt-green' : 'text-black'}`} />
            <p className={`text-[10px] break-words leading-tight ${isMidnight ? 'font-semibold text-white/80' : 'font-black uppercase tracking-wider text-black/60'}`}>{title}</p>
        </div>
        <p className={`text-2xl ${isMidnight ? 'font-bold text-white' : 'font-black text-black'}`}>{value}</p>
    </div>
);

const Admin: React.FC<{ onClose: () => void; }> = ({ onClose }) => {
    const { user: adminUser, logout } = useAuth();
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const [cpfSearch, setCpfSearch] = useState('');
    const [searchedUser, setSearchedUser] = useState<User | null>(null);
    const [unmaskedCards, setUnmaskedCards] = useState<Record<string, boolean>>({});
    const [selectedBackofficeInvoice, setSelectedBackofficeInvoice] = useState<'open' | 'closed' | 'previous'>('closed');
    const [copiedExcelSuccess, setCopiedExcelSuccess] = useState(false);
    const [passwordRequests, setPasswordRequests] = useState<PasswordResetRequest[]>([]);
    const [limitRequests, setLimitRequests] = useState<LimitIncreaseRequest[]>([]);
    const [isLoadingAction, setIsLoadingAction] = useState(false);
    const [stats, setStats] = useState<{
        totalClients: number;
        transactionsToday: number;
        passwordRequests: number;
        limitRequests: number;
    }>({
        totalClients: 0,
        transactionsToday: 0,
        passwordRequests: 0,
        limitRequests: 0
    });
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    // State for Modals and Toasts
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        action: 'approve' | 'deny' | 'block' | 'unblock' | 'deposit' | null;
        data?: any;
    }>({ isOpen: false, action: null });
    const [denyReason, setDenyReason] = useState('');
    const [depositAmount, setDepositAmount] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // State for card details form
    const [cardDueDate, setCardDueDate] = useState('');
    const [cardInvoiceDate, setCardInvoiceDate] = useState('');

    useEffect(() => {
        if (searchedUser) {
            setCardDueDate(searchedUser.creditCard.dueDate);
            const invoiceDateStr = searchedUser.creditCard.closedInvoiceDueDate || searchedUser.creditCard.invoiceDueDate;
            const invoiceDate = new Date(invoiceDateStr);
            const formattedDate = invoiceDate.toISOString().split('T')[0];
            setCardInvoiceDate(formattedDate);
        }
    }, [searchedUser]);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchRequests = async () => {
        try {
            const [pwReqs, limReqs] = await Promise.all([
                adminGetPasswordRequests(),
                adminGetLimitRequests()
            ]);
            setPasswordRequests(pwReqs || []);
            setLimitRequests(limReqs || []);
        } catch (error: any) {
            console.error('Erro ao buscar solicitações:', error);
            setPasswordRequests([]);
            setLimitRequests([]);
            showToast('Erro ao carregar solicitações pendentes.', 'error');
        }
    };

    const fetchStats = async () => {
        setIsLoadingStats(true);
        try {
            const result = await adminGetStats();
            if (result.success && result.stats) {
                setStats(result.stats);
            }
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
        } finally {
            setIsLoadingStats(false);
        }
    };

    useEffect(() => {
        fetchRequests();
        fetchStats();
    }, []);

    const handleSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!cpfSearch) return;
        const result = await adminGetUserByCpf(cpfSearch.replace(/\D/g, ''));
        if (result.success && result.user) {
            setSearchedUser(result.user);
        } else {
            showToast(result.message, 'error');
            setSearchedUser(null);
        }
    };

    const openModal = (action: typeof modalState.action, data: any) => {
        setModalState({ isOpen: true, action, data });
    };

    const closeModal = () => {
        setModalState({ isOpen: false, action: null, data: null });
        // FIX: Corrected typo and completed the function to reset modal state.
        setDenyReason('');
        setDepositAmount('');
    };

    const handleUpdateCard = async () => {
        if (!searchedUser) return;
        setIsLoadingAction(true);
        const result = await adminUpdateCardDetails(searchedUser.cpf, {
            dueDate: cardDueDate,
            invoiceDueDate: new Date(cardInvoiceDate + 'T00:00:00Z').toISOString()
        });
        if (result.success && result.user) {
            setSearchedUser(result.user);
            showToast(result.message, 'success');
        } else {
            showToast(result.message, 'error');
        }
        setIsLoadingAction(false);
    };

    const handleConfirmAction = async () => {
        if (!modalState.action || !modalState.data) return;

        setIsLoadingAction(true);
        let result: { success: boolean; message: string; user?: User };

        switch (modalState.action) {
            case 'approve':
                if (modalState.data.amount) { // Limit request
                    result = await adminApproveLimitRequest(modalState.data.cpf);
                } else { // Password request
                    result = await adminApprovePasswordRequest(modalState.data.cpf);
                }
                break;
            case 'deny':
                if (modalState.data.amount) { // Limit request
                    result = await adminDenyLimitRequest(modalState.data.cpf, denyReason);
                } else { // Password request
                    result = await adminDenyPasswordRequest(modalState.data.cpf, denyReason);
                }
                break;
            case 'block':
                result = await blockUser(modalState.data.cpf);
                if (result.success && result.user) setSearchedUser(result.user);
                break;
            case 'unblock':
                result = await unblockUser(modalState.data.cpf);
                if (result.success && result.user) setSearchedUser(result.user);
                break;
            case 'deposit':
                const amount = parseFloat(depositAmount);
                if (isNaN(amount) || amount <= 0) {
                    showToast('Valor de depósito inválido.', 'error');
                    setIsLoadingAction(false);
                    return;
                }
                result = await adminDeposit(modalState.data.cpf, amount);
                if (result.success && result.user) setSearchedUser(result.user);
                break;
            default:
                result = { success: false, message: 'Ação desconhecida.' };
        }

        showToast(result.message, result.success ? 'success' : 'error');
        setIsLoadingAction(false);
        closeModal();
        fetchRequests(); // Refresh lists
        fetchStats(); // Refresh stats
    };

    // ── Billing Mock (issue #42) ─────────────────────────────────────────────
    const [billingCpf, setBillingCpf] = useState('11111111111');
    const [billingLoading, setBillingLoading] = useState(false);
    const [billingMsg, setBillingMsg] = useState<{ text: string; ok: boolean } | null>(null);

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

    // Classes derivadas do tema — mesma estrutura, só troca as cores.
    const btnTypographyClass = isMidnight
        ? 'font-semibold normal-case tracking-normal'
        : 'font-black uppercase tracking-wider';
    const btnTypographySmallClass = isMidnight
        ? 'font-semibold normal-case tracking-normal text-xs'
        : 'font-bold uppercase tracking-wider text-xs';

    const modalCardClass = isMidnight
        ? 'bg-volt-dark text-white font-sans'
        : 'bg-white text-black border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]';
    const iconAccentClass = isMidnight ? 'text-volt-green' : 'text-black';
    const titleClass = isMidnight ? 'text-white' : 'text-black';
    const subTextClass = isMidnight ? 'text-white/80 font-medium' : 'text-black/60 font-bold';
    const closeBtnClass = isMidnight
        ? 'p-2 rounded-full border border-white/10 bg-volt-surface hover:bg-white/10 text-white shadow-none'
        : 'p-2 rounded-full border-2 border-black bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-black/5';
    const sectionCardClass = isMidnight
        ? 'bg-volt-surface border border-white/5 shadow-md rounded-2xl'
        : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rounded-2xl';
    const innerCardClass = isMidnight
        ? 'bg-volt-dark border border-white/5 rounded-xl'
        : 'bg-black/5 border border-black/10 rounded-xl';
    const inputClass = isMidnight
        ? 'bg-volt-surface text-white border border-white/10 focus:border-volt-green focus:ring-1 focus:ring-volt-green placeholder-white/30 rounded-xl'
        : 'bg-white text-black border-2 border-black focus:border-volt-pink-focus placeholder-black/30 rounded-xl';
    const searchBtnClass = isMidnight
        ? 'text-black bg-volt-green hover:bg-[#00e38b] transition-all rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.2)] border-none'
        : 'text-black bg-volt-lime border-2 border-black hover:opacity-90 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-2xl';
    const primaryOutlineBtnClass = isMidnight
        ? 'text-black bg-volt-green hover:bg-[#00e38b] transition-all rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.2)] border-none'
        : 'bg-volt-lime/20 text-black border-2 border-black hover:bg-volt-lime/30 rounded-2xl';
    const dangerOutlineBtnClass = isMidnight
        ? 'text-white bg-red-600 hover:bg-red-500 transition-all rounded-xl shadow-[0_4px_12px_rgba(220,38,38,0.2)] border-none'
        : 'bg-red-500/10 text-red-600 border-2 border-red-600/40 hover:bg-red-500/20 rounded-2xl';
    const neutralBtnClass = isMidnight
        ? 'bg-volt-surface text-white border border-white/10 hover:bg-white/5 transition-all rounded-xl'
        : 'bg-black/5 text-black border border-black/20 hover:bg-black/10 rounded-2xl';
    const dividerClass = isMidnight ? 'border-white/5' : 'border-black/10';
    const emptyStateClass = isMidnight ? 'text-white/40 font-medium' : 'text-black/40 font-bold';
    const modalOverlayClass = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 test-admin-modal-overlay';

    return (
        <div 
            className={`flex flex-col relative w-full h-full min-h-full ${modalCardClass} max-w-7xl mx-auto test-admin-page`}
            id="admin-page"
            data-testid="admin-page"
            data-cy="admin-page"
            data-playwright="admin-page"
        >
            <div className="p-4 overflow-y-auto no-scrollbar flex flex-col flex-1">
                <header
                    className="flex items-center justify-between gap-3 mb-8 test-admin-header"
                    id="admin-header"
                    data-testid="admin-header"
                    data-cy="admin-header"
                >
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={onClose}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors test-admin-close-button ${closeBtnClass}`}
                            id="btn-admin-close"
                            name="admin-close-button"
                            data-testid="admin-close-button"
                            data-cy="admin-close-button"
                            data-playwright="admin-close-button"
                            aria-label="Voltar"
                            type="button"
                        >
                            <ArrowLeft className={titleClass} aria-hidden="true" />
                        </button>
                        <Shield className={`w-9 h-9 test-admin-icon ${iconAccentClass}`} data-testid="admin-icon" aria-hidden="true" />
                        <div>
                            <h1
                                className={`text-xl font-bold test-admin-title ${titleClass}`}
                                id="admin-title"
                                data-testid="admin-title"
                                data-cy="admin-title"
                                data-playwright="admin-title"
                            >
                                Painel do Administrador
                            </h1>
                            <p
                                className={`text-xs font-bold test-admin-greeting ${subTextClass}`}
                                id="admin-greeting"
                                data-testid="admin-greeting"
                            >
                                Bem-vindo, {adminUser?.fullName.split(' ')[0]}
                            </p>
                        </div>
                    </div>
                </header>

                            <main
                                className="flex-grow space-y-8 test-admin-main"
                                id="admin-main"
                                data-testid="admin-main"
                                data-cy="admin-main"
                            >
                {/* Stats */}
                <section
                    className="grid grid-cols-2 gap-4 test-admin-stats"
                    id="admin-stats"
                    data-testid="admin-stats"
                    data-cy="admin-stats"
                >
                    <StatCard
                        title="Solicitações de Senha"
                        value={isLoadingStats ? '-' : stats.passwordRequests}
                        icon={KeyRound}
                        isMidnight={isMidnight}
                    />
                    <StatCard
                        title="Solicitações de Limite"
                        value={isLoadingStats ? '-' : stats.limitRequests}
                        icon={ArrowUpCircle}
                        isMidnight={isMidnight}
                    />
                    <StatCard
                        title="Total de Clientes"
                        value={isLoadingStats ? '-' : stats.totalClients}
                        icon={Users}
                        isMidnight={isMidnight}
                    />
                    <StatCard
                        title="Transações Hoje"
                        value={isLoadingStats ? '-' : stats.transactionsToday}
                        icon={Activity}
                        isMidnight={isMidnight}
                    />
                </section>

                {/* User Management */}
                <section
                    className={`p-6 rounded-2xl test-admin-user-management ${sectionCardClass}`}
                    id="admin-user-management"
                    data-testid="admin-user-management"
                    data-cy="admin-user-management"
                >
                    <h2
                        className={`text-xl font-bold uppercase tracking-wider mb-6 test-admin-user-management-title ${titleClass}`}
                        id="admin-user-management-title"
                        data-testid="admin-user-management-title"
                    >
                        Gerenciar Cliente
                    </h2>
                    <form
                        onSubmit={handleSearch}
                        className="flex flex-col gap-4 mb-6 test-admin-search-form"
                        id="admin-search-form"
                        name="admin-search-form"
                        data-testid="admin-search-form"
                        data-cy="admin-search-form"
                        data-playwright="admin-search-form"
                    >
                        <input
                            type="text"
                            value={formatCPF(cpfSearch)}
                            onChange={(e) => setCpfSearch(e.target.value)}
                            placeholder="Buscar por CPF"
                            maxLength={14}
                            className={`flex-grow px-4 py-3 rounded-2xl focus:outline-none transition-all ${isMidnight ? 'font-medium' : 'font-bold'} test-input-cpf-search ${inputClass}`}
                            id="admin-cpf-search"
                            name="cpf-search"
                            data-testid="admin-cpf-search"
                            data-cy="admin-cpf-search"
                            data-playwright="admin-cpf-search"
                            aria-label="Buscar por CPF"
                        />
                        <button
                            type="submit"
                            className={`px-6 py-3 rounded-2xl transition-all test-admin-search-button ${btnTypographyClass} ${searchBtnClass}`}
                            id="btn-admin-search"
                            name="admin-search-button"
                            data-testid="admin-search-button"
                            data-cy="admin-search-button"
                            data-playwright="admin-search-button"
                            aria-label="Buscar cliente"
                        >
                            Buscar
                        </button>
                    </form>
                    {searchedUser && (
                        <div className={`p-6 rounded-2xl flex flex-col gap-8 ${innerCardClass}`}>
                            {/* Header do Cliente / Backoffice */}
                            <div className="flex-1 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h3 className={`font-black text-2xl ${titleClass}`}>{searchedUser.fullName}</h3>
                                        <p className={`text-xs ${isMidnight ? 'font-medium text-white/70' : 'font-bold uppercase text-black/70'}`}>CPF: {formatCPF(searchedUser.cpf)} • Username: @{searchedUser.username || 'cliente'}</p>
                                    </div>
                                    {(() => {
                                        const closedAmount = searchedUser.creditCard?.closedInvoice || 0;
                                        const today = new Date();
                                        let dueDate = searchedUser.creditCard?.invoiceDueDate 
                                            ? new Date(searchedUser.creditCard.invoiceDueDate)
                                            : new Date(today.getFullYear(), today.getMonth() - 1, 15);
                                        if (isNaN(dueDate.getTime())) dueDate = new Date(today.getFullYear(), today.getMonth() - 1, 15);
                                        
                                        let diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                                        const explicitDays = (searchedUser as any).daysOverdue || 0;
                                        const overdueDays = explicitDays > 0 ? explicitDays : (closedAmount > 0 ? Math.max(7, diffDays) : 0);
                                        const isOverdue = closedAmount > 0 && overdueDays > 0;

                                        return (
                                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${
                                                isOverdue 
                                                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/40'
                                                    : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                                            }`}>
                                                {isOverdue ? `Fatura Fechada em Atraso (${overdueDays} dias)` : 'Fatura Fechada em Dia'}
                                            </span>
                                        );
                                    })()}
                                </div>

                                <p className={`text-xs mt-1 ${isMidnight ? 'font-semibold text-volt-green' : 'font-bold uppercase'} ${searchedUser.isBlocked || searchedUser.creditCard.isBlocked ? (isMidnight ? 'text-red-400' : 'text-red-600') : (isMidnight ? 'text-green-400' : 'text-green-600')}`}>
                                    {searchedUser.isBlocked ? 'CONTA BLOQUEADA' : 'CONTA ATIVA'} / {searchedUser.creditCard.isBlocked ? 'CARTÃO BLOQUEADO' : 'CARTÃO ATIVO'}
                                </p>

                                {/* Painel Backoffice: Saúde Financeira & Auditoria de Encargos */}
                                {(() => {
                                     const openAmount = searchedUser.creditCard?.currentInvoice && searchedUser.creditCard.currentInvoice > 0 ? searchedUser.creditCard.currentInvoice : 2365.05;
                                     const closedAmount = searchedUser.creditCard?.closedInvoiceAmount || searchedUser.creditCard?.closedInvoice || 3870.86;
                                     const previousAmount = 1120.00; // Fatura Anterior (Mai/26) - Paga
                                     const diffTime = Math.abs(new Date().getTime() - new Date(searchedUser.creditCard?.closedInvoiceDueDate || searchedUser.creditCard?.invoiceDueDate || '2026-07-15').getTime());
                                     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                     const explicitDays = (searchedUser as any).daysOverdue || 0;
                                     const overdueDays = explicitDays > 0 ? explicitDays : (closedAmount > 0 ? Math.max(7, diffDays) : 0);
                                     const isOverdue = closedAmount > 0 && overdueDays > 0;

                                     const multa = isOverdue ? Math.round(closedAmount * 0.02 * 100) / 100 : 0;
                                     const jurosMora = isOverdue ? Math.round(closedAmount * 0.000333 * overdueDays * 100) / 100 : 0;
                                     const jurosRemun = isOverdue ? Math.round(closedAmount * 0.00513 * overdueDays * 100) / 100 : 0;
                                     const iofFixo = Math.round(closedAmount * 0.0038 * 100) / 100;
                                     const iofDiario = isOverdue ? Math.round(closedAmount * 0.000082 * overdueDays * 100) / 100 : 0;
                                     const iofTotal = Math.round((iofFixo + iofDiario) * 100) / 100;
                                     const totalEncargos = Math.round((multa + jurosMora + jurosRemun + iofTotal) * 100) / 100;
                                     const totalWithCharges = Math.round((closedAmount + totalEncargos) * 100) / 100;

                                     // Mínimos (10%)
                                     const minOpenOriginal = Math.round(openAmount * 0.10 * 100) / 100; 
                                     const minClosedOriginal = Math.round(closedAmount * 0.10 * 100) / 100; 
                                     const minPreviousOriginal = Math.round(previousAmount * 0.10 * 100) / 100; 
                                     const minClosedWithCharges = Math.round((minClosedOriginal + totalEncargos) * 100) / 100; 
                                     const totalOpenConsolidated = Math.round((openAmount + totalWithCharges) * 100) / 100; 
                                     const minOpenConsolidated = Math.round((minOpenOriginal + totalWithCharges) * 100) / 100; 

                                     return (
                                         <div className={`mt-4 p-4 rounded-xl border space-y-3 ${isMidnight ? 'bg-zinc-900/80 border-white/10' : 'bg-white border-black/20 shadow-sm'}`}>
                                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 dark:border-white/10 pb-2">
                                                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-500 flex items-center gap-2">
                                                      <span>Diagnóstico Backoffice (Últimas 3 Faturas Visíveis)</span>
                                                      <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
                                                          {selectedBackofficeInvoice === 'closed'
                                                              ? '(Fatura Fechada Vencida 📂)'
                                                              : selectedBackofficeInvoice === 'open'
                                                              ? '(Fatura Aberta 📂)'
                                                              : '(Fatura Anterior Paga 📂)'}
                                                      </span>
                                                  </h4>

                                                  <button
                                                      type="button"
                                                      onClick={() => {
                                                          let tsvData = `RELATÓRIO DE FATURA E ENCARGOS - BACKOFFICE FINTECH\t${new Date().toLocaleDateString('pt-BR')}\n`;
                                                          tsvData += `Cliente:\t${searchedUser.fullName}\tCPF:\t${searchedUser.cpf}\n`;
                                                          tsvData += `Fatura Selecionada:\t${selectedBackofficeInvoice === 'closed' ? 'Fatura Fechada Jun/26' : selectedBackofficeInvoice === 'open' ? 'Fatura Aberta Jul/26' : 'Fatura Mai/26 Paga'}\tDias em Atraso:\t${overdueDays}\n\n`;
                                                          tsvData += `CÓDIGO ISO\tITEM / DESCRIÇÃO DO ENCARGO\tTAXA / REGRA\tVALOR (R$)\n`;

                                                          if (selectedBackofficeInvoice === 'closed') {
                                                              tsvData += `BASE\tValor Original Fatura Fechada (Invariável)\tValor Fixo Fechamento\t${closedAmount.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `MIN\tPagamento Mínimo Fixado no Corte (10%)\t10.00%\t${minClosedOriginal.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `CÓD 3000\tTaxa de Multa por Atraso (Informativo)\t2.00%\t${multa.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `CÓD 2001\tJuros de Mora (Informativo)\t0.0333%/dia\t${jurosMora.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `CÓD 2000\tJuros Remuneratórios / Financiamento\t0.513%/dia\t${jurosRemun.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `CÓD 4001\tIOF Adicional (Fixo - Compras)\t0.38%\t${iofFixo.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `CÓD 4000\tIOF Diário (Atraso)\t0.0082%/dia\t${iofDiario.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `TOTAL_ENC\tValor Total dos Encargos do Atraso (Memória)\tAcumulado (${overdueDays}d)\t${totalEncargos.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `NOTA\tEncargos herdados e consolidados na FATURA ABERTA\tSomente no Corte/Fechamento Aberta\t0,00\n`;
                                                              tsvData += `MIN_REGULARIZAR\tPagamento Mínimo Obrigatório p/ Regularizar Atraso\tMínimo Original (10%) + 100% Encargos\t${minClosedWithCharges.toFixed(2).replace('.', ',')}\n`;
                                                          } else if (selectedBackofficeInvoice === 'open') {
                                                              tsvData += `BASE\tNovas Compras do Mês Corrente (Jul/26)\tAberto\t${openAmount.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `MIN\tPagamento Mínimo Compras Correntes (10%)\t10.00%\t${minOpenOriginal.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `HERANCA\tFatura Fechada Anterior em Atraso (Jun/26)\tInvariável\t${closedAmount.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `CÓD 3000\tTaxa de Multa por Atraso (Herdada)\t2.00%\t${multa.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `CÓD 2001\tJuros de Mora (Herdado)\t0.0333%/dia\t${jurosMora.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `CÓD 2000\tJuros Remuneratórios (Herdado)\t0.513%/dia\t${jurosRemun.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `CÓD 4001\tIOF Adicional Fixo (Herdado)\t0.38%\t${iofFixo.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `CÓD 4000\tIOF Diário (Herdado)\t0.0082%/dia\t${iofDiario.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `TOTAL_HER\tTotal Encargos Herdados\tAcumulado (${overdueDays}d)\t${totalEncargos.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `TOTAL_CORTE\tTotal Consolidado no Fechamento/Corte\tCompras + Herança + Encargos\t${totalOpenConsolidated.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `MIN_CORTE\tPagamento Mínimo Consolidado no Corte\tMínimo + Herança + Encargos\t${minOpenConsolidated.toFixed(2).replace('.', ',')}\n`;
                                                          } else {
                                                              tsvData += `BASE\tFatura Anterior Mai/26 Quitada\t15/05/2026\t${previousAmount.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `MIN\tPagamento Mínimo da Época (10%)\t10.00%\t${minPreviousOriginal.toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `CÓD 3000\tTaxa de Multa por Atraso\t0.00%\t0,00\n`;
                                                              tsvData += `CÓD 2001\tJuros de Mora\t0.00%/dia\t0,00\n`;
                                                              tsvData += `CÓD 2000\tJuros Remuneratórios\t0.00%/dia\t0,00\n`;
                                                              tsvData += `CÓD 4001\tIOF Adicional Fixo (Compras)\t0.38%\t${(previousAmount * 0.0038).toFixed(2).replace('.', ',')}\n`;
                                                              tsvData += `CÓD 4000\tIOF Diário\t0.00%/dia\t0,00\n`;
                                                              tsvData += `STATUS\tStatus da Fatura\t100% Quitada\t0,00\n`;
                                                          }

                                                          try {
                                                              navigator.clipboard.writeText(tsvData);
                                                          } catch (err) {
                                                              console.error('Erro ao copiar dados para a área de transferência:', err);
                                                          }
                                                          setCopiedExcelSuccess(true);
                                                          setTimeout(() => setCopiedExcelSuccess(false), 3000);
                                                      }}
                                                      className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer border shadow-sm ${
                                                          copiedExcelSuccess
                                                              ? 'bg-emerald-600 text-white border-emerald-500'
                                                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                                      }`}
                                                      title="Copiar dados da fatura em formato de colunas TSV para colar no Microsoft Excel"
                                                  >
                                                      {copiedExcelSuccess ? (
                                                          <>
                                                              <CheckCheck className="w-3.5 h-3.5" />
                                                              <span>Copiado para o Excel! ✅</span>
                                                          </>
                                                      ) : (
                                                          <>
                                                              <FileSpreadsheet className="w-3.5 h-3.5" />
                                                              <span>📊 Copiar p/ Excel</span>
                                                          </>
                                                      )}
                                                  </button>
                                              </div>

                                             {/* Grid das Últimas 3 Faturas numeradas (Fat 1 = mais antiga → Fat 3 = mais recente).
                                                 Sempre 3 slots: o mais recente (Fat 3) é a fatura aberta/atual, reservando o
                                                 espaço para a próxima fatura quando houver. */}
                                             <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                                                 <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 flex flex-col justify-between">
                                                     <p className="opacity-60 text-[10px] uppercase font-bold">Saldo Conta</p>
                                                     <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm">R$ {searchedUser.balance.toFixed(2)}</p>
                                                 </div>

                                                 {/* Fat 1 — Fatura mais antiga (Mai/26) - PAGA */}
                                                 <button
                                                     type="button"
                                                     onClick={() => setSelectedBackofficeInvoice('previous')}
                                                     className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border relative overflow-hidden ${
                                                         selectedBackofficeInvoice === 'previous'
                                                             ? 'bg-emerald-500/15 border-emerald-500 shadow-sm ring-2 ring-emerald-500/40'
                                                             : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-emerald-300'
                                                     }`}
                                                 >
                                                     <div className="flex justify-between items-center">
                                                         <p className="opacity-60 text-[10px] uppercase font-bold">Fat 1 · Mai/26</p>
                                                         <span className="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded-full">PAGA ✅</span>
                                                     </div>
                                                     <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm mt-1">R$ {previousAmount.toFixed(2)}</p>
                                                 </button>

                                                 {/* Fat 2 — Fatura Fechada (Jun/26) - Com ÍCONE DE ATRASO Em Cima */}
                                                 <button
                                                     type="button"
                                                     onClick={() => setSelectedBackofficeInvoice('closed')}
                                                     className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border relative overflow-hidden ${
                                                         selectedBackofficeInvoice === 'closed'
                                                             ? 'bg-rose-500/15 border-rose-500 shadow-sm ring-2 ring-rose-500/40'
                                                             : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-rose-300'
                                                     }`}
                                                 >
                                                     <div className="flex justify-between items-center">
                                                         <p className="opacity-60 text-[10px] uppercase font-bold">Fat 2 · Fechada (Jun)</p>
                                                         {isOverdue ? (
                                                             <span className="text-[9px] bg-rose-600 text-white font-black px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-1 shadow-sm">
                                                                 ⚠️ {overdueDays}d ATRASO
                                                             </span>
                                                         ) : (
                                                             <span className="text-[9px] bg-rose-500 text-white font-black px-1.5 py-0.5 rounded-full">FECHADA</span>
                                                         )}
                                                     </div>
                                                     <p className="font-black text-rose-600 dark:text-rose-400 text-sm mt-1">R$ {closedAmount.toFixed(2)}</p>
                                                 </button>

                                                 {/* Fat 3 — Fatura Aberta/atual (Jul/26) */}
                                                 <button
                                                     type="button"
                                                     onClick={() => setSelectedBackofficeInvoice('open')}
                                                     className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border relative overflow-hidden ${
                                                         selectedBackofficeInvoice === 'open'
                                                             ? 'bg-blue-500/15 border-blue-500 shadow-sm ring-2 ring-blue-500/40'
                                                             : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-blue-300'
                                                     }`}
                                                 >
                                                     <div className="flex justify-between items-center">
                                                         <p className="opacity-60 text-[10px] uppercase font-bold">Fat 3 · Aberta (Jul)</p>
                                                         <span className="text-[9px] bg-blue-500 text-white font-black px-1.5 py-0.5 rounded-full">ABERTA</span>
                                                     </div>
                                                     <p className="font-black text-blue-600 dark:text-blue-400 text-sm mt-1">R$ {openAmount.toFixed(2)}</p>
                                                 </button>

                                             </div>

                                             {/* Detalhamento da Fatura Selecionada */}
                                             {selectedBackofficeInvoice === 'closed' ? (
                                                 <div className="mt-3 pt-3 border-t border-dashed border-black/10 dark:border-white/10 space-y-1.5 text-[11px]">
                                                     <div className="flex justify-between items-center bg-rose-500/10 p-2 rounded-lg font-bold text-rose-600 dark:text-rose-300 mb-2">
                                                         <span>📄 Fatura Fechada Jun/26 (Valor Original Invariável no Fechamento):</span>
                                                         <span className="font-mono">R$ {closedAmount.toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                                                         <span>🔹 Pagamento Mínimo da Fatura Fechada (sem encargos - 10%):</span>
                                                         <span className="font-mono font-bold">R$ {minClosedOriginal.toFixed(2)}</span>
                                                     </div>

                                                     {/* Todas as 5 linhas de encargos sempre visíveis */}
                                                     <div className="pt-2 font-bold text-[10px] uppercase tracking-wider text-amber-500 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                                                         <span>⚠️ Encargos do Atraso ({overdueDays} dias acumulados no período):</span>
                                                     </div>
                                                     <div className="flex justify-between items-center">
                                                         <span className="opacity-70 flex items-center gap-1">
                                                             <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 3000</span>
                                                             Taxa de Multa por Atraso (2.0%):
                                                         </span>
                                                         <span className="font-mono font-bold">R$ {multa.toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex justify-between items-center">
                                                         <span className="opacity-70 flex items-center gap-1">
                                                             <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 2001</span>
                                                             Juros de Mora (0.0333%/dia):
                                                         </span>
                                                         <span className="font-mono font-bold">R$ {jurosMora.toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex justify-between items-center">
                                                         <span className="opacity-70 flex items-center gap-1">
                                                             <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 2000</span>
                                                             Juros Remuneratórios / Financiamento (0.513%/dia):
                                                         </span>
                                                         <span className="font-mono font-bold">R$ {jurosRemun.toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex justify-between items-center">
                                                         <span className="opacity-70 flex items-center gap-1">
                                                             <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 4001</span>
                                                             IOF Adicional (Fixo - 0.38%):
                                                         </span>
                                                         <span className="font-mono font-bold">R$ {iofFixo.toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex justify-between items-center">
                                                         <span className="opacity-70 flex items-center gap-1">
                                                             <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 4000</span>
                                                             IOF Diário (0.0082%/dia):
                                                         </span>
                                                         <span className="font-mono font-bold">R$ {iofDiario.toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex justify-between pt-2 border-t border-black/10 dark:border-white/10 font-bold text-amber-600 dark:text-amber-400">
                                                          <span>Valor Total dos Encargos do Atraso (Memória Informativa):</span>
                                                          <span className="font-mono">R$ {totalEncargos.toFixed(2)}</span>
                                                      </div>

                                                      <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                                                          <span>ℹ️</span>
                                                          <span>Esta fatura fechada é informativa. Os encargos do atraso (R$ {totalEncargos.toFixed(2)}) e o saldo original são herdados e somados na FATURA ABERTA para a consolidação final no corte.</span>
                                                      </div>
                                                 </div>
                                             ) : selectedBackofficeInvoice === 'open' ? (
                                                 /* Fatura Aberta Selecionada (Com Herança) */
                                                 <div className="mt-3 pt-3 border-t border-dashed border-black/10 dark:border-white/10 space-y-1.5 text-[11px]">
                                                     <div className="flex justify-between items-center bg-blue-500/10 p-2 rounded-lg font-bold text-blue-600 dark:text-blue-300 mb-2">
                                                         <span>🛍️ Novas Compras do Mês Corrente (Fatura Aberta Jul/26):</span>
                                                         <span className="font-mono">R$ {openAmount.toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                                                         <span>🔹 Pagamento Mínimo das Compras Correntes (10% sem encargos):</span>
                                                         <span className="font-mono font-bold">R$ {minOpenOriginal.toFixed(2)}</span>
                                                     </div>

                                                     {/* Encargos Herdados em detalhe */}
                                                     <div className="pt-2 font-bold text-[10px] uppercase tracking-wider text-rose-500 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                                                         <span>Herança de Atraso da Fatura Anterior (Jun/26):</span>
                                                     </div>
                                                     <div className="flex justify-between items-center text-rose-500 font-bold">
                                                         <span>Fatura Fechada Anterior em Atraso (Valor Invariável):</span>
                                                         <span className="font-mono">R$ {closedAmount.toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex justify-between items-center text-amber-500">
                                                         <span className="opacity-90 flex items-center gap-1">
                                                             <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 3000</span>
                                                             Taxa de Multa por Atraso (2.0%):
                                                         </span>
                                                         <span className="font-mono font-bold">R$ {multa.toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex justify-between items-center text-amber-500">
                                                         <span className="opacity-90 flex items-center gap-1">
                                                             <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 2001</span>
                                                             Juros de Mora (0.0333%/dia):
                                                         </span>
                                                         <span className="font-mono font-bold">R$ {jurosMora.toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex justify-between items-center text-amber-500">
                                                         <span className="opacity-90 flex items-center gap-1">
                                                             <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 2000</span>
                                                             Juros Remuneratórios (0.513%/dia):
                                                         </span>
                                                         <span className="font-mono font-bold">R$ {jurosRemun.toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex justify-between items-center text-amber-500">
                                                         <span className="opacity-90 flex items-center gap-1">
                                                             <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 4001</span>
                                                             IOF Adicional (Fixo - 0.38%):
                                                         </span>
                                                         <span className="font-mono font-bold">R$ {iofFixo.toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex justify-between items-center text-amber-500">
                                                         <span className="opacity-90 flex items-center gap-1">
                                                             <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 4000</span>
                                                             IOF Diário (0.0082%/dia):
                                                         </span>
                                                         <span className="font-mono font-bold">R$ {iofDiario.toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex justify-between font-bold text-amber-500 pt-1">
                                                         <span>Total de Encargos Herdados do Atraso ({overdueDays} dias):</span>
                                                         <span className="font-mono">R$ {totalEncargos.toFixed(2)}</span>
                                                     </div>

                                                     <div className="flex justify-between pt-2 border-t border-black/10 dark:border-white/10 text-xs font-black text-purple-600 dark:text-purple-300">
                                                         <span>Total Consolidado para Fechamento/Corte (Compras + Fatura Fechada + Encargos):</span>
                                                         <span className="font-mono">R$ {totalOpenConsolidated.toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex justify-between text-xs font-bold text-emerald-500">
                                                         <span>Pagamento Mínimo Consolidado no Corte (Mínimo Aberta + Fatura Fechada + Encargos):</span>
                                                         <span className="font-mono">R$ {minOpenConsolidated.toFixed(2)}</span>
                                                     </div>
                                                 </div>
                                             ) : (
                                                 /* Fatura Anterior Selecionada (Paga) */
                                                 <div className="mt-3 pt-3 border-t border-dashed border-black/10 dark:border-white/10 space-y-1.5 text-[11px]">
                                                     <div className="flex justify-between items-center bg-emerald-500/10 p-2 rounded-lg font-bold text-emerald-600 dark:text-emerald-300 mb-2">
                                                         <span>✅ Fatura Anterior Mai/26 (Quitada em 15/05/2026):</span>
                                                         <span className="font-mono">R$ {previousAmount.toFixed(2)}</span>
                                                     </div>
                                                     <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                                                         <span>🔹 Pagamento Mínimo da Época (10% sem encargos):</span>
                                                         <span className="font-mono font-bold">R$ {minPreviousOriginal.toFixed(2)}</span>
                                                     </div>
                                                     <div className="pt-2 font-bold text-[10px] uppercase tracking-wider text-zinc-400 border-t border-black/5 dark:border-white/5">
                                                         Encargos do Atraso (0 dias - Pago em dia):
                                                     </div>
                                                     <div className="flex justify-between items-center opacity-60">
                                                         <span className="flex items-center gap-1">
                                                             <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 3000</span> Taxa de Multa por Atraso (2.0%):
                                                         </span>
                                                         <span className="font-mono">R$ 0.00</span>
                                                     </div>
                                                     <div className="flex justify-between items-center opacity-60">
                                                         <span className="flex items-center gap-1">
                                                             <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 2001</span> Juros de Mora (0.0333%/dia):
                                                         </span>
                                                         <span className="font-mono">R$ 0.00</span>
                                                     </div>
                                                     <div className="flex justify-between items-center opacity-60">
                                                         <span className="flex items-center gap-1">
                                                             <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 2000</span> Juros Remuneratórios (0.513%/dia):
                                                         </span>
                                                         <span className="font-mono">R$ 0.00</span>
                                                     </div>
                                                     <div className="flex justify-between items-center opacity-60">
                                                         <span className="flex items-center gap-1">
                                                             <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 4001</span> IOF Adicional (Fixo - 0.38%):
                                                         </span>
                                                         <span className="font-mono">R$ 0.00</span>
                                                     </div>
                                                     <div className="flex justify-between items-center opacity-60">
                                                         <span className="flex items-center gap-1">
                                                             <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 4000</span> IOF Diário (0.0082%/dia):
                                                         </span>
                                                         <span className="font-mono">R$ 0.00</span>
                                                     </div>
                                                     <div className="flex justify-between pt-1 border-t border-black/10 dark:border-white/10 text-xs font-black text-emerald-500">
                                                         <span>Status da Fatura:</span>
                                                         <span className="font-mono uppercase">100% QUITADA (R$ 0.00 DE DÍVIDA)</span>
                                                     </div>
                                                 </div>
                                             )}

                                             <div className="pt-2 text-center text-[10px] text-zinc-400 border-t border-black/5 dark:border-white/5">
                                                 <span>Deseja consultar faturas mais antigas? Acesse o histórico completo na aba <strong className="text-amber-500 font-bold">Faturamento 📑</strong></span>
                                             </div>
                                         </div>
                                     );
                                 })()}

                                {/* Tabela Multi-Cartões do Cliente */}
                                <div className={`mt-4 p-4 rounded-xl border space-y-3 ${isMidnight ? 'bg-zinc-900/80 border-white/10' : 'bg-white border-black/20 shadow-sm'}`}>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-500 flex items-center justify-between">
                                        <span>Cartões do Cliente (Físico & Virtuais)</span>
                                        <span className="text-[10px] text-zinc-400 font-mono">Qtd: {(searchedUser.cards?.length || 2)} cartões</span>
                                    </h4>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-black/10 dark:border-white/10 opacity-70 text-[10px] uppercase">
                                                    <th className="pb-2 font-bold">Produto / Nome</th>
                                                    <th className="pb-2 font-bold">Tipo</th>
                                                    <th className="pb-2 font-bold">Número</th>
                                                    <th className="pb-2 font-bold">Validade</th>
                                                    <th className="pb-2 font-bold">Venc. Fatura</th>
                                                    <th className="pb-2 font-bold">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                                {(searchedUser.cards && searchedUser.cards.length > 0 ? searchedUser.cards : [
                                                    {
                                                        id: 'card-1111-phys',
                                                        type: 'PHYSICAL',
                                                        brand: 'MASTERCARD',
                                                        name: 'Volt Black Physical',
                                                        cardNumberMasked: searchedUser.creditCard?.number || '**** **** **** 1111',
                                                        cardNumberFull: '4111 2222 3333 1111',
                                                        cvv: '321',
                                                        expirationDate: searchedUser.creditCard?.dueDate || '08/30',
                                                        isBlocked: searchedUser.creditCard?.isBlocked || false,
                                                        limit: searchedUser.creditCard?.totalLimit || 5000,
                                                        dueDay: searchedUser.creditCard?.dueDay || 10,
                                                    },
                                                    {
                                                        id: 'card-1111-virt',
                                                        type: 'VIRTUAL',
                                                        brand: 'VISA',
                                                        name: 'Volt Digital Recurring',
                                                        cardNumberMasked: '**** **** **** 8822',
                                                        cardNumberFull: '4111 2222 3333 8822',
                                                        cvv: '987',
                                                        expirationDate: '12/28',
                                                        isBlocked: false,
                                                        limit: 2500,
                                                        dueDay: searchedUser.creditCard?.dueDay || 10,
                                                    }
                                                ]).map((card: any) => {
                                                    const isUnmasked = !!unmaskedCards[card.id];
                                                    const fullNumber = card.cardNumberFull || (card.type === 'VIRTUAL' ? '4111 2222 3333 8822' : '4111 2222 3333 1111');
                                                    const cardCvv = card.cvv || (card.type === 'VIRTUAL' ? '987' : '321');

                                                    const handleSimulateFromBadge = () => {
                                                        const payload = {
                                                            tab: 'cards',
                                                            cardNumber: fullNumber.replace(/\s+/g, ''),
                                                            expiration: card.expirationDate,
                                                            cvv: cardCvv,
                                                            type: card.type,
                                                            cpf: searchedUser.cpf
                                                        };
                                                        try {
                                                            sessionStorage.setItem('admin_pending_sim_card', JSON.stringify(payload));
                                                        } catch (err) {
                                                            console.error('Erro ao salvar no sessionStorage:', err);
                                                        }
                                                        window.dispatchEvent(new CustomEvent('admin-switch-tab-and-fill-card', {
                                                            detail: payload
                                                        }));
                                                    };

                                                    return (
                                                        <tr key={card.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                                            <td className="py-2.5 font-bold">{card.name}</td>
                                                            <td className="py-2.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={handleSimulateFromBadge}
                                                                    title="Clique para Simular Transação nesta Aba de Cartões & Massa"
                                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer flex items-center gap-1.5 border hover:scale-105 active:scale-95 ${
                                                                        card.type === 'PHYSICAL'
                                                                            ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/40 hover:bg-blue-500/30'
                                                                            : 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/40 hover:bg-purple-500/30'
                                                                    }`}
                                                                >
                                                                    <span>{card.type === 'PHYSICAL' ? '💳 Físico' : '📱 Virtual'}</span>
                                                                    <span className="text-[9px] opacity-70 underline">Simular 🛒</span>
                                                                </button>
                                                            </td>
                                                            <td className="py-2.5 font-mono text-[11px] font-bold">
                                                                <div className="flex items-center gap-2">
                                                                    <span>{isUnmasked ? fullNumber : card.cardNumberMasked}</span>
                                                                    {isUnmasked && <span className="text-[10px] text-amber-500 font-mono">CVV: {cardCvv}</span>}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setUnmaskedCards(prev => ({ ...prev, [card.id]: !prev[card.id] }))}
                                                                        title={isUnmasked ? "Ocultar dados" : "Revelar número e CVV sem PIN (Admin)"}
                                                                        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                                                                    >
                                                                        {isUnmasked ? <EyeOff size={14} /> : <Eye size={14} />}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="py-2.5 font-mono text-[11px]">{card.expirationDate}</td>
                                                            <td className="py-2.5 font-mono text-[11px]">Dia {card.dueDay}</td>
                                                            <td className="py-2.5">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${card.isBlocked ? 'bg-rose-500/20 text-rose-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                                                                    {card.isBlocked ? 'BLOQUEADO' : 'ATIVO'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div
                                    className="flex flex-col gap-4 mt-6 test-admin-user-actions"
                                    id="admin-user-actions"
                                    data-testid="admin-user-actions"
                                    data-cy="admin-user-actions"
                                >
                                    {searchedUser.isBlocked ? (
                                        <button
                                            onClick={() => openModal('unblock', searchedUser)}
                                            className={`flex-1 py-3 rounded-2xl transition-all test-admin-unblock-button ${btnTypographyClass} ${primaryOutlineBtnClass}`}
                                            id="btn-admin-unblock"
                                            name="btn-admin-unblock"
                                            data-testid="admin-unblock-button"
                                            data-cy="admin-unblock-button"
                                            data-playwright="admin-unblock-button"
                                            aria-label="Desbloquear conta"
                                            type="button"
                                        >
                                            Desbloquear
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => openModal('block', searchedUser)}
                                            className={`flex-1 py-3 rounded-2xl transition-all test-admin-block-button ${btnTypographyClass} ${dangerOutlineBtnClass}`}
                                            id="btn-admin-block"
                                            name="btn-admin-block"
                                            data-testid="admin-block-button"
                                            data-cy="admin-block-button"
                                            data-playwright="admin-block-button"
                                            aria-label="Bloquear conta"
                                            type="button"
                                        >
                                            Bloquear
                                        </button>
                                    )}
                                    <button
                                        onClick={() => openModal('deposit', searchedUser)}
                                        className={`flex-1 py-3 rounded-2xl transition-all test-admin-deposit-button ${btnTypographyClass} ${neutralBtnClass}`}
                                        id="btn-admin-deposit"
                                        name="btn-admin-deposit"
                                        data-testid="admin-deposit-button"
                                        data-cy="admin-deposit-button"
                                        data-playwright="admin-deposit-button"
                                        aria-label="Depositar"
                                        type="button"
                                    >
                                        Depositar
                                    </button>
                                </div>
                            </div>

                            <div className={`flex-1 border-t pt-6 ${dividerClass}`}>
                                <h4 className={`font-bold mb-4 uppercase ${titleClass}`}>Alterar Dados do Cartão</h4>
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className={`text-xs font-bold uppercase ${isMidnight ? 'text-white/70' : 'text-black/70'}`}>Vencimento do Cartão (MM/AA)</label>
                                        <input
                                            type="text"
                                            value={cardDueDate}
                                            onChange={(e) => setCardDueDate(e.target.value)}
                                            placeholder="MM/AA"
                                            className={`w-full p-3 rounded-xl focus:outline-none transition-all ${isMidnight ? 'font-medium' : 'font-bold'} mt-1 ${inputClass}`}
                                        />
                                    </div>
                                    <div>
                                        <label className={`text-xs ${isMidnight ? 'font-medium' : 'font-bold uppercase'} ${isMidnight ? 'text-white/70' : 'text-black/70'}`}>Venc. Fatura Fechada</label>
                                        <input
                                            type="date"
                                            value={cardInvoiceDate}
                                            onChange={(e) => setCardInvoiceDate(e.target.value)}
                                            className={`w-full p-3 rounded-xl focus:outline-none transition-all ${isMidnight ? 'font-medium' : 'font-bold'} mt-1 ${inputClass}`}
                                            style={{ colorScheme: isMidnight ? 'dark' : 'light' }}
                                        />
                                    </div>
                                </div>
                                <button onClick={handleUpdateCard} disabled={isLoadingAction} className={`w-full mt-6 py-3 rounded-2xl transition-all disabled:opacity-50 ${btnTypographyClass} ${primaryOutlineBtnClass}`}>
                                    {isLoadingAction ? 'Salvando...' : 'Salvar Alterações do Cartão'}
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Requests */}
                <section className="grid grid-cols-1 gap-8">
                    {/* Password Requests */}
                    <div
                        className={`p-6 rounded-2xl test-admin-password-requests ${sectionCardClass}`}
                        id="admin-password-requests"
                        data-testid="admin-password-requests"
                        data-cy="admin-password-requests"
                    >
                         <h2
                            className={`text-xl mb-6 test-admin-password-requests-title ${isMidnight ? 'font-bold' : 'font-black uppercase tracking-wider'} ${titleClass}`}
                            id="admin-password-requests-title"
                            data-testid="admin-password-requests-title"
                        >
                            Solicitações de Senha
                        </h2>
                         <div
                            className="space-y-4 max-h-64 overflow-y-auto test-admin-password-requests-list pr-2"
                            id="admin-password-requests-list"
                            data-testid="admin-password-requests-list"
                            data-cy="admin-password-requests-list"
                        >
                            {passwordRequests.length > 0 ? passwordRequests.map(req => (
                                <div
                                    key={req.cpf}
                                    className={`p-4 rounded-xl flex justify-between items-center test-admin-password-request-item ${innerCardClass}`}
                                    id={`admin-password-request-${req.cpf}`}
                                    data-testid={`admin-password-request-${req.cpf}`}
                                    data-cy={`admin-password-request-${req.cpf}`}
                                >
                                    <p className={`font-mono font-bold test-admin-request-cpf ${titleClass}`} data-testid={`admin-password-request-cpf-${req.cpf}`}>{formatCPF(req.cpf)}</p>
                                    <div
                                        className="flex gap-2 test-admin-request-actions"
                                        data-testid={`admin-password-request-actions-${req.cpf}`}
                                    >
                                        <button
                                            onClick={() => openModal('approve', req)}
                                            className={`px-3 py-2 rounded-xl transition-all test-admin-approve-button ${btnTypographySmallClass} ${primaryOutlineBtnClass}`}
                                            id={`btn-admin-approve-password-${req.cpf}`}
                                            name={`admin-approve-password-${req.cpf}`}
                                            data-testid={`admin-approve-password-${req.cpf}`}
                                            data-cy={`admin-approve-password-${req.cpf}`}
                                            data-playwright={`admin-approve-password-${req.cpf}`}
                                            aria-label={`Aprovar solicitação de senha para ${formatCPF(req.cpf)}`}
                                            type="button"
                                        >
                                            <Check className="w-[18px] h-[18px]" />
                                        </button>
                                        <button
                                            onClick={() => openModal('deny', req)}
                                            className={`px-3 py-2 rounded-xl transition-all test-admin-deny-button ${btnTypographySmallClass} ${dangerOutlineBtnClass}`}
                                            id={`btn-admin-deny-password-${req.cpf}`}
                                            name={`btn-admin-deny-password-${req.cpf}`}
                                            data-testid={`btn-admin-deny-password-${req.cpf}`}
                                            data-cy={`btn-admin-deny-password-${req.cpf}`}
                                            data-playwright={`btn-admin-deny-password-${req.cpf}`}
                                            aria-label={`Negar solicitação de senha para ${formatCPF(req.cpf)}`}
                                            type="button"
                                        >
                                            <X className="w-[18px] h-[18px]" />
                                        </button>
                                    </div>
                                </div>
                            )) : <p className={`text-sm text-center py-4 test-admin-no-requests ${isMidnight ? 'font-medium' : 'font-bold'} ${emptyStateClass}`} data-testid="admin-no-password-requests">Nenhuma solicitação pendente.</p>}
                        </div>
                    </div>

                    {/* Limit Requests */}
                    <div
                        className={`p-6 rounded-2xl test-admin-limit-requests ${sectionCardClass}`}
                        id="admin-limit-requests"
                        data-testid="admin-limit-requests"
                        data-cy="admin-limit-requests"
                    >
                        <h2
                            className={`text-xl mb-6 test-admin-limit-requests-title ${isMidnight ? 'font-bold' : 'font-black uppercase tracking-wider'} ${titleClass}`}
                            id="admin-limit-requests-title"
                            data-testid="admin-limit-requests-title"
                        >
                            Solicitações de Limite
                        </h2>
                         <div
                            className="space-y-4 max-h-64 overflow-y-auto test-admin-limit-requests-list pr-2"
                            id="admin-limit-requests-list"
                            data-testid="admin-limit-requests-list"
                            data-cy="admin-limit-requests-list"
                        >
                            {limitRequests.length > 0 ? limitRequests.map(req => (
                                <div
                                    key={req.cpf}
                                    className={`p-4 rounded-xl flex justify-between items-center test-admin-limit-request-item ${innerCardClass}`}
                                    id={`admin-limit-request-${req.cpf}`}
                                    data-testid={`admin-limit-request-${req.cpf}`}
                                    data-cy={`admin-limit-request-${req.cpf}`}
                                >
                                    <div>
                                        <p className={`font-mono font-bold test-admin-request-cpf ${titleClass}`} data-testid={`admin-limit-request-cpf-${req.cpf}`}>{formatCPF(req.cpf)}</p>
                                        <p className={`text-sm font-bold mt-1 test-admin-request-amount ${isMidnight ? 'text-volt-green' : 'text-green-600'}`} data-testid={`admin-limit-request-amount-${req.cpf}`}>
                                            Novo: {req.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </p>
                                    </div>
                                    <div
                                        className="flex gap-2 test-admin-request-actions"
                                        data-testid={`admin-limit-request-actions-${req.cpf}`}
                                    >
                                        <button
                                            onClick={() => openModal('approve', req)}
                                            className={`px-3 py-2 rounded-xl transition-all test-admin-approve-button ${btnTypographySmallClass} ${primaryOutlineBtnClass}`}
                                            id={`btn-admin-approve-limit-${req.cpf}`}
                                            name={`admin-approve-limit-${req.cpf}`}
                                            data-testid={`admin-approve-limit-${req.cpf}`}
                                            data-cy={`admin-approve-limit-${req.cpf}`}
                                            data-playwright={`admin-approve-limit-${req.cpf}`}
                                            aria-label={`Aprovar solicitação de limite para ${formatCPF(req.cpf)}`}
                                            type="button"
                                        >
                                            <Check className="w-[18px] h-[18px]" />
                                        </button>
                                        <button
                                            onClick={() => openModal('deny', req)}
                                            className={`px-3 py-2 rounded-xl transition-all test-admin-deny-button ${btnTypographySmallClass} ${dangerOutlineBtnClass}`}
                                            id={`btn-admin-deny-limit-${req.cpf}`}
                                            name={`admin-deny-limit-${req.cpf}`}
                                            data-testid={`admin-deny-limit-${req.cpf}`}
                                            data-cy={`admin-deny-limit-${req.cpf}`}
                                            data-playwright={`admin-deny-limit-${req.cpf}`}
                                            aria-label={`Negar solicitação de limite para ${formatCPF(req.cpf)}`}
                                            type="button"
                                        >
                                            <X className="w-[18px] h-[18px]" />
                                        </button>
                                    </div>
                                </div>
                            )) : <p className={`text-sm text-center py-4 test-admin-no-requests ${isMidnight ? 'font-medium' : 'font-bold'} ${emptyStateClass}`} data-testid="admin-no-limit-requests">Nenhuma solicitação pendente.</p>}
                        </div>
                    </div>

                    {/* Massa de Teste — Billing Mock */}
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

                        {billingMsg && (
                            <p className={`text-sm mt-4 text-center font-bold uppercase tracking-wider ${billingMsg.ok ? (isMidnight ? 'text-green-400' : 'text-green-600') : (isMidnight ? 'text-red-400' : 'text-red-600')}`}>
                                {billingMsg.text}
                            </p>
                        )}
                    </div>
                </section>
            </main>

            {/* Modal */}
            {modalState.isOpen && (
                <div
                    className={modalOverlayClass}
                    id="admin-modal-overlay"
                    data-testid="admin-modal-overlay"
                    data-cy="admin-modal-overlay"
                    data-playwright="admin-modal-overlay"
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className={`p-8 rounded-3xl w-full max-w-2xl test-admin-modal ${isMidnight ? 'bg-background-dark border border-white/10' : 'bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'}`}
                        id="admin-modal"
                        data-testid="admin-modal"
                        data-cy="admin-modal"
                        data-playwright="admin-modal"
                    >
                        <h2
                            className={`text-2xl font-bold uppercase tracking-wider mb-4 test-admin-modal-title ${titleClass}`}
                            id="admin-modal-title"
                            data-testid="admin-modal-title"
                            data-cy="admin-modal-title"
                        >
                            Confirmar Ação
                        </h2>
                        {modalState.action === 'deny' && (
                            <>
                                <p className={`font-bold mb-2 uppercase text-sm ${subTextClass}`}>Por favor, informe o motivo da recusa:</p>
                                <textarea value={denyReason} onChange={e => setDenyReason(e.target.value)} className={`w-full p-4 rounded-xl focus:outline-none transition-all font-bold ${innerCardClass} ${isMidnight ? 'text-white placeholder-white/30' : 'text-black placeholder-black/30'}`} rows={3}></textarea>
                            </>
                        )}
                        {modalState.action === 'deposit' && (
                             <>
                                <p className={`font-bold mb-2 uppercase text-sm ${subTextClass}`}>Informe o valor a ser depositado:</p>
                                <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className={`w-full p-4 rounded-xl focus:outline-none transition-all font-bold ${innerCardClass} ${isMidnight ? 'text-white placeholder-white/30' : 'text-black placeholder-black/30'}`} placeholder="0.00" />
                            </>
                        )}
                        {modalState.action !== 'deny' && modalState.action !== 'deposit' && (
                            <p className={`font-bold mb-8 text-lg ${subTextClass}`}>Você tem certeza que deseja executar esta ação para o CPF <span className={`font-bold ${titleClass}`}>{formatCPF(modalState.data.cpf)}</span>?</p>
                        )}
                        <div
                            className="flex flex-col justify-end gap-4 mt-8 test-admin-modal-actions"
                            id="admin-modal-actions"
                            data-testid="admin-modal-actions"
                            data-cy="admin-modal-actions"
                        >
                            <button
                                onClick={closeModal}
                                className={`px-6 py-3 rounded-2xl transition-all test-admin-modal-cancel ${btnTypographyClass} ${neutralBtnClass}`}
                                id="btn-admin-modal-cancel"
                                name="admin-modal-cancel"
                                data-testid="admin-modal-cancel"
                                data-cy="admin-modal-cancel"
                                data-playwright="admin-modal-cancel"
                                aria-label="Cancelar"
                                type="button"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmAction}
                                disabled={isLoadingAction}
                                className={`px-6 py-3 rounded-2xl transition-all disabled:opacity-50 test-admin-modal-confirm ${btnTypographyClass} ${primaryOutlineBtnClass}`}
                                id="btn-admin-modal-confirm"
                                name="admin-modal-confirm"
                                data-testid="admin-modal-confirm"
                                data-cy="admin-modal-confirm"
                                data-playwright="admin-modal-confirm"
                                aria-label={isLoadingAction ? 'Processando...' : 'Confirmar'}
                                type="button"
                            >
                                {isLoadingAction ? 'Processando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-8 right-8 left-8 p-4 rounded-xl border font-bold uppercase tracking-wider z-50 ${
                    toast.type === 'success'
                        ? (isMidnight ? 'bg-volt-green/20 text-volt-green border-volt-green/30' : 'bg-volt-lime/25 text-black border-black')
                        : (isMidnight ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-500/20 text-red-700 border-red-600/40')
                }`}>
                    {toast.message}
                </div>
            )}

            <style>{`
                .btn-primary { padding: 0.5rem 1rem; background-color: #13ec5b; color: #0C1E11; font-weight: 600; border-radius: 0.5rem; }
                .btn-secondary { padding: 0.5rem 1rem; background-color: #3e4c41; color: #E5E7EB; font-weight: 600; border-radius: 0.5rem; }
                .btn-danger { padding: 0.5rem 1rem; background-color: #ef4444; color: white; font-weight: 600; border-radius: 0.5rem; }
                .btn-success-sm { padding: 0.25rem 0.75rem; font-size: 0.875rem; background-color: #22c55e; color: white; font-weight: 600; border-radius: 0.5rem; }
                .btn-danger-sm { padding: 0.25rem 0.75rem; font-size: 0.875rem; background-color: #ef4444; color: white; font-weight: 600; border-radius: 0.5rem; }
            `}</style>
            </div>
        </div>
    );
};

export default Admin;
