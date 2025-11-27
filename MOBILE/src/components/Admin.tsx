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
    adminUpdatePixLimit
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

    useEffect(() => {
        fetchRequests();
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
    };

    return (
        <div className="bg-background-dark text-text-dark h-full flex flex-col p-4 overflow-hidden">
            <header className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center space-x-3 overflow-hidden">
                    <span className="material-symbols-outlined text-primary text-3xl shrink-0">admin_panel_settings</span>
                    <div className="overflow-hidden">
                        <h1 className="text-xl font-bold text-text-dark truncate">Painel Admin</h1>
                        <p className="text-xs text-subtle-dark truncate">Olá, {adminUser?.fullName.split(' ')[0]}</p>
                    </div>
                </div>
                <button onClick={onBack} className="p-2 rounded-full hover:bg-surface-dark transition-colors shrink-0 z-10">
                    <span className="material-symbols-outlined">logout</span>
                </button>
            </header>

            <main className="flex-grow overflow-y-auto no-scrollbar space-y-8">
                {/* Stats */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Solicitações de Senha" value={passwordRequests.length} icon="lock_reset" />
                    <StatCard title="Solicitações de Limite" value={limitRequests.length} icon="upgrade" />
                    <StatCard title="Total de Clientes" value="-" icon="group" />
                    <StatCard title="Transações Hoje" value="-" icon="monitoring" />
                </section>

                {/* User Management */}
                <section className="bg-surface-dark p-6 rounded-xl">
                    <h2 className="text-lg font-semibold mb-4">Gerenciar Cliente</h2>
                    <form onSubmit={handleSearch} className="flex items-center gap-4 mb-6">
                        <input
                            type="text"
                            value={formatCPF(cpfSearch)}
                            onChange={(e) => setCpfSearch(e.target.value)}
                            placeholder="Buscar por CPF"
                            maxLength={14}
                            className="flex-grow px-4 py-3 bg-background-dark border-2 border-background-dark rounded-lg text-text-dark placeholder-subtle-dark focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button type="submit" className="px-6 py-3 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90">Buscar</button>
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