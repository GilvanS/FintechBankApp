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

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm test-modal-overlay">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="w-full max-w-sm rounded-3xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-2 border-volt-primary overflow-hidden relative test-modal bg-volt-surface"
                >
                    <button onClick={onClose} className="absolute top-5 right-5 text-white/50 hover:text-white transition-colors">
                        <X size={20} />
                    </button>

                    <div className="space-y-6 pt-2">
                        {/* Header */}
                        <div className="text-center space-y-2">
                            <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-4 bg-volt-primary/20">
                                <Shield size={24} className="text-volt-primary" />
                            </div>
                            <h2 className="text-xl font-black uppercase tracking-wider test-modal-title text-white">
                                {title}
                            </h2>
                            {description && (
                                <p className="text-sm text-on-surface-variant test-modal-description">
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
                                            bg-[#0a0a0a] text-volt-primary ${isFocused ? 'border-volt-primary ring-2 ring-volt-primary/20 shadow-[0_0_12px_rgba(0,255,157,0.3)]' : 'border-white/10'}
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
                                    className="h-14 rounded-xl font-black text-lg flex items-center justify-center cursor-pointer transition-all active:scale-95 bg-white/5 hover:bg-white/10 text-white"
                                >
                                    {num}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={handlePinBackspace}
                                className="h-14 rounded-xl font-black text-sm flex items-center justify-center cursor-pointer transition-all active:scale-95 bg-white/5 hover:bg-white/10 text-white/50"
                            >
                                ⌫
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePinChange('0')}
                                className="h-14 rounded-xl font-black text-lg flex items-center justify-center cursor-pointer transition-all active:scale-95 bg-white/5 hover:bg-white/10 text-white"
                            >
                                0
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPin(['3', '7', '1', '9']); // MOCK auto-fill
                                    setFocusedPinIndex(3);
                                }}
                                className="h-14 rounded-xl font-black text-[10px] uppercase tracking-tighter flex items-center justify-center cursor-pointer transition-all active:scale-95 bg-white/5 hover:bg-white/10 text-white/50"
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
                                        ? 'bg-white/5 text-white/30 cursor-not-allowed'
                                        : 'bg-volt-green text-black hover:opacity-90'
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