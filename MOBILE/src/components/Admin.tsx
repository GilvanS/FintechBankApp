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
    adminUpdateCreditLimit,
    adminUpdatePixLimit,
    adminGetStats,
    adminSeedTestScenario,
    adminSaveAsMock,
    adminClearMockBaseline,
    adminResetTestData,
} from '../services/api';
import { formatCPF } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

const StatCard: React.FC<{ title: string; value: string | number; icon: string }> = ({ title, value, icon }) => (
    <div className="bg-surface-dark p-6 rounded-xl flex flex-col justify-between">
        <div className="flex items-center space-x-3 mb-4">
            <span className="material-symbols-outlined text-primary text-3xl">{icon}</span>
            <p className="text-sm text-subtle-dark">{title}</p>
        </div>
        <p className="text-4xl font-bold text-text-dark">{value}</p>
    </div>
);

const Admin: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { user: adminUser, logout } = useAuth();
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
    const [cardTotalLimit, setCardTotalLimit] = useState('');
    const [cardAvailableLimit, setCardAvailableLimit] = useState('');
    const [pixLimit, setPixLimit] = useState('');

    useEffect(() => {
        if (searchedUser) {
            setCardDueDate(searchedUser.creditCard.dueDate);
            const invoiceDateStr = searchedUser.creditCard.closedInvoiceDueDate || searchedUser.creditCard.invoiceDueDate;
            const invoiceDate = new Date(invoiceDateStr);
            const formattedDate = invoiceDate.toISOString().split('T')[0];
            setCardInvoiceDate(formattedDate);
            setCardTotalLimit(searchedUser.creditCard.totalLimit?.toString() || '');
            setCardAvailableLimit(searchedUser.creditCard.availableLimit?.toString() || '');
            setPixLimit(searchedUser.pixDailyLimit?.toString() || '');
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
        // CRÍTICO PARA PERFORMANCE APK: Adiar fetches até componente estar totalmente renderizado
        const runFetches = () => {
            fetchRequests();
            fetchStats();
        };

        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(runFetches, { timeout: 1000 });
        } else {
            setTimeout(runFetches, 300);
        }
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

    const handleUpdateCreditLimit = async () => {
        if (!searchedUser) return;

        // Converte os valores para decimal, garantindo formato correto
        const totalLimit = cardTotalLimit ? Number(parseFloat(cardTotalLimit).toFixed(2)) : undefined;
        const availableLimit = cardAvailableLimit ? Number(parseFloat(cardAvailableLimit).toFixed(2)) : undefined;
        
        if (totalLimit === undefined && availableLimit === undefined) {
            showToast('Informe pelo menos um limite (total ou disponível)', 'error');
            return;
        }
        
        // Validação de valores
        if ((totalLimit !== undefined && (isNaN(totalLimit) || totalLimit < 0)) ||
            (availableLimit !== undefined && (isNaN(availableLimit) || availableLimit < 0))) {
            showToast('Valores devem ser números válidos e positivos', 'error');
            return;
        }

        setIsLoadingAction(true);
        const result = await adminUpdateCreditLimit(searchedUser.cpf, {
            totalLimit,
            availableLimit
        });
        if (result.success && result.user) {
            setSearchedUser(result.user);
            showToast(result.message, 'success');
        } else {
            showToast(result.message, 'error');
        }
        setIsLoadingAction(false);
    };

    const handleUpdatePixLimit = async () => {
        if (!searchedUser) return;
        const limit = Number(parseFloat(pixLimit).toFixed(2));

        if (isNaN(limit) || limit < 0) {
            showToast('Informe um valor válido para o limite PIX', 'error');
            return;
        }

        setIsLoadingAction(true);
        const result = await adminUpdatePixLimit(searchedUser.cpf, limit);
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

    return (
        <div 
            className="bg-background-dark text-text-dark h-full flex flex-col p-4 overflow-hidden test-admin-page"
            id="admin-page"
            data-testid="admin-page"
            data-cy="admin-page"
            data-playwright="admin-page"
            aria-label="Painel do Admin"
        >
            <header 
                className="flex items-center justify-between mb-6 shrink-0 test-admin-header"
                id="admin-header"
                data-testid="admin-header"
                data-cy="admin-header"
            >
                <div className="flex items-center space-x-3 overflow-hidden">
                    <span className="material-symbols-outlined text-primary text-3xl shrink-0 test-admin-icon" data-testid="admin-icon" aria-hidden="true">admin_panel_settings</span>
                    <div className="overflow-hidden">
                        <h1 
                            className="text-xl font-bold text-text-dark truncate test-admin-title"
                            id="admin-title"
                            data-testid="admin-title"
                            data-cy="admin-title"
                            data-playwright="admin-title"
                        >
                            Painel Admin
                        </h1>
                        <p 
                            className="text-xs text-subtle-dark truncate test-admin-greeting"
                            id="admin-greeting"
                            data-testid="admin-greeting"
                        >
                            Olá, {adminUser?.fullName.split(' ')[0]}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={onBack} 
                    className="p-2 rounded-full hover:bg-surface-dark transition-colors shrink-0 z-10 test-admin-back-button"
                    id="btn-admin-back"
                    name="admin-back-button"
                    data-testid="admin-back-button"
                    data-cy="admin-back-button"
                    data-playwright="admin-back-button"
                    aria-label="Sair"
                    type="button"
                >
                    <span className="material-symbols-outlined" aria-hidden="true">logout</span>
                </button>
            </header>

            <main 
                className="flex-grow overflow-y-auto no-scrollbar space-y-8 test-admin-main"
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
                    />
                    <StatCard 
                        title="Solicitações de Limite" 
                        value={isLoadingStats ? '-' : stats.limitRequests} 
                        icon="upgrade" 
                    />
                    <StatCard 
                        title="Total de Clientes" 
                        value={isLoadingStats ? '-' : stats.totalClients} 
                        icon="group" 
                    />
                    <StatCard 
                        title="Transações Hoje" 
                        value={isLoadingStats ? '-' : stats.transactionsToday} 
                        icon="monitoring" 
                    />
                </section>

                {/* User Management */}
                <section 
                    className="bg-surface-dark p-6 rounded-xl test-admin-user-management"
                    id="admin-user-management"
                    data-testid="admin-user-management"
                    data-cy="admin-user-management"
                >
                    <h2 
                        className="text-lg font-semibold mb-4 test-admin-user-management-title"
                        id="admin-user-management-title"
                        data-testid="admin-user-management-title"
                    >
                        Gerenciar Cliente
                    </h2>
                    <form 
                        onSubmit={handleSearch} 
                        className="flex items-center gap-4 mb-6 test-admin-search-form"
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
                            className="flex-grow px-4 py-3 bg-background-dark border-2 border-background-dark rounded-lg text-text-dark placeholder-subtle-dark focus:outline-none focus:ring-2 focus:ring-primary test-input-cpf-search"
                            id="admin-cpf-search"
                            name="cpf-search"
                            data-testid="admin-cpf-search"
                            data-cy="admin-cpf-search"
                            data-playwright="admin-cpf-search"
                            aria-label="Buscar por CPF"
                        />
                        <button 
                            type="submit" 
                            className="px-6 py-3 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90 test-admin-search-button"
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
                        <div className="bg-background-dark p-4 rounded-lg space-y-4">
                            <div>
                                <h3 className="font-bold">{searchedUser.fullName}</h3>
                                <p className="text-sm text-subtle-dark">CPF: {formatCPF(searchedUser.cpf)}</p>
                                <p className={`text-sm font-semibold ${searchedUser.isBlocked || searchedUser.creditCard.isBlocked ? 'text-red-400' : 'text-primary'}`}>
                                    {searchedUser.isBlocked ? 'CONTA BLOQUEADA' : 'CONTA ATIVA'} / {searchedUser.creditCard.isBlocked ? 'CARTÃO BLOQUEADO' : 'CARTÃO ATIVO'}
                                </p>
                                <div className="flex gap-4 mt-4">
                                    {searchedUser.isBlocked ? (
                                        <button onClick={() => openModal('unblock', searchedUser)} className="btn-secondary">Desbloquear Conta</button>
                                    ) : (
                                        <button onClick={() => openModal('block', searchedUser)} className="btn-danger">Bloquear Conta</button>
                                    )}
                                    <button onClick={() => openModal('deposit', searchedUser)} className="btn-primary">Depositar</button>
                                </div>
                            </div>
                            
                            <div className="border-t border-subtle-dark/50 pt-4">
                                <h4 className="font-semibold text-text-dark mb-2">Alterar Dados do Cartão</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-subtle-dark">Vencimento do Cartão (MM/AA)</label>
                                        <input
                                            type="text"
                                            value={cardDueDate}
                                            onChange={(e) => setCardDueDate(e.target.value)}
                                            placeholder="MM/AA"
                                            className="w-full bg-surface-dark p-2 rounded-md mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-subtle-dark">Venc. Fatura Fechada</label>
                                        <input
                                            type="date"
                                            value={cardInvoiceDate}
                                            onChange={(e) => setCardInvoiceDate(e.target.value)}
                                            className="w-full bg-surface-dark p-2 rounded-md mt-1"
                                        />
                                    </div>
                                </div>
                                <button onClick={handleUpdateCard} disabled={isLoadingAction} className="btn-secondary mt-4 w-full sm:w-auto disabled:opacity-50">
                                    {isLoadingAction ? 'Salvando...' : 'Salvar Alterações do Cartão'}
                                </button>
                            </div>

                            <div className="border-t border-subtle-dark/50 pt-4">
                                <h4 className="font-semibold text-text-dark mb-2">Alterar Limites do Cartão de Crédito</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-subtle-dark">Limite Total (R$)</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={cardTotalLimit}
                                            onChange={(e) => {
                                                // Aceita apenas números e pontos/vírgulas
                                                const value = e.target.value.replace(/[^0-9.,]/g, '');
                                                setCardTotalLimit(value);
                                            }}
                                            onBlur={(e) => {
                                                // Formata ao perder foco
                                                const value = e.target.value.replace(',', '.');
                                                if (value && !isNaN(parseFloat(value))) {
                                                    setCardTotalLimit(parseFloat(value).toFixed(2));
                                                }
                                            }}
                                            placeholder="5000 ou 5000.00"
                                            className="w-full bg-surface-dark p-2 rounded-md mt-1 text-text-dark"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-subtle-dark">Limite Disponível (R$)</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={cardAvailableLimit}
                                            onChange={(e) => {
                                                // Aceita apenas números e pontos/vírgulas
                                                const value = e.target.value.replace(/[^0-9.,]/g, '');
                                                setCardAvailableLimit(value);
                                            }}
                                            onBlur={(e) => {
                                                // Formata ao perder foco
                                                const value = e.target.value.replace(',', '.');
                                                if (value && !isNaN(parseFloat(value))) {
                                                    setCardAvailableLimit(parseFloat(value).toFixed(2));
                                                }
                                            }}
                                            placeholder="5000 ou 5000.00"
                                            className="w-full bg-surface-dark p-2 rounded-md mt-1 text-text-dark"
                                        />
                                    </div>
                                </div>
                                <button onClick={handleUpdateCreditLimit} disabled={isLoadingAction} className="btn-secondary mt-4 w-full sm:w-auto disabled:opacity-50">
                                    {isLoadingAction ? 'Salvando...' : 'Salvar Limites do Cartão'}
                                </button>
                            </div>

                            <div className="border-t border-subtle-dark/50 pt-4">
                                <h4 className="font-semibold text-text-dark mb-2">Alterar Limite Pix Diário</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-subtle-dark">Limite Diário (R$)</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={pixLimit}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/[^0-9.,]/g, '');
                                                setPixLimit(value);
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value.replace(',', '.');
                                                if (value && !isNaN(parseFloat(value))) {
                                                    setPixLimit(parseFloat(value).toFixed(2));
                                                }
                                            }}
                                            placeholder="2000 ou 2000.00"
                                            className="w-full bg-surface-dark p-2 rounded-md mt-1 text-text-dark"
                                        />
                                    </div>
                                </div>
                                <button onClick={handleUpdatePixLimit} disabled={isLoadingAction} className="btn-secondary mt-4 w-full sm:w-auto disabled:opacity-50">
                                    {isLoadingAction ? 'Salvando...' : 'Salvar Limite Pix'}
                                </button>
                            </div>
                        </div>
                    )}
                </section>
                
                {/* Requests */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Password Requests */}
                    <div className="bg-surface-dark p-6 rounded-xl">
                         <h2 className="text-lg font-semibold mb-4">Solicitações de Senha</h2>
                         <div className="space-y-3 max-h-64 overflow-y-auto">
                            {passwordRequests.length > 0 ? passwordRequests.map(req => (
                                <div key={req.cpf} className="bg-background-dark p-3 rounded-lg flex justify-between items-center">
                                    <p className="font-mono text-sm">{formatCPF(req.cpf)}</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => openModal('approve', req)} className="btn-success-sm">Aprovar</button>
                                        <button onClick={() => openModal('deny', req)} className="btn-danger-sm">Negar</button>
                                    </div>
                                </div>
                            )) : <p className="text-subtle-dark text-sm text-center py-4">Nenhuma solicitação pendente.</p>}
                        </div>
                    </div>

                    {/* Limit Requests */}
                    <div className="bg-surface-dark p-6 rounded-xl">
                        <h2 className="text-lg font-semibold mb-4">Solicitações de Limite</h2>
                         <div className="space-y-3 max-h-64 overflow-y-auto">
                            {limitRequests.length > 0 ? limitRequests.map(req => (
                                <div key={req.cpf} className="bg-background-dark p-3 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-mono text-sm">{formatCPF(req.cpf)}</p>
                                        <p className="text-xs text-primary">Novo Limite: {req.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openModal('approve', req)} className="btn-success-sm">Aprovar</button>
                                        <button onClick={() => openModal('deny', req)} className="btn-danger-sm">Negar</button>
                                    </div>
                                </div>
                            )) : <p className="text-subtle-dark text-sm text-center py-4">Nenhuma solicitação pendente.</p>}
                        </div>
                    </div>

                    {/* Massa de Teste — Billing Mock */}
                    <div className="bg-surface-dark p-6 rounded-xl">
                        <h2 className="text-lg font-semibold mb-1">Massa de Teste (Billing)</h2>
                        <p className="text-xs text-subtle-dark mb-4">Aplica cenários de faturamento para automação. Não afeta dados de produção.</p>

                        <p className="text-xs text-subtle-dark mb-2 font-medium">CPF alvo</p>
                        <div className="flex gap-2 flex-wrap mb-2">
                            {[
                                { label: 'Todos', value: '' },
                                { label: '111', value: '11111111111' },
                                { label: '222', value: '22222222222' },
                                { label: '333', value: '33333333333' },
                                { label: '444', value: '44444444444' },
                            ].map(opt => (
                                <button key={opt.value || 'all'} onClick={() => setBillingCpf(opt.value)}
                                    className={`text-xs px-2 py-1 rounded-lg border transition-colors ${billingCpf === opt.value ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-subtle-dark hover:border-white/30'}`}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <input value={billingCpf} onChange={e => setBillingCpf(e.target.value.replace(/\D/g, ''))}
                            placeholder="ou CPF personalizado…"
                            className="w-full bg-background-dark text-white text-sm p-2 rounded-lg border border-white/10 mb-4" />

                        <p className="text-xs text-subtle-dark mb-2 font-medium">Cenário</p>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {[
                                { key: 'adimplente',   label: 'Adimplente',   cls: 'text-green-400 border-green-400/30 bg-green-400/5' },
                                { key: 'vencida',      label: 'Vencida',      cls: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5' },
                                { key: 'inadimplente', label: 'Inadimplente', cls: 'text-red-400 border-red-400/30 bg-red-400/5' },
                                { key: 'reset',        label: '↺ Reset',      cls: 'text-subtle-dark border-white/10' },
                            ].map(s => (
                                <button key={s.key} onClick={() => applyBillingScenario(s.key)}
                                    disabled={billingLoading}
                                    className={`text-xs py-2 px-3 rounded-lg border font-medium disabled:opacity-40 transition-colors ${s.cls}`}>
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2 mb-3">
                            <button onClick={saveBillingBaseline} disabled={billingLoading || !billingCpf}
                                className="flex-1 text-xs py-2 px-3 rounded-lg border border-primary/30 bg-primary/5 text-primary disabled:opacity-40">
                                Salvar como Mock
                            </button>
                            <button onClick={clearBillingBaseline} disabled={billingLoading || !billingCpf}
                                className="flex-1 text-xs py-2 px-3 rounded-lg border border-white/10 text-subtle-dark disabled:opacity-40">
                                Limpar Baseline
                            </button>
                        </div>
                        <button onClick={resetAllTestData} disabled={billingLoading}
                            className="w-full text-xs py-2 px-3 rounded-lg bg-red-500/10 border border-red-400/20 text-red-400 disabled:opacity-40">
                            Reset Todos Dados de Teste
                        </button>

                        {billingMsg && (
                            <p className={`text-xs mt-3 text-center font-medium ${billingMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
                                {billingMsg.text}
                            </p>
                        )}
                    </div>
                </section>
            </main>

            {/* Modal */}
            {modalState.isOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-surface-dark p-8 rounded-xl shadow-2xl w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Confirmar Ação</h2>
                        {modalState.action === 'deny' && (
                            <>
                                <p className="text-subtle-dark mb-2">Por favor, informe o motivo da recusa:</p>
                                <textarea value={denyReason} onChange={e => setDenyReason(e.target.value)} className="w-full bg-background-dark p-2 rounded-lg" rows={3}></textarea>
                            </>
                        )}
                        {modalState.action === 'deposit' && (
                             <>
                                <p className="text-subtle-dark mb-2">Informe o valor a ser depositado:</p>
                                <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className="w-full bg-background-dark p-2 rounded-lg" placeholder="0.00" />
                            </>
                        )}
                        {modalState.action !== 'deny' && modalState.action !== 'deposit' && (
                            <p className="text-subtle-dark mb-6">Você tem certeza que deseja executar esta ação para o CPF {formatCPF(modalState.data.cpf)}?</p>
                        )}
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={closeModal} className="btn-secondary">Cancelar</button>
                            <button onClick={handleConfirmAction} disabled={isLoadingAction} className="btn-primary disabled:opacity-50">
                                {isLoadingAction ? 'Processando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-8 right-8 p-4 rounded-lg shadow-lg text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
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
    );
};

export default Admin;