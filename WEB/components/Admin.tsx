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

    adminFixOrphanPayments,
} from '../services/api';
import { adminGetUserByCpf as mockAdminGetUserByCpf } from '../services/mockApi';
import { formatCPF } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { useAppState } from '../contexts/AppStateContext';

import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Shield, KeyRound, ArrowUpCircle, Users, Activity, Check, X, Eye, EyeOff } from 'lucide-react';
import BackofficeInvoiceSection from './Admin/BackofficeInvoiceSection';
import OverdueBadge from './Admin/OverdueBadge';
import StatCard from './Admin/StatCard';
import BillingMockSection from './Admin/BillingMockSection';
import ConfirmModal from './Admin/ConfirmModal';

const Admin: React.FC<{ onClose: () => void; initialSearchCpf?: string }> = ({ onClose, initialSearchCpf }) => {
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
        action: 'approve' | 'deny' | 'block' | 'unblock' | 'deposit' | 'fixOrphan' | null;
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

    // Auto-search when initialSearchCpf is provided from another tab
    useEffect(() => {
        if (initialSearchCpf) {
            const cleanCpf = initialSearchCpf.replace(/\D/g, '');
            setCpfSearch(cleanCpf);
            // Tenta API real primeiro; fallback para mockApi se falhar
            adminGetUserByCpf(cleanCpf).then(result => {
                if (result.success && result.user) {
                    setSearchedUser(result.user);
                    return;
                }
                // Se for "Acesso negado", o AdminDashboard já disparou o evento
                // admin-auth-failed e mostrou o modal de re-login.
                // Ainda assim tenta mockApi como fallback (modo offline).
                const isAccessDenied = result.message?.toLowerCase().includes('negado') || result.message?.toLowerCase().includes('token');
                return { isAccessDenied, mockFallback: mockAdminGetUserByCpf(cleanCpf) };
            }).then((chainResult: any) => {
                // Se o primeiro .then retornou undefined (API real funcionou), não faz nada
                if (!chainResult) return;
                const { isAccessDenied, mockFallback } = chainResult;
                return mockFallback.then((mockResult: any) => {
                    if (mockResult && mockResult.success && mockResult.user) {
                        setSearchedUser(mockResult.user);
                        if (isAccessDenied) {
                            showToast('🔐 Dados carregados (modo simulado) — faça login como admin para dados reais', 'success');
                        } else {
                            showToast('Dados carregados (modo simulado)', 'success');
                        }
                    } else if (mockResult) {
                        showToast(isAccessDenied
                            ? '🔐 Sessão expirada — faça login novamente'
                            : (mockResult.message || 'Usuário não encontrado.'), 'error');
                        setSearchedUser(null);
                    }
                });
            });
        }
    }, [initialSearchCpf]);

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
            case 'fixOrphan':
                const fixResult = await adminFixOrphanPayments();
                if (fixResult.success && fixResult.summary) {
                    const s = fixResult.summary;
                    showToast(`✅ ${s.fixed} corrigido(s), ${s.errors} erro(s), ${s.usersScanned} usuário(s) escaneados`, 'success');
                } else {
                    showToast(fixResult.message || 'Erro ao corrigir pagamentos órfãos.', 'error');
                }
                result = { success: fixResult.success, message: fixResult.message || '' };
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
                                    <OverdueBadge
                                        closedInvoice={searchedUser.creditCard?.closedInvoice || 0}
                                        invoiceDueDate={searchedUser.creditCard?.invoiceDueDate}
                                        daysOverdue={(searchedUser as any).daysOverdue ?? (searchedUser.creditCard as any)?.daysOverdue ?? 0}
                                    />
                                </div>

                                <p className={`text-xs mt-1 ${isMidnight ? 'font-semibold text-volt-green' : 'font-bold uppercase'} ${searchedUser.isBlocked || searchedUser.creditCard.isBlocked ? (isMidnight ? 'text-red-400' : 'text-red-600') : (isMidnight ? 'text-green-400' : 'text-green-600')}`}>
                                    {searchedUser.isBlocked ? 'CONTA BLOQUEADA' : 'CONTA ATIVA'} / {searchedUser.creditCard.isBlocked ? 'CARTÃO BLOQUEADO' : 'CARTÃO ATIVO'}
                                </p>

                                <BackofficeInvoiceSection
                                    searchedUser={searchedUser}
                                    selectedBackofficeInvoice={selectedBackofficeInvoice}
                                    onSelectInvoice={(tab: 'open' | 'closed' | 'previous') => setSelectedBackofficeInvoice(tab)}
                                    isMidnight={isMidnight}
                                />

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

                    <BillingMockSection
                        isMidnight={isMidnight}
                        titleClass={titleClass}
                        subTextClass={subTextClass}
                        innerCardClass={innerCardClass}
                        btnTypographyClass={btnTypographyClass}
                        btnTypographySmallClass={btnTypographySmallClass}
                        primaryOutlineBtnClass={primaryOutlineBtnClass}
                        dangerOutlineBtnClass={dangerOutlineBtnClass}
                        neutralBtnClass={neutralBtnClass}
                        onOpenModal={openModal}
                    />
                </section>
            </main>

            <ConfirmModal
                isOpen={modalState.isOpen}
                action={modalState.action}
                dataCpf={modalState.data?.cpf}
                denyReason={denyReason}
                depositAmount={depositAmount}
                isLoadingAction={isLoadingAction}
                isMidnight={isMidnight}
                modalOverlayClass={modalOverlayClass}
                modalCardClass={isMidnight ? 'bg-background-dark border border-white/10' : 'bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'}
                titleClass={titleClass}
                subTextClass={subTextClass}
                innerCardClass={innerCardClass}
                btnTypographyClass={btnTypographyClass}
                primaryOutlineBtnClass={primaryOutlineBtnClass}
                neutralBtnClass={neutralBtnClass}
                onClose={closeModal}
                onConfirm={handleConfirmAction}
                onDenyReasonChange={setDenyReason}
                onDepositAmountChange={setDepositAmount}
            />

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
