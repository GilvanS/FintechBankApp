import React, { useState, useEffect } from 'react';
import { PasswordResetRequest, LimitIncreaseRequest, User } from '../../types';
import {
    adminGetPasswordRequests,
    adminApprovePasswordRequest,
    adminDenyPasswordRequest,
    adminGetLimitRequests,
    adminApproveLimitRequest,
    adminDenyLimitRequest
} from '../../services/api';
import { formatCPF } from '../../utils/formatters';
import { useAppState } from '../../contexts/AppStateContext';
import { Check, X, KeyRound, ArrowUpCircle, FileText } from 'lucide-react';
import { showToast } from '../../utils/toast';

const RequestsManagement: React.FC = () => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    const [passwordRequests, setPasswordRequests] = useState<PasswordResetRequest[]>([]);
    const [limitRequests, setLimitRequests] = useState<LimitIncreaseRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingAction, setIsLoadingAction] = useState(false);

    // Modal State
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
            const [passReqsResult, limReqsResult] = await Promise.all([
                adminGetPasswordRequests(),
                adminGetLimitRequests()
            ]);
            
            const passReqs = passReqsResult.success ? passReqsResult.requests : [];
            const limReqs = limReqsResult.success ? limReqsResult.requests : [];
            
            setPasswordRequests(passReqs || []);
            setLimitRequests(limReqs || []);
        } catch (error: any) {
            console.error('Erro ao buscar solicitações:', error);
            setPasswordRequests([]);
            setLimitRequests([]);
            showToast('Erro ao carregar solicitações.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

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
        <div className="p-6 w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
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
                            <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
                        </div>

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
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RequestsManagement;
