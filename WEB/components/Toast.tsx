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

                    <div 
                        className="flex-1 text-sm font-semibold leading-tight test-toast-message"
                        id="toast-message"
                        data-testid="toast-message"
                        data-cy="toast-message"
                        data-playwright="toast-message"
                    >
                        {toast.text}
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