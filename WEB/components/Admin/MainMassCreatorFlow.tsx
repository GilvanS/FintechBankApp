import React, { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useAppState } from '../../contexts/AppStateContext';
import { adminCreateMassUser } from '../../services/api';
import { showToast } from '../../utils/toast';
import {
    generateRandomMassData,
    GeneratedMassData,
    OVERDUE_TIERS,
    OVERDUE_TIER_KEYS,
    OverdueState,
    CycleStatus,
    buildMassPayload,
    getCycleLabels,
    computeCycleDueDates,
    overdueDaysFrom,
    generateRandomCycleHistory,
    MAX_MASS_CYCLES,
    MIN_MASS_CYCLES,
    MIN_OVERDUE_DAYS_CURRENT_CYCLE
} from '../../utils/massGenerator';
import { useButtonAnimation } from '../../hooks/useGsapMotion';
import TiltCard from '../shared/TiltCard';
import {
    User as UserIcon,
    CreditCard as CardIcon,
    MapPin,
    Calendar,
    Dices,
    CheckCircle2,
    Globe2,
    DollarSign,
    Sparkles,
    PackageCheck,
    History,
    Minus,
    Plus,
    X as CloseIcon
} from 'lucide-react';

interface Props {
    onSuccess?: () => void;
    onCancel?: () => void;
    /** Dentro do AllureShell (que já exibe título e seção ativa): renderiza só a barra de ações, sem o bloco de título. */
    compact?: boolean;
}

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Ciclo único coerente com o estado atual da conta (1 ciclo = comportamento do Gerador 3.0).
const cycleFromState = (state: OverdueState): CycleStatus => (state === 'EM_DIA' ? 'adimplente' : 'inadimplente');
// Inverso: estado da conta coerente com o ciclo ATUAL, preservando o tier de atraso já escolhido.
const stateForCycle = (cycle: CycleStatus, prev: OverdueState): OverdueState =>
    cycle === 'adimplente' ? 'EM_DIA' : (prev === 'EM_DIA' ? 'EM_ATRASO_15D' : prev);

const CARD_GRADIENT: Record<GeneratedMassData['creditCard']['brand'], string> = {
    VISA: 'from-blue-700 via-indigo-800 to-black',
    AMEX: 'from-cyan-600 via-teal-800 to-black',
    ELO: 'from-zinc-800 via-neutral-900 to-black',
    MASTERCARD: 'from-rose-700 via-red-900 to-black',
    HIPERCARD: 'from-rose-700 via-red-900 to-black'
};

// Anéis de brilho do preview do cartão (ref: Transitions.dev credit-card-form),
// uma cor por bandeira ecoando a identidade visual de cada logo.
const CARD_RING_COLORS: Record<GeneratedMassData['creditCard']['brand'], [string, string]> = {
    VISA: ['#1A1F71', '#7288ff'],
    MASTERCARD: ['#EB001B', '#F79E1B'],
    AMEX: ['#006FCF', '#00C2CB'],
    ELO: ['#EF4444', '#3B82F6'],
    HIPERCARD: ['#B91C1C', '#F59E0B']
};

// Cada caractere de cardNumberMasked (dígitos ou •) vira um "slot" que desliza
// pra revelar o valor — puramente visual, o dado já vem mascarado do gerador.
const buildCardNumberSlots = (masked: string) => masked.split('').map((ch, idx) => ({ ch, idx }));

export const MainMassCreatorFlow: React.FC<Props> = ({ onSuccess, onCancel, compact = false }) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    const [formData, setFormData] = useState<GeneratedMassData>(() => generateRandomMassData('Brasil'));
    // Histórico de ciclos de fatura (Gerador 4.0): cycles[0] = mais antigo, último = estado ATUAL.
    const [cycles, setCycles] = useState<CycleStatus[]>(() => [cycleFromState(formData.overdueState)]);
    const [quantity, setQuantity] = useState<number>(1);
    const [isSaving, setIsSaving] = useState(false);
    const [cardFlipped, setCardFlipped] = useState(false);

    const gridRef = useRef<HTMLDivElement>(null);
    const dicesBtn = useButtonAnimation();
    const submitBtn = useButtonAnimation();

    // Entrada em stagger dos blocos + escopo para o pulso de "sorteio"
    const { contextSafe } = useGSAP(() => {
        if (prefersReducedMotion()) return;
        const sections = gridRef.current?.querySelectorAll('[data-mass-section]');
        if (sections?.length) {
            gsap.fromTo(
                sections,
                { opacity: 0, y: 14 },
                { opacity: 1, y: 0, duration: 0.45, stagger: 0.08, ease: 'power2.out' }
            );
        }
    }, { scope: gridRef });

    const pulseGrid = contextSafe(() => {
        if (prefersReducedMotion()) return;
        const sections = gridRef.current?.querySelectorAll('[data-mass-section]');
        if (sections?.length) {
            gsap.fromTo(
                sections,
                { scale: 0.985, filter: 'brightness(1.25)' },
                { scale: 1, filter: 'brightness(1)', duration: 0.45, ease: 'back.out(2)', stagger: 0.03 }
            );
        }
    });

    // Aesthetics Classes
    const cardClass = isMidnight
        ? 'bg-[#1a1a1a] border border-white/10 text-white shadow-2xl backdrop-blur-md'
        : 'bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black';

    const inputClass = isMidnight
        ? 'bg-[#252525] border border-white/10 text-white placeholder-white/40 focus:border-volt-green'
        : 'bg-[#f0f0f0] border-2 border-black text-black placeholder-black/40 focus:border-black focus:bg-white';

    const primaryBtnClass = isMidnight
        ? 'bg-volt-green text-black hover:bg-[#a3ff12] font-black uppercase shadow-[0_0_15px_rgba(163,255,18,0.3)]'
        : 'bg-volt-yellow border-2 border-black text-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-volt-yellow-pastel active:translate-y-0.5 active:shadow-none';

    const successBtnClass = isMidnight
        ? 'bg-emerald-500 text-black hover:bg-emerald-400 font-black uppercase shadow-[0_0_15px_rgba(16,185,129,0.35)]'
        : 'bg-emerald-400 border-2 border-black text-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-emerald-300 active:translate-y-0.5 active:shadow-none';

    const secondaryBtnClass = isMidnight
        ? 'border border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold'
        : 'border-2 border-black bg-white hover:bg-black/5 text-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';

    // Disparar Preenchimento Aleatório 🎲
    // Sem `country` → randomiza também o país. Com `country` (seletor) → gera para o país escolhido.
    // `randomizeCycles` (botão 🎲 principal): sorteia também o histórico de ciclos (1-6,
    // adimplente/inadimplente) com tier coerente com o ciclo atual. Trocar país ou "Sortear"
    // endereço preserva o histórico configurado e só alinha o estado ao ciclo atual.
    const handleRandomFill = (country?: string, randomizeCycles = false) => {
        const random = generateRandomMassData(country);
        if (randomizeCycles) {
            const historico = generateRandomCycleHistory();
            setCycles(historico.cycles);
            setFormData({ ...random, overdueState: historico.overdueState });
            showToast(`🎲 Dados gerados com sucesso (${random.countryOrigin}) — ${historico.cycles.length} ciclo(s) de fatura!`, 'success');
        } else {
            setFormData({ ...random, overdueState: stateForCycle(cycles[cycles.length - 1], random.overdueState) });
            showToast(`🎲 Dados gerados com sucesso (${random.countryOrigin})!`, 'success');
        }
        pulseGrid();
    };

    // O último ciclo é o estado atual da conta — mantém o histórico e só alinha a ponta.
    const syncLastCycle = (state: OverdueState) => {
        setCycles((prev) => [...prev.slice(0, -1), cycleFromState(state)]);
    };

    const handleStateChange = (state: OverdueState) => {
        setFormData((prev) => ({ ...prev, overdueState: state }));
        syncLastCycle(state);
    };

    // Ciclos novos entram como os MAIS ANTIGOS (início do array), adimplentes por padrão;
    // remover ciclos tira sempre do lado antigo, preservando o estado atual (último).
    const handleCycleCountChange = (count: number) => {
        const n = Math.max(MIN_MASS_CYCLES, Math.min(MAX_MASS_CYCLES, count));
        setCycles((prev) => {
            if (n === prev.length) return prev;
            if (n > prev.length) return [...new Array<CycleStatus>(n - prev.length).fill('adimplente'), ...prev];
            return prev.slice(prev.length - n);
        });
    };

    const toggleCycle = (index: number) => {
        const next = [...cycles];
        next[index] = next[index] === 'adimplente' ? 'inadimplente' : 'adimplente';
        setCycles(next);
        // Alternar o ciclo ATUAL também muda o estado da conta (mantém o tier já escolhido quando em atraso).
        if (index === next.length - 1) {
            setFormData((f) => ({ ...f, overdueState: stateForCycle(next[index], f.overdueState) }));
        }
    };

    const inadimplentesCount = cycles.filter((c) => c === 'inadimplente').length;
    const atualInadimplente = cycles[cycles.length - 1] === 'inadimplente';
    const tierAtual = formData.overdueState === 'EM_DIA' ? null : OVERDUE_TIERS[formData.overdueState];
    // Atraso mínimo do ciclo atual = dias do tier, com o mesmo piso do backend. Com dueDay recente
    // demais, o vencimento recua 1 mês — fatura que venceu hoje/ontem nunca nasce "inadimplente".
    const minDiasAtraso = atualInadimplente && tierAtual ? Math.max(MIN_OVERDUE_DAYS_CURRENT_CYCLE, tierAtual.days) : 0;
    // Vencimentos reais dos ciclos (mesma regra do backend) → rótulos `atual (set)`, `-1m (ago)`... e preview.
    const hoje = new Date();
    const cycleDueDates = computeCycleDueDates(cycles.length, formData.creditCard.dueDay, hoje, minDiasAtraso);
    const cycleLabels = getCycleLabels(cycles.length, formData.creditCard.dueDay, hoje, minDiasAtraso);
    const vencimentoAtual = cycleDueDates[cycles.length - 1];
    const diasAtrasoAtual = atualInadimplente ? overdueDaysFrom(vencimentoAtual, hoje) : 0;
    const fmtDia = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

    // Calcular idade quando muda a data de nascimento
    const handleBirthDateChange = (dateStr: string) => {
        if (!dateStr) return;
        const birthYear = new Date(dateStr).getFullYear();
        const currentYear = new Date().getFullYear();
        const computedAge = Math.max(0, currentYear - birthYear);

        // Regra de tutor removida — massas sempre sem tutor (faixa 18–80).
        setFormData((prev) => ({
            ...prev,
            birthDate: dateStr,
            age: computedAge,
            hasTutor: false,
            tutor: undefined
        }));
    };

    const isProfileValid = () => Boolean(formData.fullName && formData.cpf && formData.birthDate);
    const isAddressValid = () => Boolean(formData.address.street && formData.address.number && formData.address.city);
    const isFormValid = () => isProfileValid() && isAddressValid();

    // E-mail corporativo: nome.sobrenome@fintech.com. O nome é normalizado porque massas
    // estrangeiras trazem acentos e hífens, que não podem ir na parte local do endereço.
    const buildEmail = (fullName: string) => {
        const partes = fullName
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .toLowerCase()
            .replace(/[^a-z\s]/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        const randomHash = Math.floor(1000 + Math.random() * 9000);
        if (!partes.length) return `massa.${randomHash}@fintech.com`;
        const nome = partes[0];
        const sobrenome = partes.length > 1 ? partes[partes.length - 1] : '';
        return sobrenome ? `${nome}.${sobrenome}.${randomHash}@fintech.com` : `${nome}.${randomHash}@fintech.com`;
    };

    const montarPayload = (dados: GeneratedMassData, ciclos: CycleStatus[]) => {
        // Tier de atraso: o selecionado quando inadimplente; fallback 15d quando o estado atual
        // é EM_DIA mas há ciclos inadimplentes no histórico (precisa de valor base pra parcelada).
        const tier = dados.overdueState === 'EM_DIA' ? OVERDUE_TIERS.EM_ATRASO_15D : OVERDUE_TIERS[dados.overdueState];
        const cicloAtualInadimplente = ciclos[ciclos.length - 1] === 'inadimplente';
        const temInadimplencia = ciclos.includes('inadimplente');
        return buildMassPayload({
            fullName: dados.fullName,
            cpf: dados.cpf.replace(/\D/g, ''),
            email: buildEmail(dados.fullName),
            password: 'admin999',
            initialBalance: dados.balance,
            creditLimit: dados.creditCard.limit,
            pixLimit: dados.dailyPixLimit,
            cycles: ciclos,
            daysOverdue: cicloAtualInadimplente ? tier.days : 0,
            // Backend ancora o ciclo atual no último dueDay com pelo menos `minOverdueDays` de atraso.
            minOverdueDays: cicloAtualInadimplente ? tier.days : 0,
            overdueAmount: temInadimplencia ? tier.amount : 0,
            birthDate: dados.birthDate,
            age: dados.age,
            hasTutor: false,
            tutor: undefined,
            address: dados.address,
            countryOrigin: dados.countryOrigin,
            cardBrand: dados.creditCard.brand,
            dueDay: dados.creditCard.dueDay,
            cardType: dados.creditCard.cardType,
            cardActivation: dados.creditCard.activationState
        });
    };

    const MAX_TENTATIVAS_NOME = 5;

    const handleFinalSubmit = async () => {
        setIsSaving(true);
        let currentData = { ...formData };
        let iteracoes = quantity > 0 ? quantity : 1;
        let sucessos = 0;

        try {
            for (let i = 0; i < iteracoes; i++) {
                let salvo = false;
                for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_NOME; tentativa++) {
                    const result = await adminCreateMassUser(montarPayload(currentData, cycles));

                    if (result.success) {
                        sucessos++;
                        salvo = true;
                        break;
                    }

                    const emailDuplicado = /e-?mail/i.test(result.message || '');
                    if (!emailDuplicado || tentativa === MAX_TENTATIVAS_NOME) {
                        showToast(result.message || `Erro ao gravar massa (${i + 1}/${iteracoes}).`, 'error');
                        break;
                    }

                    const novoNome = generateRandomMassData(currentData.countryOrigin).fullName;
                    currentData = { ...currentData, fullName: novoNome };
                }

                if (!salvo) break;

                // Prepara próximo sorteio se houver mais de uma massa
                // O histórico de ciclos é mantido; só o estado atual acompanha o último ciclo.
                if (i < iteracoes - 1) {
                    const proximo = generateRandomMassData(currentData.countryOrigin);
                    currentData = { ...proximo, overdueState: stateForCycle(cycles[cycles.length - 1], currentData.overdueState) };
                }
            }

            if (sucessos > 0) {
                showToast(iteracoes > 1 ? `🚀 ${sucessos} massas criadas com sucesso no PGDB!` : `🚀 Massa ${currentData.fullName} criada com sucesso no PGDB!`, 'success');
                const novo = generateRandomMassData(currentData.countryOrigin);
                setFormData({ ...novo, overdueState: stateForCycle(cycles[cycles.length - 1], currentData.overdueState) });
                pulseGrid();
            }
        } catch (err: any) {
            showToast(err.message || 'Erro ao conectar ao banco.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-4">
            {/* Header: ações principais (sempre visíveis, sem avançar de tela). Em `compact` o bloco de
                título sai (o shell do Admin já mostra "Gerador de Massa 4.0") e a barra fica slim. */}
            <div
                data-testid="mass-creator-toolbar"
                className={`${compact ? 'px-3 py-2 rounded-2xl' : 'p-4 rounded-3xl'} ${cardClass} flex flex-col sm:flex-row items-stretch sm:items-center gap-3`}
            >
                {compact ? (
                    <div className="flex-1 min-w-0 flex items-center gap-2 text-[11px] opacity-80">
                        <span className="text-volt-yellow shrink-0">⚡</span>
                        <span className="truncate">Gere, ajuste o histórico de ciclos e conclua sem trocar de tela.</span>
                    </div>
                ) : (
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                        <span className="p-2 rounded-xl bg-volt-yellow/20 text-volt-yellow font-bold shrink-0">⚡</span>
                        <div className="min-w-0">
                            <h2 className="text-base font-black uppercase tracking-wide leading-tight">Gerador de Massa 4.0</h2>
                            <p className="text-[10px] opacity-70 leading-tight">Painel único — gere, ajuste o histórico de ciclos e conclua sem trocar de tela.</p>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 px-3 py-1.5 rounded-2xl">
                        <label className="text-[11px] font-bold opacity-75">Qtd:</label>
                        <input
                            type="number"
                            min={1}
                            max={50}
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                            className={`w-12 text-center p-1 rounded-lg text-xs font-black ${inputClass}`}
                            title="Quantidade de massas a gerar em sequência"
                        />
                    </div>

                    <button
                        ref={dicesBtn.buttonRef}
                        {...dicesBtn.buttonProps}
                        type="button"
                        onClick={() => handleRandomFill(undefined, true)}
                        className={`px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 cursor-pointer ${primaryBtnClass}`}
                    >
                        <Dices className="w-4 h-4 animate-spin-slow" />
                        <span>Gerar Aleatório</span>
                    </button>

                    <button
                        ref={submitBtn.buttonRef}
                        {...submitBtn.buttonProps}
                        type="button"
                        onClick={handleFinalSubmit}
                        disabled={!isFormValid() || isSaving}
                        className={`px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 cursor-pointer disabled:opacity-40 ${successBtnClass}`}
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isSaving ? 'Gravando...' : quantity > 1 ? `Criar ${quantity} Massas` : 'Concluir e Criar'}</span>
                    </button>

                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className={`px-3 py-2.5 rounded-2xl text-xs cursor-pointer ${secondaryBtnClass}`}
                            title="Fechar"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* No desktop: Perfil + Financeiro à esquerda, Cartão + Endereço à direita.
                Em tela estreita tudo vira uma coluna na ordem Perfil → Cartão → Financeiro → Endereço.
                `contents` dissolve os wrappers de coluna nesse caso, para que `order-*` valha entre
                todas as seções — entre irmãos de wrappers diferentes o `order` não teria efeito. */}
            <div ref={gridRef} className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-4 lg:items-start">
                {/* Coluna esquerda */}
                <div className="contents lg:block lg:space-y-4">
                    {/* PERFIL */}
                    <div data-mass-section className={`order-1 p-4 rounded-3xl ${cardClass} space-y-3`}>
                        <div className="flex justify-between items-center border-b border-black/10 dark:border-white/10 pb-2.5">
                            <h3 className="font-black text-sm flex items-center gap-1.5">
                                <UserIcon className="w-4 h-4 text-blue-500" />
                                <span>Perfil</span>
                            </h3>
                            <select
                                value={formData.countryOrigin}
                                onChange={(e) => handleRandomFill(e.target.value)}
                                className={`p-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${inputClass}`}
                            >
                                <option value="Brasil">🇧🇷 Brasil</option>
                                <option value="Estados Unidos">🇺🇸 EUA</option>
                                <option value="Japão">🇯🇵 Japão</option>
                                <option value="China">🇨🇳 China</option>
                                <option value="Coreia do Sul">🇰🇷 Coreia do Sul</option>
                                <option value="Arábia Saudita">🇸🇦 Arábia Saudita</option>
                                <option value="Portugal">🇵🇹 Portugal</option>
                                <option value="Alemanha">🇩🇪 Alemanha</option>
                                <option value="França">🇫🇷 França</option>
                                <option value="Itália">🇮🇹 Itália</option>
                                <option value="Argentina">🇦🇷 Argentina</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold opacity-80">Nome Completo:</label>
                            <input
                                type="text"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                placeholder="Ex: Lucas Gabriel Ferreira"
                                className={`w-full p-2.5 rounded-xl text-xs font-bold ${inputClass}`}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold opacity-80">CPF:</label>
                                <input
                                    type="text"
                                    value={formData.cpf}
                                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                                    placeholder="000.000.000-00"
                                    className={`w-full p-2.5 rounded-xl text-xs font-mono font-bold ${inputClass}`}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold opacity-80 flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-amber-500" />
                                    <span>Nascimento:</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.birthDate}
                                    onChange={(e) => handleBirthDateChange(e.target.value)}
                                    className={`w-full p-2.5 rounded-xl text-xs font-mono font-bold ${inputClass}`}
                                />
                            </div>
                        </div>

                        <div className={`px-3 py-2 rounded-xl text-[11px] font-black flex justify-between items-center ${inputClass}`}>
                            <span>{formData.age} anos</span>
                            {formData.age < 18 || formData.age > 80 ? (
                                <span className="text-amber-500">⚠️ fora da faixa padrão (18–80)</span>
                            ) : (
                                <span className="text-emerald-500">✓ titular direto</span>
                            )}
                        </div>
                    </div>

                    {/* FINANCEIRO */}
                    <div data-mass-section className={`order-3 p-4 rounded-3xl ${cardClass} space-y-3`}>
                        <h3 className="font-black text-sm flex items-center gap-1.5 border-b border-black/10 dark:border-white/10 pb-2.5">
                            <DollarSign className="w-4 h-4 text-volt-green" />
                            <span>Financeiro</span>
                        </h3>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold opacity-80">Saldo (R$):</label>
                                <input
                                    type="number"
                                    value={formData.balance}
                                    onChange={(e) => setFormData({ ...formData, balance: Number(e.target.value) })}
                                    className={`w-full p-2.5 rounded-xl text-xs font-mono font-bold ${inputClass}`}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold opacity-80">Limite (R$):</label>
                                <input
                                    type="number"
                                    value={formData.creditCard.limit}
                                    onChange={(e) => setFormData({ ...formData, creditCard: { ...formData.creditCard, limit: Number(e.target.value) } })}
                                    className={`w-full p-2.5 rounded-xl text-xs font-mono font-bold ${inputClass}`}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold opacity-80">PIX/dia (R$):</label>
                                <input
                                    type="number"
                                    value={formData.dailyPixLimit}
                                    onChange={(e) => setFormData({ ...formData, dailyPixLimit: Number(e.target.value) })}
                                    className={`w-full p-2.5 rounded-xl text-xs font-mono font-bold ${inputClass}`}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                            <button
                                type="button"
                                onClick={() => handleStateChange('EM_DIA')}
                                className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                                    formData.overdueState === 'EM_DIA'
                                        ? 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/40 font-black'
                                        : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-emerald-300'
                                }`}
                            >
                                <span>🟢</span>
                                <span>Adimplente</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleStateChange(formData.overdueState === 'EM_DIA' ? 'EM_ATRASO_15D' : formData.overdueState)}
                                title="Ciclo atual em atraso — escolha o tier (Leve/Médio/Grave) abaixo"
                                className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                                    formData.overdueState !== 'EM_DIA'
                                        ? 'bg-rose-500/15 border-rose-500 ring-2 ring-rose-500/40 font-black'
                                        : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-rose-300'
                                }`}
                            >
                                <span>🔴</span>
                                <span>Inadimplente</span>
                            </button>
                        </div>

                        {/* TIER DE ATRASO — só quando o ciclo atual é inadimplente. Define o valor da
                            parcelada e o atraso MÍNIMO do ciclo atual (o vencimento segue o dueDay). */}
                        {atualInadimplente && tierAtual && (
                            <div data-testid="mass-overdue-tier" className="space-y-1.5">
                                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                                    {OVERDUE_TIER_KEYS.map((key) => {
                                        const t = OVERDUE_TIERS[key];
                                        const ativo = formData.overdueState === key;
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                data-testid={`mass-tier-${key}`}
                                                aria-pressed={ativo}
                                                title={t.desc}
                                                onClick={() => setFormData((f) => ({ ...f, overdueState: key }))}
                                                className={`p-2 rounded-xl border flex flex-col items-center gap-0.5 cursor-pointer transition-all ${
                                                    ativo
                                                        ? 'bg-rose-500/15 border-rose-500 ring-2 ring-rose-500/40 font-black'
                                                        : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-rose-300'
                                                }`}
                                            >
                                                <span className="font-black">{t.short} · ≥{t.days}d</span>
                                                <span className="opacity-70 font-mono">R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p data-testid="mass-overdue-preview" className="text-[10px] opacity-70 leading-snug">
                                    Fatura atual venceu em <span className="font-black">{fmtDia(vencimentoAtual)}</span> →{' '}
                                    <span className="font-black text-rose-500">{diasAtrasoAtual} dia(s) de atraso</span>
                                    {diasAtrasoAtual >= 8 ? ' · cartão bloqueado (≥8d)' : ' · cartão ainda liberado (<8d)'}
                                </p>
                            </div>
                        )}

                        {/* HISTÓRICO DE CICLOS (Gerador 4.0) — 1 a 6 faturas encadeadas */}
                        <div data-testid="mass-cycles" className="space-y-2 pt-1">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-[11px] font-bold opacity-80 flex items-center gap-1">
                                    <History className="w-3 h-3 text-indigo-500" />
                                    <span>Histórico de faturas:</span>
                                </label>
                                <div className={`flex items-center gap-1 rounded-xl px-1 py-0.5 ${inputClass}`}>
                                    <button
                                        type="button"
                                        aria-label="Remover ciclo"
                                        disabled={cycles.length <= MIN_MASS_CYCLES}
                                        onClick={() => handleCycleCountChange(cycles.length - 1)}
                                        className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                                    >
                                        <Minus className="w-3 h-3" />
                                    </button>
                                    <span data-testid="mass-cycles-count" className="w-14 text-center text-[11px] font-black tabular-nums">
                                        {cycles.length} {cycles.length === 1 ? 'ciclo' : 'ciclos'}
                                    </span>
                                    <button
                                        type="button"
                                        aria-label="Adicionar ciclo"
                                        disabled={cycles.length >= MAX_MASS_CYCLES}
                                        onClick={() => handleCycleCountChange(cycles.length + 1)}
                                        className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                                    >
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>

                            {/* Linha do tempo: mais antigo à esquerda, atual à direita. Clique alterna o ciclo. */}
                            <div className="flex items-stretch gap-1.5">
                                {cycles.map((cycle, idx) => {
                                    const isCurrent = idx === cycles.length - 1;
                                    const isPaid = cycle === 'adimplente';
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            data-testid={`mass-cycle-${idx}`}
                                            aria-pressed={!isPaid}
                                            aria-label={`Ciclo ${cycleLabels[idx]}: ${isPaid ? 'pago' : 'em atraso'}`}
                                            title={isPaid ? 'Fatura FECHADA e paga no vencimento' : 'Fatura FECHADA vencida não paga (encargos + saldo encadeado)'}
                                            onClick={() => toggleCycle(idx)}
                                            className={`flex-1 min-w-0 py-1.5 px-1 rounded-xl border text-[10px] font-black flex flex-col items-center gap-0.5 cursor-pointer transition-all hover:scale-[1.03] active:scale-95 ${
                                                isPaid
                                                    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-600 dark:text-emerald-300'
                                                    : 'bg-rose-500/15 border-rose-500/60 text-rose-600 dark:text-rose-300'
                                            } ${isCurrent ? 'ring-2 ring-offset-1 ring-offset-transparent ' + (isPaid ? 'ring-emerald-500/50' : 'ring-rose-500/50') : ''}`}
                                        >
                                            <span className="leading-none">{isPaid ? '🟢' : '🔴'}</span>
                                            <span className="leading-none truncate w-full text-center">{cycleLabels[idx]}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <p className="text-[10px] opacity-60 leading-snug">
                                {inadimplentesCount === 0
                                    ? `${cycles.length} fatura(s) fechada(s) e paga(s) no vencimento.`
                                    : `${inadimplentesCount} fatura(s) vencida(s) não paga(s) — sequências consecutivas encadeiam saldo anterior via compra parcelada.`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Coluna direita */}
                <div className="contents lg:block lg:space-y-4">
                    {/* CARTÃO — em destaque, com flip 3D */}
                    <div data-mass-section className={`order-2 p-4 rounded-3xl ${cardClass} space-y-3`}>
                    <div className="flex justify-between items-center border-b border-black/10 dark:border-white/10 pb-2.5">
                        <h3 className="font-black text-sm flex items-center gap-1.5">
                            <CardIcon className="w-4 h-4 text-purple-500" />
                            <span>Cartão</span>
                        </h3>
                        <span className="text-[10px] opacity-60">clique pra virar e ler o CVV</span>
                    </div>

                    {/* Cartão tilt 3D (Transitions.dev) + flip SÓ POR CLIQUE — frente (dados) /
                        verso (CVV). O wrapper externo é a hit-area plana que rastreia o ponteiro
                        (useCardTilt escreve --tilt-*) e nunca se transforma; o card interno soma
                        o tilt (rotateX/rotateY) com o flip (rotateY 180°) e volta ao flat suavemente
                        no leave. No mobile o tilt fica desligado (pan-y preserva o scroll) e o tap
                        vira o cartão. */}
                    <TiltCard>
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setCardFlipped((f) => !f)}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setCardFlipped((f) => !f)}
                            aria-label="Virar cartão para ver CVV"
                            className="relative h-40 sm:h-44 cursor-pointer"
                            style={{
                                transformStyle: 'preserve-3d',
                                transition: 'transform 0.7s',
                                // perspectiva embutida no próprio transform — o .t-tilt-card usa
                                // overflow:hidden (achata a árvore 3D) e não serve de fonte de perspectiva
                                transform: cardFlipped ? 'perspective(1200px) rotateY(180deg)' : 'perspective(1200px) rotateY(0deg)'
                            }}
                        >
                            {/* FRENTE */}
                            <div
                                style={{
                                    backfaceVisibility: 'hidden',
                                    ['--mcf-ring1' as any]: CARD_RING_COLORS[formData.creditCard.brand][0],
                                    ['--mcf-ring2' as any]: CARD_RING_COLORS[formData.creditCard.brand][1],
                                }}
                                className={`mcf-card-glow absolute inset-0 p-5 rounded-2xl text-white font-mono shadow-xl bg-gradient-to-br ${CARD_GRADIENT[formData.creditCard.brand]}`}
                            >
                                <div className="relative z-10 flex justify-between items-start">
                                    <div>
                                        <p className="text-[10px] opacity-70 tracking-widest uppercase">VOLT BANK BLACK</p>
                                        <p className="text-xs font-bold">{formData.creditCard.brand}</p>
                                    </div>
                                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold">VENC. DIA {formData.creditCard.dueDay}</span>
                                </div>
                                <div key={formData.creditCard.cardNumberMasked} className="mcf-card-number relative z-10 text-lg font-black tracking-widest my-5">
                                    {buildCardNumberSlots(formData.creditCard.cardNumberMasked).map(({ ch, idx }) => (
                                        <span
                                            key={idx}
                                            className="mcf-digit"
                                            style={{ width: ch === ' ' ? '0.4em' : '0.62em', animationDelay: `${idx * 18}ms` }}
                                        >
                                            <span className="mcf-row" aria-hidden="true">#</span>
                                            <span className="mcf-row">{ch}</span>
                                        </span>
                                    ))}
                                </div>
                                <div className="relative z-10 flex justify-between items-end">
                                    <div>
                                        <p className="text-[9px] opacity-60 tracking-wide uppercase">Card Holder</p>
                                        <p className="text-[11px] font-bold uppercase truncate max-w-[160px]">{formData.fullName || 'NOME NA MASSA'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] opacity-60 tracking-wide uppercase">Expires</p>
                                        <p className="text-[11px] font-bold">{formData.creditCard.expirationDate}</p>
                                    </div>
                                </div>
                            </div>

                            {/* VERSO */}
                            <div
                                style={{
                                    backfaceVisibility: 'hidden',
                                    transform: 'rotateY(180deg)',
                                    ['--mcf-ring1' as any]: CARD_RING_COLORS[formData.creditCard.brand][0],
                                    ['--mcf-ring2' as any]: CARD_RING_COLORS[formData.creditCard.brand][1],
                                }}
                                className={`mcf-card-glow absolute inset-0 rounded-2xl text-white font-mono shadow-xl bg-gradient-to-br ${CARD_GRADIENT[formData.creditCard.brand]}`}
                            >
                                <div className="relative z-10 h-9 bg-black/70 mt-5" />
                                <div className="relative z-10 px-5 pt-3">
                                    <p className="text-[9px] opacity-60 tracking-wide uppercase text-right mb-1">CVV</p>
                                    <div className="flex justify-between items-center">
                                        <div className="flex-1 h-6 bg-white/90 rounded-sm" />
                                        <div className="ml-2 px-2.5 py-1 bg-white text-black text-xs font-black rounded">{formData.creditCard.cvv}</div>
                                    </div>
                                </div>
                                <p className="relative z-10 px-5 mt-3 text-[10px] opacity-60">Uso exclusivo de massa de teste — não é um cartão real.</p>
                            </div>
                        </div>
                    </TiltCard>

                    {/* Bandeiras */}
                    <div className="grid grid-cols-5 gap-1.5 text-[10px]">
                        {(['MASTERCARD', 'VISA', 'ELO', 'AMEX', 'HIPERCARD'] as const).map((brand) => (
                            <button
                                key={brand}
                                type="button"
                                onClick={() => setFormData({ ...formData, creditCard: { ...formData.creditCard, brand } })}
                                className={`p-2 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                                    formData.creditCard.brand === brand
                                        ? 'bg-black/10 dark:bg-white/10 border-current ring-2 ring-current/30 font-black scale-105'
                                        : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-current/40'
                                }`}
                            >
                                <svg className="w-7 h-4" viewBox="0 0 36 24" fill="none">
                                    {brand === 'MASTERCARD' && (<><circle cx="12" cy="12" r="10" fill="#EB001B" /><circle cx="24" cy="12" r="10" fill="#F79E1B" fillOpacity="0.8" /></>)}
                                    {brand === 'VISA' && (<><rect width="36" height="24" rx="4" fill="#1A1F71" /><text x="6" y="16" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontStyle="italic">VISA</text></>)}
                                    {brand === 'ELO' && (<><rect width="36" height="24" rx="4" fill="#000000" /><circle cx="12" cy="12" r="5" fill="#EF4444" /><circle cx="18" cy="12" r="5" fill="#F59E0B" /><circle cx="24" cy="12" r="5" fill="#3B82F6" /></>)}
                                    {brand === 'AMEX' && (<><rect width="36" height="24" rx="4" fill="#006FCF" /><text x="4" y="16" fill="#FFFFFF" fontSize="9" fontWeight="black">AMEX</text></>)}
                                    {brand === 'HIPERCARD' && (<><rect width="36" height="24" rx="4" fill="#B91C1C" /><text x="3" y="16" fill="#FFFFFF" fontSize="7.5" fontWeight="black">HIPER</text></>)}
                                </svg>
                                <span>{brand === 'MASTERCARD' ? 'MASTER' : brand}</span>
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                        <div className="space-y-1">
                            <label className="font-bold opacity-80">Vencimento:</label>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold opacity-60">Dia</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={formData.creditCard.dueDay}
                                    onChange={(e) => setFormData({ ...formData, creditCard: { ...formData.creditCard, dueDay: Math.max(1, Math.min(31, Number(e.target.value) || 1)) } })}
                                    className={`w-full p-1.5 text-center rounded-xl font-bold ${inputClass}`}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="font-bold opacity-80">Modalidade:</label>
                            <select
                                value={formData.creditCard.cardType}
                                onChange={(e) => setFormData({ ...formData, creditCard: { ...formData.creditCard, cardType: e.target.value as any } })}
                                className={`w-full p-2 rounded-xl font-bold cursor-pointer ${inputClass}`}
                            >
                                <option value="PHYSICAL">Físico</option>
                                <option value="VIRTUAL">Virtual</option>
                                <option value="BOTH">Ambos</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1 text-[11px]">
                        <label className="font-bold opacity-80">Ativação:</label>
                        <select
                            value={formData.creditCard.activationState || 'ACTIVATED'}
                            onChange={(e) => setFormData({ ...formData, creditCard: { ...formData.creditCard, activationState: e.target.value as any } })}
                            className={`w-full p-2 rounded-xl font-bold cursor-pointer ${
                                formData.creditCard.activationState === 'AWAITING_ACTIVATION'
                                    ? 'bg-amber-500/15 border border-amber-500 text-amber-600 dark:text-amber-300 font-black'
                                    : inputClass
                            }`}
                        >
                            <option value="ACTIVATED">✅ Já Ativado</option>
                            <option value="AWAITING_ACTIVATION">⏳ Aguardando Ativação</option>
                        </select>
                    </div>
                    </div>

                    {/* ENDEREÇO */}
                    <div data-mass-section className={`order-4 p-4 rounded-3xl ${cardClass} space-y-3`}>
                        <div className="flex justify-between items-center border-b border-black/10 dark:border-white/10 pb-2.5">
                            <h3 className="font-black text-sm flex items-center gap-1.5">
                                <MapPin className="w-4 h-4 text-emerald-500" />
                                <span>Endereço SAC</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => handleRandomFill(formData.countryOrigin)}
                                className="text-[11px] font-bold text-blue-500 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                <Dices className="w-3 h-3" /> Sortear
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold opacity-80">CEP:</label>
                                <input
                                    type="text"
                                    value={formData.address.cep}
                                    onChange={(e) => setFormData({ ...formData, address: { ...formData.address, cep: e.target.value } })}
                                    className={`w-full p-2.5 rounded-xl text-xs font-mono font-bold ${inputClass}`}
                                />
                            </div>
                            <div className="col-span-2 space-y-1">
                                <label className="text-[11px] font-bold opacity-80">Logradouro:</label>
                                <input
                                    type="text"
                                    value={formData.address.street}
                                    onChange={(e) => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })}
                                    className={`w-full p-2.5 rounded-xl text-xs font-bold ${inputClass}`}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold opacity-80">Número:</label>
                                <input
                                    type="text"
                                    value={formData.address.number}
                                    onChange={(e) => setFormData({ ...formData, address: { ...formData.address, number: e.target.value } })}
                                    className={`w-full p-2.5 rounded-xl text-xs font-bold ${inputClass}`}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold opacity-80">Bairro:</label>
                                <input
                                    type="text"
                                    value={formData.address.neighborhood}
                                    onChange={(e) => setFormData({ ...formData, address: { ...formData.address, neighborhood: e.target.value } })}
                                    className={`w-full p-2.5 rounded-xl text-xs font-bold ${inputClass}`}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold opacity-80">Cidade/UF:</label>
                                <div className="flex gap-1.5">
                                    <input
                                        type="text"
                                        value={formData.address.city}
                                        onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                                        className={`w-full p-2.5 rounded-xl text-xs font-bold ${inputClass}`}
                                    />
                                    <input
                                        type="text"
                                        value={formData.address.state}
                                        onChange={(e) => setFormData({ ...formData, address: { ...formData.address, state: e.target.value } })}
                                        className={`w-14 p-2.5 rounded-xl text-xs font-bold uppercase text-center ${inputClass}`}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-[11px] flex items-start gap-2">
                            <PackageCheck className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                            <p className="opacity-80 leading-snug">
                                {formData.address.street}, nº {formData.address.number} - {formData.address.neighborhood}, {formData.address.city}/{formData.address.state} · CEP {formData.address.cep}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* RESUMO — sempre visível, reflete o estado atual */}
            <div className={`p-3.5 rounded-2xl ${cardClass}`}>
                <div className="flex items-center gap-1.5 font-black text-xs text-volt-green mb-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Resumo da massa a ser gravada no PGDB</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 opacity-90 font-mono text-[11px]">
                    <div><span className="opacity-60">Cliente:</span> {formData.fullName || '—'}</div>
                    <div><span className="opacity-60">CPF:</span> {formData.cpf || '—'}</div>
                    <div className="flex items-center gap-1"><Globe2 className="w-3 h-3 opacity-60" /> {formData.countryOrigin}</div>
                    <div><span className="opacity-60">Idade:</span> {formData.age}a</div>
                    <div><span className="opacity-60">Bandeira:</span> {formData.creditCard.brand}</div>
                    <div><span className="opacity-60">Vencimento:</span> Dia {formData.creditCard.dueDay}</div>
                    <div><span className="opacity-60">Saldo:</span> R$ {formData.balance.toFixed(2)}</div>
                    <div><span className="opacity-60">Estado:</span> {formData.overdueState === 'EM_DIA' ? '🟢 Adimplente' : `🔴 Inadimplente · ${tierAtual?.short} · ${diasAtrasoAtual}d (venc. ${fmtDia(vencimentoAtual)})`}</div>
                    <div className="col-span-2 sm:col-span-4">
                        <span className="opacity-60">Ciclos:</span>{' '}
                        <span data-testid="mass-cycles-summary" className="tracking-widest">{cycles.map((c) => (c === 'adimplente' ? '🟢' : '🔴')).join('')}</span>
                        {' '}<span className="opacity-60">({cycles.length}/{MAX_MASS_CYCLES}, {inadimplentesCount} em atraso)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
