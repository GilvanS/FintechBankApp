


import React, { useState, useEffect } from 'react';
// FIX: Corrected import path for useAuth from parent directory.
import { useAuth } from '../App';
// FIX: Corrected import path for types from parent directory.
import { AppNotification } from '../types';
import { getNotifications, markNotificationAsRead } from '../services/api';
import { useToast, ToastContainer } from './Toast';

interface NotificationsProps {
    onBack: () => void;
}
function Notifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast, showSuccess, showError, hide } = useToast();

    const fetchNotifications = async () => {
        if (user) {
            setIsLoading(true);
            const result = await getNotifications(user.cpf);
            if (result.success) {
                const userNotifications = result.notifications!;
                setNotifications(userNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
            }
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, [user]);

    const handleMarkAsRead = async (id: number) => {
        if (user) {
            const res = await markNotificationAsRead(user.cpf, id);
            if (res.success) {
                showSuccess('Notificacao marcada como lida');
                fetchNotifications();
            } else {
                showError(res.message || 'Falha ao marcar notificacao');
            }
        }
    };

    return (
        <div className="bg-white min-h-full">
            <header className="bg-orange-500 text-white p-4 flex items-center">
                <button onClick={onBack} className="mr-4 p-2 -ml-2 rounded-full hover:bg-white/20">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-xl font-bold">Notificações</h2>
            </header>

            <div className="p-4">
                {isLoading ? <p className="text-center text-gray-500">Carregando...</p> : (
                    notifications.length > 0 ? (
                        <ul className="space-y-3">
                            {notifications.map(n => (
                                <li key={n.id} className={`p-4 rounded-lg border ${n.is_read ? 'bg-white border-gray-200' : 'bg-orange-50 border-orange-200'}`}>
                                    <p className={`text-gray-800 ${!n.is_read && 'font-semibold'}`}>{n.message}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-xs text-gray-500">{new Date(n.created_at).toLocaleString('pt-BR')}</p>
                                        {!n.is_read && <button onClick={() => handleMarkAsRead(n.id)} className="text-xs text-orange-600 font-semibold hover:underline">Marcar como lida</button>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-8">Nenhuma notificação.</p>
                    )
                )}
            </div>
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};
export default Notifications;