import React, { useEffect } from 'react';
import { useAppState } from '../contexts/AppStateContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, CreditCard, Calendar, X, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

const ICONS = {
  info: <Info className="text-blue-500" size={24} />,
  success: <CheckCircle2 className="text-volt-green" size={24} />,
  warning: <AlertTriangle className="text-volt-yellow" size={24} />,
  error: <AlertTriangle className="text-volt-red" size={24} />
};

const BORDERS = {
  info: 'border-blue-500/30',
  success: 'border-volt-green/30',
  warning: 'border-volt-yellow/30',
  error: 'border-volt-red/30'
};

const SmartAlerts: React.FC = () => {
    const { alerts, removeAlert, addAlert, theme } = useAppState();
    const { user } = useAuth();
    
    // Simulate Smart Checks on Mount
    useEffect(() => {
        if (!user) return;
        
        const checkAlerts = () => {
            const hasChecked = localStorage.getItem(`volt_alerts_checked_${user.cpf}_${new Date().toDateString()}`);
            if (hasChecked) return;
            
            const now = new Date();

            // Helper: calcula dias restantes para uma data
            const daysUntil = (dateStr: string | Date | undefined | null): number | null => {
                if (!dateStr) return null;
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return null;
                const diff = d.getTime() - now.getTime();
                return Math.ceil(diff / (1000 * 60 * 60 * 24));
            };

            // 1. Verificar Fatura FECHADA (vencida ou prestes a vencer)
            if (user.creditCard?.closedInvoice && user.creditCard.closedInvoice > 0) {
                const days = daysUntil(user.creditCard.closedInvoiceDueDate);
                if (days !== null) {
                    const valor = `R$ ${user.creditCard.closedInvoice.toFixed(2).replace('.', ',')}`;
                    if (days < 0) {
                        addAlert({
                            type: 'error',
                            message: `⚠️ Fatura ${valor} atrasada há ${Math.abs(days)} dia(s)! Pague agora para evitar juros.`,
                            duration: 10000
                        });
                    } else if (days === 0) {
                        addAlert({
                            type: 'error',
                            message: `🚨 Sua fatura de ${valor} vence HOJE! Não perca o prazo.`,
                            duration: 10000
                        });
                    } else if (days === 1) {
                        addAlert({
                            type: 'warning',
                            message: `⏰ Falta 1 dia para o vencimento da sua fatura de ${valor}. Pague agora!`,
                            duration: 9000
                        });
                    } else if (days <= 3) {
                        addAlert({
                            type: 'warning',
                            message: `📅 Sua fatura de ${valor} vence em ${days} dias. Programe seu pagamento.`,
                            duration: 8000
                        });
                    }
                }
            }

            // 2. Verificar Fatura ABERTA (próximo vencimento)
            if (user.creditCard?.dueDay) {
                const dueDay = user.creditCard.dueDay;
                const closingDay = user.creditCard.closingDay || (dueDay - 7);
                let openDueMonth = now.getUTCMonth();
                let openDueYear = now.getUTCFullYear();
                if (now.getUTCDate() > closingDay) {
                    openDueMonth += 1;
                    if (openDueMonth > 11) { openDueMonth = 0; openDueYear += 1; }
                }
                if (closingDay > dueDay) {
                    openDueMonth += 1;
                    if (openDueMonth > 11) { openDueMonth = 0; openDueYear += 1; }
                }
                const openDueDate = new Date(Date.UTC(openDueYear, openDueMonth, dueDay));
                const daysToOpen = daysUntil(openDueDate);
                const currentInvoice = user.creditCard?.currentInvoice || 0;
                if (daysToOpen !== null && daysToOpen === 1 && currentInvoice > 0) {
                    addAlert({
                        type: 'info',
                        message: `⏰ Falta 1 dia para o vencimento da fatura atual de R$ ${currentInvoice.toFixed(2).replace('.', ',')}.`,
                        duration: 9000
                    });
                }
            }
            
            // 3. Predict Recurring Bills from Mock Transactions
            const recentTx = user.transactions.slice(0, 10);
            const netflix = recentTx.find(tx => tx.description.toLowerCase().includes('netflix'));
            if (netflix) {
                addAlert({
                    type: 'info',
                    message: 'Previsão: Netflix (R$ 45,90) será cobrado nos próximos 3 dias.',
                    duration: 6000
                });
            }

            localStorage.setItem(`volt_alerts_checked_${user.cpf}_${new Date().toDateString()}`, 'true');
        };

        // Delay checks to not overlap with initial rendering
        const timeout = setTimeout(checkAlerts, 2000);
        return () => clearTimeout(timeout);
    }, [user, addAlert]);


    // Auto-remove timers
    useEffect(() => {
        alerts.forEach(alert => {
            if (alert.duration && alert.duration > 0) {
                const timer = setTimeout(() => {
                    removeAlert(alert.id);
                }, alert.duration);
                return () => clearTimeout(timer);
            }
        });
    }, [alerts, removeAlert]);

    const isMidnight = theme === 'midnight';

    return (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm flex flex-col gap-3 pointer-events-none">
            <AnimatePresence>
                {alerts.map((alert) => (
                    <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={`pointer-events-auto w-full p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-start gap-3 relative overflow-hidden ${
                            isMidnight ? 'bg-[#18181b]/90 border-white/5' : 'bg-white/90 border-black border-2'
                        } ${isMidnight ? BORDERS[alert.type] : ''}`}
                    >
                        {/* Status Bar */}
                        <div className={`absolute top-0 left-0 w-full h-1 ${alert.type === 'error' ? 'bg-volt-red' : alert.type === 'warning' ? 'bg-volt-yellow' : alert.type === 'success' ? 'bg-volt-green' : 'bg-blue-500'}`} />
                        
                        <div className="shrink-0 mt-1">
                            {ICONS[alert.type]}
                        </div>
                        
                        <div className="flex-1 pr-6">
                            <p className={`text-sm font-semibold leading-tight ${isMidnight ? 'text-white' : 'text-black'}`}>
                                {alert.message}
                            </p>
                        </div>
                        
                        <button 
                            onClick={() => removeAlert(alert.id)}
                            className={`absolute top-4 right-4 transition-colors ${isMidnight ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-black'}`}
                        >
                            <X size={18} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default SmartAlerts;
