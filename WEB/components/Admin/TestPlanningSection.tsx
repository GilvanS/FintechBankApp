import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { ClipboardList, AlertCircle, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { useToast, ToastContainer } from '../Toast';
import { formatCPF } from '../../utils/formatters';
import AdminPanel from './common/AdminPanel';
import StatusPill from './common/StatusPill';
import SearchInput from './common/SearchInput';
import {
    getTestPlanningData,
    saveTestPlanningAssignment,
    type TestPlanningCenario,
    type TestPlanningMassa,
} from '../../services/api';

// Mesmas regras de API/utils/testPlanningRules.cjs, replicadas aqui só pra
// feedback visual imediato no cliente — a validação de verdade (o que é
// persistido) sempre roda de novo no backend antes de salvar.
const REGRAS_POR_CENARIO: Record<string, (massa: TestPlanningMassa) => boolean> = {
    'CT03.1': (massa) => Number(massa.fatura_aberta) > 0,
    'CT03.2': (massa) => Number(massa.fatura_fechada) > 0,
    'CT03.3': (massa) => Number(massa.fatura_fechada) > 0,
};

function validarMassaParaCenario(idCenario: string, massa: TestPlanningMassa): { valido: boolean; motivo: string | null } {
    const regra = REGRAS_POR_CENARIO[idCenario];
    if (!regra) return { valido: true, motivo: null };
    const valido = regra(massa);
    return { valido, motivo: valido ? null : `Essa massa não atende ao pré-requisito do cenário ${idCenario}.` };
}

const formatBRL = (value: number | undefined): string => (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TestPlanningSection: React.FC = () => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const { toast, showSuccess, showError, hide } = useToast();

    const [loading, setLoading] = useState(true);
    const [cenarios, setCenarios] = useState<TestPlanningCenario[]>([]);
    const [massas, setMassas] = useState<TestPlanningMassa[]>([]);
    const [cenarioSelecionado, setCenarioSelecionado] = useState<string | null>(null);
    const [massaSelecionada, setMassaSelecionada] = useState<TestPlanningMassa | null>(null);
    const [salvando, setSalvando] = useState(false);

    const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'adimplente' | 'inadimplente'>('TODOS');
    const [filtroFaturaFechada, setFiltroFaturaFechada] = useState(false);
    const [filtroFaturaAberta, setFiltroFaturaAberta] = useState(false);
    const [busca, setBusca] = useState('');
    const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({ adimplente: true, inadimplente: true });

    useEffect(() => {
        carregarDados();
    }, []);

    const carregarDados = async () => {
        setLoading(true);
        const res = await getTestPlanningData();
        if (res.success && res.data) {
            setCenarios(res.data.cenarios);
            setMassas(res.data.massas);
        } else {
            showError(res.message || 'Erro ao carregar planejamento de testes.');
        }
        setLoading(false);
    };

    const massasFiltradas = useMemo(() => {
        return massas.filter((massa) => {
            if (filtroStatus !== 'TODOS' && massa.status !== filtroStatus) return false;
            if (filtroFaturaFechada && !(Number(massa.fatura_fechada) > 0)) return false;
            if (filtroFaturaAberta && !(Number(massa.fatura_aberta) > 0)) return false;
            if (busca.trim() && !(massa.cpf || '').includes(busca.trim())) return false;
            return true;
        });
    }, [massas, filtroStatus, filtroFaturaFechada, filtroFaturaAberta, busca]);

    const massasPorGrupo = useMemo(() => {
        const grupos: Record<string, TestPlanningMassa[]> = {};
        massasFiltradas.forEach((massa) => {
            const chave = massa.status || 'sem_status';
            if (!grupos[chave]) grupos[chave] = [];
            grupos[chave].push(massa);
        });
        return grupos;
    }, [massasFiltradas]);

    const validacao = cenarioSelecionado && massaSelecionada
        ? validarMassaParaCenario(cenarioSelecionado, massaSelecionada)
        : null;

    const limparFiltros = () => {
        setFiltroStatus('TODOS');
        setFiltroFaturaFechada(false);
        setFiltroFaturaAberta(false);
        setBusca('');
    };

    const toggleGrupo = (chave: string) => {
        setGruposAbertos((prev) => ({ ...prev, [chave]: !prev[chave] }));
    };

    const handleSalvar = async () => {
        if (!cenarioSelecionado || !massaSelecionada) return;
        setSalvando(true);
        const res = await saveTestPlanningAssignment(cenarioSelecionado, {
            idMassa: massaSelecionada.id_massa,
            cpf: massaSelecionada.cpf,
            saldoConta: massaSelecionada.saldo_conta,
            faturaFechada: massaSelecionada.fatura_fechada,
            faturaAberta: massaSelecionada.fatura_aberta,
            diasAtraso: massaSelecionada.dias_atraso,
            pin: String((massaSelecionada as any).PIN ?? '9898'),
        });
        if (res.success) {
            showSuccess(`Cenário ${cenarioSelecionado} atualizado com a massa ${massaSelecionada.cpf}.`);
            await carregarDados();
        } else {
            showError(res.message || 'Erro ao salvar no xlsx.');
        }
        setSalvando(false);
    };

    const chipClass = isMidnight ? 'bg-volt-green/20 text-volt-green border border-volt-green/40' : 'bg-black text-volt-yellow';
    const filtrosAtivos = filtroStatus !== 'TODOS' || filtroFaturaFechada || filtroFaturaAberta || Boolean(busca);

    if (loading) {
        return <div className="p-6 text-sm font-bold opacity-70">Carregando planejamento de testes...</div>;
    }

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center gap-2">
                <ClipboardList size={20} />
                <h2 className="text-lg font-black">Planejamento de Testes</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
                {/* Coluna esquerda: cenários */}
                <AdminPanel title="Cenários (TBL_CENARIOS)">
                    <div className="flex flex-col gap-1.5 max-h-[65vh] overflow-y-auto">
                        {cenarios.map((cenario) => {
                            const ativo = cenarioSelecionado === cenario.ID_CENARIO;
                            return (
                                <button
                                    key={cenario.ID_CENARIO}
                                    onClick={() => setCenarioSelecionado(cenario.ID_CENARIO)}
                                    className={`text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                        ativo ? chipClass : isMidnight ? 'hover:bg-white/5' : 'hover:bg-black/5'
                                    }`}
                                >
                                    <div>{cenario.ID_CENARIO} — {cenario.NOME || cenario.FEATURE}</div>
                                    <div className="text-[10px] opacity-60 mt-0.5">
                                        Vinculado hoje: CPF {cenario.CPF || '—'}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </AdminPanel>

                {/* Coluna direita: catálogo de massas */}
                <AdminPanel>
                    <div className="flex flex-col gap-2 mb-3">
                        {/* Linha 1: chips de filtros ativos */}
                        <div className="flex items-center gap-2 flex-wrap rounded-lg bg-volt-surface-high px-3 py-2">
                            {filtroStatus !== 'TODOS' && (
                                <StatusPill variant="success" size="xs" className="gap-1">
                                    {filtroStatus} <X size={10} className="cursor-pointer" onClick={() => setFiltroStatus('TODOS')} />
                                </StatusPill>
                            )}
                            {filtroFaturaFechada && (
                                <StatusPill variant="success" size="xs" className="gap-1">
                                    fatura_fechada&gt;0 <X size={10} className="cursor-pointer" onClick={() => setFiltroFaturaFechada(false)} />
                                </StatusPill>
                            )}
                            {filtroFaturaAberta && (
                                <StatusPill variant="success" size="xs" className="gap-1">
                                    fatura_aberta&gt;0 <X size={10} className="cursor-pointer" onClick={() => setFiltroFaturaAberta(false)} />
                                </StatusPill>
                            )}
                            {busca && (
                                <StatusPill variant="success" size="xs" className="gap-1">
                                    busca: "{busca}" <X size={10} className="cursor-pointer" onClick={() => setBusca('')} />
                                </StatusPill>
                            )}
                            {!filtrosAtivos && <span className="text-[10px] opacity-50">Nenhum filtro ativo</span>}
                            {filtrosAtivos && (
                                <button onClick={limparFiltros} className="text-[10px] font-bold underline opacity-60 ml-auto">
                                    Limpar tudo
                                </button>
                            )}
                        </div>

                        {/* Linha 2: controles */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <select
                                value={filtroStatus}
                                onChange={(e) => setFiltroStatus(e.target.value as any)}
                                className={`text-xs font-bold rounded-lg px-2 py-1.5 border ${isMidnight ? 'bg-black border-white/20' : 'bg-white border-black/20'}`}
                            >
                                <option value="TODOS">Status: TODOS</option>
                                <option value="adimplente">adimplente</option>
                                <option value="inadimplente">inadimplente</option>
                            </select>
                            <label className="text-xs font-bold flex items-center gap-1">
                                <input type="checkbox" checked={filtroFaturaFechada} onChange={(e) => setFiltroFaturaFechada(e.target.checked)} />
                                fatura_fechada&gt;0
                            </label>
                            <label className="text-xs font-bold flex items-center gap-1">
                                <input type="checkbox" checked={filtroFaturaAberta} onChange={(e) => setFiltroFaturaAberta(e.target.checked)} />
                                fatura_aberta&gt;0
                            </label>
                            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar CPF..." className="flex-1 min-w-[160px]" />
                        </div>
                    </div>

                    <div className="max-h-[50vh] overflow-y-auto overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="sticky top-0 z-10 bg-volt-surface">
                                <tr className={isMidnight ? 'border-b border-white/10' : 'border-b border-black/10'}>
                                    <th className="py-2 px-3 text-[11px] font-semibold uppercase tracking-wide opacity-50">ID Massa</th>
                                    <th className="py-2 px-3 text-[11px] font-semibold uppercase tracking-wide opacity-50">CPF</th>
                                    <th className="py-2 px-3 text-[11px] font-semibold uppercase tracking-wide opacity-50">Status</th>
                                    <th className="py-2 px-3 text-[11px] font-semibold uppercase tracking-wide opacity-50 text-right">Saldo</th>
                                    <th className="py-2 px-3 text-[11px] font-semibold uppercase tracking-wide opacity-50 text-right">Fatura Fechada</th>
                                    <th className="py-2 px-3 text-[11px] font-semibold uppercase tracking-wide opacity-50 text-right">Fatura Aberta</th>
                                    <th className="py-2 px-3 text-[11px] font-semibold uppercase tracking-wide opacity-50 text-center">Dias Atraso</th>
                                    <th className="py-2 px-3 text-[11px] font-semibold uppercase tracking-wide opacity-50 text-center">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(massasPorGrupo).map(([chave, lista]: [string, TestPlanningMassa[]]) => (
                                    <Fragment key={chave}>
                                        <tr>
                                            <td colSpan={8} className="p-0">
                                                <button
                                                    onClick={() => toggleGrupo(chave)}
                                                    className={`w-full flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-60 px-3 py-1.5 ${isMidnight ? 'bg-white/[0.03]' : 'bg-black/[0.03]'}`}
                                                >
                                                    {gruposAbertos[chave] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                    {chave} ({lista.length})
                                                </button>
                                            </td>
                                        </tr>
                                        {gruposAbertos[chave] && lista.map((massa) => {
                                            const selecionada = massaSelecionada?.id_massa === massa.id_massa;
                                            const adimplente = massa.status === 'adimplente';
                                            return (
                                                <tr
                                                    key={massa.id_massa}
                                                    onClick={() => setMassaSelecionada(massa)}
                                                    className={`cursor-pointer border-b transition-colors ${isMidnight ? 'border-white/5' : 'border-black/5'} ${
                                                        selecionada
                                                            ? isMidnight ? 'bg-volt-green/10' : 'bg-black/5'
                                                            : isMidnight ? 'hover:bg-white/5' : 'hover:bg-black/5'
                                                    }`}
                                                >
                                                    <td className="py-2 px-3 font-mono opacity-60">{massa.id_massa}</td>
                                                    <td className="py-2 px-3 font-mono">{formatCPF(massa.cpf)}</td>
                                                    <td className="py-2 px-3">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${adimplente ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                                            <span className={adimplente ? 'text-emerald-500' : 'text-rose-500'}>{massa.status}</span>
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-right tabular-nums">{formatBRL(massa.saldo_conta)}</td>
                                                    <td className="py-2 px-3 text-right tabular-nums">{formatBRL(massa.fatura_fechada)}</td>
                                                    <td className="py-2 px-3 text-right tabular-nums">{formatBRL(massa.fatura_aberta)}</td>
                                                    <td className="py-2 px-3 text-center opacity-70 tabular-nums">{massa.dias_atraso ?? '—'}</td>
                                                    <td className="py-2 px-3 text-center">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setMassaSelecionada(massa); }}
                                                            className="text-[10px] font-bold underline opacity-70 hover:opacity-100"
                                                        >
                                                            Selecionar
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </Fragment>
                                ))}
                                {massasFiltradas.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="p-4 text-center opacity-60">
                                            Nenhuma massa encontrada com os filtros atuais.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {cenarioSelecionado && massaSelecionada && (
                        <div className="mt-4 bg-volt-surface-high p-3 rounded-lg">
                            <p className="text-xs font-black mb-1">
                                Massa selecionada: {massaSelecionada.id_massa} / CPF {formatCPF(massaSelecionada.cpf)}
                            </p>
                            <p className="text-[11px] opacity-70 mb-2">
                                saldo {formatBRL(massaSelecionada.saldo_conta)} · fatura fechada {formatBRL(massaSelecionada.fatura_fechada)} · fatura aberta {formatBRL(massaSelecionada.fatura_aberta)}
                            </p>
                            {validacao && !validacao.valido && (
                                <p className="text-[11px] flex items-center gap-1.5 text-gray-400 mb-2">
                                    <AlertCircle size={13} /> {validacao.motivo}
                                </p>
                            )}
                            <button
                                onClick={handleSalvar}
                                disabled={salvando}
                                className={`w-full py-2.5 rounded-lg text-xs font-black uppercase ${isMidnight ? 'bg-volt-green text-black' : 'bg-black text-volt-yellow'} disabled:opacity-50`}
                            >
                                {salvando ? 'Salvando...' : 'Salvar no xlsx'}
                            </button>
                        </div>
                    )}
                </AdminPanel>
            </div>

            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default TestPlanningSection;
