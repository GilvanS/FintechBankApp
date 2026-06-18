import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getNotifications, markNotificationAsRead } from '../services/api';
import { useToast, ToastContainer } from './Toast';
import { AppNotification } from '../types';
import LoadingSpinner from './LoadingSpinner';
import ErrorState from './ErrorState';

interface NotificationsProps {
    onBack: () => void;
}

const Notifications: React.FC<NotificationsProps> = ({ onBack }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast, showSuccess, showError, hide } = useToast();
    
    // CRÍTICO PARA PERFORMANCE APK: Estado inicial sem localStorage bloqueante
    // Ler preferência em useEffect em background
    const [isWelcomePopupEnabled, setIsWelcomePopupEnabled] = useState<boolean>(true);

    const fetchNotifications = async () => {
        if (user) {
            setIsLoading(true);
            setError(null);
            try {
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
            } catch {
                setError('Não foi possível carregar as notificações.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        // CRÍTICO PARA PERFORMANCE APK: Adiar fetch até componente estar totalmente renderizado
        if (!user) return;

        const runFetch = () => {
            fetchNotifications();
        };

        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(runFetch, { timeout: 1000 });
        } else {
            setTimeout(runFetch, 300);
        }
    }, [user]);

    // Sincronizar estado do popup quando o usuário mudar
    // CRÍTICO PARA PERFORMANCE APK: Ler preferência em background
    useEffect(() => {
        if (!user) return;
        
        const readPreference = () => {
            try {
                const welcomePopupEnabledKey = `welcome_popup_enabled_${user.cpf}`;
                const saved = localStorage.getItem(welcomePopupEnabledKey);
                setIsWelcomePopupEnabled(saved !== 'false');
            } catch (error) {
                console.warn('Erro ao ler preferência do popup:', error);
            }
        };
        
        // Executar em background para não bloquear renderização
        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(readPreference, { timeout: 1000 });
        } else {
            setTimeout(readPreference, 300);
        }
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

    const handleToggleWelcomePopup = () => {
        if (!user) return;
        const welcomePopupEnabledKey = `welcome_popup_enabled_${user.cpf}`;
        const newValue = !isWelcomePopupEnabled;
        setIsWelcomePopupEnabled(newValue);
        
        // CRÍTICO PARA PERFORMANCE APK: Salvar em background
        const savePreference = () => {
            try {
                localStorage.setItem(welcomePopupEnabledKey, newValue.toString());
            } catch (error) {
                console.warn('Erro ao salvar preferência do popup:', error);
            }
        };
        
        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(savePreference, { timeout: 500 });
        } else {
            setTimeout(savePreference, 0);
        }
        
        showSuccess(newValue ? 'Popup de boas-vindas ativado' : 'Popup de boas-vindas desativado');
    };

    return (
        <div className="bg-background-light min-h-full" id="notifications-view" data-testid="notifications-view" aria-label="Notificações">
            <header className="bg-primary text-white p-4 flex items-center safe-top" id="notifications-header" data-testid="notifications-header" aria-label="Cabeçalho de notificações">
                <button onClick={onBack} className="mr-4 p-2 -ml-2 rounded-full hover:bg-white/20" id="notifications-back" data-testid="notifications-back" aria-label="Voltar">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="text-xl font-bold">Notificações</h2>
            </header>

            <div className="p-4 space-y-4">
                {/* Configuração do Popup de Boas-vindas */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <h3 className="text-text-light font-semibold mb-1">Popup de Boas-vindas</h3>
                            <p className="text-sm text-subtle-light">Mostrar popup de boas-vindas após o login</p>
                        </div>
                        <button
                            onClick={handleToggleWelcomePopup}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                                isWelcomePopupEnabled ? 'bg-primary' : 'bg-gray-300'
                            }`}
                            role="switch"
                            aria-checked={isWelcomePopupEnabled}
                            aria-label="Ativar/desativar popup de boas-vindas"
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                    isWelcomePopupEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Lista de Notificações */}
                {isLoading ? (
                    <LoadingSpinner message="Carregando notificações..." />
                ) : error ? (
                    <ErrorState message={error} onRetry={fetchNotifications} />
                ) : (
                    notifications.length > 0 ? (
                        <ul className="space-y-3">
                            {notifications.map(n => (
                                <li key={n.id} className={`p-4 rounded-xl border ${n.is_read ? 'bg-white border-gray-200' : 'bg-primary/5 border-primary/20'}`}>
                                    <p className={`text-text-light ${!n.is_read && 'font-semibold'}`}>{n.message}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-xs text-subtle-light">{new Date(n.created_at).toLocaleString('pt-BR')}</p>
                                        {!n.is_read && <button onClick={() => handleMarkAsRead(n.id)} className="text-xs text-primary font-semibold hover:underline">Marcar como lida</button>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-subtle-light py-8">Nenhuma notificação.</p>
                    )
                )}
            </div>
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};
export default Notifications;