import React from 'react';
import { useAppState } from '../contexts/AppStateContext';

interface PixKeySuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    keyData: {
        type: 'CPF' | 'EMAIL';
        key: string;
    };
}

const PixKeySuccessModal: React.FC<PixKeySuccessModalProps> = ({ isOpen, onClose, keyData }) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    if (!isOpen) return null;

    const formatKey = (type: 'CPF' | 'EMAIL', key: string) => {
        if (type === 'CPF') {
            const digits = key.replace(/\D/g, '');
            return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
        }
        return key;
    };

    return (
        <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 test-pix-key-success-modal-overlay"
            id="pix-key-success-modal-overlay"
            data-testid="pix-key-success-modal-overlay"
            data-cy="pix-key-success-modal-overlay"
            data-playwright="pix-key-success-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pix-key-success-modal-title"
            onClick={onClose}
        >
            <div
                className={`rounded-xl p-6 max-w-md w-full mx-4 test-pix-key-success-modal ${isMidnight ? 'bg-surface-dark' : 'bg-white border-2 border-black'}`}
                id="pix-key-success-modal"
                data-testid="pix-key-success-modal"
                data-cy="pix-key-success-modal"
                data-playwright="pix-key-success-modal"
                onClick={(e) => e.stopPropagation()}
                role="document"
            >
                <div className="text-center mb-6">
                    <div
                        className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4 test-pix-key-success-icon-container"
                        data-testid="pix-key-success-icon-container"
                    >
                        <span
                            className="material-symbols-outlined text-green-500 text-4xl"
                            aria-hidden="true"
                            data-testid="pix-key-success-icon"
                        >
                            check_circle
                        </span>
                    </div>
                    <h2
                        className={`text-2xl font-bold mb-2 test-pix-key-success-title ${isMidnight ? 'text-white' : 'text-black'}`}
                        id="pix-key-success-modal-title"
                        data-testid="pix-key-success-modal-title"
                        data-cy="pix-key-success-modal-title"
                        data-playwright="pix-key-success-modal-title"
                        role="heading"
                        aria-level={2}
                    >
                        Chave cadastrada com sucesso!
                    </h2>
                    <div
                        className="alert block mt-4 p-3 border rounded-lg text-sm flex items-center gap-2 bg-green-500/10 border-green-500/20 text-green-600 test-pix-key-success-message"
                        id="pix-key-success-message"
                        data-testid="pix-key-success-message"
                        data-cy="pix-key-success-message"
                        data-playwright="pix-key-success-message"
                        role="alert"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        <span
                            className="material-symbols-outlined text-sm"
                            aria-hidden="true"
                            data-testid="pix-key-success-message-icon"
                        >
                            check_circle
                        </span>
                        <span data-testid="pix-key-success-message-text">Sua chave PIX foi cadastrada com sucesso e ja esta disponivel para uso.</span>
                    </div>
                </div>

                <div
                    className={`rounded-lg p-4 mb-6 test-pix-key-success-details ${isMidnight ? 'bg-background-dark' : 'bg-black/5'}`}
                    id="pix-key-success-details"
                    data-testid="pix-key-success-details"
                    data-cy="pix-key-success-details"
                    role="group"
                    aria-label="Detalhes da chave cadastrada"
                >
                    <div className="space-y-3">
                        <div className="flex justify-between items-center test-pix-key-success-type-row">
                            <span
                                className={`text-sm test-pix-key-success-type-label ${isMidnight ? 'text-white/60' : 'text-black/50'}`}
                                data-testid="pix-key-success-type-label"
                            >
                                Tipo
                            </span>
                            <span
                                className={`font-semibold text-right test-pix-key-success-type-value ${isMidnight ? 'text-white' : 'text-black'}`}
                                id="pix-key-success-type-value"
                                data-testid="pix-key-success-type-value"
                                data-cy="pix-key-success-type-value"
                                role="text"
                                aria-label="Tipo da chave"
                            >
                                {keyData.type === 'CPF' ? 'CPF' : 'E-mail'}
                            </span>
                        </div>
                        <div className={`h-px ${isMidnight ? 'bg-subtle-dark/50' : 'bg-black/20'}`}></div>
                        <div className="flex justify-between items-center test-pix-key-success-key-row">
                            <span
                                className={`text-sm test-pix-key-success-key-label ${isMidnight ? 'text-white/60' : 'text-black/50'}`}
                                data-testid="pix-key-success-key-label"
                            >
                                Chave
                            </span>
                            <span
                                className={`font-semibold text-right break-all test-pix-key-success-key-value ${isMidnight ? 'text-white' : 'text-black'}`}
                                id="pix-key-success-key-value"
                                data-testid="pix-key-success-key-value"
                                data-cy="pix-key-success-key-value"
                                role="text"
                                aria-label="Chave PIX"
                            >
                                {formatKey(keyData.type, keyData.key)}
                            </span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className={`w-full flex items-center justify-center gap-2 font-bold py-3 px-8 rounded-lg transition-colors test-pix-key-success-close-button ${isMidnight ? 'bg-primary hover:bg-primary/90 text-background-dark' : 'bg-volt-lime hover:opacity-90 text-black border-2 border-black'}`}
                    id="btn-pix-key-success-close"
                    name="pix-key-success-close-button"
                    data-testid="pix-key-success-close-button"
                    data-cy="pix-key-success-close-button"
                    data-playwright="pix-key-success-close-button"
                    aria-label="Fechar"
                    type="button"
                    role="button"
                >
                    <span 
                        className="test-pix-key-success-close-button-text"
                        data-testid="pix-key-success-close-button-text"
                    >
                        Fechar
                    </span>
                </button>
            </div>
        </div>
    );
};

export default PixKeySuccessModal;
