import React from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
    type: ToastType;
    text: string;
}

export function useToast() {
    const [toast, setToast] = React.useState<ToastMessage | null>(null);

    const show = (type: ToastType, text: string) => setToast({ type, text });
    const showSuccess = (text: string) => show('success', text);
    const showError = (text: string) => show('error', text);
    const showInfo = (text: string) => show('info', text);
    const hide = () => setToast(null);

    return { toast, showSuccess, showError, showInfo, hide };
}

export const ToastContainer: React.FC<{ toast: ToastMessage | null; onClose: () => void }> = ({ toast, onClose }) => {
    if (!toast) return null;
    const bg =
        toast.type === 'success' ? 'bg-green-600' :
        toast.type === 'error' ? 'bg-red-600' :
        'bg-blue-600';

    const iconName = toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info';

    return (
        <div 
            className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded text-white shadow-lg ${bg} z-50 test-toast test-toast-${toast.type}`}
            id={`toast-${toast.type}`}
            data-testid={`toast-${toast.type}`}
            data-cy={`toast-${toast.type}`}
            data-playwright={`toast-${toast.type}`}
            role="alert"
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
            aria-label={`Notificação ${toast.type === 'success' ? 'de sucesso' : toast.type === 'error' ? 'de erro' : 'informativa'}`}
        >
            <div 
                className="flex items-center space-x-3 test-toast-content"
                id="toast-content"
                data-testid="toast-content"
                data-cy="toast-content"
            >
                <span 
                    className="material-symbols-outlined test-toast-icon"
                    aria-hidden="true"
                    id="toast-icon"
                    data-testid="toast-icon"
                    data-cy="toast-icon"
                >
                    {iconName}
                </span>
                <span 
                    className="test-toast-message"
                    id="toast-message"
                    data-testid="toast-message"
                    data-cy="toast-message"
                    data-playwright="toast-message"
                >
                    {toast.text}
                </span>
                <button 
                    onClick={onClose} 
                    className="ml-2 bg-white/20 hover:bg-white/30 rounded px-2 py-1 text-sm test-toast-close-button"
                    id="btn-toast-close"
                    name="toast-close-button"
                    data-testid="toast-close-button"
                    data-cy="toast-close-button"
                    data-playwright="toast-close-button"
                    aria-label="Fechar notificação"
                    type="button"
                    role="button"
                >
                    <span data-testid="toast-close-button-text">Fechar</span>
                </button>
            </div>
        </div>
    );
};