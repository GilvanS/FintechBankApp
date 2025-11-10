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

    return (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded text-white shadow-lg ${bg} z-50`}>
            <div className="flex items-center space-x-3">
                <span className="material-symbols-outlined">
                    {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
                </span>
                <span>{toast.text}</span>
                <button onClick={onClose} className="ml-2 bg-white/20 hover:bg-white/30 rounded px-2 py-1 text-sm">Fechar</button>
            </div>
        </div>
    );
};