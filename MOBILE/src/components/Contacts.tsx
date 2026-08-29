import { ArrowLeft } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PixContact } from '../types';
import { getPixContacts, addPixContact, deletePixContact, getPixRecipientInfo } from '../services/api';
import { formatCPF } from '../utils/formatters';
import InfoPopupBottom from './InfoPopupBottom';
import { useToast, ToastContainer } from './Toast';
import { useDialog } from '../contexts/GlobalDialogContext';
import { useAppState } from '../contexts/AppStateContext';

interface ContactsProps {
    onBack?: () => void;
    onSelectContact?: (contact: PixContact) => void;
}


const Contacts: React.FC<ContactsProps> = ({ onBack, onSelectContact }) => {
    const { user } = useAuth();
    const { showDialog } = useDialog();
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const [contacts, setContacts] = useState<PixContact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showBenefitsPopup, setShowBenefitsPopup] = useState(false);

    const [newContactName, setNewContactName] = useState('');
    const [newContactKey, setNewContactKey] = useState('');
    const [error, setError] = useState('');
    const { toast, showSuccess, showError, hide } = useToast();
    const [recipientInfo, setRecipientInfo] = useState<{ name: string; cpf: string } | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    const fetchContacts = async () => {
        if (user) {
            setIsLoading(true);
            const res = await getPixContacts(user.cpf);
            setContacts(res?.contacts ?? []);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchContacts();
    }, [user]);

    const handleConfirmBenefits = () => {
        setShowBenefitsPopup(false);
        setShowAddModal(true);
    };


    const handleSearchKey = async () => {
        if (!user) return;
        setError('');
        setRecipientInfo(null);

        const onlyDigits = newContactKey.replace(/\D/g, '');
        if (onlyDigits.length !== 11) {
            const msg = 'CPF deve ter 11 digitos numericos.';
            setError(msg);
            showError(msg);
            return;
        }

        setIsSearching(true);
        const result = await getPixRecipientInfo(onlyDigits, user.cpf);
        setIsSearching(false);

        if (result.success && result.name && result.cpf) {
            setRecipientInfo({ name: result.name, cpf: result.cpf });
            setNewContactName(result.name);
        } else {
            const msg = result.message || 'Chave PIX nao encontrada no sistema.';
            setError(msg);
            showError(msg);
        }
    };

    const handleAddContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !recipientInfo) return;
        setError('');

        const onlyDigits = newContactKey.replace(/\D/g, '');
        const result = await addPixContact(user.cpf, { name: recipientInfo.name, key: onlyDigits });
        if (result.success) {
            setShowAddModal(false);
            setNewContactName('');
            setNewContactKey('');
            setRecipientInfo(null);
            showSuccess('Contato salvo com sucesso');
            fetchContacts();
        } else {
            const msg = result.message || 'Falha ao salvar contato.';
            if (/duplic/gi.test(msg) || /unique/gi.test(msg)) {
                showError('Contato com esta chave ja existe');
            } else {
                showError(msg);
            }
            setError(msg);
        }
    };

    const handleDeleteContact = async (key: string) => {
        if (user) {
            showDialog({
                title: 'Remover Contato',
                message: 'Tem certeza que deseja remover este contato?',
                confirmText: 'Sim, remover',
                cancelText: 'Cancelar',
                onConfirm: async () => {
                    const res = await deletePixContact(user.cpf, key);
                    if (res.success) {
                        showSuccess('Contato removido com sucesso');
                        fetchContacts();
                    } else {
                        showError(res.message || 'Falha ao remover contato');
                    }
                }
            });
        }
    };

    // Classes derivadas do tema — estrutura igual, só troca as cores.
    const containerClass = isMidnight ? 'bg-surface-dark' : 'bg-black/5';
    const titleClass = isMidnight ? 'text-white' : 'text-black';
    const backBtnClass = isMidnight ? 'hover:bg-white/10' : 'hover:bg-black/10';
    const contactCardClass = isMidnight ? 'bg-white/5 hover:bg-white/10' : 'bg-white border border-black/10 hover:bg-black/5';
    const contactNameClass = isMidnight ? 'text-white' : 'text-black';
    const contactKeyClass = isMidnight ? 'text-white/60' : 'text-black/50';
    const deleteBtnClass = isMidnight ? 'bg-black/30 text-white/50 hover:text-red-500' : 'bg-white/60 text-black/40 hover:text-red-600';
    const newContactBtnClass = isMidnight
        ? 'bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary'
        : 'bg-volt-lime/20 hover:bg-volt-lime/30 border border-black text-black';
    const newContactIconBubbleClass = isMidnight ? 'bg-primary/20' : 'bg-volt-lime/40';
    const modalOverlayClass = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50';
    const modalCardClass = isMidnight ? 'bg-surface-dark' : 'bg-white border-2 border-black';
    const labelClass = isMidnight ? 'text-gray-300' : 'text-black/60';
    const inputClass = isMidnight
        ? 'bg-background-dark border border-subtle-dark text-white placeholder:text-white/40 focus:ring-2 focus:ring-primary focus:border-primary'
        : 'bg-black/5 border border-black/20 text-black placeholder:text-black/30 focus:ring-2 focus:ring-black/20 focus:border-black';
    const searchBtnClass = isMidnight
        ? 'bg-primary text-background-dark hover:bg-primary/90'
        : 'bg-volt-lime text-black border border-black hover:opacity-90';
    const hintClass = isMidnight ? 'text-gray-400' : 'text-black/50';
    const recipientBoxClass = isMidnight ? 'bg-primary/10 border border-primary/30' : 'bg-volt-lime/15 border border-black/30';
    const recipientNameClass = isMidnight ? 'text-white' : 'text-black';
    const recipientKeyClass = isMidnight ? 'text-white/60' : 'text-black/60';
    const linkClass = isMidnight ? 'text-primary hover:underline' : 'text-black underline hover:opacity-70';
    const cancelBtnClass = isMidnight ? 'text-white bg-white/10 hover:bg-white/20' : 'text-black bg-black/10 hover:bg-black/20';
    const saveBtnClass = isMidnight ? 'text-black bg-primary hover:bg-primary/90' : 'text-black bg-volt-lime border border-black hover:opacity-90';

    return (
        <div className={`rounded-xl p-6 ${containerClass}`}>
            <div className="flex justify-between items-center mb-4">
                <h2 className={`text-xl font-bold ${titleClass}`}>Meus Contatos</h2>
                {onBack && (
                     <button onClick={onBack} className={`p-2 rounded-full ${backBtnClass} ${titleClass}`}>
                        <ArrowLeft size={22} className="shrink-0" />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {contacts.map(contact => (
                     <button key={contact.key} onClick={() => onSelectContact && onSelectContact(contact)} className={`relative group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors w-full text-left ${contactCardClass}`}>
                        <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style={{backgroundImage: `url("https://api.dicebear.com/8.x/initials/svg?seed=${contact.name}")`}}></div>
                        <div className="flex flex-col overflow-hidden">
                            <p className={`text-sm font-medium leading-normal truncate ${contactNameClass}`}>{contact.name}</p>
                            <p className={`text-xs font-normal leading-normal truncate ${contactKeyClass}`}>{contact.key}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteContact(contact.key); }} className={`absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${deleteBtnClass}`}>
                            <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </button>
                ))}

                <button onClick={() => setShowBenefitsPopup(true)} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${newContactBtnClass}`}>
                    <div className={`size-10 flex items-center justify-center rounded-full ${newContactIconBubbleClass}`}>
                        <span className="material-symbols-outlined">add</span>
                    </div>
                    <p className="text-sm font-medium leading-normal">Novo Contato</p>
                </button>
            </div>

            {showBenefitsPopup && (
                <InfoPopupBottom
                    isOpen={showBenefitsPopup}
                    onClose={() => setShowBenefitsPopup(false)}
                    onConfirm={handleConfirmBenefits}
                    title="Benefícios do Contato Salvo"
                    confirmText="Entendi, quero cadastrar"
                    showCloseIcon={true}
                >
                    <p>Cadastre um contato para fazer transferências futuras de forma mais rápida e segura, sem precisar digitar a chave PIX toda vez.</p>
                </InfoPopupBottom>
            )}


            {showAddModal && (
                 <div className={modalOverlayClass}>
                    <div className={`p-8 rounded-lg shadow-xl w-full max-w-md ${modalCardClass}`}>
                        <h2 className={`text-2xl font-bold mb-4 ${titleClass}`}>Novo Contato</h2>
                        <form onSubmit={handleAddContact} className="space-y-4">
                            <div>
                               <label className={`text-sm font-medium ${labelClass}`}>Chave PIX (CPF)</label>
                                <div className="flex gap-2 mt-1">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={newContactKey}
                                        onChange={e => setNewContactKey(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                        required
                                        disabled={!!recipientInfo}
                                        className={`flex-1 rounded-lg py-3 px-4 transition-all disabled:opacity-50 ${inputClass}`}
                                    />
                                    {!recipientInfo && (
                                        <button
                                            type="button"
                                            onClick={handleSearchKey}
                                            disabled={isSearching || newContactKey.replace(/\D/g, '').length !== 11}
                                            className={`px-4 py-3 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${searchBtnClass}`}
                                        >
                                            {isSearching ? 'Buscando...' : 'Buscar'}
                                        </button>
                                    )}
                                </div>
                                <p className={`text-xs mt-1 ${hintClass}`}>Digite o CPF e clique em Buscar.</p>
                            </div>

                            {recipientInfo && (
                                <div className={`rounded-lg p-4 ${recipientBoxClass}`}>
                                    <p className={`text-xs mb-1 ${hintClass}`}>Destinatário encontrado:</p>
                                    <p className={`font-semibold ${recipientNameClass}`}>{recipientInfo.name}</p>
                                    <p className={`text-sm ${recipientKeyClass}`}>{recipientInfo.cpf}</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRecipientInfo(null);
                                            setNewContactKey('');
                                            setNewContactName('');
                                        }}
                                        className={`text-xs mt-2 ${linkClass}`}
                                    >
                                        Buscar outro CPF
                                    </button>
                                </div>
                            )}

                            {error && <p className="text-sm text-red-500">{error}</p>}
                            <div className="flex justify-end space-x-4 mt-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setRecipientInfo(null);
                                        setNewContactKey('');
                                        setNewContactName('');
                                    }}
                                    className={`px-4 py-2 rounded-md ${cancelBtnClass}`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!recipientInfo}
                                    className={`px-4 py-2 font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${saveBtnClass}`}
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default Contacts;
