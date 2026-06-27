


import React, { useState, useEffect } from 'react';
// FIX: Corrected import path for useAuth from parent directory.
import { useAuth } from '../context/AuthContext';
// FIX: Corrected import path for types from parent directory.
import { AppNotification } from '../types';
import { getNotifications, markNotificationAsRead } from '../services/api';
import { useToast, ToastContainer } from './Toast';
import { formatDateTimeBR } from '../utils/formatters';

interface NotificationsProps {
    onBack: () => void;
}
function Notifications({ onBack }: NotificationsProps) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast, showSuccess, showError, hide } = useToast();

    const fetchNotifications = async () => {
        if (user) {
            setIsLoading(true);
            const result = await getNotifications(user.cpf);
            if (Array.isArray(result)) {
                setNotifications(result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
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
        <div className="bg-background-dark min-h-full text-white">
            <header className="bg-surface-dark p-4 flex items-center border-b border-white/10">
                <button onClick={onBack} className="mr-4 p-2 -ml-2 rounded-full hover:bg-white/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-xl font-bold">Notificações</h2>
            </header>

            <div className="p-4">
                {isLoading ? <p className="text-center text-white/50">Carregando...</p> : (
                    notifications.length > 0 ? (
                        <ul className="space-y-3">
                            {notifications.map(n => (
                                <li key={n.id} className={`p-4 rounded-lg border ${n.is_read ? 'bg-surface-dark border-white/10' : 'bg-primary/10 border-primary/30'}`}>
                                    <p className={`text-white ${!n.is_read && 'font-semibold'}`}>{n.message}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-xs text-white/40">{formatDateTimeBR(n.created_at)}</p>
                                        {!n.is_read && <button onClick={() => handleMarkAsRead(n.id)} className="text-xs text-primary font-semibold hover:underline">Marcar como lida</button>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-white/50 py-8">Nenhuma notificação.</p>
                    )
                )}
            </div>
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};
export default Notifications;