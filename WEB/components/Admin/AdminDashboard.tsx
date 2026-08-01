import React, { useState, useEffect } from 'react';
import { Shield, Users, CreditCard, Receipt, FileText, ArrowLeft, Sparkles, X, LogIn, RefreshCw } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { setAdminSessionToken, login } from '../../services/api';

// Import sub-components
import AdminLegacy from '../Admin';
import UserManagement from './UserManagement';
import RequestsManagement from './RequestsManagement';
import CardsManagement from './CardsManagement';
import BillingManagement from './BillingManagement';
import { MainMassCreatorFlow } from './MainMassCreatorFlow';

interface AdminDashboardProps {
    onClose: () => void;
}

type AdminTab = 'mass-creator' | 'users' | 'cards' | 'billing' | 'requests' | 'legacy';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const [activeTab, setActiveTab] = useState<AdminTab>('users');
    const [legacySearchCpf, setLegacySearchCpf] = useState<string | null>(null);
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
    const [authFailedModal, setAuthFailedModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
    const [refreshForm, setRefreshForm] = useState({ cpf: '', password: '', loading: false, error: '' });
    const [showRefreshForm, setShowRefreshForm] = useState(false);

    // ── Salvar token admin no sessionStorage ao montar ──
    // Garante que o token do admin esteja disponível mesmo após navegar entre
    // abas (Solicitações → Legado), evitando o erro "Acesso negado" quando o
    // localStorage.adminToken expirar ou for sobrescrito.
    useEffect(() => {
        const savedToken = localStorage.getItem('adminToken') || localStorage.getItem('authToken');
        if (savedToken) {
            // Verificar se não está expirado
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
                // Token inválido, ignora
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
            // Tentar restaurar token do localStorage
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

    const handleRelogin = () => {
        // Limpar tokens e forçar redirect para o login
        setAdminSessionToken(null);
        localStorage.removeItem('adminToken');
        localStorage.removeItem('fintech_user_session');
        setAuthFailedModal({ show: false, message: '' });
        window.location.href = '/login';
    };

    const handleDismissAuthFailed = () => {
        setAuthFailedModal({ show: false, message: '' });
        setShowRefreshForm(false);
        setRefreshForm({ cpf: '', password: '', loading: false, error: '' });
    };

    const handleRefreshToken = async () => {
        const cpf = refreshForm.cpf.replace(/\D/g, '');
        if (cpf.length !== 11 || !refreshForm.password) {
            setRefreshForm(prev => ({ ...prev, error: 'CPF e senha são obrigatórios.' }));
            return;
        }
        setRefreshForm(prev => ({ ...prev, loading: true, error: '' }));
        try {
            const result = await login(cpf, refreshForm.password);
            if (result.success && result.token) {
                // Salvar novo token
                const isAdmin = result.user?.role === 'admin';
                localStorage.setItem(isAdmin ? 'adminToken' : 'authToken', result.token);
                setAdminSessionToken(result.token);
                // Salvar sessão
                try {
                    localStorage.setItem('fintech_user_session', JSON.stringify(result.user));
                } catch {}
                setAuthFailedModal({ show: false, message: '' });
                setShowRefreshForm(false);
                setRefreshForm({ cpf: '', password: '', loading: false, error: '' });
                // Disparar toast de sucesso
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

    const tabs = [
        { id: 'mass-creator', label: '⚡ Gerador de Massa 2.0', icon: Sparkles },
        { id: 'users', label: 'Usuários', icon: Users },
        { id: 'cards', label: 'Cartões & Massa', icon: CreditCard },
        { id: 'billing', label: 'Faturamento', icon: Receipt },
        { id: 'requests', label: 'Solicitações', icon: FileText },
        { id: 'legacy', label: 'Legado', icon: Shield },
    ] as const;

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
            case 'requests':
                return <RequestsManagement />;
            default:
                return null;
        }
    };

    return (
        <div className={`flex flex-col min-h-full w-full max-w-full px-1 md:px-3 mx-auto ${isMidnight ? 'bg-[#0f0f0f] text-white' : 'bg-volt-yellow text-black'}`}>
            <div className={`flex items-center gap-2 py-1.5 px-3 border-b sticky top-0 z-50 ${isMidnight ? 'border-white/5 bg-[#0f0f0f]' : 'border-black/5 bg-volt-yellow'}`}>
                <button onClick={onClose} className={`p-1 -ml-1 rounded-full transition-colors cursor-pointer ${isMidnight ? 'hover:bg-white/10 text-white' : 'hover:bg-black/10 text-black'}`}>
                    <ArrowLeft size={18} />
                </button>
                <div className="flex items-center gap-2">
                    <Shield size={18} className={isMidnight ? 'text-volt-green' : 'text-black'} />
                    <h1 className="text-sm font-bold">Painel Administrativo</h1>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className={`flex overflow-x-auto no-scrollbar border-b px-2 pt-1 gap-1 ${isMidnight ? 'border-white/10' : 'border-black'}`}>
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as AdminTab)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 whitespace-nowrap font-bold text-xs transition-all ${
                                isActive 
                                    ? (isMidnight ? 'border-b-2 border-volt-green text-volt-green' : 'bg-[#f4f4f5] border-2 border-black border-b-0 rounded-t-lg translate-y-[1px] text-black') 
                                    : (isMidnight ? 'border-transparent text-white/50 hover:text-white' : 'border-transparent text-black/60 hover:text-black')
                            }`}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <main className={`flex-1 overflow-y-auto relative p-1 md:p-2 ${isMidnight ? 'bg-[#0f0f0f]' : 'bg-[#f4f4f5]'}`}>
                {renderContent()}

                {/* TOAST NOTIFICATION */}
                {toast.show && (
                    <div className={`fixed bottom-4 right-4 p-4 rounded-xl text-white font-bold ${toast.type === 'success' ? 'bg-volt-green text-black' : 'bg-red-500'} shadow-lg z-50 animate-fade-in`}>
                        {toast.message}
                    </div>
                )}

                {/* AUTH FAILED MODAL — Token expirado ou acesso negado */}
                {authFailedModal.show && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
                        <div className={`w-full max-w-md p-8 rounded-3xl ${isMidnight ? 'bg-[#1a1a1a] text-white border border-white/10' : 'bg-white text-black border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-3 rounded-full ${isMidnight ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'}`}>
                                    <LogIn size={22} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg">Sessão Expirada</h3>
                                    <p className={`text-xs opacity-70 ${isMidnight ? 'font-medium' : 'font-bold'}`}>Token de administrador inválido ou expirado</p>
                                </div>
                                <button
                                    onClick={handleDismissAuthFailed}
                                    className={`ml-auto p-2 rounded-full transition-colors cursor-pointer ${isMidnight ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <p className={`text-sm mb-2 ${isMidnight ? 'font-medium text-white/80' : 'font-bold text-black/70'}`}>
                                {authFailedModal.message}
                            </p>
                            <p className={`text-xs mb-6 ${isMidnight ? 'text-white/50' : 'text-black/50'}`}>
                                Sua sessão de administrador expirou ou o token não é mais válido.
                                Faça login novamente para continuar usando o painel administrativo.
                            </p>
                            <div className="flex flex-col gap-3">
                                {/* Botão de Refresh Inline */}
                                {!showRefreshForm ? (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleDismissAuthFailed}
                                            className={`flex-1 py-3 px-6 rounded-2xl font-bold transition-all text-xs cursor-pointer ${
                                                isMidnight ? 'border border-white/20 text-white hover:bg-white/5' : 'border-2 border-black/20 text-black hover:bg-black/5'
                                            }`}
                                        >
                                            Fechar
                                        </button>
                                        <button
                                            onClick={() => setShowRefreshForm(true)}
                                            className={`flex-1 py-3 px-6 rounded-2xl font-bold transition-all text-xs cursor-pointer flex items-center justify-center gap-1.5 ${
                                                isMidnight
                                                    ? 'bg-volt-green text-black hover:bg-[#00e38b]'
                                                    : 'bg-volt-lime text-black border-2 border-black hover:bg-volt-lime/80'
                                            }`}
                                        >
                                            <RefreshCw size={14} />
                                            Renovar Token
                                        </button>
                                        <button
                                            onClick={handleRelogin}
                                            className={`flex-1 py-3 px-6 rounded-2xl font-bold transition-all text-xs cursor-pointer ${
                                                isMidnight ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-black text-white hover:bg-zinc-800'
                                            }`}
                                        >
                                            🔐 Login Page
                                        </button>
                                    </div>
                                ) : (
                                    /* Formulário inline de refresh */
                                    <div className="space-y-3">
                                        <p className={`text-xs font-bold ${isMidnight ? 'text-white/70' : 'text-black/60'}`}>
                                            Faça login novamente para renovar o token:
                                        </p>
                                        <input
                                            type="text"
                                            value={refreshForm.cpf}
                                            onChange={e => setRefreshForm(prev => ({ ...prev, cpf: e.target.value.replace(/\D/g, '').slice(0, 11), error: '' }))}
                                            placeholder="CPF do admin"
                                            maxLength={11}
                                            className={`w-full p-3 rounded-xl focus:outline-none transition-all text-sm ${
                                                isMidnight
                                                    ? 'bg-[#0f0f0f] text-white border border-white/10 focus:border-volt-green placeholder-white/30'
                                                    : 'bg-white text-black border-2 border-black focus:border-volt-lime placeholder-black/40'
                                            }`}
                                        />
                                        <input
                                            type="password"
                                            value={refreshForm.password}
                                            onChange={e => setRefreshForm(prev => ({ ...prev, password: e.target.value, error: '' }))}
                                            placeholder="Senha"
                                            className={`w-full p-3 rounded-xl focus:outline-none transition-all text-sm ${
                                                isMidnight
                                                    ? 'bg-[#0f0f0f] text-white border border-white/10 focus:border-volt-green placeholder-white/30'
                                                    : 'bg-white text-black border-2 border-black focus:border-volt-lime placeholder-black/40'
                                            }`}
                                            onKeyDown={e => e.key === 'Enter' && handleRefreshToken()}
                                        />
                                        {refreshForm.error && (
                                            <p className="text-xs text-red-500 font-bold">{refreshForm.error}</p>
                                        )}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => { setShowRefreshForm(false); setRefreshForm({ cpf: '', password: '', loading: false, error: '' }); }}
                                                className={`flex-1 py-3 px-4 rounded-2xl font-bold transition-all text-xs cursor-pointer ${
                                                    isMidnight ? 'border border-white/20 text-white hover:bg-white/5' : 'border-2 border-black/20 text-black hover:bg-black/5'
                                                }`}
                                            >
                                                Voltar
                                            </button>
                                            <button
                                                onClick={handleRefreshToken}
                                                disabled={refreshForm.loading}
                                                className={`flex-1 py-3 px-4 rounded-2xl font-bold transition-all text-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                                                    isMidnight
                                                        ? 'bg-volt-green text-black hover:bg-[#00e38b]'
                                                        : 'bg-black text-white hover:bg-zinc-800'
                                                }`}
                                            >
                                                {refreshForm.loading ? (
                                                    <>
                                                        <RefreshCw size={14} className="animate-spin" />
                                                        Renovando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshCw size={14} />
                                                        Renovar
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;
