
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPixContacts, getPixRecipientInfo, performPix, performPixCreditInstallment, getUserByCpf, getUserStatement } from '../services/api';
import { PixContact, Transaction, User } from '../types';
import Contacts from './Contacts';
import PixKeyManagement from './PixKeyManagement';
import PixSidebar from './PixSidebar';
import PasswordModal from './PasswordModal';
import PixConfirmation from './PixConfirmation';
import { useToast, ToastContainer } from './Toast';

type PixSubView = 'transfer' | 'keyManagement' | 'contacts' | 'confirmation';

interface TransferViewProps {
    user: User;
    contacts: PixContact[];
    onInitiateTransfer: (details: { key: string, amount: number, description: string, useCredit: boolean }) => void;
    onNavigate: (view: PixSubView) => void;
    isProcessing: boolean;
    error: string;
    selectedContact: PixContact | null;
    onClearSelectedContact: () => void;
}


const TransferView: React.FC<TransferViewProps> = ({ user, contacts, onInitiateTransfer, onNavigate, isProcessing, error, selectedContact, onClearSelectedContact }) => {
    const [pixKey, setPixKey] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [useCredit, setUseCredit] = useState(false);
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (selectedContact) {
            setPixKey(selectedContact.key);
            onClearSelectedContact();
        }
    }, [selectedContact, onClearSelectedContact]);
    
    const handleSubmit = (e: React.FormEvent) => {
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
        onInitiateTransfer({ key: pixKey, amount: numericAmount, description, useCredit });
    };

    return (
        <div className="lg:col-span-2 flex flex-col gap-8">
            <div className="bg-surface-dark rounded-xl p-6">
                <h1 className="text-white text-2xl font-bold leading-tight pb-1">Enviar PIX</h1>
                <p className="text-white/60 text-base font-normal leading-normal pb-6">Para quem você quer transferir?</p>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2" htmlFor="pix-key">Chave PIX</label>
                        <div className="relative">
                            <input value={pixKey} onChange={e => setPixKey(e.target.value)} className="w-full bg-background-dark border border-subtle-dark rounded-lg py-3 px-4 text-white placeholder:text-white/40 focus:ring-2 focus:ring-primary focus:border-primary transition-all" id="pix-key" placeholder="Digite CPF/CNPJ, celular, e-mail ou chave aleatória" type="text" />
                            {contacts.length > 0 && (
                                <button type="button" title="Usar contato salvo" onClick={() => onNavigate('contacts')} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full text-white/60 hover:bg-white/10 hover:text-primary transition-colors">
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
                                <p className="text-white/60 text-sm">Use seu limite de crédito para fazer o PIX.</p>
                            </div>
                            <label className="flex items-center cursor-pointer" htmlFor="pix-credit-toggle">
                                <div className="relative">
                                    <input checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} className="sr-only peer" id="pix-credit-toggle" type="checkbox" />
                                    <div className="w-11 h-6 bg-subtle-dark rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </div>
                            </label>
                        </div>
                        <p className="text-white/50 text-xs mt-2">Sujeito a taxas. O valor será adicionado à sua próxima fatura.</p>
                    </div>
                    {(error || localError) && <p className="text-sm text-red-400 p-2 bg-red-900/50 rounded-md">{error || localError}</p>}
                    <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-background-dark font-bold py-3 px-8 rounded-lg transition-colors disabled:opacity-50" type="submit" disabled={isProcessing}>
                        {isProcessing ? 'Verificando...' : 'Continuar'}
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                </form>
            </div>
        </div>
    );
};


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

    useEffect(() => {
        const fetchContacts = async () => {
            if (user) {
                const contacts = await getPixContacts(user.cpf);
                setContacts(contacts);
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
            showInfo('Destinatario verificado. Confirme a transferencia.');
        } else {
            const msg = recipientResult.message || 'Chave PIX invalida ou nao encontrada.';
            setTransferError(msg);
            showError(msg);
        }
        setIsProcessing(false);
    };
    
    const handleConfirmFromConfirmationScreen = () => {
        setPasswordModalInfo({ title: 'Confirmar Transferencia', description: 'Digite seu PIN para autorizar.' });
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
                showSuccess('Transferencia realizada com sucesso!');
                setSubView('transfer');
            } else {
                const msg = `Falha na transferencia: ${result.message}`;
                showError(msg);
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
        } else {
            setIsPasswordModalOpen(false);
        }
    };
    
    const handleSelectContact = (contact: PixContact) => {
        setSelectedContact(contact);
        setSubView('transfer');
    };
    
    if (!user) return null;

    return (
        <div className="h-full w-full flex flex-col">
            <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-subtle-dark/50 px-6 sm:px-10 py-3 bg-background-dark/80 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex items-center gap-4 text-white">
                    <button onClick={onBack} className="hidden sm:block"><span className="material-symbols-outlined">arrow_back</span></button>
                    <div className="size-6 text-primary">
                        <svg fill="currentColor" viewBox="0 0 48 48"><path d="M24 18.4228L42 11.475V34.3663C42 34.7796 41.7457 35.1504 41.3601 35.2992L24 42V18.4228Z" /><path d="M24 8.18819L33.4123 11.574L24 15.2071L14.5877 11.574L24 8.18819ZM9 15.8487L21 20.4805V37.6263L9 32.9945V15.8487ZM27 37.6263V20.4805L39 15.8487V32.9945L27 37.6263ZM25.354 2.29885C24.4788 1.98402 23.5212 1.98402 22.646 2.29885L4.98454 8.65208C3.7939 9.08038 3 10.2097 3 11.475V34.3663C3 36.0196 4.01719 37.5026 5.55962 38.098L22.9197 44.7987C23.6149 45.0671 24.3851 45.0671 25.0803 44.7987L42.4404 38.098C43.9828 37.5026 45 36.0196 45 34.3663V11.475C45 10.2097 44.2061 9.08038 43.0155 8.65208L25.354 2.29885Z" /></svg>
                    </div>
                    <h2 className="text-white text-lg font-bold">Área PIX</h2>
                </div>
                 <div className="flex items-center gap-4">
                    <p className="text-sm text-white/70 hidden sm:block">Olá, {user.fullName.split(' ')[0]}</p>
                    <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style={{ backgroundImage: `url("https://api.dicebear.com/8.x/initials/svg?seed=${user.fullName}")` }}></div>
                </div>
            </header>
            <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col gap-4 mb-8">
                    <p className="text-white text-4xl font-black">Área PIX</p>
                    <p className="text-white/60 text-base">Envie, receba e gerencie suas chaves com facilidade.</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Mobile Navigation */}
                    <div className="lg:hidden col-span-1 grid grid-cols-3 gap-2 mb-2">
                        <button onClick={() => setSubView('transfer')} className={`p-3 rounded-lg flex flex-col items-center justify-center gap-2 transition-colors ${subView === 'transfer' ? 'bg-primary text-background-dark' : 'bg-surface-dark text-white hover:bg-white/10'}`}>
                            <span className="material-symbols-outlined">currency_exchange</span>
                            <span className="text-xs font-bold">Transferir</span>
                        </button>
                        <button onClick={() => setSubView('contacts')} className={`p-3 rounded-lg flex flex-col items-center justify-center gap-2 transition-colors ${subView === 'contacts' ? 'bg-primary text-background-dark' : 'bg-surface-dark text-white hover:bg-white/10'}`}>
                            <span className="material-symbols-outlined">contact_page</span>
                            <span className="text-xs font-bold">Contatos</span>
                        </button>
                        <button onClick={() => setSubView('keyManagement')} className={`p-3 rounded-lg flex flex-col items-center justify-center gap-2 transition-colors ${subView === 'keyManagement' ? 'bg-primary text-background-dark' : 'bg-surface-dark text-white hover:bg-white/10'}`}>
                            <span className="material-symbols-outlined">vpn_key</span>
                            <span className="text-xs font-bold">Chaves</span>
                        </button>
                    </div>
                    {subView === 'transfer' && <TransferView user={user} contacts={contacts} onInitiateTransfer={handleInitiateTransfer} onNavigate={setSubView} isProcessing={isProcessing} error={transferError} selectedContact={selectedContact} onClearSelectedContact={() => setSelectedContact(null)} />}
                    {subView === 'confirmation' && recipientInfo && transferDetails && (
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
                    )}
                    {subView === 'keyManagement' && <PixKeyManagement onBack={() => setSubView('transfer')} />}
                    {subView === 'contacts' && <Contacts onBack={() => setSubView('transfer')} onSelectContact={handleSelectContact} />}
                    
                    <div className="hidden lg:block">
                        <PixSidebar onNavigate={setSubView} currentView={subView} />
                    </div>
                </div>
            </main>
            <PasswordModal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
                onConfirm={handlePasswordConfirm}
                title="Confirmar Transferencia"
                description="Digite sua senha para autorizar."
                isLoading={isProcessing}
            />
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default Pix;
