import React, { useState, useMemo, useCallback } from 'react';
import { adminGetAllRecurringBills, payRecurringBill, updateRecurringBill, removeRecurringBill } from '../../services/api';
import { useAppState } from '../../contexts/AppStateContext';
import { Repeat, RefreshCw, Loader2, CheckCircle2, Search, Wallet, AlertTriangle, Pencil, Trash2, X, Save } from 'lucide-react';
import { showToast } from '../../utils/toast';
import { formatCPF } from '../../utils/formatters';

type StatusFilter = 'all' | 'active' | 'past_due' | 'suspended' | 'canceled' | 'paid';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'active', label: 'Ativas' },
    { id: 'past_due', label: 'Em atraso' },
    { id: 'suspended', label: 'Suspensas' },
    { id: 'canceled', label: 'Canceladas' },
    { id: 'paid', label: 'Pagas' },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    active: { label: 'Ativa', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/40' },
    past_due: { label: 'Em atraso', cls: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/40' },
    suspended: { label: 'Suspensa', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/40' },
    canceled: { label: 'Cancelada', cls: 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400 border-zinc-500/40' },
    paid: { label: 'Paga', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/40' },
};

const fmtDate = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR');
};

const RecurringBillsManagement: React.FC = () => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    const [bills, setBills] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [payingKey, setPayingKey] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [cpfSearch, setCpfSearch] = useState('');
    const [billPayMethod, setBillPayMethod] = useState<'ACCOUNT_DEBIT' | 'CREDIT_CARD'>('ACCOUNT_DEBIT');

    // ── Editar / Cancelar ──
    const [editingBill, setEditingBill] = useState<any | null>(null);
    const [editForm, setEditForm] = useState({ name: '', amount: '', dueDay: '', category: '' });
    const [savingEdit, setSavingEdit] = useState(false);
    const [cancelTarget, setCancelTarget] = useState<any | null>(null);
    const [cancelling, setCancelling] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminGetAllRecurringBills();
            if (res.success) {
                setBills(res.bills || []);
            } else {
                setBills([]);
                showToast(res.message || 'Erro ao listar contas recorrentes.', 'error');
            }
        } catch (e: any) {
            setBills([]);
            showToast(e.message || 'Erro ao listar contas recorrentes.', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { load(); }, [load]);

    // Filtro client-side: status + CPF (dados completos já carregados — chips com contagem real).
    const filtered = useMemo(() => {
        const digits = cpfSearch.replace(/\D/g, '');
        return bills.filter((b: any) => {
            if (statusFilter !== 'all' && b.status !== statusFilter) return false;
            if (digits && String(b.cpf || '').replace(/\D/g, '') !== digits) return false;
            return true;
        });
    }, [bills, statusFilter, cpfSearch]);

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: bills.length };
        for (const b of bills) c[b.status] = (c[b.status] || 0) + 1;
        return c;
    }, [bills]);

    const totalMonthly = useMemo(() => bills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0), [bills]);
    const totalPastDue = useMemo(() => bills.filter(b => b.status === 'past_due').reduce((s, b) => s + (parseFloat(b.amount) || 0), 0), [bills]);

    const handlePay = async (cpf: string, billId: string) => {
        const key = `${cpf}:${billId}`;
        setPayingKey(key);
        try {
            const res = await payRecurringBill(cpf, billId, { paymentMethod: billPayMethod });
            if (res.success) {
                showToast(res.message || 'Pagamento realizado com sucesso!', 'success');
                load();
            } else {
                showToast(res.message || 'Erro ao pagar conta.', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Erro ao pagar conta.', 'error');
        } finally {
            setPayingKey(null);
        }
    };

    // Abre o modal de edição preenchendo o formulário com os dados atuais da conta
    const openEdit = (b: any) => {
        setEditForm({
            name: String(b.name || ''),
            amount: String(Number(b.amount || 0).toFixed(2)),
            dueDay: String(b.dueDay || ''),
            category: String(b.category || ''),
        });
        setEditingBill(b);
    };

    const handleSaveEdit = async () => {
        if (!editingBill) return;
        const amount = parseFloat(String(editForm.amount).replace(',', '.'));
        if (!editForm.name.trim() || isNaN(amount) || amount <= 0) {
            showToast('Preencha nome e valor válido (maior que zero).', 'error');
            return;
        }
        const dueDay = parseInt(editForm.dueDay, 10);
        if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
            showToast('Dia de vencimento deve ser entre 1 e 31.', 'error');
            return;
        }
        setSavingEdit(true);
        try {
            const res = await updateRecurringBill(editingBill.cpf, editingBill.id, {
                name: editForm.name.trim(),
                amount,
                dueDay,
                category: editForm.category.trim() || undefined,
            });
            if (res.success) {
                showToast(res.message || 'Conta atualizada com sucesso!', 'success');
                setEditingBill(null);
                load();
            } else {
                showToast(res.message || 'Erro ao editar conta.', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Erro ao editar conta.', 'error');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleCancelConfirm = async () => {
        if (!cancelTarget) return;
        setCancelling(true);
        try {
            const res = await removeRecurringBill(cancelTarget.cpf, cancelTarget.id);
            if (res.success) {
                showToast(res.message || 'Conta recorrente removida.', 'success');
                setCancelTarget(null);
                load();
            } else {
                showToast(res.message || 'Erro ao cancelar conta.', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Erro ao cancelar conta.', 'error');
        } finally {
            setCancelling(false);
        }
    };

    const inputClass = isMidnight
        ? 'bg-[#0f0f0f] text-white border border-white/10 focus:border-volt-green placeholder-white/30'
        : 'bg-white text-black border-2 border-black focus:border-volt-lime placeholder-black/40';

    return (
        <div className="w-full space-y-4">
            {/* Header + ações */}
            <div className={`flex flex-wrap items-center gap-2 ${isMidnight ? 'text-white' : 'text-black'}`}>
                <div className="flex items-center gap-2 mr-auto">
                    <div className={`p-2 rounded-xl border ${isMidnight ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-volt-lime border-2 border-black'}`}>
                        <Repeat size={18} />
                    </div>
                    <div>
                        <h3 className="font-black uppercase tracking-wider text-sm">Contas Recorrentes</h3>
                        <p className={`text-[10px] font-bold ${isMidnight ? 'text-white/50' : 'text-black/50'}`}>
                            Todas as massas — {bills.length} conta(s), R$ {totalMonthly.toFixed(2)}/mês
                        </p>
                    </div>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border ${isMidnight ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-black bg-red-100 text-red-600'}`}>
                    <AlertTriangle size={12} />
                    Em atraso: R$ {totalPastDue.toFixed(2)}
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all disabled:opacity-50 cursor-pointer ${
                        isMidnight
                            ? 'bg-white/5 border-white/15 text-white hover:bg-white/10'
                            : 'bg-white border-2 border-black hover:bg-black/5'
                    }`}
                >
                    {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Atualizar
                </button>
            </div>

            {/* Filtros */}
            <div className={`flex flex-wrap items-center gap-1.5 ${isMidnight ? 'text-white' : 'text-black'}`}>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {STATUS_FILTERS.map(f => {
                        const isActive = statusFilter === f.id;
                        const n = counts[f.id] || 0;
                        return (
                            <button
                                key={f.id}
                                onClick={() => setStatusFilter(f.id)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                    isActive
                                        ? isMidnight
                                            ? 'bg-volt-green text-black border-volt-green'
                                            : 'bg-volt-yellow border-2 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                        : isMidnight
                                            ? 'bg-white/5 border-white/15 text-white/60 hover:text-white'
                                            : 'bg-white border border-black/20 text-black/60 hover:text-black'
                                }`}
                            >
                                {f.label} ({n})
                            </button>
                        );
                    })}
                </div>
                <div className="relative ml-auto min-w-[220px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" size={13} />
                    <input
                        type="text"
                        value={cpfSearch}
                        onChange={e => setCpfSearch(e.target.value)}
                        placeholder="Filtrar por CPF..."
                        className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs font-bold outline-none transition-all ${inputClass}`}
                    />
                </div>
            </div>

            {/* Método de pagamento padrão */}
            <div className={`flex items-center gap-2 ${isMidnight ? 'text-white' : 'text-black'}`}>
                <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Método do Pagar:</span>
                <select
                    value={billPayMethod}
                    onChange={e => setBillPayMethod(e.target.value as 'ACCOUNT_DEBIT' | 'CREDIT_CARD')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider outline-none cursor-pointer ${inputClass}`}
                >
                    <option value="ACCOUNT_DEBIT">Débito em Conta</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                </select>
            </div>

            {/* Tabela */}
            {loading && bills.length === 0 ? (
                <div className={`flex items-center justify-center gap-2 py-12 ${isMidnight ? 'text-white/60' : 'text-black/60'}`}>
                    <Loader2 size={18} className="animate-spin" />
                    Carregando contas recorrentes...
                </div>
            ) : filtered.length === 0 ? (
                <div className={`p-8 text-center text-xs font-bold ${isMidnight ? 'text-white/40' : 'text-black/40'}`}>
                    {bills.length === 0 ? 'Nenhuma conta recorrente cadastrada no banco ainda.' : 'Nenhuma conta corresponde ao filtro atual.'}
                </div>
            ) : (
                <div className={`overflow-x-auto rounded-2xl border ${isMidnight ? 'border-white/10' : 'border-black/20'}`}>
                    <table className="w-full text-left text-[11px]">
                        <thead>
                            <tr className={`text-[9px] uppercase tracking-wider ${isMidnight ? 'bg-white/5 text-white/50' : 'bg-black/5 text-black/50'}`}>
                                <th className="px-2.5 py-2 font-black">Cliente</th>
                                <th className="px-2.5 py-2 font-black">Conta</th>
                                <th className="px-2.5 py-2 font-black text-right">Valor</th>
                                <th className="px-2.5 py-2 font-black">Freq.</th>
                                <th className="px-2.5 py-2 font-black">Método</th>
                                <th className="px-2.5 py-2 font-black">Status</th>
                                <th className="px-2.5 py-2 font-black">Próx. cobrança</th>
                                <th className="px-2.5 py-2 font-black">Últ. pagamento</th>
                                <th className="px-2.5 py-2 font-black text-center">Retries</th>
                                <th className="px-2.5 py-2 font-black text-center">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((b: any, i: number) => {
                                const badge = STATUS_BADGE[b.status] || { label: b.status || '—', cls: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 border-zinc-500/40' };
                                const key = `${b.cpf}:${b.id}`;
                                const isPaying = payingKey === key;
                                return (
                                    <tr key={key} className={`border-t ${isMidnight ? 'border-white/5' : 'border-black/10'} ${i % 2 ? (isMidnight ? 'bg-white/[0.02]' : 'bg-black/[0.02]') : ''} ${isMidnight ? 'text-white' : 'text-black'}`}>
                                        <td className="px-2.5 py-2">
                                            <p className="font-bold truncate max-w-[140px]">{b.userFullName || '—'}</p>
                                            <p className="font-mono text-[10px] opacity-50">{formatCPF(b.cpf)}</p>
                                        </td>
                                        <td className="px-2.5 py-2 font-bold max-w-[180px] truncate">{b.name || '—'}</td>
                                        <td className="px-2.5 py-2 text-right font-mono font-black">R$ {Number(b.amount || 0).toFixed(2)}</td>
                                        <td className="px-2.5 py-2">{b.frequency || 'MONTHLY'}</td>
                                        <td className="px-2.5 py-2">{b.paymentMethod || '—'}</td>
                                        <td className="px-2.5 py-2">
                                            <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${badge.cls}`}>
                                                {badge.label}
                                            </span>
                                        </td>
                                        <td className="px-2.5 py-2">{fmtDate(b.nextBillingDate)}</td>
                                        <td className="px-2.5 py-2">{fmtDate(b.paidAt)}</td>
                                        <td className="px-2.5 py-2 text-center font-mono">
                                            {b.retryCount !== undefined && b.retryCount > 0 ? (
                                                <span className={b.retryCount >= (b.maxRetries || 3) ? 'text-red-500 font-black' : ''}>{b.retryCount}/{b.maxRetries || 3}</span>
                                            ) : (
                                                <span className="opacity-40">0</span>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-2">
                                            <div className="flex items-center justify-center gap-1 flex-wrap">
                                                <button
                                                    onClick={() => openEdit(b)}
                                                    disabled={b.status === 'canceled'}
                                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer disabled:opacity-40 ${
                                                        isMidnight
                                                            ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 hover:bg-sky-500/25'
                                                            : 'bg-white border-2 border-black text-black hover:bg-black/5'
                                                    }`}
                                                    title={`Editar ${b.name}`}
                                                >
                                                    <Pencil size={11} />
                                                    Editar
                                                </button>
                                                {b.status !== 'canceled' && (
                                                    <button
                                                        onClick={() => handlePay(b.cpf, b.id)}
                                                        disabled={isPaying}
                                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer disabled:opacity-50 ${
                                                            isMidnight
                                                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                                                                : 'bg-volt-yellow border-2 border-black text-black hover:bg-volt-yellow-pastel shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                                        }`}
                                                        title={`Pagar ${b.name} via ${billPayMethod === 'ACCOUNT_DEBIT' ? 'débito em conta' : 'cartão de crédito'}`}
                                                    >
                                                        {isPaying ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                                                        Pagar
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setCancelTarget(b)}
                                                    disabled={b.status === 'canceled' || isPaying}
                                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer disabled:opacity-40 ${
                                                        isMidnight
                                                            ? 'bg-red-500/15 border-red-500/40 text-red-300 hover:bg-red-500/25'
                                                            : 'bg-white border-2 border-black text-red-600 hover:bg-red-50'
                                                    }`}
                                                    title={`Cancelar ${b.name}`}
                                                >
                                                    <Trash2 size={11} />
                                                    Cancelar
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

            {!loading && bills.length > 0 && (
                <p className={`flex items-center gap-1.5 text-[10px] font-bold ${isMidnight ? 'text-white/40' : 'text-black/40'}`}>
                    <Wallet size={11} />
                    {filtered.length} de {bills.length} conta(s) exibida(s) — Editar (PUT), Pagar (POST .../pay, débito em conta ou cartão) e Cancelar (DELETE), com comprovante no tópico Telegram da massa.
                </p>
            )}

            {/* ── Modal: Editar conta recorrente ── */}
            {editingBill && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
                    <div className={`w-full max-w-md rounded-2xl border p-5 space-y-4 ${isMidnight ? 'bg-[#0f0f0f] border-white/10 text-white' : 'bg-white border-2 border-black text-black'}`}>
                        <div className="flex items-center justify-between">
                            <h4 className="font-black uppercase tracking-wider text-sm flex items-center gap-2">
                                <Pencil size={14} />
                                Editar Conta Recorrente
                            </h4>
                            <button onClick={() => setEditingBill(null)} className={`p-1 rounded-full transition-colors cursor-pointer ${isMidnight ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>
                                <X size={16} />
                            </button>
                        </div>
                        <p className={`text-[10px] font-bold ${isMidnight ? 'text-white/50' : 'text-black/50'}`}>
                            {editingBill.userFullName || 'Cliente'} • {formatCPF(editingBill.cpf)} — {editingBill.name}
                        </p>
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black uppercase tracking-wider opacity-70">Nome</label>
                            <input
                                value={editForm.name}
                                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="Ex.: Assinatura Netflix Mensal"
                                className={`w-full px-3 py-2 rounded-xl text-xs font-bold outline-none transition-all ${inputClass}`}
                            />
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider opacity-70">Valor R$</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={editForm.amount}
                                        onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                                        className={`w-full px-3 py-2 rounded-xl text-xs font-bold outline-none transition-all ${inputClass}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider opacity-70">Dia venc.</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={editForm.dueDay}
                                        onChange={e => setEditForm(f => ({ ...f, dueDay: e.target.value }))}
                                        className={`w-full px-3 py-2 rounded-xl text-xs font-bold outline-none transition-all ${inputClass}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider opacity-70">Categoria</label>
                                    <input
                                        value={editForm.category}
                                        onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                                        placeholder="ex.: cultura"
                                        className={`w-full px-3 py-2 rounded-xl text-xs font-bold outline-none transition-all ${inputClass}`}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={() => setEditingBill(null)}
                                className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                    isMidnight ? 'bg-white/5 border-white/15 text-white/60 hover:text-white' : 'bg-white border-2 border-black text-black/60 hover:text-black'
                                }`}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={savingEdit}
                                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer disabled:opacity-50 ${
                                    isMidnight ? 'bg-volt-green border-volt-green text-black hover:brightness-110' : 'bg-volt-yellow border-2 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-volt-yellow-pastel'
                                }`}
                            >
                                {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Confirmar cancelamento ── */}
            {cancelTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
                    <div className={`w-full max-w-sm rounded-2xl border p-5 space-y-4 ${isMidnight ? 'bg-[#0f0f0f] border-white/10 text-white' : 'bg-white border-2 border-black text-black'}`}>
                        <div className="flex items-center justify-between">
                            <h4 className="font-black uppercase tracking-wider text-sm flex items-center gap-2 text-red-500">
                                <Trash2 size={14} />
                                Cancelar Conta Recorrente
                            </h4>
                            <button onClick={() => setCancelTarget(null)} className={`p-1 rounded-full transition-colors cursor-pointer ${isMidnight ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>
                                <X size={16} />
                            </button>
                        </div>
                        <p className="text-xs font-bold leading-relaxed">
                            Tem certeza que deseja cancelar <span className="text-red-500">{cancelTarget.name}</span>
                            ({formatCPF(cancelTarget.cpf)})? A conta recorrente será removida e deixará de ser cobrada.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCancelTarget(null)}
                                disabled={cancelling}
                                className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer disabled:opacity-50 ${
                                    isMidnight ? 'bg-white/5 border-white/15 text-white/60 hover:text-white' : 'bg-white border-2 border-black text-black/60 hover:text-black'
                                }`}
                            >
                                Voltar
                            </button>
                            <button
                                onClick={handleCancelConfirm}
                                disabled={cancelling}
                                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer disabled:opacity-50 ${
                                    isMidnight ? 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30' : 'bg-red-500 border-2 border-black text-white hover:bg-red-600'
                                }`}
                            >
                                {cancelling ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                Sim, cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecurringBillsManagement;
