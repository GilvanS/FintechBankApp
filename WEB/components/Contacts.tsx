
import React, { useState, useEffect } from 'react';
import { User, PixContact } from '../types';
// FIX: Removed .ts extension from import path.
import { getPixContacts, addPixContact, deletePixContact } from '../services/mockApi';
import InfoPopupBottom from './InfoPopupBottom';

interface ContactsProps {
    currentUser: User;
    onContactsUpdate: () => void;
    onBack: () => void;
}

const Contacts: React.FC<ContactsProps> = ({ currentUser, onContactsUpdate, onBack }) => {
    const [contacts, setContacts] = useState<PixContact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isInfoPopupOpen, setIsInfoPopupOpen] = useState(true);

    const [newName, setNewName] = useState('');
    const [newKey, setNewKey] = useState('');

    const fetchContacts = async () => {
        setIsLoading(true);
        const userContacts = await getPixContacts(currentUser.cpf);
        setContacts(userContacts);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchContacts();
    }, [currentUser.cpf]);

    const handleAddContact = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const result = await addPixContact(currentUser.cpf, { name: newName, key: newKey });

        if (result.success) {
            setSuccess(result.message);
            setNewName('');
            setNewKey('');
            setShowAddForm(false);
            fetchContacts();
            onContactsUpdate();
        } else {
            setError(result.message);
        }
    };

    const handleDeleteContact = async (contactKey: string) => {
        if (window.confirm('Tem certeza que deseja remover este contato?')) {
            setError('');
            setSuccess('');
            const result = await deletePixContact(currentUser.cpf, contactKey);
            if (result.success) {
                setSuccess(result.message);
                fetchContacts();
                onContactsUpdate();
            } else {
                setError(result.message);
            }
        }
    };

    return (
        <div className="bg-black text-white min-h-full flex flex-col">
            <header className="flex items-center mb-6 px-4 pt-4">
                <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-gray-800">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Contatos Favoritos</h2>
            </header>
            
            <main className="flex-grow p-4 space-y-6">
                {error && <p className="p-3 bg-red-900/50 text-red-400 rounded-md">{error}</p>}
                {success && <p className="p-3 bg-green-900/50 text-green-400 rounded-md">{success}</p>}

                {!showAddForm && (
                    <button onClick={() => setShowAddForm(true)} className="w-full mb-4 px-4 py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500">
                        Adicionar Novo Contato
                    </button>
                )}

                {showAddForm && (
                    <form onSubmit={handleAddContact} className="space-y-4 p-4 mb-6 bg-gray-900 rounded-lg">
                        <h3 className="font-bold text-lg text-white">Novo Contato</h3>
                        <div>
                            <label className="text-sm font-medium text-gray-400">Apelido</label>
                            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Ex: João da Silva" className="w-full px-4 py-3 mt-1 bg-gray-800 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-400">Chave PIX (CPF ou E-mail)</label>
                            <input type="text" value={newKey} onChange={e => setNewKey(e.target.value)} required placeholder="Chave do contato" maxLength={70} className="w-full px-4 py-3 mt-1 bg-gray-800 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                        <div className="flex space-x-2">
                            <button type="button" onClick={() => setShowAddForm(false)} className="w-full px-4 py-2 font-semibold text-white bg-gray-700 rounded-lg hover:bg-gray-600">Cancelar</button>
                            <button type="submit" className="w-full px-4 py-2 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500">Salvar Contato</button>
                        </div>
                    </form>
                )}

                {isLoading ? <p className="text-center text-gray-400">Carregando contatos...</p> : (
                    contacts.length > 0 ? (
                        <ul className="space-y-3">
                            {contacts.map(contact => (
                                <li key={contact.key} className="p-4 bg-gray-900 rounded-lg flex items-center justify-between">
                                    <div className="flex-grow">
                                        <p className="font-bold text-white">{contact.name}</p>
                                        <p className="text-sm text-gray-400 break-all">{contact.key}</p>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <button onClick={() => handleDeleteContact(contact.key)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-full" aria-label={`Remover contato ${contact.name}`}>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-8">Nenhum contato salvo.</p>
                    )
                )}
            </main>
            
            <InfoPopupBottom
                isOpen={isInfoPopupOpen}
                onClose={() => setIsInfoPopupOpen(false)}
                title="Por que salvar um contato?"
            >
                <p>
                    Salvar um contato como favorito torna suas transferências PIX mais rápidas e seguras.
                </p>
                <p>
                    Você seleciona o contato e o valor, sem precisar digitar a chave PIX toda vez, evitando erros.
                </p>
            </InfoPopupBottom>
        </div>
    );
};

export default Contacts;
