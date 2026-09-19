import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, Users, CreditCard, Receipt, FileText, LogIn, RefreshCw, Repeat, Send, ShieldCheck, Activity, Timer, Palette, Moon, Sun, Sparkles, X, Wrench, ClipboardList, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import MatrixDotLoader from '../shared/MatrixDotLoader';
import GridRevealBackdrop from '../shared/GridRevealBackdrop';
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
    { key: 'mass-creator', label: 'Gerador de Massa 4.0', icon: Sparkles, group: 'Gerador 4.0' },
    { key: 'audit', label: 'Auditoria', icon: ShieldCheck, group: 'Auditoria & Sistema' },
    { key: 'vitrine', label: 'Vitrine', icon: Timer, group: 'Auditoria & Sistema' },
    { key: 'telegram', label: 'Telegram', icon: Send, group: 'Auditoria & Sistema' },
    { key: 'scripts', label: 'Scripts & Massas', icon: Wrench, group: 'Auditoria & Sistema' },
    { key: 'test-planning', label: 'Planejamento de Testes', icon: ClipboardList, group: 'Testes' },
    { key: 'legacy', label: 'Painel Legado', icon: Shield, group: 'Legado' },
];

const ADMIN_BACKDROP_KEY = 'admin-backdrop-settings';

// Dimensão máxima no lado maior — o fundo é textura; 1600px cobre qualquer tela
// sem estourar o localStorage (JPEG ~0.8 fica na casa de 200–500KB).
const BACKDROP_MAX_DIM = 1600;

const AdminAllureView: React.FC<AdminAllureViewProps> = ({ onClose, initialSearchCpf }) => {
    const { theme, adminDefaultTheme, setAdminDefaultTheme } = useAppState();
    const isMidnight = theme === 'midnight';
    const [activeSection, setActiveSection] = useState<AdminSectionKey>('users');
    const [legacySearchCpf, setLegacySearchCpf] = useState<string | null>(initialSearchCpf ?? null);
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
    const [authFailedModal, setAuthFailedModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
    const [refreshForm, setRefreshForm] = useState({ cpf: '', password: '', loading: false, error: '' });
    const [showRefreshForm, setShowRefreshForm] = useState(false);

    // Fundo GridReveal: imagem (dataURL do upload ou caminho/URL) + opacidade —
    // persistidos no localStorage para sobreviver a reload e sessões novas.
    const [backdrop, setBackdrop] = useState<{ src: string | null; opacity: number; ditherCellSize: number }>(() => {
        try {
            const saved = localStorage.getItem(ADMIN_BACKDROP_KEY);
            if (saved) return { ditherCellSize: 8, ...JSON.parse(saved) };
        } catch { /* ignora — cai no padrão */ }
        return { src: '/FintechBankApp/img/admin-backdrop.jpg', opacity: 0.15, ditherCellSize: 8 };
    });
    const [showBackdropModal, setShowBackdropModal] = useState(false);
    const [backdropUrlInput, setBackdropUrlInput] = useState('');

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

    // Persiste o fundo a cada mudança (localStorage sobrevive a reload/sessão).
    useEffect(() => {
        try {
            localStorage.setItem(ADMIN_BACKDROP_KEY, JSON.stringify({
                src: backdrop.src, opacity: backdrop.opacity, ditherCellSize: backdrop.ditherCellSize
            }));
        } catch {
            // Quota estourada (imagem grande demais) — remove só a imagem, mantém o resto.
            try {
                localStorage.setItem(ADMIN_BACKDROP_KEY, JSON.stringify({ src: null, opacity: backdrop.opacity, ditherCellSize: backdrop.ditherCellSize }));
            } catch { /* localStorage indisponível — segue sem persistir */ }
        }
    }, [backdrop]);

    // Upload: lê o arquivo, redimensiona para ≤1600px no lado maior e re-encoda em JPEG
    // (~0.8) antes de virar dataURL — evita estourar a cota do localStorage (5MB).
    const handleBackdropFile = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, BACKDROP_MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
                const w = Math.max(1, Math.round(img.naturalWidth * scale));
                const h = Math.max(1, Math.round(img.naturalHeight * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setBackdrop((prev) => ({ ...prev, src: dataUrl }));
                setShowBackdropModal(false);
                setBackdropUrlInput('');
                window.dispatchEvent(new CustomEvent('app-toast', {
                    detail: { message: '🖼️ Fundo atualizado!', type: 'success' }
                }));
            };
            img.onerror = () => {
                window.dispatchEvent(new CustomEvent('app-toast', {
                    detail: { message: '❌ Arquivo de imagem inválido.', type: 'error' }
                }));
            };
            img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
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
                // `compact`: o shell já exibe título e a seção ativa — o gerador mostra só a barra de ações.
                return <MainMassCreatorFlow compact onSuccess={() => setActiveSection('users')} onCancel={() => setActiveSection('users')} />;
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

    // Acento do header: Matrix dot loader (Transitions.dev) no lugar do ASCII estático.
    // Cores seguem o tema — verde-on-dark no midnight (como na referência) e preto no yellow,
    // já que o cinza padrão do loader desapareceria no fundo claro.
    const matrixAccent = (
        <span
            className="hidden sm:flex items-center"
            style={
                isMidnight
                    ? { ['--matrix-base' as string]: 'rgba(255,255,255,0.12)', ['--matrix-active' as string]: '#00ff9d' }
                    : { ['--matrix-base' as string]: 'rgba(0,0,0,0.15)', ['--matrix-active' as string]: '#000000' }
            }
        >
            <MatrixDotLoader variant="scan" scale={1.5} />
        </span>
    );

    // Uma única linha de ações no cabeçalho: tema padrão (segmentado compacto) + Monitor ao vivo.
    // O card "Tema Padrão do Sistema" foi absorvido aqui para não gastar uma faixa inteira.
    const themeSegmentBase = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer';
    const themeSegmentIdle = isMidnight ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-black/60 hover:text-black hover:bg-black/5';
    const headerActions = (
        <div className="flex items-center gap-2">
            <div
                role="group"
                aria-label="Tema padrão do sistema (novos acessos)"
                title="Tema padrão do sistema — define o tema de novos acessos no app"
                className={`flex items-center gap-1 p-1 rounded-2xl ${
                    isMidnight ? 'bg-white/5 border border-white/10' : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                }`}
            >
                <span className={`pl-1.5 pr-0.5 ${isMidnight ? 'text-volt-green' : 'text-black'}`} aria-hidden>
                    <Palette size={14} />
                </span>
                <button
                    type="button"
                    onClick={() => setAdminDefaultTheme('yellow')}
                    data-testid="admin-theme-yellow-btn"
                    aria-pressed={adminDefaultTheme === 'yellow'}
                    className={`${themeSegmentBase} ${adminDefaultTheme === 'yellow' ? 'bg-yellow-400 text-black border border-black shadow-sm' : themeSegmentIdle}`}
                >
                    <Sun size={13} /> <span className="hidden md:inline">Normal</span>
                </button>
                <button
                    type="button"
                    onClick={() => setAdminDefaultTheme('midnight')}
                    data-testid="admin-theme-midnight-btn"
                    aria-pressed={adminDefaultTheme === 'midnight'}
                    className={`${themeSegmentBase} ${adminDefaultTheme === 'midnight' ? 'bg-volt-green text-black border border-black shadow-sm' : themeSegmentIdle}`}
                >
                    <Moon size={13} /> <span className="hidden md:inline">Dark</span>
                </button>
            </div>

            <button
                type="button"
                onClick={() => setShowBackdropModal(true)}
                title="Escolher imagem de fundo do painel e ajustar visibilidade"
                aria-label="Configurar fundo do painel"
                className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl font-bold text-sm transition-all ${
                    isMidnight
                        ? 'bg-white/5 border border-white/10 text-on-surface hover:bg-white/10'
                        : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 text-black active:translate-y-0.5 active:shadow-none'
                }`}
            >
                <ImageIcon size={16} /> <span className="hidden md:inline">Fundo</span>
                {backdrop.src && <span className="w-1.5 h-1.5 rounded-full bg-volt-green shrink-0" aria-hidden />}
            </button>

            <button
                onClick={() => window.open('/FintechBankApp/monitor', 'volt-monitor', 'width=520,height=900')}
                title="Acompanhar eventos em tempo real numa janela ao lado"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all ${
                    isMidnight
                        ? 'bg-volt-green/15 hover:bg-volt-green/25 text-volt-green'
                        : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 text-black active:translate-y-0.5 active:shadow-none'
                }`}
            >
                <Activity size={16} /> <span className="hidden sm:inline">Monitor ao vivo</span>
            </button>
        </div>
    );

    // Fundo animado (GridReveal do Transitions.dev): mosaico que se divide e revela a foto
    // de base — escolhida pelo admin (upload ou caminho) e persistida no navegador.
    // Sem imagem válida, o mosaico roda sozinho em cinzas. Fica atrás de tudo, sem cliques.
    return (
        <>
            <GridRevealBackdrop src={backdrop.src} opacity={backdrop.opacity} dither ditherCellSize={backdrop.ditherCellSize} ditherColor="#00ff9d" />
            <AllureShell<AdminSectionKey>
                title="Painel Administrativo"
                subtitle="Gestão central do FintechBankApp"
                theme={theme}
                onBack={onClose}
                sections={SECTIONS}
                activeSection={activeSection}
                onSelectSection={setActiveSection}
                headerActions={headerActions}
                headerAccent={matrixAccent}
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

            {showBackdropModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    onClick={() => setShowBackdropModal(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className={`w-full max-w-md p-6 rounded-3xl ${isMidnight ? 'bg-[#1a1a1a] border border-white/10 text-white' : 'bg-white border-2 border-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}`}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 font-black uppercase text-sm">
                                <ImageIcon size={18} />
                                Fundo do Painel
                            </div>
                            <button onClick={() => setShowBackdropModal(false)} className="p-1 opacity-60 hover:opacity-100" aria-label="Fechar">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Upload + caminho/URL */}
                        <div className="space-y-3">
                            <label
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const file = e.dataTransfer.files?.[0];
                                    if (file) handleBackdropFile(file);
                                }}
                                className={`flex flex-col items-center justify-center gap-1.5 p-5 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${
                                    isMidnight ? 'border-white/20 hover:border-volt-green/50 bg-white/5' : 'border-black/30 hover:border-black bg-gray-50'
                                }`}
                            >
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    data-testid="admin-backdrop-upload"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleBackdropFile(file);
                                    }}
                                />
                                <ImageIcon size={22} className="opacity-60" />
                                <span className="text-xs font-bold">Enviar imagem</span>
                                <span className="text-[10px] opacity-60">clique ou arraste — JPG/PNG (redimensionada p/ ≤1600px, salva no navegador)</span>
                            </label>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={backdropUrlInput}
                                    onChange={(e) => setBackdropUrlInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && backdropUrlInput.trim()) {
                                            setBackdrop((prev) => ({ ...prev, src: backdropUrlInput.trim() }));
                                            setShowBackdropModal(false);
                                            setBackdropUrlInput('');
                                        }
                                    }}
                                    placeholder="ou cole um caminho/URL da imagem…"
                                    className={`flex-1 p-2.5 rounded-xl text-xs ${isMidnight ? 'bg-[#0f0f0f] border border-white/20' : 'bg-gray-100 border-2 border-black'}`}
                                />
                                <button
                                    type="button"
                                    disabled={!backdropUrlInput.trim()}
                                    onClick={() => {
                                        setBackdrop((prev) => ({ ...prev, src: backdropUrlInput.trim() }));
                                        setShowBackdropModal(false);
                                        setBackdropUrlInput('');
                                    }}
                                    className={`px-4 rounded-xl text-xs font-black disabled:opacity-40 cursor-pointer ${isMidnight ? 'bg-volt-green text-black' : 'bg-volt-yellow border-2 border-black text-black'}`}
                                >
                                    Usar
                                </button>
                            </div>
                            <p className="text-[10px] opacity-50 leading-snug">
                                Arquivo local da pasta public → use o caminho completo: <span className="font-mono">/FintechBankApp/img/seu-arquivo.jpg</span>
                            </p>

                            {/* Opacidade */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[11px] font-bold">Visibilidade do fundo</label>
                                    <span className="text-[10px] font-mono opacity-60">{Math.round(backdrop.opacity * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={60}
                                    step={1}
                                    value={Math.round(backdrop.opacity * 100)}
                                    onChange={(e) => setBackdrop((prev) => ({ ...prev, opacity: Number(e.target.value) / 100 }))}
                                    className="w-full cursor-pointer accent-volt-green"
                                    data-testid="admin-backdrop-opacity"
                                    aria-label="Opacidade do fundo"
                                />
                                <div className="flex justify-between text-[9px] opacity-50">
                                    <span>sutil</span><span>vibrante</span>
                                </div>
                            </div>

                            {/* Tamanho dos quadrados/pixels do dither ASCII */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[11px] font-bold">Tamanho dos quadrados (dither)</label>
                                    <span className="text-[10px] font-mono opacity-60">{backdrop.ditherCellSize}px</span>
                                </div>
                                <input
                                    type="range"
                                    min={3}
                                    max={24}
                                    step={1}
                                    value={backdrop.ditherCellSize}
                                    onChange={(e) => setBackdrop((prev) => ({ ...prev, ditherCellSize: Number(e.target.value) }))}
                                    className="w-full cursor-pointer accent-volt-green"
                                    data-testid="admin-backdrop-dither-cell-size"
                                    aria-label="Tamanho dos quadrados do dither"
                                />
                                <div className="flex justify-between text-[9px] opacity-50">
                                    <span>denso</span><span>pixelado</span>
                                </div>
                            </div>

                            {/* Preview + reset */}
                            <div className="flex items-center gap-3 pt-1">
                                <div className={`flex-1 h-14 rounded-xl overflow-hidden ${isMidnight ? 'bg-black/40' : 'bg-black/10'}`}>
                                    {backdrop.src && (
                                        <img
                                            src={backdrop.src}
                                            alt="Prévia do fundo"
                                            className="w-full h-full object-cover"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setBackdrop((prev) => ({ ...prev, src: null }))}
                                    disabled={!backdrop.src}
                                    className={`px-3 py-2.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer ${
                                        isMidnight ? 'bg-white/5 border border-white/10 hover:bg-white/10' : 'bg-gray-100 border-2 border-black hover:bg-gray-200'
                                    }`}
                                >
                                    <RotateCcw size={13} /> Sem imagem
                                </button>
                            </div>
                        </div>
                    </div>
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
