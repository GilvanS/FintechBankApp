
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PixContact } from '../types';
import { getPixContacts, addPixContact, deletePixContact } from '../services/api';
import { formatCPF } from '../utils/formatters';
import InfoPopupBottom from './InfoPopupBottom';
import { useToast, ToastContainer } from './Toast';

interface ContactsProps {
    onBack?: () => void;
    onSelectContact?: (contact: PixContact) => void;
}


const Contacts: React.FC<ContactsProps> = ({ onBack, onSelectContact }) => {
    const { user } = useAuth();
    const [contacts, setContacts] = useState<PixContact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showBenefitsPopup, setShowBenefitsPopup] = useState(false);
    
    const [newContactName, setNewContactName] = useState('');
    const [newContactKey, setNewContactKey] = useState('');
    const [error, setError] = useState('');
    const { toast, showSuccess, showError, hide } = useToast();

    const fetchContacts = async () => {
        if (user) {
            setIsLoading(true);
            const result = await getPixContacts(user.cpf);
            if (result.success) setContacts(result.contacts!);
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

    const handleAddContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setError('');

        const onlyDigits = newContactKey.replace(/\D/g, '');
        if (onlyDigits.length !== 11) {
            const msg = 'CPF deve ter 11 digitos numericos.';
            setError(msg);
            showError(msg);
            return;
        }

        const result = await addPixContact(user.cpf, { name: newContactName, key: onlyDigits });
        if (result.success) {
            setShowAddModal(false);
            setNewContactName('');
            setNewContactKey('');
            showSuccess('Contato salvo com sucesso');
            fetchContacts();
        } else {
            const msg = result.message || 'Falha ao salvar contato.';
            if (/duplic/gi.test(msg)) {
                showError('Contato com esta chave ja existe');
            } else {
                showError(msg);
            }
            setError(msg);
        }
    };

    const handleDeleteContact = async (key: string) => {
        if (user && window.confirm('Tem certeza que deseja remover este contato?')) {
            const res = await deletePixContact(user.cpf, key);
            if (res.success) {
                showSuccess('Contato removido com sucesso');
                fetchContacts();
            } else {
                showError(res.message || 'Falha ao remover contato');
            }
        }
    };
    
    return (
        <div className="bg-surface-dark rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-white text-xl font-bold">Meus Contatos</h2>
                {onBack && (
                     <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                )}
            </div>
           
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {contacts.map(contact => (
                     <button key={contact.key} onClick={() => onSelectContact && onSelectContact(contact)} className="relative group flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors w-full text-left">
                        <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style={{backgroundImage: `url("https://api.dicebear.com/8.x/initials/svg?seed=${contact.name}")`}}></div>
                        <div className="flex flex-col overflow-hidden">
                            <p className="text-white text-sm font-medium leading-normal truncate">{contact.name}</p>
                            <p className="text-white/60 text-xs font-normal leading-normal truncate">{contact.key}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteContact(contact.key); }} className="absolute top-1 right-1 p-1 rounded-full bg-black/30 text-white/50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </button>
                ))}

                <button onClick={() => setShowBenefitsPopup(true)} className="flex items-center gap-3 p-3 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/50 cursor-pointer transition-colors text-primary">
                    <div className="size-10 flex items-center justify-center bg-primary/20 rounded-full">
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
                 <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-surface-dark p-8 rounded-lg shadow-xl w-full max-w-md">
                        <h2 className="text-2xl font-bold mb-4 text-white">Novo Contato</h2>
                        <form onSubmit={handleAddContact} className="space-y-4">
                            <div>
                               <label className="text-sm font-medium text-gray-300">Nome do Contato</label>
                               <input type="text" value={newContactName} onChange={e => setNewContactName(e.target.value)} required className="w-full bg-background-dark border border-subtle-dark rounded-lg py-3 px-4 mt-1 text-white placeholder:text-white/40 focus:ring-2 focus:ring-primary focus:border-primary transition-all" />
                            </div>
                            <div>
                               <label className="text-sm font-medium text-gray-300">Chave PIX (CPF)</label>
                               <input
                                   type="text"
                                   inputMode="numeric"
                                   pattern="[0-9]*"
                                   value={newContactKey}
                                   onChange={e => setNewContactKey(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                   required
                                   className="w-full bg-background-dark border border-subtle-dark rounded-lg py-3 px-4 mt-1 text-white placeholder:text-white/40 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                               />
                               <p className="text-xs text-gray-400 mt-1">Digite apenas os 11 digitos do CPF.</p>
                            </div>
                            {error && <p className="text-sm text-red-400">{error}</p>}
                            <div className="flex justify-end space-x-4 mt-6">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-white bg-white/10 rounded-md hover:bg-white/20">Cancelar</button>
                                <button type="submit" className="px-4 py-2 text-black bg-primary font-semibold rounded-md hover:bg-primary/90">Salvar</button>
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
