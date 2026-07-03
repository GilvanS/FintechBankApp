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

const StatCard: React.FC<{ title: string; value: string | number; icon: string; isMidnight: boolean }> = ({ title, value, icon, isMidnight }) => (
    <div className={`p-6 rounded-2xl flex flex-col justify-between border transition-colors ${isMidnight ? 'bg-surface-dark border-white/5 hover:border-primary/50' : 'bg-white border-black/10 hover:border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
        <div className="flex items-center space-x-3 mb-4">
            <span className={`material-symbols-outlined text-3xl ${isMidnight ? 'text-primary' : 'text-black'}`}>{icon}</span>
            <p className={`text-sm font-bold uppercase tracking-wider ${isMidnight ? 'text-white/60' : 'text-black/60'}`}>{title}</p>
        </div>
        <p className={`text-4xl font-black ${isMidnight ? 'text-white' : 'text-black'}`}>{value}</p>
    </div>
);

const Admin: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { user: adminUser, logout } = useAuth();
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const [cpfSearch, setCpfSearch] = useState('');
    const [searchedUser, setSearchedUser] = useState<User | null>(null);
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
        const [pwReqs, limReqs] = await Promise.all([
            adminGetPasswordRequests(),
            adminGetLimitRequests()
        ]);
        setPasswordRequests(pwReqs);
        setLimitRequests(limReqs);
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
        // Busca dados apenas quando o painel é aberto (evita chamadas no mount do Dashboard)
        if (isOpen) {
            fetchRequests();
            fetchStats();
        }
    }, [isOpen]);

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
    const modalCardClass = isMidnight
        ? 'bg-background-dark text-white border border-white/10 shadow-2xl'
        : 'bg-white text-black border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]';
    const iconAccentClass = isMidnight ? 'text-primary' : 'text-black';
    const titleClass = isMidnight ? 'text-white' : 'text-black';
    const subTextClass = isMidnight ? 'text-white/60' : 'text-black/60';
    const closeBtnClass = isMidnight
        ? 'bg-surface-dark border border-white/5 hover:bg-white/10'
        : 'bg-white border-2 border-black hover:bg-black/5';
    const sectionCardClass = isMidnight ? 'bg-surface-dark border border-white/5' : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]';
    const innerCardClass = isMidnight ? 'bg-background-dark border border-white/10' : 'bg-black/5 border border-black/10';
    const inputClass = isMidnight
        ? 'bg-background-dark text-white border border-white/10 focus:border-primary/50 placeholder-white/30'
        : 'bg-black/5 text-black border border-black/20 focus:border-black placeholder-black/30';
    const searchBtnClass = isMidnight
        ? 'text-primary bg-primary/10 border border-primary/30 hover:bg-primary/20'
        : 'text-black bg-volt-lime border-2 border-black hover:opacity-90';
    const primaryOutlineBtnClass = isMidnight
        ? 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20'
        : 'bg-volt-lime/20 text-black border-2 border-black hover:bg-volt-lime/30';
    const dangerOutlineBtnClass = isMidnight
        ? 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20'
        : 'bg-red-500/10 text-red-600 border-2 border-red-600/40 hover:bg-red-500/20';
    const neutralBtnClass = isMidnight
        ? 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
        : 'bg-black/5 text-black border border-black/20 hover:bg-black/10';
    const dividerClass = isMidnight ? 'border-white/10' : 'border-black/10';
    const emptyStateClass = isMidnight ? 'text-white/40' : 'text-black/40';
    const modalOverlayClass = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 test-admin-modal-overlay';

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 test-admin-page">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={`flex flex-col relative w-full max-w-3xl max-h-[85vh] rounded-3xl overflow-hidden z-10 ${modalCardClass}`}
                        id="admin-page"
                        data-testid="admin-page"
                        data-cy="admin-page"
                        data-playwright="admin-page"
                    >
                        <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar flex flex-col min-h-full">
                            <header
                                className="flex items-center justify-between gap-3 mb-8 test-admin-header"
                                id="admin-header"
                                data-testid="admin-header"
                                data-cy="admin-header"
                            >
                                <div className="flex items-center space-x-3">
                                    <span className={`material-symbols-outlined text-4xl test-admin-icon ${iconAccentClass}`} data-testid="admin-icon" aria-hidden="true">admin_panel_settings</span>
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
                                <button
                                    onClick={onClose}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors test-admin-close-button ${closeBtnClass}`}
                                    id="btn-admin-close"
                                    name="admin-close-button"
                                    data-testid="admin-close-button"
                                    data-cy="admin-close-button"
                                    data-playwright="admin-close-button"
                                    aria-label="Fechar"
                                    type="button"
                                >
                                    <span className={`material-symbols-outlined ${titleClass}`} aria-hidden="true">close</span>
                                </button>
                            </header>

                            <main
                                className="flex-grow space-y-8 test-admin-main"
                                id="admin-main"
                                data-testid="admin-main"
                                data-cy="admin-main"
                            >
                {/* Stats */}
                <section
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 test-admin-stats"
                    id="admin-stats"
                    data-testid="admin-stats"
                    data-cy="admin-stats"
                >
                    <StatCard
                        title="Solicitações de Senha"
                        value={isLoadingStats ? '-' : stats.passwordRequests}
                        icon="lock_reset"
                        isMidnight={isMidnight}
                    />
                    <StatCard
                        title="Solicitações de Limite"
                        value={isLoadingStats ? '-' : stats.limitRequests}
                        icon="upgrade"
                        isMidnight={isMidnight}
                    />
                    <StatCard
                        title="Total de Clientes"
                        value={isLoadingStats ? '-' : stats.totalClients}
                        icon="group"
                        isMidnight={isMidnight}
                    />
                    <StatCard
                        title="Transações Hoje"
                        value={isLoadingStats ? '-' : stats.transactionsToday}
                        icon="monitoring"
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
                        className="flex flex-col sm:flex-row gap-4 mb-6 test-admin-search-form"
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
                            className={`flex-grow px-4 py-3 rounded-2xl focus:outline-none transition-all font-bold test-input-cpf-search ${inputClass}`}
                            id="admin-cpf-search"
                            name="cpf-search"
                            data-testid="admin-cpf-search"
                            data-cy="admin-cpf-search"
                            data-playwright="admin-cpf-search"
                            aria-label="Buscar por CPF"
                        />
                        <button
                            type="submit"
                            className={`px-6 py-3 font-bold uppercase tracking-wider rounded-2xl transition-all test-admin-search-button ${searchBtnClass}`}
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
                        <div className={`p-6 rounded-2xl flex flex-col lg:flex-row gap-8 ${innerCardClass}`}>
                            <div className="flex-1 space-y-2">
                                <h3 className={`font-bold text-2xl ${titleClass}`}>{searchedUser.fullName}</h3>
                                <p className={`text-sm font-bold uppercase ${isMidnight ? 'text-white/70' : 'text-black/70'}`}>CPF: {formatCPF(searchedUser.cpf)}</p>
                                <p className={`text-sm font-bold mt-1 uppercase ${searchedUser.isBlocked || searchedUser.creditCard.isBlocked ? (isMidnight ? 'text-red-400' : 'text-red-600') : (isMidnight ? 'text-green-400' : 'text-green-600')}`}>
                                    {searchedUser.isBlocked ? 'CONTA BLOQUEADA' : 'CONTA ATIVA'} / {searchedUser.creditCard.isBlocked ? 'CARTÃO BLOQUEADO' : 'CARTÃO ATIVO'}
                                </p>
                                <div
                                    className="flex flex-col sm:flex-row gap-4 mt-6 test-admin-user-actions"
                                    id="admin-user-actions"
                                    data-testid="admin-user-actions"
                                    data-cy="admin-user-actions"
                                >
                                    {searchedUser.isBlocked ? (
                                        <button
                                            onClick={() => openModal('unblock', searchedUser)}
                                            className={`flex-1 py-3 rounded-2xl font-bold uppercase tracking-wider transition-all test-admin-unblock-button ${primaryOutlineBtnClass}`}
                                            id="btn-admin-unblock"
                                            name="admin-unblock-button"
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
                                            className={`flex-1 py-3 rounded-2xl font-bold uppercase tracking-wider transition-all test-admin-block-button ${dangerOutlineBtnClass}`}
                                            id="btn-admin-block"
                                            name="admin-block-button"
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
                                        className={`flex-1 py-3 rounded-2xl font-bold uppercase tracking-wider transition-all test-admin-deposit-button ${neutralBtnClass}`}
                                        id="btn-admin-deposit"
                                        name="admin-deposit-button"
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

                            <div className={`flex-1 border-t lg:border-t-0 lg:border-l lg:pl-8 pt-6 lg:pt-0 ${dividerClass}`}>
                                <h4 className={`font-bold mb-4 uppercase ${titleClass}`}>Alterar Dados do Cartão</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={`text-xs font-bold uppercase ${isMidnight ? 'text-white/70' : 'text-black/70'}`}>Vencimento do Cartão (MM/AA)</label>
                                        <input
                                            type="text"
                                            value={cardDueDate}
                                            onChange={(e) => setCardDueDate(e.target.value)}
                                            placeholder="MM/AA"
                                            className={`w-full p-3 rounded-xl focus:outline-none transition-all font-bold mt-1 ${inputClass}`}
                                        />
                                    </div>
                                    <div>
                                        <label className={`text-xs font-bold uppercase ${isMidnight ? 'text-white/70' : 'text-black/70'}`}>Venc. Fatura Fechada</label>
                                        <input
                                            type="date"
                                            value={cardInvoiceDate}
                                            onChange={(e) => setCardInvoiceDate(e.target.value)}
                                            className={`w-full p-3 rounded-xl focus:outline-none transition-all font-bold mt-1 ${inputClass}`}
                                            style={{ colorScheme: isMidnight ? 'dark' : 'light' }}
                                        />
                                    </div>
                                </div>
                                <button onClick={handleUpdateCard} disabled={isLoadingAction} className={`w-full mt-6 py-3 rounded-2xl font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${primaryOutlineBtnClass}`}>
                                    {isLoadingAction ? 'Salvando...' : 'Salvar Alterações do Cartão'}
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Requests */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Password Requests */}
                    <div
                        className={`p-6 rounded-2xl test-admin-password-requests ${sectionCardClass}`}
                        id="admin-password-requests"
                        data-testid="admin-password-requests"
                        data-cy="admin-password-requests"
                    >
                         <h2
                            className={`text-xl font-bold uppercase tracking-wider mb-6 test-admin-password-requests-title ${titleClass}`}
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
                                            className={`px-3 py-2 rounded-xl font-bold uppercase tracking-wider transition-all test-admin-approve-button ${primaryOutlineBtnClass}`}
                                            id={`btn-admin-approve-password-${req.cpf}`}
                                            name={`admin-approve-password-${req.cpf}`}
                                            data-testid={`admin-approve-password-${req.cpf}`}
                                            data-cy={`admin-approve-password-${req.cpf}`}
                                            data-playwright={`admin-approve-password-${req.cpf}`}
                                            aria-label={`Aprovar solicitação de senha para ${formatCPF(req.cpf)}`}
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-lg">check</span>
                                        </button>
                                        <button
                                            onClick={() => openModal('deny', req)}
                                            className={`px-3 py-2 rounded-xl font-bold uppercase tracking-wider transition-all test-admin-deny-button ${dangerOutlineBtnClass}`}
                                            id={`btn-admin-deny-password-${req.cpf}`}
                                            name={`admin-deny-password-${req.cpf}`}
                                            data-testid={`admin-deny-password-${req.cpf}`}
                                            data-cy={`admin-deny-password-${req.cpf}`}
                                            data-playwright={`admin-deny-password-${req.cpf}`}
                                            aria-label={`Negar solicitação de senha para ${formatCPF(req.cpf)}`}
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-lg">close</span>
                                        </button>
                                    </div>
                                </div>
                            )) : <p className={`font-bold text-sm text-center py-4 test-admin-no-requests ${emptyStateClass}`} data-testid="admin-no-password-requests">Nenhuma solicitação pendente.</p>}
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
                            className={`text-xl font-bold uppercase tracking-wider mb-6 test-admin-limit-requests-title ${titleClass}`}
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
                                        <p className={`text-sm font-bold mt-1 test-admin-request-amount ${isMidnight ? 'text-green-400' : 'text-green-600'}`} data-testid={`admin-limit-request-amount-${req.cpf}`}>
                                            Novo: {req.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </p>
                                    </div>
                                    <div
                                        className="flex gap-2 test-admin-request-actions"
                                        data-testid={`admin-limit-request-actions-${req.cpf}`}
                                    >
                                        <button
                                            onClick={() => openModal('approve', req)}
                                            className={`px-3 py-2 rounded-xl font-bold uppercase tracking-wider transition-all test-admin-approve-button ${primaryOutlineBtnClass}`}
                                            id={`btn-admin-approve-limit-${req.cpf}`}
                                            name={`admin-approve-limit-${req.cpf}`}
                                            data-testid={`admin-approve-limit-${req.cpf}`}
                                            data-cy={`admin-approve-limit-${req.cpf}`}
                                            data-playwright={`admin-approve-limit-${req.cpf}`}
                                            aria-label={`Aprovar solicitação de limite para ${formatCPF(req.cpf)}`}
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-lg">check</span>
                                        </button>
                                        <button
                                            onClick={() => openModal('deny', req)}
                                            className={`px-3 py-2 rounded-xl font-bold uppercase tracking-wider transition-all test-admin-deny-button ${dangerOutlineBtnClass}`}
                                            id={`btn-admin-deny-limit-${req.cpf}`}
                                            name={`admin-deny-limit-${req.cpf}`}
                                            data-testid={`admin-deny-limit-${req.cpf}`}
                                            data-cy={`admin-deny-limit-${req.cpf}`}
                                            data-playwright={`admin-deny-limit-${req.cpf}`}
                                            aria-label={`Negar solicitação de limite para ${formatCPF(req.cpf)}`}
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-lg">close</span>
                                        </button>
                                    </div>
                                </div>
                            )) : <p className={`font-bold text-sm text-center py-4 test-admin-no-requests ${emptyStateClass}`} data-testid="admin-no-limit-requests">Nenhuma solicitação pendente.</p>}
                        </div>
                    </div>

                    {/* Massa de Teste — Billing Mock */}
                    <div className={`p-6 rounded-2xl lg:col-span-2 flex flex-col items-center text-center ${isMidnight ? 'bg-surface-dark border border-white/5' : 'bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}`}>
                        <h2 className={`text-xl font-black uppercase tracking-wider mb-2 ${titleClass}`}>Massa de Teste (Billing)</h2>
                        <p className={`text-xs font-bold mb-6 uppercase ${subTextClass}`}>Aplica cenários de faturamento para automação. Não afeta dados de produção.</p>

                        <p className={`text-xs font-black mb-3 uppercase tracking-wider ${titleClass}`}>CPF alvo</p>
                        <div className="flex gap-2 flex-wrap mb-4">
                            {[
                                { label: 'Todos', value: '' },
                                { label: '111', value: '11111111111' },
                                { label: '222', value: '22222222222' },
                                { label: '333', value: '33333333333' },
                                { label: '444', value: '44444444444' },
                            ].map(opt => (
                                <button key={opt.value || 'all'} onClick={() => setBillingCpf(opt.value)}
                                    className={`text-xs px-3 py-2 rounded-xl border-4 font-black transition-all ${
                                        billingCpf === opt.value
                                            ? (isMidnight ? 'border-primary bg-primary/20 text-primary' : 'border-black bg-volt-yellow text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]')
                                            : (isMidnight ? 'border-white/10 text-white/50 hover:border-white/30 hover:text-white' : 'border-black/20 text-black/50 hover:border-black hover:text-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]')
                                    }`}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <input value={billingCpf} onChange={e => setBillingCpf(e.target.value.replace(/\D/g, ''))}
                            placeholder="ou CPF personalizado…"
                            className={`w-full font-bold p-3 rounded-xl focus:outline-none transition-all mb-6 ${
                                isMidnight
                                    ? 'bg-background-dark text-white border border-white/10 focus:border-primary/50'
                                    : 'bg-white text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:translate-y-1 focus:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]'
                            }`} />

                        <p className={`text-xs font-black mb-3 uppercase tracking-wider ${titleClass}`}>Cenário</p>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {[
                                { key: 'adimplente',   label: 'Adimplente',   cls: isMidnight ? 'text-green-400 bg-green-400/10 border-green-400/30 hover:bg-green-400/20' : 'text-green-600 bg-green-500/10 border-green-500/30 hover:bg-green-500/20' },
                                { key: 'vencida',      label: 'Vencida',      cls: isMidnight ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30 hover:bg-yellow-400/20' : 'text-yellow-700 bg-yellow-500/10 border-yellow-600/30 hover:bg-yellow-500/20' },
                                { key: 'inadimplente', label: 'Inadimplente', cls: isMidnight ? 'text-red-500 bg-red-500/10 border-red-500/30 hover:bg-red-500/20' : 'text-red-600 bg-red-500/10 border-red-600/30 hover:bg-red-500/20' },
                                { key: 'reset',        label: '↺ Reset',      cls: isMidnight ? 'text-white/70 bg-white/5 border-white/10 hover:bg-white/10' : 'text-black/70 bg-black/5 border-black/20 hover:bg-black/10' },
                            ].map(s => (
                                <button key={s.key} onClick={() => applyBillingScenario(s.key)}
                                    disabled={billingLoading}
                                    className={`text-xs py-3 px-3 rounded-xl border font-bold uppercase tracking-wider disabled:opacity-40 transition-all ${s.cls}`}>
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 mb-4">
                            <button onClick={saveBillingBaseline} disabled={billingLoading || !billingCpf}
                                className={`flex-1 text-xs py-3 px-6 rounded-xl font-bold uppercase tracking-wider disabled:opacity-40 transition-all ${primaryOutlineBtnClass}`}>
                                Salvar Mock
                            </button>
                            <button onClick={clearBillingBaseline} disabled={billingLoading || !billingCpf}
                                className={`flex-1 text-xs py-3 px-6 rounded-xl font-bold uppercase tracking-wider disabled:opacity-40 transition-all ${neutralBtnClass}`}>
                                Limpar
                            </button>
                        </div>
                        <button onClick={resetAllTestData} disabled={billingLoading}
                            className={`w-full max-w-sm text-xs py-3 px-6 rounded-xl font-bold uppercase tracking-wider disabled:opacity-40 transition-all ${dangerOutlineBtnClass}`}>
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
                            className="flex flex-col sm:flex-row justify-end gap-4 mt-8 test-admin-modal-actions"
                            id="admin-modal-actions"
                            data-testid="admin-modal-actions"
                            data-cy="admin-modal-actions"
                        >
                            <button
                                onClick={closeModal}
                                className={`px-6 py-3 rounded-2xl font-bold uppercase tracking-wider transition-all test-admin-modal-cancel ${neutralBtnClass}`}
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
                                className={`px-6 py-3 rounded-2xl font-bold uppercase tracking-wider transition-all disabled:opacity-50 test-admin-modal-confirm ${primaryOutlineBtnClass}`}
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
                <div className={`fixed bottom-8 right-8 left-8 sm:left-auto p-4 rounded-xl border font-bold uppercase tracking-wider z-50 ${
                    toast.type === 'success'
                        ? (isMidnight ? 'bg-primary/20 text-primary border-primary/30' : 'bg-volt-lime/25 text-black border-black')
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
        </motion.div>
    </div>
    )}
</AnimatePresence>
    );
};

export default Admin;
