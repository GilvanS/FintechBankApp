import React, { useState, useEffect } from 'react';
import { User, PixContact } from './types';
import { getPixContacts, addPixContact, deletePixContact } from './services/mockApi';

interface ContactsProps {
    currentUser: User;
    onContactsUpdate: () => void;
}

const Contacts: React.FC<ContactsProps> = ({ currentUser, onContactsUpdate }) => {
    const [contacts, setContacts] = useState<PixContact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // State for the "Add Contact" form
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 my-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Contatos Seguros</h2>

            {error && <p className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200 rounded-md">{error}</p>}
            {success && <p className="mb-4 p-3 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200 rounded-md">{success}</p>}

            {!showAddForm && (
                <button onClick={() => setShowAddForm(true)} className="w-full mb-4 px-4 py-3 text-lg font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
                    Adicionar Novo Contato
                </button>
            )}

            {showAddForm && (
                <form onSubmit={handleAddContact} className="space-y-4 p-4 mb-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <h3 className="font-bold text-lg">Novo Contato</h3>
                    <div>
                        <label className="text-sm font-medium">Apelido</label>
                        <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Ex: João da Silva" className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-white" />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Chave PIX (CPF ou E-mail)</label>
                        <input type="text" value={newKey} onChange={e => setNewKey(e.target.value)} required placeholder="Chave do contato" className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-white" />
                    </div>
                    <div className="flex space-x-2">
                        <button type="button" onClick={() => setShowAddForm(false)} className="w-full px-4 py-2 font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200">Cancelar</button>
                        <button type="submit" className="w-full px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Salvar Contato</button>
                    </div>
                </form>
            )}

            {isLoading ? <p>Carregando contatos...</p> : (
                contacts.length > 0 ? (
                    <ul className="space-y-3">
                        {contacts.map(contact => (
                            <li key={contact.key} className="p-4 border dark:border-gray-700 rounded-lg flex items-center justify-between">
                                <div className="flex-grow">
                                    <p className="font-bold text-gray-800 dark:text-white">{contact.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 break-all">{contact.key}</p>
                                </div>
                                <div className="flex-shrink-0">
                                    <button onClick={() => handleDeleteContact(contact.key)} className="p-2 text-sm font-semibold text-red-600 bg-red-100 rounded-md hover:bg-red-200 dark:bg-red-900/50 dark:text-red-200 dark:hover:bg-red-900">Remover</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">Nenhum contato salvo.</p>
                )
            )}
        </div>
    );
};

export default Contacts;