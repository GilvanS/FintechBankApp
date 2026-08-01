import React, { useState } from 'react';
import { User } from '../../types';
import { adminGetUserByCpf, adminUpdateBillingDay, adminRunBillingCron, adminCloseInvoice } from '../../services/api';
import { formatCPF } from '../../utils/formatters';
import { useAppState } from '../../contexts/AppStateContext';
import { Search, FileText, Calendar, Loader2, Play, Receipt, AlertCircle, Clock } from 'lucide-react';
import { showToast } from '../../utils/toast';

const BillingManagement: React.FC = () => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    const [cpfSearch, setCpfSearch] = useState('');
    const [searchedUser, setSearchedUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    // Actions State
    const [isUpdating, setIsUpdating] = useState(false);
    const [dueDate, setDueDate] = useState('');
    const [isCronRunning, setIsCronRunning] = useState(false);

    const btnClass = `py-3 px-6 rounded-2xl font-bold transition-all disabled:opacity-50 flex justify-center items-center gap-2 text-sm`;
    const primaryBtnClass = isMidnight ? 'bg-volt-green text-black hover:bg-[#a3ff12]' : 'bg-volt-yellow border-2 border-black text-black font-black uppercase hover:bg-volt-yellow-pastel shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none';
    const outlineBtnClass = isMidnight ? 'border-2 border-volt-green text-volt-green hover:bg-volt-green/10' : 'border-2 border-black text-black hover:bg-black/5';
    const inputClass = isMidnight ? 'bg-[#252525] border border-white/10 text-white placeholder-white/40 focus:border-volt-green' : 'bg-[#f0f0f0] border-2 border-transparent text-black placeholder-black/40 focus:border-black focus:bg-white';
    const cardClass = isMidnight ? 'bg-[#1a1a1a] border border-white/10 text-white' : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black';

    const handleSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!cpfSearch) return;
        setIsLoading(true);
        const result = await adminGetUserByCpf(cpfSearch.replace(/\D/g, ''));
        if (result.success && result.user) {
            setSearchedUser(result.user);
            setDueDate(result.user.billingDay?.toString() || '10');
        } else {
            showToast(result.message || 'Usuário não encontrado.', 'error');
            setSearchedUser(null);
        }
        setIsLoading(false);
    };

    const handleUpdateBillingDay = async () => {
        if (!searchedUser) return;
        setIsUpdating(true);
        const result = await adminUpdateBillingDay(searchedUser.cpf, Number(dueDate));
        if (result.success) {
            showToast('Dia de vencimento atualizado com sucesso', 'success');
            await handleSearch();
        } else {
            showToast(result.message || 'Erro ao atualizar vencimento', 'error');
        }
        setIsUpdating(false);
    };

    const handleCloseInvoice = async () => {
        if (!searchedUser) return;
        setIsUpdating(true);
        const result = await adminCloseInvoice(searchedUser.cpf);
        if (result.success) {
            showToast('Fatura fechada com sucesso!', 'success');
            await handleSearch();
        } else {
            showToast(result.message || 'Erro ao fechar fatura', 'error');
        }
        setIsUpdating(false);
    };

    const handleRunCron = async () => {
        setIsCronRunning(true);
        const result = await adminRunBillingCron();
        if (result.success) {
            showToast('Cron executado com sucesso nas faturas', 'success');
            console.log("Cron Logs:", result.logs);
        } else {
            showToast(result.message || 'Erro ao rodar cron', 'error');
        }
        setIsCronRunning(false);
    };

    return (
        <div className="p-6 w-full mx-auto space-y-6 animate-fade-in pb-24">
            <div className={`p-8 rounded-3xl ${cardClass} mb-6`}>
                <div className="flex items-center justify-between gap-4 mb-8 pb-6 border-b border-black/10 dark:border-white/10">
                    <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-xl ${isMidnight ? 'bg-white/5 text-volt-green' : 'bg-black/5 text-black'}`}>
                            <Receipt size={32} />
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight">Faturamento</h2>
                            <p className="opacity-70 text-sm md:text-base mt-1">Gestão de ciclos, vencimentos e simulação de fechamento.</p>
                        </div>
                    </div>
                    <div>
                        <button 
                            onClick={handleRunCron} 
                            disabled={isCronRunning}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all text-sm
                                ${isMidnight ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/50' : 'bg-red-100 text-red-700 border-2 border-red-700 hover:bg-red-200'}
                            `}
                        >
                            {isCronRunning ? <Loader2 className="animate-spin" size={18} /> : <Clock size={18} />}
                            Forçar Cron Global Diário
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSearch} className="flex flex-col gap-4">
                    <div className="relative w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por CPF (apenas números)"
                            value={formatCPF(cpfSearch)}
                            onChange={(e) => setCpfSearch(e.target.value.replace(/\D/g, '').slice(0, 11))}
                            className={`w-full pl-12 pr-4 py-4 rounded-2xl outline-none text-lg ${inputClass}`}
                        />
                    </div>
                    <button type="submit" disabled={isLoading} className={`py-4 px-8 text-lg ${btnClass} ${primaryBtnClass}`}>
                        {isLoading ? <Loader2 className="animate-spin" size={24} /> : 'Buscar'}
                    </button>
                </form>

                {searchedUser && (
                    <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Bloco de Informações */}
                        <div className="bg-black/5 dark:bg-white/5 p-6 rounded-2xl border border-black/10 dark:border-white/10 space-y-6">
                            <div>
                                <h3 className="font-black text-2xl uppercase tracking-tight">{searchedUser.fullName}</h3>
                                <p className="text-sm font-bold opacity-70 font-mono mt-1">{formatCPF(searchedUser.cpf)}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-black/10 dark:border-white/10">
                                <div>
                                    <p className="text-[10px] opacity-70 font-bold uppercase mb-1">Dia do Vencimento</p>
                                    <p className="text-xl font-bold">Dia {searchedUser.creditCard?.dueDay || searchedUser.billingDay || 10}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] opacity-70 font-bold uppercase mb-1">Fatura Aberta Atual</p>
                                    <p className="text-xl font-bold text-volt-green">
                                        R$ {Number(searchedUser.creditCard?.currentInvoice || 0).toFixed(2).replace('.', ',')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] opacity-70 font-bold uppercase mb-1">Fatura Fechada</p>
                                    <p className="text-xl font-bold text-rose-500">
                                        R$ {Number(searchedUser.creditCard?.closedInvoice || 0).toFixed(2).replace('.', ',')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Bloco de Ações e Configurações */}
                        <div className="space-y-6">
                            {/* Dia Vencimento */}
                            <div className="bg-black/5 dark:bg-white/5 p-5 rounded-2xl border border-black/10 dark:border-white/10">
                                <div className="flex items-center gap-2 mb-4">
                                    <Calendar size={18} className="opacity-70" />
                                    <h3 className="font-bold uppercase text-sm tracking-wider opacity-80">Alterar Vencimento</h3>
                                </div>
                                <div className="flex gap-3">
                                    <select
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className={`flex-1 px-4 py-3 rounded-xl outline-none ${inputClass}`}
                                    >
                                        <option value="5">Dia 5</option>
                                        <option value="10">Dia 10</option>
                                        <option value="15">Dia 15</option>
                                        <option value="20">Dia 20</option>
                                        <option value="25">Dia 25</option>
                                    </select>
                                    <button 
                                        onClick={handleUpdateBillingDay} 
                                        disabled={isUpdating}
                                        className={`${btnClass} ${outlineBtnClass}`}
                                    >
                                        {isUpdating ? <Loader2 className="animate-spin" size={18} /> : 'Salvar'}
                                    </button>
                                </div>
                            </div>

                            {/* Fechamento Fatura */}
                            <div className="bg-black/5 dark:bg-white/5 p-5 rounded-2xl border border-black/10 dark:border-white/10">
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertCircle size={18} className="opacity-70" />
                                    <h3 className="font-bold uppercase text-sm tracking-wider opacity-80">Ações Específicas</h3>
                                </div>
                                <p className="text-xs opacity-70 mb-4">Forçar o fechamento da fatura atual do usuário imediatamente para simular a virada do mês.</p>
                                <button 
                                    onClick={handleCloseInvoice} 
                                    disabled={isUpdating}
                                    className={`w-full ${btnClass} ${outlineBtnClass} !border-orange-500 !text-orange-500 hover:!bg-orange-500/10`}
                                >
                                    {isUpdating ? <Loader2 className="animate-spin" size={18} /> : <><FileText size={18} /> Forçar Fechamento da Fatura</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BillingManagement;
