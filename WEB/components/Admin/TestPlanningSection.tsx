import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, AlertCircle, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { useToast, ToastContainer } from '../Toast';
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

    const cardClass = isMidnight ? 'bg-[#1a1a1a] border border-white/10 text-white' : 'bg-white border-2 border-black text-black';
    const chipClass = isMidnight ? 'bg-volt-green/20 text-volt-green border border-volt-green/40' : 'bg-black text-volt-yellow';

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
                <div className={`rounded-xl p-3 ${cardClass}`}>
                    <p className="text-xs font-black uppercase opacity-60 mb-2">Cenários (TBL_CENARIOS)</p>
                    <div className="flex flex-col gap-1 max-h-[65vh] overflow-y-auto">
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
                </div>

                {/* Coluna direita: catálogo de massas */}
                <div className={`rounded-xl p-3 ${cardClass}`}>
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                        {filtroStatus !== 'TODOS' && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center gap-1">
                                {filtroStatus} <X size={10} className="cursor-pointer" onClick={() => setFiltroStatus('TODOS')} />
                            </span>
                        )}
                        {filtroFaturaFechada && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center gap-1">
                                fatura_fechada&gt;0 <X size={10} className="cursor-pointer" onClick={() => setFiltroFaturaFechada(false)} />
                            </span>
                        )}
                        {filtroFaturaAberta && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center gap-1">
                                fatura_aberta&gt;0 <X size={10} className="cursor-pointer" onClick={() => setFiltroFaturaAberta(false)} />
                            </span>
                        )}
                        {(filtroStatus !== 'TODOS' || filtroFaturaFechada || filtroFaturaAberta || busca) && (
                            <button onClick={limparFiltros} className="text-[10px] font-bold underline opacity-60">
                                Limpar tudo
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 mb-3 flex-wrap">
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
                        <div className="relative flex-1 min-w-[140px]">
                            <Search size={12} className="absolute left-2 top-2 opacity-50" />
                            <input
                                type="text"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar CPF..."
                                className={`w-full pl-6 pr-2 py-1.5 rounded-lg text-xs border ${isMidnight ? 'bg-black border-white/20' : 'bg-white border-black/20'}`}
                            />
                        </div>
                    </div>

                    <div className="max-h-[45vh] overflow-y-auto flex flex-col gap-2">
                        {Object.entries(massasPorGrupo).map(([chave, lista]: [string, TestPlanningMassa[]]) => (
                            <div key={chave}>
                                <button
                                    onClick={() => toggleGrupo(chave)}
                                    className="w-full flex items-center gap-2 text-xs font-black uppercase py-1.5"
                                >
                                    {gruposAbertos[chave] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    {chave} ({lista.length})
                                </button>
                                {gruposAbertos[chave] && (
                                    <div className="flex flex-col gap-1 pl-4">
                                        {lista.map((massa) => (
                                            <button
                                                key={massa.id_massa}
                                                onClick={() => setMassaSelecionada(massa)}
                                                className={`text-left px-3 py-2 rounded-lg text-xs transition-all ${
                                                    massaSelecionada?.id_massa === massa.id_massa
                                                        ? chipClass
                                                        : isMidnight ? 'hover:bg-white/5' : 'hover:bg-black/5'
                                                }`}
                                            >
                                                {massa.id_massa} · {massa.cpf} · saldo {formatBRL(massa.saldo_conta)} · fatura fechada {formatBRL(massa.fatura_fechada)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {cenarioSelecionado && massaSelecionada && (
                        <div className={`mt-4 p-3 rounded-lg border ${isMidnight ? 'border-white/10' : 'border-black/10'}`}>
                            <p className="text-xs font-black mb-1">
                                Massa selecionada: {massaSelecionada.id_massa} / CPF {massaSelecionada.cpf}
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
                </div>
            </div>

            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default TestPlanningSection;
