import React from 'react';
import { formatCPF } from '../../utils/formatters';

interface ConfirmModalProps {
    isOpen: boolean;
    action: string | null;
    dataCpf?: string;
    denyReason: string;
    depositAmount: string;
    isLoadingAction: boolean;
    isMidnight: boolean;
    modalOverlayClass: string;
    modalCardClass: string;
    titleClass: string;
    subTextClass: string;
    innerCardClass: string;
    btnTypographyClass: string;
    primaryOutlineBtnClass: string;
    neutralBtnClass: string;
    onClose: () => void;
    onConfirm: () => void;
    onDenyReasonChange: (value: string) => void;
    onDepositAmountChange: (value: string) => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen, action, dataCpf,
    denyReason, depositAmount, isLoadingAction,
    isMidnight, modalOverlayClass, modalCardClass,
    titleClass, subTextClass, innerCardClass,
    btnTypographyClass, primaryOutlineBtnClass, neutralBtnClass,
    onClose, onConfirm, onDenyReasonChange, onDepositAmountChange,
}) => {
    if (!isOpen) return null;

    return (
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
                className={`p-8 rounded-3xl w-full max-w-2xl test-admin-modal ${modalCardClass}`}
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

                {action === 'deny' && (
                    <>
                        <p className={`font-bold mb-2 uppercase text-sm ${subTextClass}`}>Por favor, informe o motivo da recusa:</p>
                        <textarea
                            value={denyReason}
                            onChange={e => onDenyReasonChange(e.target.value)}
                            className={`w-full p-4 rounded-xl focus:outline-none transition-all font-bold ${innerCardClass} ${isMidnight ? 'text-white placeholder-white/30' : 'text-black placeholder-black/30'}`}
                            rows={3}
                        />
                    </>
                )}

                {action === 'deposit' && (
                    <>
                        <p className={`font-bold mb-2 uppercase text-sm ${subTextClass}`}>Informe o valor a ser depositado:</p>
                        <input
                            type="number"
                            value={depositAmount}
                            onChange={e => onDepositAmountChange(e.target.value)}
                            className={`w-full p-4 rounded-xl focus:outline-none transition-all font-bold ${innerCardClass} ${isMidnight ? 'text-white placeholder-white/30' : 'text-black placeholder-black/30'}`}
                            placeholder="0.00"
                        />
                    </>
                )}

                {action === 'fixOrphan' && (
                    <div className="mb-8">
                        <p className={`font-bold text-lg mb-2 ${subTextClass}`}>
                            Corrigir pagamentos órfãos em TODOS os CPFs?
                        </p>
                        <p className={`text-sm ${isMidnight ? 'text-white/60' : 'text-black/50'}`}>
                            Esta ação cruza todas as transações INVOICE_PAYMENT com o valor_pago
                            das invoices. Discrepâncias serão automaticamente corrigidas:
                            pagamentos sem invoice vinculada serão estornados ao saldo do usuário,
                            e diferenças serão alocadas à invoice mais recente não paga.
                        </p>
                    </div>
                )}

                {action !== 'deny' && action !== 'deposit' && action !== 'fixOrphan' && (
                    <p className={`font-bold mb-8 text-lg ${subTextClass}`}>
                        Você tem certeza que deseja executar esta ação para o CPF{' '}
                        <span className={`font-bold ${titleClass}`}>{formatCPF(dataCpf || '')}</span>?
                    </p>
                )}

                <div
                    className="flex flex-col justify-end gap-4 mt-8 test-admin-modal-actions"
                    id="admin-modal-actions"
                    data-testid="admin-modal-actions"
                    data-cy="admin-modal-actions"
                >
                    <button
                        onClick={onClose}
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
                        onClick={onConfirm}
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
    );
};

export default ConfirmModal;
