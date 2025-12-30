import React from 'react';

interface PixSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    details: {
        amount: number;
        recipientName: string;
        recipientCpf: string;
        description?: string;
    };
}

const PixSuccessModal: React.FC<PixSuccessModalProps> = ({ isOpen, onClose, details }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 test-pix-success-modal-overlay"
            id="pix-success-modal-overlay"
            data-testid="pix-success-modal-overlay"
            data-cy="pix-success-modal-overlay"
            data-playwright="pix-success-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pix-success-modal-title"
            onClick={onClose}
        >
            <div 
                className="bg-surface-dark rounded-xl p-6 max-w-md w-full mx-4 test-pix-success-modal"
                id="pix-success-modal"
                data-testid="pix-success-modal"
                data-cy="pix-success-modal"
                data-playwright="pix-success-modal"
                onClick={(e) => e.stopPropagation()}
                role="document"
            >
                <div className="text-center mb-6">
                    <div 
                        className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4 test-pix-success-icon-container"
                        data-testid="pix-success-icon-container"
                    >
                        <span 
                            className="material-symbols-outlined text-green-400 text-4xl"
                            aria-hidden="true"
                            data-testid="pix-success-icon"
                        >
                            check_circle
                        </span>
                    </div>
                    <h2 
                        className="text-white text-2xl font-bold mb-2 test-pix-success-title"
                        id="pix-success-modal-title"
                        data-testid="pix-success-modal-title"
                        data-cy="pix-success-modal-title"
                        data-playwright="pix-success-modal-title"
                        role="heading"
                        aria-level={2}
                    >
                        Transferencia realizada com sucesso!
                    </h2>
                    <div 
                        className={`alert block mt-4 p-3 border rounded-lg text-sm flex items-center gap-2 bg-green-500/10 border-green-500/20 text-green-400 test-pix-success-message`}
                        id="pix-success-message"
                        data-testid="pix-success-message"
                        data-cy="pix-success-message"
                        data-playwright="pix-success-message"
                        role="alert"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        <span 
                            className="material-symbols-outlined text-sm"
                            aria-hidden="true"
                            data-testid="pix-success-message-icon"
                        >
                            check_circle
                        </span>
                        <span data-testid="pix-success-message-text">Transferencia concluida com sucesso</span>
                    </div>
                </div>

                <div 
                    className="bg-background-dark rounded-lg p-4 mb-6 test-pix-success-details"
                    id="pix-success-details"
                    data-testid="pix-success-details"
                    data-cy="pix-success-details"
                    role="group"
                    aria-label="Detalhes da transferência realizada"
                >
                    <div className="space-y-3">
                        <div className="flex justify-between items-center test-pix-success-amount-row">
                            <span 
                                className="text-white/60 text-sm test-pix-success-amount-label"
                                data-testid="pix-success-amount-label"
                            >
                                Valor transferido
                            </span>
                            <span 
                                className="text-primary font-bold text-lg test-pix-success-amount-value"
                                id="pix-success-amount-value"
                                data-testid="pix-success-amount-value"
                                data-cy="pix-success-amount-value"
                                role="text"
                                aria-label="Valor transferido"
                            >
                                {details.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                        <div className="h-px bg-subtle-dark/50"></div>
                        <div className="flex justify-between items-center test-pix-success-recipient-row">
                            <span 
                                className="text-white/60 text-sm test-pix-success-recipient-label"
                                data-testid="pix-success-recipient-label"
                            >
                                Para
                            </span>
                            <span 
                                className="text-white font-semibold text-right break-all test-pix-success-recipient-value"
                                id="pix-success-recipient-value"
                                data-testid="pix-success-recipient-value"
                                data-cy="pix-success-recipient-value"
                                role="text"
                                aria-label="Destinatário"
                            >
                                {details.recipientName}
                            </span>
                        </div>
                        <div className="flex justify-between items-center test-pix-success-cpf-row">
                            <span 
                                className="text-white/60 text-sm test-pix-success-cpf-label"
                                data-testid="pix-success-cpf-label"
                            >
                                CPF
                            </span>
                            <span 
                                className="text-white font-semibold text-right break-all test-pix-success-cpf-value"
                                id="pix-success-cpf-value"
                                data-testid="pix-success-cpf-value"
                                data-cy="pix-success-cpf-value"
                                role="text"
                                aria-label="CPF do destinatário"
                            >
                                {details.recipientCpf}
                            </span>
                        </div>
                        {details.description && (
                            <>
                                <div className="h-px bg-subtle-dark/50"></div>
                                <div className="flex justify-between items-start test-pix-success-description-row">
                                    <span 
                                        className="text-white/60 text-sm test-pix-success-description-label"
                                        data-testid="pix-success-description-label"
                                    >
                                        Descricao
                                    </span>
                                    <span 
                                        className="text-white font-semibold text-right break-all test-pix-success-description-value"
                                        id="pix-success-description-value"
                                        data-testid="pix-success-description-value"
                                        data-cy="pix-success-description-value"
                                        role="text"
                                        aria-label="Descrição"
                                    >
                                        {details.description}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <button 
                    onClick={onClose}
                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-background-dark font-bold py-3 px-8 rounded-lg transition-colors test-pix-success-close-button"
                    id="btn-pix-success-close"
                    name="pix-success-close-button"
                    data-testid="pix-success-close-button"
                    data-cy="pix-success-close-button"
                    data-playwright="pix-success-close-button"
                    aria-label="Fechar"
                    type="button"
                    role="button"
                >
                    <span 
                        className="test-pix-success-close-button-text"
                        data-testid="pix-success-close-button-text"
                    >
                        Fechar
                    </span>
                </button>
            </div>
        </div>
    );
};

export default PixSuccessModal;







