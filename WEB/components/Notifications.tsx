import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppNotification } from '../types';
import { getNotifications, markNotificationAsRead } from '../services/api';
import { useToast, ToastContainer } from './Toast';
import { formatDateTimeBR } from '../utils/formatters';

interface NotificationsProps {
    onBack: () => void;
}

/** Verifica se a notificação é de pagamento mínimo pelo título */
function isMinPaymentNotification(n: AppNotification): boolean {
    const title = (n.title || '').toLowerCase();
    return title.includes('mínimo') || title.includes('minimo');
}

/** Determina as classes CSS extra baseadas no tipo de notificação */
function getNotificationClasses(n: AppNotification): string {
    const base = 'p-4 rounded-lg border transition-all duration-200';
    const isMin = isMinPaymentNotification(n);

    if (isMin && !n.is_read) {
        // Destaque verde para pagamento mínimo não lido
        return `${base} bg-emerald-900/20 border-emerald-500/40 shadow-sm shadow-emerald-500/10`;
    }
    if (isMin && n.is_read) {
        // Pagamento mínimo já lido — borda verde suave
        return `${base} bg-surface-dark border-emerald-500/20`;
    }
    if (!n.is_read) {
        return `${base} bg-primary/10 border-primary/30`;
    }
    return `${base} bg-surface-dark border-white/10`;
}

/** Ícone indicador baseado no tipo da notificação */
function NotificationIcon({ n }: { n: AppNotification }) {
    if (isMinPaymentNotification(n)) {
        return (
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
        );
    }
    return (
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
        </div>
    );
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
                                <li key={n.id} className={getNotificationClasses(n)}>
                                    <div className="flex items-start gap-3">
                                        <NotificationIcon n={n} />

                                        <div className="flex-1 min-w-0">
                                            {/* Título da notificação — sempre exibido se presente */}
                                            {n.title && (
                                                <p className={`text-sm font-semibold mb-0.5 ${
                                                    isMinPaymentNotification(n)
                                                        ? 'text-emerald-300'
                                                        : !n.is_read
                                                            ? 'text-white'
                                                            : 'text-white/70'
                                                }`}>
                                                    {n.title}
                                                </p>
                                            )}

                                            {/* Mensagem com destaque de lido/não lido */}
                                            <p className={`text-sm leading-relaxed ${
                                                !n.is_read ? 'text-white/80' : 'text-white/50'
                                            }`}>
                                                {n.message}
                                            </p>

                                            {/* Rodapé: data + ação */}
                                            <div className="flex justify-between items-center mt-2">
                                                <p className="text-xs text-white/40">{formatDateTimeBR(n.created_at)}</p>
                                                {!n.is_read && (
                                                    <button
                                                        onClick={() => handleMarkAsRead(n.id)}
                                                        className={`text-xs font-semibold hover:underline ${
                                                            isMinPaymentNotification(n)
                                                                ? 'text-emerald-400'
                                                                : 'text-primary'
                                                        }`}
                                                    >
                                                        Marcar como lida
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-12">
                            <svg className="w-12 h-12 mx-auto text-white/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            <p className="text-white/50">Nenhuma notificação.</p>
                        </div>
                    )
                )}
            </div>
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default Notifications;
