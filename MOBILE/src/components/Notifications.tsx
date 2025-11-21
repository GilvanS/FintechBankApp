import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getNotifications, markNotificationAsRead } from '../services/mockApi';
import { useToast, ToastContainer } from './Toast';
import { AppNotification } from '../types';

interface NotificationsProps {
    onBack: () => void;
}

const Notifications: React.FC<NotificationsProps> = ({ onBack }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast, showSuccess, showError, hide } = useToast();

    const fetchNotifications = async () => {
        if (user) {
            setIsLoading(true);
            const result = await getNotifications(user.cpf);
            // getNotifications returns AppNotification[] directly in mockApi.ts based on previous view, 
            // BUT looking at the code I saw in view_file for mockApi.ts lines 811-815:
            // export const getNotifications = async (cpf: string): Promise<AppNotification[]> => { ... }
            // However, the usage in the broken file was:
            // const result = await getNotifications(user.cpf);
            // if (result.success) { ... }
            // This implies the broken file expected a different signature. 
            // I must check mockApi.ts signature again to be sure.
            // Wait, I saw line 811 in mockApi.ts: export const getNotifications = async (cpf: string): Promise<AppNotification[]>
            // So it returns an array, not an object with success property.
            // I should adapt the component to match the actual API signature found in mockApi.ts.

            // Actually, let me re-read the mockApi.ts output from step 61 carefully.
            // Line 811: export const getNotifications = async (cpf: string): Promise<AppNotification[]>
            // It returns the array directly.

            // So I will fix the usage in Notifications.tsx as well.
            setNotifications(result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
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
                    <span className="material-symbols-outlined">arrow_back</span>
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