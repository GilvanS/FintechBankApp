import React, { useEffect, useState } from 'react';
import { adminTelegramStatus, adminTelegramTopics, adminTelegramCreateTopic, adminTelegramDeleteTopic, adminTelegramTest, adminTelegramSendMessage, adminTelegramSettings, adminTelegramUpdateSetting, adminTelegramTestCategory, adminTelegramSendPdf, adminTelegramSendTable, adminTelegramLog, TelegramTopic, TelegramSetting, TelegramLogEntry } from '../../services/api';
import { formatCPF } from '../../utils/formatters';
import { useAppState } from '../../contexts/AppStateContext';
import { Send, RefreshCw, Trash2, MessageSquare, Mail, AlertTriangle, Calendar, Clock, Save, FileText, Table, History, Search } from 'lucide-react';
import { showToast } from '../../utils/toast';

const CATEGORY_LABELS: Record<string, string> = {
    purchase: '🛒 Compras',
    payment: '💸 Pagamentos',
    invoice_close: '✂️ Corte de fatura',
    invoice_pdf: '📄 PDF fatura fechada',
    payment_receipt: '🧾 Comprovante de pagamento',
    boleto_request: '📑 Boleto gerado',
    qrcode_request: '📱 PIX Copia e Cola',
    welcome: '👋 Conta criada',
    system_start: '🚀 Motor diário — início',
    system_done: '✅ Motor diário — concluído',
    system_error: '❌ Erros do motor',
    deposit: '🏦 Depósito recebido',
    notification: '🔔 Notificações',
    daily_anomaly: '⚠️ Anomalia diária'
};

const toLocalInput = (value: string | null): string => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
};

const TelegramManagement: React.FC = () => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    const [status, setStatus] = useState<{ enabled?: boolean; chatId?: string | null; topicCount?: number }>({});
    const [topics, setTopics] = useState<TelegramTopic[]>([]);
    const [settings, setSettings] = useState<TelegramSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyCpf, setBusyCpf] = useState<string | null>(null);
    const [busyCategory, setBusyCategory] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, { valid_from: string; valid_until: string; ttl_minutes: string }>>({});
    const [logEntries, setLogEntries] = useState<TelegramLogEntry[]>([]);
    const [logLoading, setLogLoading] = useState(false);
    const [logCpf, setLogCpf] = useState('');
    const [logCategory, setLogCategory] = useState('');
    const [logLimit, setLogLimit] = useState(30);
    const [logLoaded, setLogLoaded] = useState(false);

    const btnClass = 'h-5 px-2.5 rounded-full font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1 text-[10px] cursor-pointer shrink-0';
    const primaryBtnClass = isMidnight ? 'bg-volt-green text-black hover:bg-[#a3ff12]' : 'bg-volt-yellow border border-black text-black font-black uppercase hover:bg-volt-yellow-pastel shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none';
    const outlineBtnClass = isMidnight ? 'border border-volt-green text-volt-green hover:bg-volt-green/10' : 'border border-black text-black hover:bg-black/5';
    const cardClass = isMidnight ? 'bg-[#1a1a1a] border border-white/10 text-white' : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-black';
    const inputClass = isMidnight ? 'bg-[#0f0f0f] border border-white/20 text-white rounded-md px-1.5 py-0.5 text-[10px] w-32 text-center' : 'bg-white border border-black/40 rounded-md px-1.5 py-0.5 text-[10px] font-bold w-32 text-center';

    const load = async () => {
        setLoading(true);
        try {
            const [s, t, cfg] = await Promise.all([adminTelegramStatus(), adminTelegramTopics(), adminTelegramSettings()]);
            if (s && s.enabled !== undefined) setStatus({ enabled: s.enabled, chatId: s.chatId, topicCount: s.topicCount });
            setTopics(Array.isArray(t) ? t : (t?.topics || []));
            const settingsList = Array.isArray(cfg) ? cfg : (cfg?.settings || []);
            setSettings(settingsList);
            const d: Record<string, { valid_from: string; valid_until: string; ttl_minutes: string }> = {};
            for (const st of settingsList) {
                const vFrom = st.valid_from ? toLocalInput(st.valid_from) : '2026-08-06T00:00';
                const vUntil = st.valid_until ? toLocalInput(st.valid_until) : '2099-01-01T23:59';
                d[st.category] = {
                    valid_from: vFrom,
                    valid_until: vUntil,
                    ttl_minutes: st.ttl_minutes != null ? String(st.ttl_minutes) : ''
                };
            }
            setDrafts(d);
        } catch (err: any) {
            showToast('Erro ao carregar dados do Telegram: ' + (err.message || err), 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const loadLog = async () => {
        setLogLoading(true);
        try {
            const entries = await adminTelegramLog({
                cpf: logCpf || undefined,
                category: logCategory || undefined,
                limit: logLimit,
            });
            setLogEntries(entries);
            setLogLoaded(true);
        } catch (err: any) {
            showToast('Erro ao carregar histórico: ' + (err.message || err), 'error');
        } finally {
            setLogLoading(false);
        }
    };

    const formatLogDate = (value: string) => {
        const d = new Date(value);
        if (isNaN(d.getTime())) return value || '—';
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const handleToggle = async (setting: TelegramSetting) => {
        const next = !setting.enabled;
        setBusyCategory(setting.category);
        const result = await adminTelegramUpdateSetting(setting.category, { enabled: next });
        setBusyCategory(null);
        if (result.success) {
            showToast(`Categoria ${CATEGORY_LABELS[setting.category] || setting.category} ${next ? 'ativada' : 'desativada'}`, 'success');
            load();
        } else {
            showToast(result.message || 'Erro ao alterar toggle', 'error');
        }
    };

    const handleDraftChange = (category: string, field: 'valid_from' | 'valid_until' | 'ttl_minutes', val: string) => {
        setDrafts(prev => ({
            ...prev,
            [category]: {
                ...(prev[category] || { valid_from: '2026-08-06T00:00', valid_until: '2099-01-01T23:59', ttl_minutes: '' }),
                [field]: val
            }
        }));
    };

    const handleSaveParams = async (category: string) => {
        const d = drafts[category];
        if (!d) return;
        setBusyCategory(category);
        const payload: Partial<TelegramSetting> = {
            valid_from: d.valid_from ? new Date(d.valid_from).toISOString() : null,
            valid_until: d.valid_until ? new Date(d.valid_until).toISOString() : null,
            ttl_minutes: d.ttl_minutes ? parseInt(d.ttl_minutes, 10) : null
        };
        const result = await adminTelegramUpdateSetting(category, payload);
        setBusyCategory(null);
        if (result.success) {
            showToast('Parâmetros salvos com sucesso', 'success');
            load();
        } else {
            showToast(result.message || 'Erro ao salvar parâmetros', 'error');
        }
    };

    const handleTestCategory = async (category: string) => {
        setBusyCategory(category);
        const result = await adminTelegramTestCategory(category);
        setBusyCategory(null);
        if (result.success) {
            showToast('Envio de teste disparado com sucesso', 'success');
        } else {
            showToast(result.message || 'Erro no envio de teste', 'error');
        }
    };

    const handleTestGeneral = async () => {
        setLoading(true);
        const result = await adminTelegramTest();
        setLoading(false);
        if (result.success) showToast('Mensagem de teste enviada!', 'success');
        else showToast(result.message || 'Erro no teste', 'error');
    };

    const handleDeleteTopic = async (cpf: string) => {
        if (!confirm('Deseja realmente remover o registro do tópico deste CPF?')) return;
        setBusyCpf(cpf);
        const result = await adminTelegramDeleteTopic(cpf);
        setBusyCpf(null);
        if (result.success) {
            showToast('Tópico removido', 'success');
            load();
        } else {
            showToast(result.message || 'Erro ao remover tópico', 'error');
        }
    };

    const handleSendPdf = async (cpf: string, type: 'open' | 'closed') => {
        setBusyCpf(cpf);
        const result = await adminTelegramSendPdf(cpf, type);
        setBusyCpf(null);
        if (result.success) {
            showToast(`PDF de fatura (${type === 'open' ? 'Aberta' : 'Fechada'}) enviado ao tópico!`, 'success');
        } else {
            showToast(result.message || 'Erro ao enviar PDF', 'error');
        }
    };

    const handleSendTable = async (cpf: string, fullName: string | undefined, topicId: number) => {
        setBusyCpf(cpf);
        const result = await adminTelegramSendTable(cpf, {
            title: 'Resumo do Tópico',
            headers: ['Campo', 'Valor'],
            rows: [
                ['CPF', formatCPF(cpf)],
                ['Nome', fullName || '—'],
                ['Tópico', '#' + topicId],
            ],
        });
        setBusyCpf(null);
        if (result.success) {
            showToast('Resumo em tabela ASCII enviado ao tópico!', 'success');
        } else {
            showToast(result.message || 'Erro ao enviar tabela ASCII', 'error');
        }
    };

    const safeSettings = settings || [];
    const safeTopics = topics || [];

    return (
        <div className="space-y-4">
            {/* Cabeçalho superior */}
            <div className={`p-4 rounded-2xl ${cardClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <Send className="text-volt-green" size={20} />
                            <h2 className="font-black uppercase text-base">Gerenciamento do Telegram</h2>
                        </div>
                        <p className="text-[11px] opacity-70">Gerencie regras de notificação, validade de datas, TTL e tópicos do Telegram.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={load} disabled={loading} className={`${outlineBtnClass} py-1.5 px-3 h-auto text-xs`}>
                            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
                        </button>
                        <button onClick={handleTestGeneral} disabled={loading} className={`${primaryBtnClass} py-1.5 px-3 h-auto text-xs`}>
                            <Mail size={12} /> Teste Geral
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabela Excel de Toggles e Parâmetros */}
            <div className={`p-4 rounded-2xl ${cardClass}`}>
                <h3 className="font-black uppercase text-xs mb-3">Toggles e Parâmetros por Categoria</h3>
                {loading ? (
                    <p className="text-xs opacity-60">Carregando categorias...</p>
                ) : safeSettings.length === 0 ? (
                    <p className="text-xs opacity-60">Nenhuma categoria encontrada. Verifique se o seed do banco foi executado.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className={`text-[11px] uppercase font-bold border-b ${isMidnight ? 'text-white/60 border-white/10' : 'text-black/60 border-black/10'}`}>
                                    <th className="text-center py-2 px-2 w-12">Status</th>
                                    <th className="text-left py-2 px-3">Categoria</th>
                                    <th className="text-center py-2 px-3 w-40">Válido De</th>
                                    <th className="text-center py-2 px-3 w-40">Válido Até</th>
                                    <th className="text-center py-2 px-2 w-20">TTL (m)</th>
                                    <th className="text-center py-2 px-3 w-40">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {safeSettings.map(s => {
                                    const on = Boolean(s.enabled);
                                    const d = drafts[s.category] || { valid_from: '2026-08-06T00:00', valid_until: '2099-01-01T23:59', ttl_minutes: '' };
                                    const busy = busyCategory === s.category;
                                    return (
                                        <tr key={s.category} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                            <td className="py-2 px-2 text-center align-middle">
                                                <button
                                                    onClick={() => handleToggle(s)}
                                                    disabled={busy}
                                                    title={on ? 'Desativar' : 'Ativar'}
                                                    className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer inline-block align-middle ${on ? 'bg-volt-green' : 'bg-gray-400'}`}
                                                >
                                                    <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-black transition-transform ${on ? 'translate-x-3.5' : ''}`} />
                                                </button>
                                            </td>

                                            <td className="py-2 px-3 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-xs whitespace-nowrap">{CATEGORY_LABELS[s.category] || s.category}</span>
                                                    <span className="text-[10px] opacity-50 font-mono">({s.category})</span>
                                                    <span className={`px-1.5 py-0.2 text-[9px] font-black rounded uppercase ${on ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                                        {on ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="py-2 px-3 text-center align-middle">
                                                <input
                                                    type="datetime-local"
                                                    value={d.valid_from}
                                                    onChange={e => handleDraftChange(s.category, 'valid_from', e.target.value)}
                                                    className={inputClass}
                                                />
                                            </td>

                                            <td className="py-2 px-3 text-center align-middle">
                                                <input
                                                    type="datetime-local"
                                                    value={d.valid_until}
                                                    onChange={e => handleDraftChange(s.category, 'valid_until', e.target.value)}
                                                    className={inputClass}
                                                />
                                            </td>

                                            <td className="py-2 px-2 text-center align-middle">
                                                <input
                                                    type="number"
                                                    placeholder="—"
                                                    value={d.ttl_minutes}
                                                    onChange={e => handleDraftChange(s.category, 'ttl_minutes', e.target.value)}
                                                    className="w-14 bg-transparent border border-black/30 dark:border-white/20 rounded-md px-1.5 py-0.5 text-[10px] text-center"
                                                />
                                            </td>

                                            <td className="py-2 px-3 text-center align-middle">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button onClick={() => handleTestCategory(s.category)} disabled={busy} className={`${outlineBtnClass} ${btnClass}`}>
                                                        Testar
                                                    </button>
                                                    <button onClick={() => handleSaveParams(s.category)} disabled={busy} className={`${primaryBtnClass} ${btnClass}`}>
                                                        <Save size={10} /> Salvar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Tópicos Registrados por CPF + Envio manual de PDF / ASCII */}
            <div className={`p-4 rounded-2xl ${cardClass}`}>
                <h3 className="font-black uppercase text-xs mb-3">Tópicos Registrados por CPF</h3>
                {loading ? (
                    <p className="text-xs opacity-60">Carregando tópicos...</p>
                ) : safeTopics.length === 0 ? (
                    <p className="text-xs opacity-60">Nenhum tópico registrado ainda.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className={isMidnight ? 'text-white/60' : 'text-black/60'}>
                                    <th className="text-left py-1.5 font-bold">CPF</th>
                                    <th className="text-left py-1.5 font-bold">Nome</th>
                                    <th className="text-left py-2 font-bold">Tópico ID</th>
                                    <th className="text-right py-1.5 font-bold">Ações no Tópico</th>
                                </tr>
                            </thead>
                            <tbody>
                                {safeTopics.map(t => {
                                    const busy = busyCpf === t.cpf;
                                    return (
                                        <tr key={t.cpf} className={isMidnight ? 'border-t border-white/10' : 'border-t border-black/10'}>
                                            <td className="py-2 font-mono">{formatCPF(t.cpf)}</td>
                                            <td className="py-2">{t.fullName || '—'}</td>
                                            <td className="py-2 font-mono">#{t.topicId}</td>
                                            <td className="py-2 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleSendPdf(t.cpf, 'closed')}
                                                        disabled={busy}
                                                        title="Enviar PDF da fatura ao tópico do Telegram"
                                                        className={`${outlineBtnClass} py-0.5 px-2 text-[10px] text-blue-500 border-blue-500 hover:bg-blue-500/10 flex items-center gap-1`}
                                                    >
                                                        <FileText size={12} /> PDF Fatura
                                                    </button>
                                                    <button
                                                        onClick={() => handleSendTable(t.cpf, t.fullName, t.topicId)}
                                                        disabled={busy}
                                                        title="Enviar Resumo ASCII em tabela ao tópico do Telegram"
                                                        className={`${outlineBtnClass} py-0.5 px-2 text-[10px] text-purple-500 border-purple-500 hover:bg-purple-500/10 flex items-center gap-1`}
                                                    >
                                                        <Table size={12} /> Resumo ASCII
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteTopic(t.cpf)}
                                                        disabled={busy}
                                                        className="text-red-500 hover:underline text-[11px] ml-2"
                                                    >
                                                        Remover
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Histórico Persistente de Envios (telegram_message_log) */}
            <div className={`p-4 rounded-2xl ${cardClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <History className="text-volt-green" size={16} />
                            <h3 className="font-black uppercase text-xs">Histórico de Envios (Log Persistente)</h3>
                        </div>
                        <p className="text-[10px] opacity-60 mt-0.5">Registro durável de mensagens enviadas por massa — sobrevive a restart (rota GET /admin/telegram/log).</p>
                    </div>
                    <button onClick={loadLog} disabled={logLoading} className={`${outlineBtnClass} py-1.5 px-3 h-auto text-xs`}>
                        <RefreshCw size={12} className={logLoading ? 'animate-spin' : ''} /> {logLoading ? 'Carregando...' : 'Carregar Histórico'}
                    </button>
                </div>

                <div className="flex flex-wrap items-end gap-3 mb-3">
                    <div>
                        <label className="block text-[10px] font-bold uppercase opacity-60 mb-1">CPF da Massa</label>
                        <input
                            value={logCpf}
                            onChange={e => setLogCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                            placeholder="Somente números"
                            className={`${inputClass} w-40 text-left`}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase opacity-60 mb-1">Categoria</label>
                        <select
                            value={logCategory}
                            onChange={e => setLogCategory(e.target.value)}
                            className={`${inputClass} w-40 text-left`}
                        >
                            <option value="">Todas</option>
                            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                                <option key={cat} value={cat}>{label} ({cat})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase opacity-60 mb-1">Limite</label>
                        <select value={logLimit} onChange={e => setLogLimit(Number(e.target.value))} className={`${inputClass} w-20`}>
                            <option value={20}>20</option>
                            <option value={30}>30</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                    <button onClick={loadLog} className={`${primaryBtnClass} py-1.5 px-3 h-auto text-xs flex items-center gap-1`}>
                        <Search size={12} /> Filtrar
                    </button>
                </div>

                {logLoading ? (
                    <p className="text-xs opacity-60">Carregando histórico...</p>
                ) : !logLoaded ? (
                    <p className="text-xs opacity-60">Clique em "Carregar Histórico" para consultar o log persistente de envios.</p>
                ) : logEntries.length === 0 ? (
                    <p className="text-xs opacity-60">Nenhum envio registrado com os filtros informados.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className={isMidnight ? 'text-white/60' : 'text-black/60'}>
                                    <th className="text-left py-1.5 font-bold">Data/Hora</th>
                                    <th className="text-left py-1.5 font-bold">CPF</th>
                                    <th className="text-left py-1.5 font-bold">Categoria</th>
                                    <th className="text-left py-1.5 font-bold">Destino</th>
                                    <th className="text-left py-1.5 font-bold">Tipo</th>
                                    <th className="text-left py-1.5 font-bold">Msg ID</th>
                                    <th className="text-center py-1.5 font-bold">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logEntries.map(e => (
                                    <tr key={e.id} className={isMidnight ? 'border-t border-white/10' : 'border-t border-black/10'}>
                                        <td className="py-2 font-mono whitespace-nowrap">{formatLogDate(e.created_at)}</td>
                                        <td className="py-2 font-mono">{formatCPF(e.cpf)}</td>
                                        <td className="py-2">{CATEGORY_LABELS[e.category] || e.category}</td>
                                        <td className="py-2">{e.destination}</td>
                                        <td className="py-2 font-mono">{e.message_type}</td>
                                        <td className="py-2 font-mono">{e.message_id ? '#' + e.message_id : '—'}</td>
                                        <td className="py-2 text-center">
                                            {e.ok ? (
                                                <span className="px-1.5 py-0.2 text-[9px] font-black rounded uppercase bg-green-500/20 text-green-400">✓ OK</span>
                                            ) : (
                                                <span title={e.error || ''} className="px-1.5 py-0.2 text-[9px] font-black rounded uppercase bg-red-500/20 text-red-400">✗ Erro</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TelegramManagement;