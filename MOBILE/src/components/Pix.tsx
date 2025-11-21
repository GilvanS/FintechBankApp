
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPixContacts, getPixRecipientInfo, performPix, performPixCreditInstallment, getUserByCpf } from '../services/api';
import { PixContact, Transaction, User } from '../types';
import Contacts from './Contacts';
import PixKeyManagement from './PixKeyManagement';
import PasswordModal from './PasswordModal';
import PixConfirmation from './PixConfirmation';
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
    const { toast, showSuccess, showError, showInfo, hide } = useToast();

    const [pixKey, setPixKey] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [useCredit, setUseCredit] = useState(false);
    const [localError, setLocalError] = useState('');

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
            showInfo('Destinatário verificado. Confirme a transferência.');
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
                result = await performPixCreditInstallment(user.cpf, transferDetails.amount, 1);
            } else {
                result = await performPix(user.cpf, transferDetails.key, transferDetails.amount, transferDetails.description);
            }
            
            if (result.success) {
                const refreshed = await getUserByCpf(user.cpf);
                if (refreshed.success && refreshed.user) updateUser(refreshed.user);
                showSuccess('Transferência realizada com sucesso!');
                setSubView('transfer');
            } else {
                showError(`Falha na transferência: ${result.message}`);
            }
            setIsProcessing(false);
            setIsPasswordModalOpen(false);
            setTransferDetails(null);
            setRecipientInfo(null);
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
                    />
                );
            case 'keyManagement':
                return <PixKeyManagement onBack={() => setSubView('transfer')} />;
            case 'contacts':
                return <Contacts onBack={() => setSubView('transfer')} onSelectContact={handleSelectContact} />;
            case 'transfer':
            default:
                return (
                    <div className="bg-surface-dark rounded-xl p-6">
                        <h2 className="text-white text-2xl font-bold leading-tight pb-1">Enviar PIX</h2>
                        <p className="text-white/60 text-base font-normal leading-normal pb-6">Para quem você quer transferir?</p>
                        <form onSubmit={handleSubmitTransfer} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-2" htmlFor="pix-key">Chave PIX</label>
                                <div className="relative">
                                    <input value={pixKey} onChange={e => setPixKey(e.target.value)} className="w-full bg-background-dark border border-subtle-dark rounded-lg py-3 px-4 text-white placeholder:text-white/40 focus:ring-2 focus:ring-primary focus:border-primary transition-all" id="pix-key" placeholder="Digite CPF/CNPJ, celular, etc." type="text" />
                                    {contacts.length > 0 && (
                                        <button type="button" title="Usar contato salvo" onClick={() => setSubView('contacts')} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full text-white/60 hover:bg-white/10 hover:text-primary transition-colors">
                                            <span className="material-symbols-outlined">contact_page</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-2" htmlFor="pix-amount">Valor</label>
                                <input value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-background-dark border border-subtle-dark rounded-lg py-3 px-4 text-white placeholder:text-white/40 focus:ring-2 focus:ring-primary focus:border-primary transition-all" id="pix-amount" placeholder="R$ 0,00" type="text" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-2" htmlFor="pix-description">Descrição (Opcional)</label>
                                <input value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-background-dark border border-subtle-dark rounded-lg py-3 px-4 text-white placeholder:text-white/40 focus:ring-2 focus:ring-primary focus:border-primary transition-all" id="pix-description" placeholder="Ex: Pagamento do aluguel" type="text" />
                            </div>
                            <div className="border-t border-subtle-dark/50 pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-white font-medium">PIX no Crédito</h3>
                                        <p className="text-white/60 text-sm">Use seu limite de crédito.</p>
                                    </div>
                                    <label className="flex items-center cursor-pointer" htmlFor="pix-credit-toggle">
                                        <div className="relative">
                                            <input checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} className="sr-only peer" id="pix-credit-toggle" type="checkbox" />
                                            <div className="w-11 h-6 bg-subtle-dark rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                            {(transferError || localError) && <p className="text-sm text-red-400 p-2 bg-red-900/50 rounded-md">{transferError || localError}</p>}
                            <button className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-background-dark font-bold py-3 px-8 rounded-lg transition-colors disabled:opacity-50" type="submit" disabled={isProcessing}>
                                {isProcessing ? 'Verificando...' : 'Continuar'}
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </button>
                        </form>
                    </div>
                );
        }
    };

    return (
        <div className="bg-background-dark text-white flex flex-col h-screen">
            <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-subtle-dark/50 pt-[calc(1rem+env(safe-area-inset-top))] shadow-md">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-xl font-bold text-white">Área PIX</h1>
                <div className="w-6"></div>
            </header>

            <main className="flex-1 overflow-y-auto">
                 <div className="p-4">
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                        <button onClick={() => setSubView('transfer')} className={`px-4 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${subView === 'transfer' ? 'bg-primary text-background-dark font-bold' : 'bg-surface-dark text-white hover:bg-white/10'}`}>Transferir</button>
                        <button onClick={() => setSubView('contacts')} className={`px-4 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${subView === 'contacts' ? 'bg-primary text-background-dark font-bold' : 'bg-surface-dark text-white hover:bg-white/10'}`}>Meus Contatos</button>
                        <button onClick={() => setSubView('keyManagement')} className={`px-4 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${subView === 'keyManagement' ? 'bg-primary text-background-dark font-bold' : 'bg-surface-dark text-white hover:bg-white/10'}`}>Minhas Chaves</button>
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
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default Pix;
