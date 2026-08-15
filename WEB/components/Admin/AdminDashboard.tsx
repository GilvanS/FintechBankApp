import React, { useState, useEffect } from 'react';
import { Shield, Users, CreditCard, Receipt, FileText, ArrowLeft, Sparkles, X, LogIn, RefreshCw, Repeat, Send, ShieldCheck } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { setAdminSessionToken, login } from '../../services/api';

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

interface AdminDashboardProps {
    onClose: () => void;
}

type AdminTab = 'mass-creator' | 'users' | 'cards' | 'billing' | 'recurring' | 'requests' | 'telegram' | 'audit' | 'legacy';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const [activeTab, setActiveTab] = useState<AdminTab>('users');
    const [legacySearchCpf, setLegacySearchCpf] = useState<string | null>(null);
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
    const [authFailedModal, setAuthFailedModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
    const [refreshForm, setRefreshForm] = useState({ cpf: '', password: '', loading: false, error: '' });
    const [showRefreshForm, setShowRefreshForm] = useState(false);

    useEffect(() => {
        const savedToken = localStorage.getItem('adminToken') || localStorage.getItem('authToken');
        if (savedToken) {
            try {
                const payload = JSON.parse(atob(savedToken.split('.')[1]));
                const expired = payload.exp && payload.exp * 1000 < Date.now();
                if (!expired && payload.role === 'admin') {
                    setAdminSessionToken(savedToken);
                } else if (expired) {
                    console.warn('[AdminDashboard] Token admin expirado — limpando sessão');
                    localStorage.removeItem('adminToken');
                    setAdminSessionToken(null);
                }
            } catch {
                setAdminSessionToken(null);
            }
        }
    }, []);

    useEffect(() => {
        const handleToast = (e: any) => {
            const { message, type } = e.detail;
            setToast({ show: true, message, type });
            setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
        };
        const handleSwitchTab = (e: any) => {
            if (e.detail?.tab) {
                setActiveTab(e.detail.tab as AdminTab);
            }
        };
        const handleNavigateToLegacy = (e: any) => {
            if (e.detail?.cpf) {
                setLegacySearchCpf(e.detail.cpf);
                setActiveTab('legacy');
            }
        };
        const handleAuthFailed = (e: any) => {
            const msg = e.detail?.message || 'Acesso negado';
            setAuthFailedModal({ show: true, message: msg });
            const savedToken = localStorage.getItem('adminToken') || localStorage.getItem('authToken');
            if (savedToken) {
                try {
                    const payload = JSON.parse(atob(savedToken.split('.')[1]));
                    const expired = payload.exp && payload.exp * 1000 < Date.now();
                    if (!expired && payload.role === 'admin') {
                        setAdminSessionToken(savedToken);
                        setAuthFailedModal({ show: false, message: '' });
                    }
                } catch {}
            }
        };
        window.addEventListener('app-toast', handleToast);
        window.addEventListener('admin-switch-tab-and-fill-card', handleSwitchTab);
        window.addEventListener('admin-navigate-to-legacy', handleNavigateToLegacy);
        window.addEventListener('admin-auth-failed', handleAuthFailed);
        return () => {
            window.removeEventListener('app-toast', handleToast);
            window.removeEventListener('admin-switch-tab-and-fill-card', handleSwitchTab);
            window.removeEventListener('admin-navigate-to-legacy', handleNavigateToLegacy);
            window.removeEventListener('admin-auth-failed', handleAuthFailed);
        };
    }, []);

    const handleRefreshSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setRefreshForm(prev => ({ ...prev, loading: true, error: '' }));
        try {
            const result = await login(refreshForm.cpf, refreshForm.password);
            if (result.success && result.token) {
                localStorage.setItem('adminToken', result.token);
                setAdminSessionToken(result.token);
                setAuthFailedModal({ show: false, message: '' });
                setShowRefreshForm(false);
                setRefreshForm({ cpf: '', password: '', loading: false, error: '' });
                window.dispatchEvent(new CustomEvent('app-toast', {
                    detail: { message: '✅ Token renovado com sucesso!', type: 'success' }
                }));
            } else {
                setRefreshForm(prev => ({ ...prev, loading: false, error: result.message || 'Falha no login. Verifique CPF e senha.' }));
            }
        } catch (err: any) {
            setRefreshForm(prev => ({ ...prev, loading: false, error: err.message || 'Erro ao renovar token.' }));
        }
    };

        // Categoriza��o de abas em 5 �reas principais para um layout compacto e resumido
    const tabGroups = [
        {
            id: 'gestao',
            label: 'Usuários & Solicit.',
            icon: Users,
            tabs: [
                { id: 'users', label: 'Usuários', icon: Users },
                { id: 'requests', label: 'Solicitações', icon: FileText }
            ]
        },
        {
            id: 'financeiro',
            label: 'Financeiro',
            icon: Receipt,
            tabs: [
                { id: 'billing', label: 'Faturamento', icon: Receipt },
                { id: 'recurring', label: 'Contas Recorrentes', icon: Repeat },
                { id: 'cards', label: 'Cartões & Massa', icon: CreditCard }
            ]
        },
        {
            id: 'massa',
            label: 'Gerador 2.0',
            icon: Sparkles,
            tabs: [
                { id: 'mass-creator', label: '⚡ Gerador de Massa 2.0', icon: Sparkles }
            ]
        },
        {
            id: 'sistema',
            label: 'Auditoria & Sistema',
            icon: ShieldCheck,
            tabs: [
                { id: 'audit', label: 'Auditoria', icon: ShieldCheck },
                { id: 'telegram', label: 'Telegram', icon: Send }
            ]
        },
        {
            id: 'legado',
            label: 'Legado',
            icon: Shield,
            tabs: [
                { id: 'legacy', label: 'Painel Legado', icon: Shield }
            ]
        }
    ] as const;

    const activeGroup = tabGroups.find(group => group.tabs.some(t => t.id === activeTab)) || tabGroups[0];

    const renderContent = () => {
        switch (activeTab) {
            case 'mass-creator':
                return <MainMassCreatorFlow onSuccess={() => setActiveTab('users')} onCancel={() => setActiveTab('users')} />;
            case 'legacy':
                return <AdminLegacy onClose={onClose} initialSearchCpf={legacySearchCpf} />;
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
            default:
                return <UserManagement />;
        }
    };

    return (
        <div className={`min-h-screen ${isMidnight ? 'bg-[#0f0f0f] text-white' : 'bg-[#f4f4f5] text-black'} p-4 md:p-8 font-sans transition-colors duration-200`}>
            {toast.show && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl font-bold shadow-xl border-2 flex items-center gap-2 ${
                    toast.type === 'success' ? 'bg-volt-green text-black border-black' : 'bg-red-500 text-white border-black'
                }`}>
                    {toast.message}
                </div>
            )}

            {authFailedModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className={`w-full max-full max-w-md p-6 rounded-3xl ${isMidnight ? 'bg-[#1a1a1a] border border-white/10 text-white' : 'bg-white border-2 border-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-red-500 font-black uppercase text-sm">
                                <Shield size={20} />
                                Sessão Admin Expirada
                            </div>
                            <button onClick={() => setAuthFailedModal({ show: false, message: '' })} className="p-1 opacity-60 hover:opacity-100">
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-sm mb-4 opacity-80">{authFailedModal.message}</p>
                        {!showRefreshForm ? (
                            <div className="flex gap-2">
                                <button onClick={() => setShowRefreshForm(true)} className={`flex-1 py-3 font-black rounded-2xl flex items-center justify-center gap-2 ${isMidnight ? 'bg-volt-green text-black' : 'bg-volt-yellow border-2 border-black text-black'}`}>
                                    <LogIn size={16} /> Renovar Sessão Admin
                                </button>
                                <button onClick={() => setAuthFailedModal({ show: false, message: '' })} className="px-4 py-3 font-bold opacity-60 hover:opacity-100 text-sm">
                                    Fechar
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleRefreshSubmit} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold mb-1">CPF Admin</label>
                                    <input
                                        type="text"
                                        placeholder="000.000.000-00"
                                        value={refreshForm.cpf}
                                        onChange={e => setRefreshForm(prev => ({ ...prev, cpf: e.target.value }))}
                                        className={`w-full p-2.5 rounded-xl text-sm font-mono ${isMidnight ? 'bg-[#0f0f0f] border border-white/20' : 'bg-gray-100 border-2 border-black'}`}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1">Senha</label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={refreshForm.password}
                                        onChange={e => setRefreshForm(prev => ({ ...prev, password: e.target.value }))}
                                        className={`w-full p-2.5 rounded-xl text-sm ${isMidnight ? 'bg-[#0f0f0f] border border-white/20' : 'bg-gray-100 border-2 border-black'}`}
                                        required
                                    />
                                </div>
                                {refreshForm.error && <p className="text-xs text-red-500 font-bold">{refreshForm.error}</p>}
                                <div className="flex gap-2 pt-2">
                                    <button type="submit" disabled={refreshForm.loading} className={`flex-1 py-2.5 font-bold rounded-xl flex items-center justify-center gap-2 ${isMidnight ? 'bg-volt-green text-black' : 'bg-volt-yellow border-2 border-black text-black'}`}>
                                        {refreshForm.loading ? <RefreshCw size={14} className="animate-spin" /> : <LogIn size={14} />} Entrar
                                    </button>
                                    <button type="button" onClick={() => setShowRefreshForm(false)} className="px-3 py-2.5 font-bold text-xs opacity-60">
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${isMidnight ? 'bg-volt-green/20 text-volt-green' : 'bg-black text-white'}`}>
                            <Shield size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Painel Administrativo</h1>
                            <p className={`text-xs md:text-sm font-bold ${isMidnight ? 'text-white/60' : 'text-black/60'}`}>
                                Gestão central do FintechBankApp
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all ${
                            isMidnight
                                ? 'bg-white/10 hover:bg-white/20 text-white'
                                : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 text-black active:translate-y-0.5 active:shadow-none'
                        }`}
                    >
                        <ArrowLeft size={16} /> Voltar ao App
                    </button>
                </div>

                {/* Grupos Principais de Abas (Reduzido e Organizado) */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full scrollbar-none">
                        {tabGroups.map((group) => {
                            const GroupIcon = group.icon;
                            const isGroupActive = activeGroup.id === group.id;
                            return (
                                <button
                                    key={group.id}
                                    onClick={() => setActiveTab(group.tabs[0].id as AdminTab)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs md:text-sm whitespace-nowrap transition-all cursor-pointer ${
                                        isGroupActive
                                            ? isMidnight
                                                ? 'bg-volt-green text-black shadow-lg shadow-volt-green/20 scale-[1.02]'
                                                : 'bg-black text-white shadow-[3px_3px_0px_0px_rgba(162,255,0,1)] scale-[1.02]'
                                            : isMidnight
                                                ? 'bg-white/5 hover:bg-white/10 text-white/70'
                                                : 'bg-white border-2 border-black/20 hover:border-black text-black/70'
                                    }`}
                                >
                                    <GroupIcon size={16} />
                                    {group.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Sub-abas do grupo ativo (se o grupo tiver mais de 1 aba) */}
                    {activeGroup.tabs.length > 1 && (
                        <div className={`flex items-center gap-2 p-1.5 rounded-2xl border transition-all ${
                            isMidnight ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-black/10'
                        }`}>
                            {activeGroup.tabs.map((subTab) => {
                                const SubIcon = subTab.icon;
                                const isSubActive = activeTab === subTab.id;
                                return (
                                    <button
                                        key={subTab.id}
                                        onClick={() => setActiveTab(subTab.id as AdminTab)}
                                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer ${
                                            isSubActive
                                                ? isMidnight
                                                    ? 'bg-white/20 text-white shadow'
                                                    : 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black'
                                                : isMidnight
                                                    ? 'text-white/60 hover:text-white hover:bg-white/5'
                                                    : 'text-black/60 hover:text-black hover:bg-white/50'
                                        }`}
                                    >
                                        <SubIcon size={14} />
                                        {subTab.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <main>{renderContent()}</main>
            </div>
        </div>
    );
};

export default AdminDashboard;