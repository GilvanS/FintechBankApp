


import React, { useState, useEffect } from 'react';
// FIX: Corrected import path for types from parent directory.
import { User, PixContact, Transaction } from '../types';
import InfoPopupBottom from './InfoPopupBottom';

interface TransferFormProps {
    user: User;
    dailyUsage: number;
    // FIX: Updated the onTransfer prop type to reflect that the user object may be returned, ensuring consistency with the updated API call.
    onTransfer: (pixKey: string, amount: number, description: string) => Promise<{ success: boolean; message: string, user?: Omit<User, 'password'>, transaction?: Transaction }>;
    onPixCredit: (details: { pixKey: string, amount: number, installments: number }) => void;
    selectedContact?: PixContact | null;
    clearSelectedContact: () => void;
}

const TransferForm: React.FC<TransferFormProps> = ({ user, dailyUsage, onTransfer, onPixCredit, selectedContact, clearSelectedContact }) => {
    const [pixKey, setPixKey] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [showPixCreditInfo, setShowPixCreditInfo] = useState(false);

    useEffect(() => {
        if (selectedContact) {
            setPixKey(selectedContact.key);
            clearSelectedContact();
        }
    }, [selectedContact, clearSelectedContact]);

    const remainingLimit = user.pixDailyLimit - dailyUsage;
    
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (!value) {
            setAmount('');
            return;
        }
        value = (parseInt(value, 10) / 100).toFixed(2);
        if (value === "NaN") value = "";
        setAmount(value);
    };

    const formattedAmount = isNaN(parseFloat(amount)) ? '' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(amount));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);

        if (!pixKey) {
            setResultMessage({ type: 'error', text: 'Por favor, insira uma chave PIX.' });
            return;
        }
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setResultMessage({ type: 'error', text: 'Por favor, insira um valor válido.' });
            return;
        }
        if (numericAmount > user.balance) {
            setResultMessage({ type: 'error', text: 'Saldo insuficiente.' });
            return;
        }
        if (numericAmount > remainingLimit) {
            setResultMessage({ type: 'error', text: `Valor excede o limite diário restante de ${remainingLimit.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}.` });
            return;
        }

        setIsLoading(true);
        setResultMessage(null);
        const result = await onTransfer(pixKey, numericAmount, description);
        setIsLoading(false);

        setResultMessage({ type: result.success ? 'success' : 'error', text: result.message });
        if (result.success) {
            setPixKey('');
            setAmount('');
            setDescription('');
        }
    };

    const handleProposePixCredit = () => {
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setResultMessage({ type: 'error', text: 'Insira um valor para parcelar.' });
            return;
        }
        if (numericAmount > user.creditCard.availableLimit) {
            setResultMessage({ type: 'error', text: 'Valor excede seu limite de crédito.' });
            return;
        }
        onPixCredit({ pixKey, amount: numericAmount, installments: 12 });
    }

    return (
        <div className="pt-6 test-pix-transfer" id="pix-transfer" data-testid="pix-transfer" data-cy="pix-transfer" data-playwright="pix-transfer">
            <form
                onSubmit={handleSubmit}
                className="space-y-4 test-pix-transfer-form"
                id="pix-transfer-form"
                name="pix-transfer-form"
                data-testid="pix-transfer-form"
                data-cy="pix-transfer-form"
                data-playwright="pix-transfer-form"
                aria-label="Formulário de transferência PIX"
            >
                <div className="test-pix-key-field" id="pix-key-field" data-testid="pix-key-field" data-cy="pix-key-field">
                    <label htmlFor="pix-key-input" className="text-sm font-medium text-gray-400">Para quem você quer transferir?</label>
                    <input
                        id="pix-key-input"
                        name="pix-key"
                        type="text"
                        value={pixKey}
                        onChange={(e) => setPixKey(e.target.value)}
                        placeholder="Digite a chave PIX"
                        required
                        className="w-full px-4 py-3 mt-1 bg-gray-900 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 test-pix-key-input"
                        data-testid="pix-key-input"
                        data-cy="pix-key-input"
                        data-playwright="pix-key-input"
                        aria-label="Chave PIX"
                        aria-required="true"
                    />
                </div>
                <div className="test-pix-amount-field" id="pix-amount-field" data-testid="pix-amount-field" data-cy="pix-amount-field">
                    <label htmlFor="pix-amount-input" className="text-sm font-medium text-gray-400">Valor</label>
                     <input
                        id="pix-amount-input"
                        name="pix-amount"
                        type="text"
                        inputMode="decimal"
                        value={formattedAmount}
                        onChange={handleAmountChange}
                        placeholder="R$ 0,00"
                        required
                        className="w-full px-4 py-3 mt-1 bg-gray-900 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 text-2xl font-bold test-pix-amount-input"
                        data-testid="pix-amount-input"
                        data-cy="pix-amount-input"
                        data-playwright="pix-amount-input"
                        aria-label="Valor da transferência"
                        aria-required="true"
                    />
                </div>
                 <div className="test-pix-description-field" id="pix-description-field" data-testid="pix-description-field" data-cy="pix-description-field">
                    <label htmlFor="pix-description-input" className="text-sm font-medium text-gray-400">Descrição (opcional)</label>
                    <input
                        id="pix-description-input"
                        name="pix-description"
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ex: Aluguel"
                        className="w-full px-4 py-3 mt-1 bg-gray-900 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 test-pix-description-input"
                        data-testid="pix-description-input"
                        data-cy="pix-description-input"
                        data-playwright="pix-description-input"
                        aria-label="Descrição da transferência"
                    />
                </div>

                {resultMessage && (
                    <p
                        className={`text-sm p-2 rounded-md ${resultMessage.type === 'success' ? 'text-green-400 bg-green-900/50 test-pix-transfer-success' : 'text-red-400 bg-red-900/50 test-pix-transfer-error'}`}
                        id={resultMessage.type === 'success' ? 'pix-transfer-success' : 'pix-transfer-error'}
                        data-testid={resultMessage.type === 'success' ? 'pix-transfer-success' : 'pix-transfer-error'}
                        data-cy={resultMessage.type === 'success' ? 'pix-transfer-success' : 'pix-transfer-error'}
                        data-playwright={resultMessage.type === 'success' ? 'pix-transfer-success' : 'pix-transfer-error'}
                        role={resultMessage.type === 'success' ? 'status' : 'alert'}
                        aria-live="polite"
                    >
                        {resultMessage.text}
                    </p>
                )}

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500 disabled:bg-green-700 test-pix-submit-button"
                        id="btn-pix-submit"
                        name="pix-submit"
                        data-testid="pix-submit-button"
                        data-cy="pix-submit-button"
                        data-playwright="pix-submit-button"
                        aria-label={isLoading ? 'Transferindo...' : 'Transferir'}
                    >
                        {isLoading ? 'Transferindo...' : 'Transferir'}
                    </button>
                </div>
            </form>
            <div className="mt-4 p-4 bg-orange-900/50 border border-orange-400/30 rounded-lg flex items-center justify-between">
                <div>
                    <p className="font-bold text-orange-400">Sem saldo? Use o limite do cartão!</p>
                    <p className="text-xs text-orange-200">Faça um PIX e parcele em até 12x.</p>
                </div>
                <button
                    onClick={handleProposePixCredit}
                    className="px-3 py-1.5 text-sm font-bold bg-orange-400 text-black rounded-lg hover:bg-orange-500 test-pix-credit-button"
                    id="btn-pix-credit"
                    name="pix-credit"
                    data-testid="pix-credit-button"
                    data-cy="pix-credit-button"
                    data-playwright="pix-credit-button"
                    aria-label="Simular PIX no crédito"
                    type="button"
                >
                   Simular
                </button>
            </div>
            <InfoPopupBottom isOpen={showPixCreditInfo} onClose={() => setShowPixCreditInfo(false)} title="Como funciona o PIX no Crédito?">
                <p>O PIX no Crédito usa o limite do seu cartão para fazer a transferência. O valor é adicionado à sua fatura, e você pode parcelar com juros.</p>
                <p>É uma ótima opção para emergências quando você está sem saldo em conta!</p>
            </InfoPopupBottom>
        </div>
    );
};

export default TransferForm;