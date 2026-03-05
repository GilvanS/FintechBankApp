
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPixContacts, getPixRecipientInfo, performPixTransfer, performPixCreditTransfer, getUserByCpf, getUserStatement } from '../services/api';
import { PixContact, Transaction, User } from '../types';
import Contacts from './Contacts';
import PixKeyManagement from './PixKeyManagement';
import PasswordModal from './PasswordModal';
import PixConfirmation from './PixConfirmation';
import PixSuccessModal from './PixSuccessModal';
import { useToast, ToastContainer } from './Toast';

type PixSubView = 'transfer' | 'keyManagement' | 'contacts' | 'confirmation';

const Pix: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { user, updateUser, logout } = useAuth();
    const [subView, setSubView] = useState<PixSubView>('transfer');
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordModalInfo, setPasswordModalInfo] = useState({ title: '', description: '' });
    const [pendingPinAction, setPendingPinAction] = useState<null | ((pin: string) => Promise<void>)>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transferDetails, setTransferDetails] = useState<{ key: string, amount: number, description: string, useCredit: boolean } | null>(null);
    const [recipientInfo, setRecipientInfo] = useState<{ name: string; cpf: string } | null>(null);
    const [transferError, setTransferError] = useState('');
    const [contacts, setContacts] = useState<PixContact[]>([]);
    const [selectedContact, setSelectedContact] = useState<PixContact | null>(null);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successDetails, setSuccessDetails] = useState<{ amount: number; recipientName: string; recipientCpf: string; description?: string } | null>(null);
    const { toast, showSuccess, showError, showInfo, hide } = useToast();

    const [pixKey, setPixKey] = useState('');
    const [amount, setAmount] = useState('');
    const [displayAmount, setDisplayAmount] = useState('');
    const [description, setDescription] = useState('');
    const [useCredit, setUseCredit] = useState(false);
    const [localError, setLocalError] = useState('');

    const handlePixKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value;

        // Remove formatting characters to check content type
        const cleanValue = value.replace(/[^a-zA-Z0-9]/g, '');

        // Check if it's numeric (potential CPF)
        // We only apply mask if the input starts with a number or is empty
        const isNumeric = /^\d*$/.test(cleanValue);

        if (isNumeric && cleanValue.length > 0) {
            // Limit to 11 digits
            const limitedValue = cleanValue.slice(0, 11);

            // Apply CPF mask
            value = limitedValue
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d{1,2})/, '$1-$2')
                .replace(/(-\d{2})\d+?$/, '$1');
        }

        setPixKey(value);
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Remove tudo exceto números
        const numericValue = value.replace(/\D/g, '');

        if (numericValue === '') {
            setAmount('');
            setDisplayAmount('');
            return;
        }

        // Converte para número com centavos
        const numValue = parseInt(numericValue, 10) / 100;

        // Formata para exibição
        const formatted = numValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        setAmount(numValue.toString());
        setDisplayAmount(formatted);
    };

    useEffect(() => {
        if (selectedContact) {
            setPixKey(selectedContact.key);
            setSelectedContact(null); 
        }
    }, [selectedContact]);

    useEffect(() => {
        const fetchContacts = async () => {
            if (user) {
                const result = await getPixContacts(user.cpf);
                if (result.success) setContacts(result.contacts!);
            }
        };
        fetchContacts();
    }, [user]);


    const handleInitiateTransfer = async (details: { key: string, amount: number, description: string, useCredit: boolean }) => {
        if(!user) return;
        setIsProcessing(true);
        setTransferError('');
        const recipientResult = await getPixRecipientInfo(details.key, user.cpf);
        if (recipientResult.success && recipientResult.name && recipientResult.cpf) {
            setTransferDetails(details);
            setRecipientInfo({ name: recipientResult.name, cpf: recipientResult.cpf });
            setSubView('confirmation');
        } else {
            const msg = recipientResult.message || 'Chave PIX inválida ou não encontrada.';
            setTransferError(msg);
            showError(msg);
        }
        setIsProcessing(false);
    };
    
    const handleConfirmFromConfirmationScreen = () => {
        setPasswordModalInfo({ title: 'Confirmar Transferência', description: 'Digite seu PIN para autorizar.' });
        setPendingPinAction(() => async (pin: string) => {
            if (!user || !transferDetails) return;
            setIsProcessing(true);

            let result;
            if (transferDetails.useCredit) {
                result = await performPixCreditTransfer(user.cpf, transferDetails.key, transferDetails.amount, transferDetails.description, 1, pin);
            } else {
                result = await performPixTransfer(transferDetails.key, transferDetails.amount, transferDetails.description, pin, user.cpf);
            }

            if (result.success) {
                // Salvar detalhes para o modal de sucesso antes de limpar
                if (recipientInfo && transferDetails) {
                    setSuccessDetails({
                        amount: transferDetails.amount,
                        recipientName: recipientInfo.name,
                        recipientCpf: recipientInfo.cpf,
                        description: transferDetails.description || undefined
                    });
                }
                
                // Atualizar dados do usuário (saldo, etc)
                const refreshed = await getUserByCpf(user.cpf);
                if (refreshed.success && refreshed.user) {
                    // Atualizar também as transações do extrato
                    const stmt = await getUserStatement(user.cpf);
                    if (stmt.success && stmt.transactions) {
                        updateUser({ ...refreshed.user, transactions: stmt.transactions });
                    } else {
                        updateUser(refreshed.user);
                    }
                }
                
                // Limpar dados e mostrar modal de sucesso
                setSubView('transfer');
                setTransferDetails(null);
                setRecipientInfo(null);
                setIsPasswordModalOpen(false);
                setIsSuccessModalOpen(true);
            } else {
                showError(`Falha na transferência: ${result.message}`);
                setIsPasswordModalOpen(false);
            }
            setIsProcessing(false);
        });
        setIsPasswordModalOpen(true);
    };

    const handlePasswordConfirm = async (pin: string) => {
        if (pendingPinAction) {
            await pendingPinAction(pin);
            setPendingPinAction(null);
        }
    };
    
    const handleSelectContact = (contact: PixContact) => {
        setSelectedContact(contact);
        setSubView('transfer');
    };
    
    const handleSubmitTransfer = (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError('');
        const numericAmount = parseFloat(amount.replace(',', '.'));
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setLocalError("Por favor, insira um valor válido.");
            return;
        }
        if (!pixKey.trim()) {
            setLocalError("Por favor, insira uma chave PIX.");
            return;
        }
        handleInitiateTransfer({ key: pixKey, amount: numericAmount, description, useCredit });
    };
    
    if (!user) return null;

    const renderContent = () => {
        switch (subView) {
            case 'confirmation':
                return recipientInfo && transferDetails && (
                    <PixConfirmation 
                        details={{
                            amount: transferDetails.amount,
                            description: transferDetails.description,
                            recipientName: recipientInfo.name,
                            recipientCpf: recipientInfo.cpf,
                        }}
                        onConfirm={handleConfirmFromConfirmationScreen}
                        onBack={() => setSubView('transfer')}
                        message="Destinatario verificado. Confirme a transferencia."
                        messageType="info"
                    />
                );
            case 'keyManagement':
                return <PixKeyManagement onBack={() => setSubView('transfer')} />;
            case 'contacts':
                return <Contacts onBack={() => setSubView('transfer')} onSelectContact={handleSelectContact} />;
            case 'transfer':
            default:
                return (
                    <div 
                        className="bg-surface-dark rounded-xl p-6 test-pix-transfer-card"
                        id="pix-transfer-card"
                        data-testid="pix-transfer-card"
                        data-cy="pix-transfer-card"
                    >
                        <h2 
                            className="text-white text-2xl font-bold leading-tight pb-1 test-pix-transfer-title"
                            id="pix-transfer-title"
                            data-testid="pix-transfer-title"
                            data-cy="pix-transfer-title"
                        >
                            Enviar PIX
                        </h2>
                        <p 
                            className="text-white/60 text-base font-normal leading-normal pb-6 test-pix-transfer-subtitle"
                            id="pix-transfer-subtitle"
                            data-testid="pix-transfer-subtitle"
                        >
                            Para quem você quer transferir?
                        </p>
                        <form 
                            onSubmit={handleSubmitTransfer} 
                            className="space-y-6 test-pix-transfer-form"
                            id="pix-transfer-form"
                            name="pix-transfer-form"
                            data-testid="pix-transfer-form"
                            data-cy="pix-transfer-form"
                            data-playwright="pix-transfer-form"
                            aria-label="Formulário de transferência PIX"
                        >
                            <div className="test-pix-key-field" id="pix-key-field" data-testid="pix-key-field" data-cy="pix-key-field">
                                <label className="block text-sm font-medium text-white/80 mb-2" htmlFor="pix-key">Chave PIX</label>
                                <div className="relative">
                                    <input 
                                        value={pixKey} 
                                        onChange={handlePixKeyChange} 
                                        className="w-full bg-background-dark border border-subtle-dark rounded-lg py-3 px-4 text-white placeholder:text-white/40 focus:ring-2 focus:ring-primary focus:border-primary transition-all test-input-pix-key" 
                                        id="pix-key"
                                        name="pix-key"
                                        placeholder="Digite CPF, celular, e-mail, etc." 
                                        type="text" 
                                        inputMode="numeric"
                                        data-testid="pix-input-key"
                                        data-cy="pix-input-key"
                                        data-playwright="pix-input-key"
                                        aria-label="Chave PIX"
                                        aria-required="true"
                                    />
                                    {contacts.length > 0 && (
                                        <button 
                                            type="button" 
                                            title="Usar contato salvo" 
                                            onClick={() => setSubView('contacts')} 
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full text-white/60 hover:bg-white/10 hover:text-primary transition-colors test-contacts-button"
                                            id="btn-pix-contacts"
                                            name="pix-contacts-button"
                                            data-testid="pix-contacts-button"
                                            data-cy="pix-contacts-button"
                                            data-playwright="pix-contacts-button"
                                            aria-label="Usar contato salvo"
                                        >
                                            <span className="material-symbols-outlined" aria-hidden="true">contact_page</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="test-pix-amount-field" id="pix-amount-field" data-testid="pix-amount-field" data-cy="pix-amount-field">
                                <label className="block text-sm font-medium text-white/80 mb-2" htmlFor="pix-amount">Valor</label>
                                <input 
                                    value={displayAmount} 
                                    onChange={handleAmountChange} 
                                    className="w-full bg-background-dark border border-subtle-dark rounded-lg py-3 px-4 text-white placeholder:text-white/40 focus:ring-2 focus:ring-primary focus:border-primary transition-all test-input-pix-amount" 
                                    id="pix-amount"
                                    name="pix-amount"
                                    placeholder="0,00" 
                                    type="text" 
                                    inputMode="decimal"
                                    data-testid="pix-input-amount"
                                    data-cy="pix-input-amount"
                                    data-playwright="pix-input-amount"
                                    aria-label="Valor"
                                    aria-required="true"
                                />
                            </div>
                            <div className="test-pix-description-field" id="pix-description-field" data-testid="pix-description-field" data-cy="pix-description-field">
                                <label className="block text-sm font-medium text-white/80 mb-2" htmlFor="pix-description">Descrição (Opcional)</label>
                                <input 
                                    value={description} 
                                    onChange={e => setDescription(e.target.value)} 
                                    className="w-full bg-background-dark border border-subtle-dark rounded-lg py-3 px-4 text-white placeholder:text-white/40 focus:ring-2 focus:ring-primary focus:border-primary transition-all test-input-pix-description" 
                                    id="pix-description"
                                    name="pix-description"
                                    placeholder="Ex: Pagamento do aluguel" 
                                    type="text"
                                    data-testid="pix-input-description"
                                    data-cy="pix-input-description"
                                    data-playwright="pix-input-description"
                                    aria-label="Descrição (Opcional)"
                                />
                            </div>
                            <div className="border-t border-subtle-dark/50 pt-6 test-pix-credit-section" id="pix-credit-section" data-testid="pix-credit-section" data-cy="pix-credit-section">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-white font-medium test-pix-credit-title" data-testid="pix-credit-title">PIX no Crédito</h3>
                                        <p className="text-white/60 text-sm test-pix-credit-description" data-testid="pix-credit-description">Use seu limite de crédito.</p>
                                    </div>
                                    <label className="flex items-center cursor-pointer test-pix-credit-toggle-label" htmlFor="pix-credit-toggle" data-testid="pix-credit-toggle-label">
                                        <div className="relative">
                                            <input 
                                                checked={useCredit} 
                                                onChange={(e) => setUseCredit(e.target.checked)} 
                                                className="sr-only peer" 
                                                id="pix-credit-toggle"
                                                name="pix-credit-toggle"
                                                type="checkbox"
                                                data-testid="pix-credit-toggle"
                                                data-cy="pix-credit-toggle"
                                                data-playwright="pix-credit-toggle"
                                                aria-label="Usar PIX no crédito"
                                            />
                                            <div className="w-11 h-6 bg-subtle-dark rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary test-pix-credit-toggle-switch"></div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                            {(transferError || localError) && (
                                <p 
                                    className="text-sm text-red-400 p-2 bg-red-900/50 rounded-md test-pix-error-message"
                                    id="pix-error-message"
                                    data-testid="pix-error-message"
                                    data-cy="pix-error-message"
                                    role="alert"
                                    aria-live="assertive"
                                >
                                    {transferError || localError}
                                </p>
                            )}
                            <button 
                                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-background-dark font-bold py-3 px-8 rounded-lg transition-colors disabled:opacity-50 test-pix-submit-button" 
                                type="submit" 
                                disabled={isProcessing}
                                id="btn-pix-submit"
                                name="pix-submit"
                                data-testid="pix-submit-button"
                                data-cy="pix-submit-button"
                                data-playwright="pix-submit-button"
                                aria-label={isProcessing ? 'Verificando...' : 'Continuar'}
                            >
                                {isProcessing ? 'Verificando...' : 'Continuar'}
                                <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                            </button>
                        </form>
                    </div>
                );
        }
    };

    return (
        <div 
            className="bg-background-dark text-white flex flex-col h-screen test-pix-page"
            id="pix-page"
            data-testid="pix-page"
            data-cy="pix-page"
            data-playwright="pix-page"
            aria-label="PIX"
        >
            <header 
                className="flex-shrink-0 flex items-center justify-between p-4 border-b border-subtle-dark/50 pt-[calc(1rem+env(safe-area-inset-top))] shadow-md test-pix-header"
                id="pix-header"
                data-testid="pix-header"
                data-cy="pix-header"
            >
                <button 
                    onClick={onBack} 
                    className="p-2 -ml-2 rounded-full hover:bg-white/10 test-pix-back-button"
                    id="btn-pix-back"
                    name="pix-back-button"
                    data-testid="pix-back-button"
                    data-cy="pix-back-button"
                    data-playwright="pix-back-button"
                    aria-label="Voltar"
                    type="button"
                >
                    <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                </button>
                <h1 
                    className="text-xl font-bold text-white test-pix-header-title"
                    id="pix-header-title"
                    data-testid="pix-header-title"
                    data-cy="pix-header-title"
                    data-playwright="pix-header-title"
                >
                    Área PIX
                </h1>
                <div className="w-6"></div>
            </header>

            <main 
                className="flex-1 overflow-y-auto test-pix-main"
                id="pix-main"
                data-testid="pix-main"
                data-cy="pix-main"
            >
                 <div className="p-4">
                    <div 
                        className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar test-pix-tabs"
                        id="pix-tabs"
                        data-testid="pix-tabs"
                        data-cy="pix-tabs"
                        role="tablist"
                        aria-label="Navegação PIX"
                    >
                        <button 
                            onClick={() => setSubView('transfer')} 
                            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm transition-colors test-pix-tab-transfer ${subView === 'transfer' ? 'bg-primary text-background-dark font-bold' : 'bg-surface-dark text-white hover:bg-white/10'}`}
                            id="btn-pix-tab-transfer"
                            name="pix-tab-transfer"
                            data-testid="pix-tab-transfer"
                            data-cy="pix-tab-transfer"
                            data-playwright="pix-tab-transfer"
                            aria-label="Transferir"
                            aria-selected={subView === 'transfer'}
                            role="tab"
                            type="button"
                        >
                            Transferir
                        </button>
                        <button 
                            onClick={() => setSubView('contacts')} 
                            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm transition-colors test-pix-tab-contacts ${subView === 'contacts' ? 'bg-primary text-background-dark font-bold' : 'bg-surface-dark text-white hover:bg-white/10'}`}
                            id="btn-pix-tab-contacts"
                            name="pix-tab-contacts"
                            data-testid="pix-tab-contacts"
                            data-cy="pix-tab-contacts"
                            data-playwright="pix-tab-contacts"
                            aria-label="Meus Contatos"
                            aria-selected={subView === 'contacts'}
                            role="tab"
                            type="button"
                        >
                            Meus Contatos
                        </button>
                        <button 
                            onClick={() => setSubView('keyManagement')} 
                            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm transition-colors test-pix-tab-keys ${subView === 'keyManagement' ? 'bg-primary text-background-dark font-bold' : 'bg-surface-dark text-white hover:bg-white/10'}`}
                            id="btn-pix-tab-keys"
                            name="pix-tab-keys"
                            data-testid="pix-tab-keys"
                            data-cy="pix-tab-keys"
                            data-playwright="pix-tab-keys"
                            aria-label="Minhas Chaves"
                            aria-selected={subView === 'keyManagement'}
                            role="tab"
                            type="button"
                        >
                            Minhas Chaves
                        </button>
                    </div>
                    {renderContent()}
                </div>
            </main>
            
            <PasswordModal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
                onConfirm={handlePasswordConfirm}
                title={passwordModalInfo.title}
                description={passwordModalInfo.description}
                isLoading={isProcessing}
            />
            {successDetails && (
                <PixSuccessModal
                    isOpen={isSuccessModalOpen}
                    onClose={() => {
                        setIsSuccessModalOpen(false);
                        setSuccessDetails(null);
                    }}
                    details={successDetails}
                />
            )}
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default Pix;
