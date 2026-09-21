import React from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
    label: string;
    onClick: () => void;
}

export interface ToastMessage {
    type: ToastType;
    text: string;
    /** Título curto e em destaque — quando ausente, `text` ocupa o lugar do título sozinho (comportamento antigo). */
    title?: string;
    /** Ex.: "Tentar novamente" numa falha de comunicação. Opcional — a maioria dos toasts não precisa. */
    action?: ToastAction;
}

export interface ToastOptions {
    title?: string;
    action?: ToastAction;
}

export function useToast() {
    const [toast, setToast] = React.useState<ToastMessage | null>(null);

    const show = (type: ToastType, text: string, options?: ToastOptions) =>
        setToast({ type, text, title: options?.title, action: options?.action });
    const showSuccess = (text: string, options?: ToastOptions) => show('success', text, options);
    const showError = (text: string, options?: ToastOptions) => show('error', text, options);
    const showInfo = (text: string, options?: ToastOptions) => show('info', text, options);
    const hide = () => setToast(null);

    return { toast, showSuccess, showError, showInfo, hide };
}

import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC<{ toast: ToastMessage | null; onClose: () => void }> = ({ toast, onClose }) => {
    return (
        <AnimatePresence>
            {toast && (
                <motion.div 
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={`fixed bottom-6 left-1/2 -translate-x-1/2 p-4 pr-12 rounded-2xl text-white shadow-2xl z-50 test-toast test-toast-${toast.type} flex items-start gap-3 backdrop-blur-xl
                        ${toast.type === 'success' ? 'bg-[#18181b]/95 border border-volt-green/30' : 
                          toast.type === 'error' ? 'bg-[#18181b]/95 border border-volt-red/30' : 
                          'bg-[#18181b]/95 border border-blue-500/30'}`}
                    id={`toast-${toast.type}`}
                    data-testid={`toast-${toast.type}`}
                    data-cy={`toast-${toast.type}`}
                    data-playwright={`toast-${toast.type}`}
                    role="alert"
                    aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
                    aria-atomic="true"
                    aria-label={`Notificação ${toast.type === 'success' ? 'de sucesso' : toast.type === 'error' ? 'de erro' : 'informativa'}`}
                >
                    <div className="shrink-0 mt-0.5">
                        {toast.type === 'success' && <CheckCircle2 className="text-volt-green" size={24} />}
                        {toast.type === 'error' && <AlertTriangle className="text-volt-red" size={24} />}
                        {toast.type === 'info' && <Info className="text-blue-500" size={24} />}
                    </div>

                    <div className="flex-1 min-w-0">
                        {toast.title && (
                            <div className="text-sm font-black leading-tight mb-0.5">{toast.title}</div>
                        )}
                        <div
                            className={`text-xs leading-relaxed test-toast-message ${toast.title ? 'text-white/70 font-medium' : 'text-sm font-semibold'}`}
                            id="toast-message"
                            data-testid="toast-message"
                            data-cy="toast-message"
                            data-playwright="toast-message"
                        >
                            {toast.text}
                        </div>
                        {toast.action && (
                            <button
                                type="button"
                                onClick={toast.action.onClick}
                                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 transition-colors test-toast-action"
                                data-testid="toast-action"
                            >
                                {toast.action.label}
                            </button>
                        )}
                    </div>

                    <button 
                        onClick={onClose} 
                        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors test-toast-close-button"
                        id="btn-toast-close"
                        name="toast-close-button"
                        data-testid="toast-close-button"
                        data-cy="toast-close-button"
                        data-playwright="toast-close-button"
                        aria-label="Fechar notificação"
                        type="button"
                        role="button"
                    >
                        <X size={18} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};