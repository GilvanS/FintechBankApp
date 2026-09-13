import React, { useState, useEffect } from 'react';
import { Shield, Users, CreditCard, Receipt, FileText, LogIn, RefreshCw, Repeat, Send, ShieldCheck, Activity, Timer, Palette, Moon, Sun, Sparkles, X, Wrench, ClipboardList } from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import { useAppState } from '../../contexts/AppStateContext';
import { setAdminSessionToken, login } from '../../services/api';

// Sub-telas do Admin — mesmas 10 já existentes, agora orquestradas pelo AllureShell
// em vez do shell próprio que o AdminDashboard.tsx (legado) implementava.
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
import ScriptsMassasSection from './ScriptsMassasSection';
import TestPlanningSection from './TestPlanningSection';

interface AdminAllureViewProps {
    onClose: () => void;
    initialSearchCpf?: string;
}

type AdminSectionKey = 'users' | 'requests' | 'billing' | 'recurring' | 'cards' | 'mass-creator' | 'audit' | 'vitrine' | 'telegram' | 'scripts' | 'test-planning' | 'legacy';

const SECTIONS: AllureSection<AdminSectionKey>[] = [
    { key: 'users', label: 'Usuários', icon: Users, group: 'Usuários & Solicit.' },
    { key: 'requests', label: 'Solicitações', icon: FileText, group: 'Usuários & Solicit.' },
    { key: 'billing', label: 'Faturamento', icon: Receipt, group: 'Financeiro' },
    { key: 'recurring', label: 'Contas Recorrentes', icon: Repeat, group: 'Financeiro' },
    { key: 'cards', label: 'Cartões & Massa', icon: CreditCard, group: 'Financeiro' },
    { key: 'mass-creator', label: 'Gerador de Massa 3.0', icon: Sparkles, group: 'Gerador 3.0' },
    { key: 'audit', label: 'Auditoria', icon: ShieldCheck, group: 'Auditoria & Sistema' },
    { key: 'vitrine', label: 'Vitrine', icon: Timer, group: 'Auditoria & Sistema' },
    { key: 'telegram', label: 'Telegram', icon: Send, group: 'Auditoria & Sistema' },
    { key: 'scripts', label: 'Scripts & Massas', icon: Wrench, group: 'Auditoria & Sistema' },
    { key: 'test-planning', label: 'Planejamento de Testes', icon: ClipboardList, group: 'Testes' },
    { key: 'legacy', label: 'Painel Legado', icon: Shield, group: 'Legado' },
];

const AdminAllureView: React.FC<AdminAllureViewProps> = ({ onClose, initialSearchCpf }) => {
    const { theme, adminDefaultTheme, setAdminDefaultTheme } = useAppState();
    const isMidnight = theme === 'midnight';
    const [activeSection, setActiveSection] = useState<AdminSectionKey>('users');
    const [legacySearchCpf, setLegacySearchCpf] = useState<string | null>(initialSearchCpf ?? null);
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
                setActiveSection(e.detail.tab as AdminSectionKey);
            }
        };
        const handleNavigateToLegacy = (e: any) => {
            if (e.detail?.cpf) {
                setLegacySearchCpf(e.detail.cpf);
                setActiveSection('legacy');
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

    const renderContent = () => {
        switch (activeSection) {
            case 'mass-creator':
                return <MainMassCreatorFlow onSuccess={() => setActiveSection('users')} onCancel={() => setActiveSection('users')} />;
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
            case 'vitrine':
                return <ShopOfferSettings />;
            case 'scripts':
                return <ScriptsMassasSection />;
            case 'test-planning':
                return <TestPlanningSection />;
            default:
                return <UserManagement />;
        }
    };

    // Fundo do Admin fica neutro (não amarelo/preto full-bleed) — exceção
    // consciente ao padrão Allure, mantendo o painel visualmente mais
    // técnico/sóbrio que o resto do app (decisão validada com o usuário).
    const bgClassName = isMidnight ? 'bg-[#0f0f0f]' : 'bg-[#f4f4f5]';

    const headerActions = (
        <button
            onClick={() => window.open('/FintechBankApp/monitor', 'volt-monitor', 'width=520,height=900')}
            title="Acompanhar eventos em tempo real numa janela ao lado"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all ${
                isMidnight
                    ? 'bg-volt-green/15 hover:bg-volt-green/25 text-volt-green'
                    : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 text-black active:translate-y-0.5 active:shadow-none'
            }`}
        >
            <Activity size={16} /> Monitor ao vivo
        </button>
    );

    const headerExtra = (
        <div className={`p-4 rounded-2xl border transition-all ${
            isMidnight
                ? 'bg-white/5 border-white/10 text-white'
                : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black'
        }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isMidnight ? 'bg-volt-green/20 text-volt-green' : 'bg-black text-white'}`}>
                        <Palette size={20} />
                    </div>
                    <div>
                        <h3 className="font-black text-sm uppercase tracking-wide">Tema Padrão do Sistema (Admin)</h3>
                        <p className={`text-xs ${isMidnight ? 'text-white/60' : 'text-black/60'}`}>
                            Define o tema padrão de novos acessos no app
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => setAdminDefaultTheme('yellow')}
                        data-testid="admin-theme-yellow-btn"
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            adminDefaultTheme === 'yellow'
                                ? 'bg-yellow-400 text-black border-2 border-black shadow-sm'
                                : isMidnight ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-black/70 hover:bg-gray-200'
                        }`}
                    >
                        <Sun size={14} /> Normal (Yellow)
                    </button>
                    <button
                        type="button"
                        onClick={() => setAdminDefaultTheme('midnight')}
                        data-testid="admin-theme-midnight-btn"
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            adminDefaultTheme === 'midnight'
                                ? 'bg-volt-green text-black border-2 border-black shadow-sm'
                                : isMidnight ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-black/70 hover:bg-gray-200'
                        }`}
                    >
                        <Moon size={14} /> Dark (Midnight)
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <AllureShell<AdminSectionKey>
                title="Painel Administrativo"
                subtitle="Gestão central do FintechBankApp"
                theme={theme}
                onBack={onClose}
                sections={SECTIONS}
                activeSection={activeSection}
                onSelectSection={setActiveSection}
                headerActions={headerActions}
                headerExtra={headerExtra}
                bgClassName={bgClassName}
            >
                {renderContent()}
            </AllureShell>

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
        </>
    );
};

export default AdminAllureView;
