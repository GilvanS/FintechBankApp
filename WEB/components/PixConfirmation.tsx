import React, { useState } from 'react';

interface PixConfirmationProps {
    details: {
        amount: number;
        description: string;
        recipientName: string;
        recipientCpf: string;
    };
    onConfirm: () => void;
    onBack: () => void;
    message?: string;
    messageType?: 'success' | 'error' | 'info';
}

const InfoRow: React.FC<{ label: string; value: string | React.ReactNode; testId?: string }> = ({ label, value, testId }) => (
    <div 
        className="py-4 border-b border-subtle-dark/50 flex justify-between items-center text-sm test-info-row"
        data-testid={testId}
    >
        <span 
            className="text-white/60 test-info-label"
            data-testid={testId ? `${testId}-label` : undefined}
        >
            {label}
        </span>
        <span 
            className="font-semibold text-white text-right break-all test-info-value"
            data-testid={testId ? `${testId}-value` : undefined}
        >
            {value}
        </span>
    </div>
);

const PixConfirmation: React.FC<PixConfirmationProps> = ({ details, onConfirm, onBack, message, messageType = 'info' }) => {
    const { amount, description, recipientName, recipientCpf } = details;
    const [infoMessage, setInfoMessage] = useState<string>('');

    const handleBack = () => {
        setInfoMessage('Transferencia cancelada pelo usuario');
        onBack();
    };

    const displayMessage = message || infoMessage;
    const alertClass = messageType === 'error' 
        ? 'bg-red-500/10 border-red-500/20 text-red-400' 
        : messageType === 'success'
        ? 'bg-green-500/10 border-green-500/20 text-green-400'
        : 'bg-blue-500/10 border-blue-500/20 text-blue-400';

    return (
        <div 
            className="lg:col-span-2 flex flex-col gap-8 animate-fade-in test-pix-confirmation"
            id="pix-confirmation"
            data-testid="pix-confirmation"
            data-cy="pix-confirmation"
            data-playwright="pix-confirmation"
            role="region"
            aria-label="Confirmação de transferência PIX"
        >
            <div 
                className="bg-surface-dark rounded-xl p-6 test-pix-confirmation-modal"
                id="pix-confirmation-modal"
                data-testid="pix-confirmation-modal"
                data-cy="pix-confirmation-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pix-confirmation-title"
            >
                 <div className="flex justify-between items-center mb-4">
                    <h1 
                        className="text-white text-2xl font-bold leading-tight test-pix-confirmation-title"
                        id="pix-confirmation-title"
                        data-testid="pix-confirmation-title"
                        data-cy="pix-confirmation-title"
                        data-playwright="pix-confirmation-title"
                        role="heading"
                        aria-level={2}
                    >
                        Confirme os dados
                    </h1>
                    <button 
                        onClick={handleBack} 
                        className="p-2 rounded-full hover:bg-white/10 test-pix-confirmation-close"
                        id="btn-pix-confirmation-close"
                        name="pix-confirmation-close"
                        data-testid="pix-confirmation-close-button"
                        data-cy="pix-confirmation-close-button"
                        data-playwright="pix-confirmation-close-button"
                        aria-label="Fechar"
                        type="button"
                        role="button"
                    >
                        <span 
                            className="material-symbols-outlined"
                            aria-hidden="true"
                            data-testid="pix-confirmation-close-icon"
                        >
                            close
                        </span>
                    </button>
                </div>
                
                {displayMessage && (
                    <div 
                        className={`alert block mb-4 p-3 border rounded-lg text-sm flex items-center gap-2 ${alertClass} test-pix-confirmation-message`}
                        id="pix-confirmation-message"
                        data-testid="pix-confirmation-message"
                        data-cy="pix-confirmation-message"
                        data-playwright="pix-confirmation-message"
                        role="alert"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        <span 
                            className="material-symbols-outlined text-sm"
                            aria-hidden="true"
                            data-testid="pix-confirmation-message-icon"
                        >
                            {messageType === 'error' ? 'error' : messageType === 'success' ? 'check_circle' : 'info'}
                        </span>
                        <span data-testid="pix-confirmation-message-text">{displayMessage}</span>
                    </div>
                )}

                <div 
                    className="space-y-4 mb-8 test-pix-confirmation-content"
                    data-testid="pix-confirmation-content"
                >
                     <div 
                        className="text-center test-pix-confirmation-amount-section"
                        data-testid="pix-confirmation-amount-section"
                    >
                        <p 
                            className="text-white/60 text-sm test-pix-confirmation-amount-label"
                            data-testid="pix-confirmation-amount-label"
                            data-cy="pix-confirmation-amount-label"
                            role="text"
                            aria-label="Label do valor a transferir"
                        >
                            Você está transferindo
                        </p>
                        <p 
                            className="text-primary text-4xl font-bold test-pix-confirmation-amount-value"
                            id="pix-confirmation-amount-value"
                            data-testid="pix-confirmation-amount-value"
                            data-cy="pix-confirmation-amount-value"
                            data-playwright="pix-confirmation-amount-value"
                            role="text"
                            aria-label="Valor da transferência"
                            aria-live="polite"
                        >
                            {amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                    <div 
                        className="bg-background-dark rounded-lg p-4 test-pix-confirmation-details"
                        id="pix-confirmation-details"
                        data-testid="pix-confirmation-details"
                        data-cy="pix-confirmation-details"
                        role="group"
                        aria-label="Detalhes da transferência"
                    >
                        <InfoRow label="Para" value={recipientName} testId="pix-confirmation-recipient" />
                        <InfoRow label="CPF" value={recipientCpf} testId="pix-confirmation-cpf" />
                        <InfoRow label="Descrição" value={description || 'Sem descrição'} testId="pix-confirmation-description" />
                    </div>
                </div>
                <button 
                    onClick={onConfirm}
                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-background-dark font-bold py-3 px-8 rounded-lg transition-colors test-pix-confirmation-button"
                    id="btn-pix-confirmation-confirm"
                    name="pix-confirmation-confirm"
                    data-testid="pix-confirmation-confirm-button"
                    data-cy="pix-confirmation-confirm-button"
                    data-playwright="pix-confirmation-confirm-button"
                    aria-label="Confirmar Transferência"
                    type="button"
                    role="button"
                >
                    <span 
                        className="test-pix-confirmation-button-text"
                        data-testid="pix-confirmation-button-text"
                    >
                        Confirmar Transferência
                    </span>
                </button>
            </div>
             <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default PixConfirmation;
