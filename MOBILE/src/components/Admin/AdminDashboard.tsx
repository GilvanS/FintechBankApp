import React, { useState, useEffect } from 'react';
import { Shield, Users, CreditCard, Receipt, FileText, ArrowLeft, Sparkles, Repeat, Send, ShieldCheck, Timer } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';

// Import sub-components
import AdminLegacy from '../Admin';
import UserManagement from './UserManagement';
import RequestsManagement from './RequestsManagement';
import CardsManagement from './CardsManagement';
import BillingManagement from './BillingManagement';
import RecurringBillsManagement from './RecurringBillsManagement';
import { MainMassCreatorFlow } from './MainMassCreatorFlow';
import TelegramManagement from './TelegramManagement';
import AuditSection from './AuditSection';
import ShopOfferSettings from './ShopOfferSettings';

interface AdminDashboardProps {
    onClose: () => void;
}

type AdminTab = 'mass-creator' | 'users' | 'cards' | 'billing' | 'recurring' | 'requests' | 'telegram' | 'audit' | 'vitrine' | 'legacy';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const [activeTab, setActiveTab] = useState<AdminTab>('users');
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    useEffect(() => {
        const handleToast = (e: any) => {
            const { message, type } = e.detail;
            setToast({ show: true, message, type });
            setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
        };
        window.addEventListener('app-toast', handleToast);
        return () => window.removeEventListener('app-toast', handleToast);
    }, []);

    const tabs = [
        { id: 'mass-creator', label: 'Gerador de Massa 3.0', icon: Sparkles },
        { id: 'users', label: 'Usuários', icon: Users },
        { id: 'cards', label: 'Cartões & Massa', icon: CreditCard },
        { id: 'billing', label: 'Faturamento', icon: Receipt },
        { id: 'recurring', label: 'Contas Recorrentes', icon: Repeat },
        { id: 'requests', label: 'Solicitações', icon: FileText },
        { id: 'telegram', label: 'Telegram', icon: Send },
        { id: 'audit', label: 'Auditoria', icon: ShieldCheck },
        { id: 'vitrine', label: 'Vitrine', icon: Timer },
        { id: 'legacy', label: 'Legado', icon: Shield },
    ] as const;

    const renderContent = () => {
        switch (activeTab) {
            case 'mass-creator':
                return <MainMassCreatorFlow onSuccess={() => setActiveTab('users')} onCancel={() => setActiveTab('users')} />;
            case 'legacy':
                return <AdminLegacy onClose={onClose} />;
            case 'users':
                return <UserManagement />;
            case 'cards':
                return <CardsManagement />;
            case 'billing':
                return <BillingManagement />;
            case 'recurring':
                return <RecurringBillsManagement />;
            case 'requests':
                return <RequestsManagement />;
            case 'telegram':
                return <TelegramManagement />;
            case 'audit':
                return <AuditSection />;
            case 'vitrine':
                return <ShopOfferSettings />;
            default:
                return null;
        }
    };

    return (
        <div className={`flex flex-col h-full w-full max-w-screen-2xl mx-auto ${isMidnight ? 'bg-[#0f0f0f] text-white' : 'bg-volt-yellow text-black'}`}>
            {/* Header */}
            <div className={`flex items-center gap-3 p-4 border-b sticky top-0 z-50 ${isMidnight ? 'border-white/5 bg-[#0f0f0f]' : 'border-black/5 bg-volt-yellow'}`}>
                <button onClick={onClose} className={`p-2 -ml-2 rounded-full transition-colors cursor-pointer ${isMidnight ? 'hover:bg-white/10 text-white' : 'hover:bg-black/10 text-black'}`}>
                    <ArrowLeft size={24} />
                </button>
                <div className="flex items-center gap-2">
                    <Shield size={24} className={isMidnight ? 'text-volt-green' : 'text-black'} />
                    <h1 className="text-xl font-bold">Painel Administrativo</h1>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className={`flex overflow-x-auto no-scrollbar border-b-2 px-4 pt-2 gap-1 ${isMidnight ? 'border-white/10' : 'border-black'}`}>
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as AdminTab)}
                            className={`flex items-center gap-2 px-6 py-3 whitespace-nowrap font-bold text-sm transition-all ${
                                isActive 
                                    ? (isMidnight ? 'border-b-2 border-volt-green text-volt-green' : 'bg-[#f4f4f5] border-2 border-black border-b-0 rounded-t-xl translate-y-[2px] text-black') 
                                    : (isMidnight ? 'border-transparent text-white/50 hover:text-white' : 'border-transparent text-black/60 hover:text-black')
                            }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <main className={`flex-1 overflow-y-auto relative ${isMidnight ? 'bg-[#0f0f0f]' : 'bg-[#f4f4f5]'}`}>
                {renderContent()}

                {/* TOAST NOTIFICATION */}
                {toast.show && (
                    <div className={`fixed bottom-4 right-4 p-4 rounded-xl text-white font-bold ${toast.type === 'success' ? 'bg-volt-green text-black' : 'bg-red-500'} shadow-lg z-50 animate-fade-in`}>
                        {toast.message}
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;
