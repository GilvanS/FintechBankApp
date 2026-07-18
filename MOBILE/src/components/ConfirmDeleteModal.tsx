import React from 'react';
import { useAppState } from '../contexts/AppStateContext';

interface ConfirmDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    itemName?: string;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    itemName
}) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            data-testid="confirm-delete-modal-overlay"
            id="confirm-delete-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-modal-title"
            onClick={onClose}
        >
            <div
                className={`rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl ${isMidnight ? 'bg-surface-dark' : 'bg-white border-2 border-black'}`}
                data-testid="confirm-delete-modal"
                id="confirm-delete-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="text-center mb-6">
                    <div
                        className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4"
                        data-testid="confirm-delete-icon-container"
                    >
                        <span
                            className="material-symbols-outlined text-red-500 text-4xl"
                            aria-hidden="true"
                            data-testid="confirm-delete-icon"
                        >
                            warning
                        </span>
                    </div>
                    <h2
                        className={`text-xl font-bold mb-2 ${isMidnight ? 'text-white' : 'text-black'}`}
                        id="confirm-delete-modal-title"
                        data-testid="confirm-delete-modal-title"
                        role="heading"
                        aria-level={2}
                    >
                        {title}
                    </h2>
                    <p
                        className={`text-sm ${isMidnight ? 'text-subtle-dark' : 'text-black/60'}`}
                        data-testid="confirm-delete-modal-message"
                        id="confirm-delete-modal-message"
                    >
                        {message}
                        {itemName && (
                            <span className={`block mt-2 font-semibold ${isMidnight ? 'text-white' : 'text-black'}`}>{itemName}</span>
                        )}
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className={`flex-1 px-4 py-3 rounded-lg transition-colors font-medium ${isMidnight ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-black/10 text-black hover:bg-black/20'}`}
                        data-testid="confirm-delete-cancel-button"
                        id="confirm-delete-cancel-button"
                        aria-label="Cancelar exclusão"
                        role="button"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                        data-testid="confirm-delete-confirm-button"
                        id="confirm-delete-confirm-button"
                        aria-label="Confirmar exclusão"
                        role="button"
                    >
                        Excluir
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDeleteModal;

