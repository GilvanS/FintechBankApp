import React, { createContext, useContext, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface DialogOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    isConfirm?: boolean;
}

interface DialogContextType {
    showDialog: (options: DialogOptions) => void;
    hideDialog: () => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const useDialog = () => {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return context;
};

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        options: DialogOptions | null;
    }>({
        isOpen: false,
        options: null,
    });

    const showDialog = (options: DialogOptions) => {
        setDialogState({
            isOpen: true,
            options,
        });
    };

    const hideDialog = () => {
        setDialogState((prev) => ({ ...prev, isOpen: false }));
        setTimeout(() => {
            setDialogState({ isOpen: false, options: null });
        }, 300);
    };

    const handleConfirm = () => {
        if (dialogState.options?.onConfirm) {
            dialogState.options.onConfirm();
        }
        hideDialog();
    };

    const handleCancel = () => {
        if (dialogState.options?.onCancel) {
            dialogState.options.onCancel();
        }
        hideDialog();
    };

    return (
        <DialogContext.Provider value={{ showDialog, hideDialog }}>
            {children}
            <AnimatePresence>
                {dialogState.isOpen && dialogState.options && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={dialogState.options.isConfirm ? handleCancel : handleConfirm}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-sm bg-[#131313] border border-white/10 shadow-2xl rounded-[2rem] p-6 text-center flex flex-col gap-4 overflow-hidden"
                        >
                            <h2 className="text-xl font-black text-white">{dialogState.options.title}</h2>
                            <p className="text-white/70 text-sm whitespace-pre-wrap">{dialogState.options.message}</p>
                            
                            <div className={`flex gap-3 mt-2 ${dialogState.options.isConfirm ? 'flex-row' : 'flex-col'}`}>
                                {dialogState.options.isConfirm && (
                                    <button
                                        onClick={handleCancel}
                                        className="flex-1 py-3 rounded-xl font-bold bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                                    >
                                        {dialogState.options.cancelText || 'Cancelar'}
                                    </button>
                                )}
                                <button
                                    onClick={handleConfirm}
                                    className={`${dialogState.options.isConfirm ? 'flex-1' : 'w-full'} py-3 rounded-xl font-bold bg-volt-primary text-black hover:bg-[#b0f52b] transition-colors`}
                                >
                                    {dialogState.options.confirmText || (dialogState.options.isConfirm ? 'Confirmar' : 'Entendi')}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </DialogContext.Provider>
    );
};
