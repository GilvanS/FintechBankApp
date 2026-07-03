import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ArrowLeft, X } from 'lucide-react';
import { useAppState } from '../contexts/AppStateContext';

interface PasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (password: string) => void;
    title: string;
    description?: string;
    isLoading: boolean;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ isOpen, onClose, onConfirm, title, description, isLoading }) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    
    const [pin, setPin] = useState<string[]>(['', '', '', '']);
    const [focusedPinIndex, setFocusedPinIndex] = useState<number>(0);

    // Reset PIN when modal opens
    useEffect(() => {
        if (isOpen) {
            setPin(['', '', '', '']);
            setFocusedPinIndex(0);
        }
    }, [isOpen]);

    const handlePinChange = (val: string) => {
        if (focusedPinIndex < 4) {
            const newPin = [...pin];
            newPin[focusedPinIndex] = val;
            setPin(newPin);
            if (focusedPinIndex < 3) {
                setFocusedPinIndex(focusedPinIndex + 1);
            }
        }
    };

    const handlePinBackspace = () => {
        if (focusedPinIndex > 0 && pin[focusedPinIndex] === '') {
            const newPin = [...pin];
            newPin[focusedPinIndex - 1] = '';
            setPin(newPin);
            setFocusedPinIndex(focusedPinIndex - 1);
        } else {
            const newPin = [...pin];
            newPin[focusedPinIndex] = '';
            setPin(newPin);
        }
    };

    const handleSubmit = () => {
        if (pin.every(d => d !== '')) {
            onConfirm(pin.join(''));
        }
    };

    if (!isOpen) return null;

    const cardClass = isMidnight
        ? 'bg-volt-surface border-2 border-volt-primary'
        : 'bg-white border-4 border-black';
    const closeBtnClass = isMidnight ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black';
    const titleClass = isMidnight ? 'text-white' : 'text-black';
    const descClass = isMidnight ? 'text-on-surface-variant' : 'text-black/60';
    const iconBubbleClass = isMidnight ? 'bg-volt-primary/20' : 'bg-volt-lime/25';
    const iconClass = isMidnight ? 'text-volt-primary' : 'text-black';
    const pinBoxClass = isMidnight
        ? 'bg-[#0a0a0a] text-volt-primary'
        : 'bg-black/5 text-black';
    const pinFocusClass = isMidnight
        ? 'border-volt-primary ring-2 ring-volt-primary/20 shadow-[0_0_12px_rgba(0,255,157,0.3)]'
        : 'border-black ring-2 ring-black/10';
    const pinBlurClass = isMidnight ? 'border-white/10' : 'border-black/20';
    const keyBtnClass = isMidnight
        ? 'bg-white/5 hover:bg-white/10 text-white'
        : 'bg-black/5 hover:bg-black/10 text-black';
    const keyBtnMutedClass = isMidnight
        ? 'bg-white/5 hover:bg-white/10 text-white/50'
        : 'bg-black/5 hover:bg-black/10 text-black/50';
    const submitDisabledClass = isMidnight
        ? 'bg-white/5 text-white/30 cursor-not-allowed'
        : 'bg-black/5 text-black/30 cursor-not-allowed';
    const submitEnabledClass = isMidnight ? 'bg-volt-green text-black hover:opacity-90' : 'bg-volt-lime text-black border-2 border-black hover:opacity-90';

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm test-modal-overlay">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={`w-full max-w-sm rounded-3xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative test-modal ${cardClass}`}
                >
                    <button onClick={onClose} className={`absolute top-5 right-5 transition-colors ${closeBtnClass}`}>
                        <X size={20} />
                    </button>

                    <div className="space-y-6 pt-2">
                        {/* Header */}
                        <div className="text-center space-y-2">
                            <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-4 ${iconBubbleClass}`}>
                                <Shield size={24} className={iconClass} />
                            </div>
                            <h2 className={`text-xl font-black uppercase tracking-wider test-modal-title ${titleClass}`}>
                                {title}
                            </h2>
                            {description && (
                                <p className={`text-sm test-modal-description ${descClass}`}>
                                    {description}
                                </p>
                            )}
                        </div>

                        {/* Interactive PIN code inputs */}
                        <div className="flex justify-center gap-3">
                            {pin.map((digit, idx) => {
                                const isFocused = idx === focusedPinIndex;
                                return (
                                    <input
                                        key={idx}
                                        type={idx < 3 ? 'password' : 'text'}
                                        value={digit}
                                        readOnly
                                        onClick={() => setFocusedPinIndex(idx)}
                                        placeholder={isFocused ? '|' : ''}
                                        className={`w-14 h-16 border-b-2 text-center font-black text-2xl rounded-xl focus:outline-none transition-all placeholder:opacity-50
                                            ${pinBoxClass} ${isFocused ? pinFocusClass : pinBlurClass}
                                        `}
                                    />
                                );
                            })}
                        </div>

                        {/* On-screen Keypad */}
                        <div className="max-w-[260px] mx-auto grid grid-cols-3 gap-2 pt-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => handlePinChange(num.toString())}
                                    className={`h-14 rounded-xl font-black text-lg flex items-center justify-center cursor-pointer transition-all active:scale-95 ${keyBtnClass}`}
                                >
                                    {num}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={handlePinBackspace}
                                className={`h-14 rounded-xl font-black text-sm flex items-center justify-center cursor-pointer transition-all active:scale-95 ${keyBtnMutedClass}`}
                            >
                                ⌫
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePinChange('0')}
                                className={`h-14 rounded-xl font-black text-lg flex items-center justify-center cursor-pointer transition-all active:scale-95 ${keyBtnClass}`}
                            >
                                0
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPin(['3', '7', '1', '9']); // MOCK auto-fill
                                    setFocusedPinIndex(3);
                                }}
                                className={`h-14 rounded-xl font-black text-[10px] uppercase tracking-tighter flex items-center justify-center cursor-pointer transition-all active:scale-95 ${keyBtnMutedClass}`}
                            >
                                Auto
                            </button>
                        </div>

                        {/* Submit */}
                        <div className="pt-2 test-modal-actions">
                            <button
                                onClick={handleSubmit}
                                disabled={isLoading || pin.some(d => d === '')}
                                className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer test-confirm-button ${
                                    pin.some(d => d === '')
                                        ? submitDisabledClass
                                        : submitEnabledClass
                                }`}
                            >
                                {isLoading ? (
                                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                                ) : (
                                    'Confirmar'
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default PasswordModal;