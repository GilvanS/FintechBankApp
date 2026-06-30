import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppNotification } from '../types';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface Alert {
    id: string;
    type: AlertType;
    message: string;
    duration?: number;
}

interface AppStateContextData {
    theme: 'midnight' | 'yellow';
    setTheme: (theme: 'midnight' | 'yellow') => void;
    alerts: Alert[];
    addAlert: (alert: Omit<Alert, 'id'>) => void;
    removeAlert: (id: string) => void;
    
    // Notifications & Toasts
    notifications: AppNotification[];
    clearNotification: (id: string) => void;
    clearAllNotifications: () => void;
    checkRecurringBillNotifications: () => void;
    triggerSmartAlertCheck: (title: string, amount: number, category: string) => void;
    toast: { title: string; message: string } | null;
    setToast: (toast: { title: string; message: string } | null) => void;
    
    // Modals
    isFinancialHealthOpen: boolean;
    setFinancialHealthOpen: (isOpen: boolean) => void;
    isAiRecurringModalOpen: boolean;
    setAiRecurringModalOpen: (isOpen: boolean) => void;
    isAiModalOpen: boolean;
    setAiModalOpen: (isOpen: boolean) => void;
    
    // Hub
    isCentralHubOpen: boolean;
    setCentralHubOpen: (isOpen: boolean) => void;
    activeDrawer: string | null;
    setActiveDrawer: (drawer: string | null) => void;
}

export const AppStateContext = createContext<AppStateContextData>({} as AppStateContextData);

const DEFAULT_BILLS = [
    { id: 'rec_1', title: 'Spotify Premium', amount: -24.90, category: 'cultura', dueDate: '26/06/2026', status: 'pending' },
    { id: 'rec_2', title: 'Netflix Ultra HD', amount: -55.90, category: 'cultura', dueDate: '27/06/2026', status: 'pending' },
    { id: 'rec_3', title: 'Internet Volt Fibra', amount: -119.90, category: 'outros', dueDate: '28/06/2026', status: 'pending' },
    { id: 'rec_4', title: 'Light Volt Energia', amount: -180.00, category: 'outros', dueDate: '20/06/2026', status: 'paid', paidAtDate: '20/06/2026' },
    { id: 'rec_5', title: 'Gym Pass Academia', amount: -89.90, category: 'saude', dueDate: '30/06/2026', status: 'pending' },
];

const DEFAULT_NOTIFICATIONS = [
    { id: 'notif_1', title: 'Compra aprovada', description: 'R$ 499,00 na Apple Store', time: 'Há 5 min' },
    { id: 'notif_2', title: 'Fatura fechada', description: 'Fatura de Outubro fechou em R$ 1.210,00', time: 'Ontem' },
    { id: 'notif_3', title: 'Rendimento CDI', description: 'Seu saldo rendeu R$ 2,45 ontem (110% do CDI)', time: 'Ontem' },
];

export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<'midnight' | 'yellow'>(() => {
        return (localStorage.getItem('volt_theme') as 'midnight' | 'yellow') || 'yellow';
    });
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [toast, setToast] = useState<{ title: string; message: string } | null>(null);
    
    const [isFinancialHealthOpen, setFinancialHealthOpen] = useState(false);
    const [isAiRecurringModalOpen, setAiRecurringModalOpen] = useState(false);
    const [isAiModalOpen, setAiModalOpen] = useState(false);
    
    const [isCentralHubOpen, setCentralHubOpen] = useState(false);
    const [activeDrawer, setActiveDrawer] = useState<string | null>(null);

    // Sincronizar classe do body no boot e nas atualizações do tema
    useEffect(() => {
        if (theme === 'midnight') {
            document.body.classList.add('theme-midnight');
        } else {
            document.body.classList.remove('theme-midnight');
        }
    }, [theme]);

    // Timer para limpar o toast flutuante
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => {
                setToast(null);
            }, 6000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const setTheme = (newTheme: 'midnight' | 'yellow') => {
        setThemeState(newTheme);
        localStorage.setItem('volt_theme', newTheme);
    };

    const addAlert = (alert: Omit<Alert, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        setAlerts(prev => [...prev, { ...alert, id }]);
    };

    const removeAlert = (id: string) => {
        setAlerts(prev => prev.filter(alert => alert.id !== id));
    };

    const clearNotification = (id: string) => {
        const updated = notifications.filter(n => n.id !== id);
        setNotifications(updated);
        localStorage.setItem('volt_notifications', JSON.stringify(updated));
    };

    const clearAllNotifications = () => {
        setNotifications([]);
        localStorage.setItem('volt_notifications', JSON.stringify([]));
    };

    const checkRecurringBillNotifications = () => {
        // 1. Obter contas do localStorage ou usar padrão
        let bills: any[] = [];
        const savedBills = localStorage.getItem('volt_recurring_bills');
        if (savedBills) {
            bills = JSON.parse(savedBills);
        } else {
            bills = DEFAULT_BILLS;
            localStorage.setItem('volt_recurring_bills', JSON.stringify(bills));
        }

        // 2. Obter notificações do localStorage ou usar padrão
        let currentNotifs: AppNotification[] = [];
        const savedNotifs = localStorage.getItem('volt_notifications');
        if (savedNotifs) {
            currentNotifs = JSON.parse(savedNotifs);
        } else {
            currentNotifs = DEFAULT_NOTIFICATIONS;
            localStorage.setItem('volt_notifications', JSON.stringify(currentNotifs));
        }

        // Helper para ler data DD/MM/YYYY
        const parseDueDate = (dateStr: string) => {
            const parts = dateStr.split('/');
            if (parts.length !== 3) return null;
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            return new Date(year, month, day);
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let triggeredAny = false;
        let updatedNotifs = [...currentNotifs];

        bills.forEach((bill) => {
            if (bill.status !== 'pending') return;

            const dueDateObj = parseDueDate(bill.dueDate);
            if (!dueDateObj) return;
            dueDateObj.setHours(0, 0, 0, 0);

            const diffTime = dueDateObj.getTime() - today.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            // Disparar se faltarem exatamente 2 dias
            if (diffDays === 2) {
                const uniqueNotifId = `bill-due-2days-${bill.id}-${bill.dueDate}`;
                const alreadyExists = updatedNotifs.some(n => n.id === uniqueNotifId);

                if (!alreadyExists) {
                    const absAmount = Math.abs(bill.amount);
                    const formattedAmt = absAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                    
                    const newNotif: AppNotification = {
                        id: uniqueNotifId,
                        title: 'Vencimento Próximo 📅',
                        description: `A conta "${bill.title}" no valor de R$ ${formattedAmt} vence em 2 dias (${bill.dueDate}).`,
                        time: 'Agora'
                    };

                    updatedNotifs = [newNotif, ...updatedNotifs];
                    triggeredAny = true;

                    setToast({
                        title: '⚠️ VENCIMENTO PRÓXIMO',
                        message: `Aviso Volt: A conta "${bill.title}" no valor de R$ ${formattedAmt} vence em 2 dias (${bill.dueDate}).`
                    });
                }
            }
        });

        if (triggeredAny || !savedNotifs) {
            localStorage.setItem('volt_notifications', JSON.stringify(updatedNotifs));
        }
        setNotifications(updatedNotifs);
    };

    const triggerSmartAlertCheck = (title: string, amount: number, category: string) => {
        const absAmount = Math.abs(amount);
        const now = new Date();
        const currentTimeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        // 1. Compra Elevada Geral
        const isNotificationEnabled = localStorage.getItem('volt_notifications_enabled') === 'true';
        const notificationThreshold = parseFloat(localStorage.getItem('volt_notifications_amount') || '500');
        if (isNotificationEnabled && absAmount >= notificationThreshold) {
            setToast({
                title: '🔔 Compra Elevada Realizada',
                message: `Aviso Volt: Uma transação de R$ ${absAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi confirmada em "${title}".`
            });
        }

        // 2. Alertas Inteligentes Customizados (Filtros de Categoria, Valor e Horário)
        const isSmartAlertsEnabled = localStorage.getItem('volt_smart_alerts_enabled') === 'true';
        if (isSmartAlertsEnabled) {
            const minAmount = parseFloat(localStorage.getItem('volt_smart_alerts_min_amount') || '100');
            const savedCategories = localStorage.getItem('volt_smart_alerts_categories');
            const categories: string[] = savedCategories ? JSON.parse(savedCategories) : ['refeicao', 'mobilidade', 'cultura', 'saude', 'outros'];
            const timePreset = localStorage.getItem('volt_smart_alerts_time_preset') || 'always';

            let isCategoryMatch = categories.includes(category);
            let isAmountMatch = absAmount >= minAmount;
            let isTimeMatch = false;

            if (timePreset === 'always') {
                isTimeMatch = true;
            } else if (timePreset === 'night') {
                isTimeMatch = currentTimeStr >= '22:00' || currentTimeStr <= '06:00';
            } else if (timePreset === 'business') {
                isTimeMatch = currentTimeStr >= '08:00' && currentTimeStr <= '18:00';
            } else if (timePreset === 'custom') {
                const startT = localStorage.getItem('volt_smart_alerts_start_time') || '22:00';
                const endT = localStorage.getItem('volt_smart_alerts_end_time') || '06:00';
                if (startT === endT) {
                    isTimeMatch = true;
                } else if (startT < endT) {
                    isTimeMatch = currentTimeStr >= startT && currentTimeStr <= endT;
                } else {
                    isTimeMatch = currentTimeStr >= startT || currentTimeStr <= endT;
                }
            }

            if (isCategoryMatch && isAmountMatch && isTimeMatch) {
                const catLabels: Record<string, string> = {
                    refeicao: 'Refeição 🍔',
                    mobilidade: 'Mobilidade 🚗',
                    cultura: 'Cultura 🎬',
                    saude: 'Saúde 🏥',
                    outros: 'Outros 💳'
                };
                const catLabel = catLabels[category] || category;

                // Definir Toast inteligente
                setToast({
                    title: '🔮 Alerta Inteligente Volt',
                    message: `Gasto monitorado detectado: R$ ${absAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em "${title}" (${catLabel}) às ${currentTimeStr}.`
                });

                // Criar notificação persistente
                const newNotifId = `smart-alert-${Date.now()}-${Math.random()}`;
                const newNotif: AppNotification = {
                    id: newNotifId,
                    title: '🔮 Alerta Inteligente',
                    description: `Compra monitorada de R$ ${absAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} realizada em "${title}" (${catLabel}) às ${currentTimeStr}.`,
                    time: 'Agora'
                };

                const currentNotifs = JSON.parse(localStorage.getItem('volt_notifications') || '[]');
                const updatedNotifs = [newNotif, ...currentNotifs];
                localStorage.setItem('volt_notifications', JSON.stringify(updatedNotifs));
                setNotifications(updatedNotifs);
            }
        }
    };

    // Executar verificação no mount
    useEffect(() => {
        checkRecurringBillNotifications();
    }, []);

    return (
        <AppStateContext.Provider value={{
            theme,
            setTheme,
            alerts,
            addAlert,
            removeAlert,
            notifications,
            clearNotification,
            clearAllNotifications,
            checkRecurringBillNotifications,
            triggerSmartAlertCheck,
            toast,
            setToast,
            isFinancialHealthOpen,
            setFinancialHealthOpen,
            isAiRecurringModalOpen,
            setAiRecurringModalOpen,
            isAiModalOpen,
            setAiModalOpen,
            isCentralHubOpen,
            setCentralHubOpen,
            activeDrawer,
            setActiveDrawer,
        }}>
            {children}
        </AppStateContext.Provider>
    );
};

export const useAppState = () => {
    const context = useContext(AppStateContext);
    if (!context) {
        throw new Error('useAppState deve ser usado dentro de um AppStateProvider');
    }
    return context;
};
