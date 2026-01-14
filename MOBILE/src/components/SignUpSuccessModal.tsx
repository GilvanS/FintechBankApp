import React from 'react';

interface SignUpSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    userData: {
        fullName: string;
        email: string;
        cpf: string;
    };
}

const SignUpSuccessModal: React.FC<SignUpSuccessModalProps> = ({ isOpen, onClose, userData }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 test-signup-success-modal-overlay"
            id="signup-success-modal-overlay"
            data-testid="signup-success-modal-overlay"
            data-cy="signup-success-modal-overlay"
            data-playwright="signup-success-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signup-success-modal-title"
            onClick={onClose}
        >
            <div 
                className="bg-surface-dark rounded-xl p-6 max-w-md w-full mx-4 test-signup-success-modal"
                id="signup-success-modal"
                data-testid="signup-success-modal"
                data-cy="signup-success-modal"
                data-playwright="signup-success-modal"
                onClick={(e) => e.stopPropagation()}
                role="document"
            >
                <div className="text-center mb-6">
                    <div 
                        className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4 test-signup-success-icon-container"
                        data-testid="signup-success-icon-container"
                    >
                        <span 
                            className="material-symbols-outlined text-green-400 text-4xl"
                            aria-hidden="true"
                            data-testid="signup-success-icon"
                        >
                            check_circle
                        </span>
                    </div>
                    <h2 
                        className="text-white text-2xl font-bold mb-2 test-signup-success-title"
                        id="signup-success-modal-title"
                        data-testid="signup-success-modal-title"
                        data-cy="signup-success-modal-title"
                        data-playwright="signup-success-modal-title"
                        role="heading"
                        aria-level={2}
                    >
                        Conta criada com sucesso!
                    </h2>
                    <div 
                        className={`alert block mt-4 p-3 border rounded-lg text-sm flex items-center gap-2 bg-green-500/10 border-green-500/20 text-green-400 test-signup-success-message`}
                        id="signup-success-message"
                        data-testid="signup-success-message"
                        data-cy="signup-success-message"
                        data-playwright="signup-success-message"
                        role="alert"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        <span 
                            className="material-symbols-outlined text-sm"
                            aria-hidden="true"
                            data-testid="signup-success-message-icon"
                        >
                            check_circle
                        </span>
                        <span data-testid="signup-success-message-text">Sua conta foi criada com sucesso. Bem-vindo!</span>
                    </div>
                </div>

                <div 
                    className="bg-background-dark rounded-lg p-4 mb-6 test-signup-success-details"
                    id="signup-success-details"
                    data-testid="signup-success-details"
                    data-cy="signup-success-details"
                    role="group"
                    aria-label="Detalhes da conta criada"
                >
                    <div className="space-y-3">
                        <div className="flex justify-between items-center test-signup-success-name-row">
                            <span 
                                className="text-white/60 text-sm test-signup-success-name-label"
                                data-testid="signup-success-name-label"
                            >
                                Nome
                            </span>
                            <span 
                                className="text-white font-semibold text-right break-all test-signup-success-name-value"
                                id="signup-success-name-value"
                                data-testid="signup-success-name-value"
                                data-cy="signup-success-name-value"
                                role="text"
                                aria-label="Nome completo"
                            >
                                {userData.fullName}
                            </span>
                        </div>
                        <div className="h-px bg-subtle-dark/50"></div>
                        <div className="flex justify-between items-center test-signup-success-email-row">
                            <span 
                                className="text-white/60 text-sm test-signup-success-email-label"
                                data-testid="signup-success-email-label"
                            >
                                E-mail
                            </span>
                            <span 
                                className="text-white font-semibold text-right break-all test-signup-success-email-value"
                                id="signup-success-email-value"
                                data-testid="signup-success-email-value"
                                data-cy="signup-success-email-value"
                                role="text"
                                aria-label="E-mail"
                            >
                                {userData.email}
                            </span>
                        </div>
                        <div className="h-px bg-subtle-dark/50"></div>
                        <div className="flex justify-between items-center test-signup-success-cpf-row">
                            <span 
                                className="text-white/60 text-sm test-signup-success-cpf-label"
                                data-testid="signup-success-cpf-label"
                            >
                                CPF
                            </span>
                            <span 
                                className="text-white font-semibold text-right break-all test-signup-success-cpf-value"
                                id="signup-success-cpf-value"
                                data-testid="signup-success-cpf-value"
                                data-cy="signup-success-cpf-value"
                                role="text"
                                aria-label="CPF"
                            >
                                {userData.cpf}
                            </span>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={onClose}
                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-background-dark font-bold py-3 px-8 rounded-lg transition-colors test-signup-success-close-button"
                    id="btn-signup-success-close"
                    name="signup-success-close-button"
                    data-testid="signup-success-close-button"
                    data-cy="signup-success-close-button"
                    data-playwright="signup-success-close-button"
                    aria-label="Fechar"
                    type="button"
                    role="button"
                >
                    <span 
                        className="test-signup-success-close-button-text"
                        data-testid="signup-success-close-button-text"
                    >
                        Fechar
                    </span>
                </button>
            </div>
        </div>
    );
};

export default SignUpSuccessModal;
