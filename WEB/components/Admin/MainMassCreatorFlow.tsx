import React, { useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { adminCreateMassUser } from '../../services/api';
import { showToast } from '../../utils/toast';
import { generateRandomMassData, GeneratedMassData, OVERDUE_TIERS, OverdueState } from '../../utils/massGenerator';
import {
    User as UserIcon,
    CreditCard as CardIcon,
    ShieldAlert,
    MapPin,
    Calendar,
    Dices,
    Zap,
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Building2,
    Globe2,
    DollarSign,
    Sparkles,
    PackageCheck
} from 'lucide-react';

interface Props {
    onSuccess?: () => void;
    onCancel?: () => void;
}

export const MainMassCreatorFlow: React.FC<Props> = ({ onSuccess, onCancel }) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    // Step State (1: Perfil/Idade, 2: Endereço SAC, 3: Cartão/Bandeira, 4: Limites/PGDB)
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

    // Form State
    const [formData, setFormData] = useState<GeneratedMassData>(() => generateRandomMassData('Brasil'));
    const [isSaving, setIsSaving] = useState(false);
    const [forceTutorAge, setForceTutorAge] = useState<'normal' | 'under18' | 'over80'>('normal');

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

    const secondaryBtnClass = isMidnight
        ? 'border border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold'
        : 'border-2 border-black bg-white hover:bg-black/5 text-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';

    // Disparar Preenchimento Aleatório 🎲
    const handleRandomFill = (country?: string, forceAge?: 'normal' | 'under18' | 'over80') => {
        const random = generateRandomMassData(country || formData.countryOrigin, forceAge || forceTutorAge);
        setFormData(random);
        showToast(`🎲 Dados gerados com sucesso (${random.countryOrigin})!`, 'info');
    };

    // Calcular idade quando muda a data de nascimento
    const handleBirthDateChange = (dateStr: string) => {
        if (!dateStr) return;
        const birthYear = new Date(dateStr).getFullYear();
        const currentYear = new Date().getFullYear();
        const computedAge = Math.max(0, currentYear - birthYear);

        const requiresTutor = computedAge < 18 || computedAge > 80;
        setFormData((prev) => ({
            ...prev,
            birthDate: dateStr,
            age: computedAge,
            hasTutor: requiresTutor,
            tutor: requiresTutor
                ? prev.tutor || { fullName: 'Maria Aparecida Santos (Responsavel)', cpf: '999.888.777-66', relationship: computedAge < 18 ? 'Pai / Responsavel' : 'Tutor Curador' }
                : undefined
        }));
    };

    // Validação da Etapa 1
    const isStep1Valid = () => {
        if (!formData.fullName || !formData.cpf || !formData.birthDate) return false;
        if (formData.hasTutor) {
            return Boolean(formData.tutor?.fullName && formData.tutor?.cpf);
        }
        return true;
    };

    // Validação da Etapa 2
    const isStep2Valid = () => {
        return Boolean(formData.address.street && formData.address.number && formData.address.city);
    };

    // Submeter Criação de Massa e Gravação Síncrona no PGDB
    const handleFinalSubmit = async () => {
        setIsSaving(true);
        try {
            const payload = {
                fullName: formData.fullName,
                cpf: formData.cpf.replace(/\D/g, ''),
                email: `${formData.fullName.toLowerCase().replace(/\s+/g, '')}@fintech.com`,
                password: 'admin999',
                initialBalance: formData.balance,
                creditLimit: formData.creditCard.limit,
                pixLimit: formData.dailyPixLimit,
                accountStatus: formData.overdueState === 'EM_DIA' ? 'adimplente' : 'inadimplente',
                daysOverdue: formData.overdueState === 'EM_DIA' ? 0 : OVERDUE_TIERS[formData.overdueState].days,
                overdueAmount: formData.overdueState === 'EM_DIA' ? 0 : OVERDUE_TIERS[formData.overdueState].amount,
                birthDate: formData.birthDate,
                age: formData.age,
                hasTutor: formData.hasTutor,
                tutor: formData.tutor,
                address: formData.address,
                countryOrigin: formData.countryOrigin,
                cardBrand: formData.creditCard.brand,
                dueDay: formData.creditCard.dueDay,
                cardType: formData.creditCard.cardType
            };

            const result = await adminCreateMassUser(payload);
            if (result.success) {
                showToast(`🚀 Massa ${formData.fullName} (CPF: ${formData.cpf}) criada com sucesso no PGDB!`, 'success');
                onSuccess?.();
            } else {
                showToast(result.message || 'Erro ao gravar massa no PGDB.', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Erro ao conectar ao banco.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto space-y-6">
            {/* Header com Título e Botão Mágico Global (🎲) */}
            <div className={`p-6 rounded-3xl ${cardClass} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-volt-yellow/20 text-volt-yellow font-bold">⚡</span>
                        <h2 className="text-xl font-black uppercase tracking-wide">Gerador de Massa 2.0 (Onboarding 360°)</h2>
                    </div>
                    <p className="text-xs opacity-70 mt-1">
                        Jornada dedicada para cadastro de massas com governança de idade, endereço SAC e sincronia PostgreSQL.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => handleRandomFill()}
                    className={`px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer ${primaryBtnClass}`}
                >
                    <Dices className="w-4 h-4 animate-spin-slow" />
                    <span>🎲 Gerar Massa Aleatória Instantânea</span>
                </button>
            </div>

            {/* Stepper Header (1 -> 2 -> 3 -> 4) */}
            <div className={`p-4 rounded-2xl ${cardClass} grid grid-cols-2 md:grid-cols-4 gap-2 text-xs`}>
                <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className={`p-3 rounded-xl flex items-center gap-2.5 transition-all text-left ${
                        currentStep === 1
                            ? isMidnight ? 'bg-volt-green/20 text-volt-green border border-volt-green/40 font-black' : 'bg-volt-yellow border-2 border-black font-black'
                            : 'opacity-60 hover:opacity-100'
                    }`}
                >
                    <div className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center font-bold text-[11px]">1</div>
                    <div>
                        <p className="font-bold leading-tight">Perfil & Idade</p>
                        <p className="text-[10px] opacity-70">Trava de Tutor</p>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => isStep1Valid() && setCurrentStep(2)}
                    disabled={!isStep1Valid()}
                    className={`p-3 rounded-xl flex items-center gap-2.5 transition-all text-left disabled:opacity-30 ${
                        currentStep === 2
                            ? isMidnight ? 'bg-volt-green/20 text-volt-green border border-volt-green/40 font-black' : 'bg-volt-yellow border-2 border-black font-black'
                            : 'opacity-60 hover:opacity-100'
                    }`}
                >
                    <div className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center font-bold text-[11px]">2</div>
                    <div>
                        <p className="font-bold leading-tight">Endereço SAC</p>
                        <p className="text-[10px] opacity-70">Checagem Logística</p>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => isStep1Valid() && isStep2Valid() && setCurrentStep(3)}
                    disabled={!isStep1Valid() || !isStep2Valid()}
                    className={`p-3 rounded-xl flex items-center gap-2.5 transition-all text-left disabled:opacity-30 ${
                        currentStep === 3
                            ? isMidnight ? 'bg-volt-green/20 text-volt-green border border-volt-green/40 font-black' : 'bg-volt-yellow border-2 border-black font-black'
                            : 'opacity-60 hover:opacity-100'
                    }`}
                >
                    <div className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center font-bold text-[11px]">3</div>
                    <div>
                        <p className="font-bold leading-tight">Bandeira Cartão</p>
                        <p className="text-[10px] opacity-70">SVGs & Vencimento</p>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => isStep1Valid() && isStep2Valid() && setCurrentStep(4)}
                    disabled={!isStep1Valid() || !isStep2Valid()}
                    className={`p-3 rounded-xl flex items-center gap-2.5 transition-all text-left disabled:opacity-30 ${
                        currentStep === 4
                            ? isMidnight ? 'bg-volt-green/20 text-volt-green border border-volt-green/40 font-black' : 'bg-volt-yellow border-2 border-black font-black'
                            : 'opacity-60 hover:opacity-100'
                    }`}
                >
                    <div className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center font-bold text-[11px]">4</div>
                    <div>
                        <p className="font-bold leading-tight">Saldo & PGDB</p>
                        <p className="text-[10px] opacity-70">Sincronia Final</p>
                    </div>
                </button>
            </div>

            {/* Conteúdo Dinâmico do Step */}
            <div className={`p-6 rounded-3xl ${cardClass} space-y-6`}>

                {/* ETAPA 1: Perfil, Origem do País & Idade (Trava Tutor) */}
                {currentStep === 1 && (
                    <div className="space-y-5 animate-fade-in">
                        <div className="flex justify-between items-center border-b border-black/10 dark:border-white/10 pb-3">
                            <h3 className="font-black text-base flex items-center gap-2">
                                <UserIcon className="w-5 h-5 text-blue-500" />
                                <span>Etapa 1: Dados Pessoais, País e Governança de Idade</span>
                            </h3>
                            <span className="text-xs font-bold opacity-60">País Atual: {formData.countryOrigin}</span>
                        </div>

                        {/* Seletor de Origem por País */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold opacity-80 flex items-center gap-1.5">
                                <Globe2 className="w-4 h-4 text-emerald-500" />
                                <span>País de Origem da Massa:</span>
                            </label>
                            <select
                                value={formData.countryOrigin}
                                onChange={(e) => handleRandomFill(e.target.value)}
                                className={`w-full p-3 rounded-xl text-xs font-bold cursor-pointer ${inputClass}`}
                            >
                                <option value="Brasil">🇧🇷 Brasil (São Paulo, RJ, Curitiba)</option>
                                <option value="Estados Unidos">🇺🇸 Estados Unidos (Nova York, Miami, LA)</option>
                                <option value="Japão">🇯🇵 Japão (Tóquio, Quioto, Osaka)</option>
                                <option value="China">🇨🇳 China (Pequim, Xangai)</option>
                                <option value="Coreia do Sul">🇰🇷 Coreia do Sul (Seul, Busan)</option>
                                <option value="Arábia Saudita">🇸🇦 Arábia Saudita (Riad, Jeda)</option>
                                <option value="Portugal">🇵🇹 Portugal (Lisboa, Porto)</option>
                                <option value="Alemanha">🇩🇪 Alemanha (Berlim, Munique)</option>
                                <option value="França">🇫🇷 França (Paris, Marselha)</option>
                                <option value="Itália">🇮🇹 Itália (Roma, Milão)</option>
                                <option value="Argentina">🇦🇷 Argentina (Buenos Aires, Córdoba)</option>
                            </select>
                        </div>

                        {/* Nome Completo e CPF */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1.5">
                                <label className="font-bold opacity-80">Nome Completo do Cliente:</label>
                                <input
                                    type="text"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    placeholder="Ex: Lucas Gabriel Ferreira"
                                    className={`w-full p-3 rounded-xl font-bold ${inputClass}`}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-bold opacity-80">CPF (Com DV Válido):</label>
                                <input
                                    type="text"
                                    value={formData.cpf}
                                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                                    placeholder="000.000.000-00"
                                    className={`w-full p-3 rounded-xl font-mono font-bold ${inputClass}`}
                                />
                            </div>
                        </div>

                        {/* Data de Nascimento & Idade Calculada */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1.5">
                                <label className="font-bold opacity-80 flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Data de Nascimento:</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.birthDate}
                                    onChange={(e) => handleBirthDateChange(e.target.value)}
                                    className={`w-full p-3 rounded-xl font-mono font-bold ${inputClass}`}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-bold opacity-80">Idade Calculada:</label>
                                <div className={`p-3 rounded-xl font-mono font-black text-sm flex justify-between items-center ${inputClass}`}>
                                    <span>{formData.age} anos</span>
                                    {formData.age < 18 || formData.age > 80 ? (
                                        <span className="text-[10px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-bold">REQUER TUTOR</span>
                                    ) : (
                                        <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">TITULAR DIRETO</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Botões de Toggle para Testar Trava de Tutor */}
                        <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 flex flex-wrap gap-2 items-center text-xs">
                            <span className="font-bold opacity-70">Atalho de Idade para Testes:</span>
                            <button
                                type="button"
                                onClick={() => handleRandomFill(formData.countryOrigin, 'normal')}
                                className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-300 font-bold hover:bg-blue-500/30"
                            >
                                🧑 Adulto (28a)
                            </button>
                            <button
                                type="button"
                                onClick={() => handleRandomFill(formData.countryOrigin, 'under18')}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold hover:bg-amber-500/30"
                            >
                                👶 Menor de 18 (14a)
                            </button>
                            <button
                                type="button"
                                onClick={() => handleRandomFill(formData.countryOrigin, 'over80')}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-300 font-bold hover:bg-rose-500/30"
                            >
                                👴 Maior de 80 (85a)
                            </button>
                        </div>

                        {/* CARD DE TUTOR LEGAL (Caso Idade < 18 ou > 80) */}
                        {formData.hasTutor && (
                            <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-xs space-y-3 animate-shake">
                                <div className="flex items-center gap-2 font-black text-amber-600 dark:text-amber-400">
                                    <ShieldAlert className="w-5 h-5 text-amber-500" />
                                    <span>Alerta de Governança: Idade fora da faixa direta (18 a 80 anos). É obrigatório o cadastro do Tutor Legal!</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label className="font-bold opacity-80">Nome do Tutor Legal:</label>
                                        <input
                                            type="text"
                                            value={formData.tutor?.fullName || ''}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                tutor: { ...formData.tutor!, fullName: e.target.value }
                                            })}
                                            placeholder="Nome do Tutor"
                                            className={`w-full p-2.5 rounded-xl font-bold ${inputClass}`}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="font-bold opacity-80">CPF do Tutor:</label>
                                        <input
                                            type="text"
                                            value={formData.tutor?.cpf || ''}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                tutor: { ...formData.tutor!, cpf: e.target.value }
                                            })}
                                            placeholder="000.000.000-00"
                                            className={`w-full p-2.5 rounded-xl font-mono font-bold ${inputClass}`}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="font-bold opacity-80">Grau de Parentesco:</label>
                                        <input
                                            type="text"
                                            value={formData.tutor?.relationship || ''}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                tutor: { ...formData.tutor!, relationship: e.target.value }
                                            })}
                                            placeholder="Pai / Curador"
                                            className={`w-full p-2.5 rounded-xl font-bold ${inputClass}`}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ETAPA 2: Endereço Residencial para Checagem SAC */}
                {currentStep === 2 && (
                    <div className="space-y-5 animate-fade-in">
                        <div className="flex justify-between items-center border-b border-black/10 dark:border-white/10 pb-3">
                            <h3 className="font-black text-base flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-emerald-500" />
                                <span>Etapa 2: Endereço Residencial para Entregas & Atendimento SAC</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => handleRandomFill(formData.countryOrigin)}
                                className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1"
                            >
                                <Dices className="w-3.5 h-3.5" /> Sortear Endereço
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                            <div className="space-y-1.5">
                                <label className="font-bold opacity-80">CEP / Postal Code:</label>
                                <input
                                    type="text"
                                    value={formData.address.cep}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        address: { ...formData.address, cep: e.target.value }
                                    })}
                                    className={`w-full p-3 rounded-xl font-mono font-bold ${inputClass}`}
                                />
                            </div>
                            <div className="sm:col-span-2 space-y-1.5">
                                <label className="font-bold opacity-80">Logradouro (Rua/Avenida):</label>
                                <input
                                    type="text"
                                    value={formData.address.street}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        address: { ...formData.address, street: e.target.value }
                                    })}
                                    className={`w-full p-3 rounded-xl font-bold ${inputClass}`}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                            <div className="space-y-1.5">
                                <label className="font-bold opacity-80">Número:</label>
                                <input
                                    type="text"
                                    value={formData.address.number}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        address: { ...formData.address, number: e.target.value }
                                    })}
                                    className={`w-full p-3 rounded-xl font-bold ${inputClass}`}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-bold opacity-80">Bairro:</label>
                                <input
                                    type="text"
                                    value={formData.address.neighborhood}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        address: { ...formData.address, neighborhood: e.target.value }
                                    })}
                                    className={`w-full p-3 rounded-xl font-bold ${inputClass}`}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-bold opacity-80">Cidade / UF:</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.address.city}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            address: { ...formData.address, city: e.target.value }
                                        })}
                                        className={`w-full p-3 rounded-xl font-bold ${inputClass}`}
                                    />
                                    <input
                                        type="text"
                                        value={formData.address.state}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            address: { ...formData.address, state: e.target.value }
                                        })}
                                        className={`w-20 p-3 rounded-xl font-bold uppercase text-center ${inputClass}`}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Pré-visualização da Etiqueta Postal de Entrega SAC */}
                        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-xs space-y-2">
                            <div className="flex items-center justify-between font-bold text-blue-600 dark:text-blue-300">
                                <span className="flex items-center gap-1.5">
                                    <PackageCheck className="w-4 h-4" />
                                    <span>Etiqueta de Entrega do Cartão (Simulação SAC/CS):</span>
                                </span>
                                <span className="text-[10px] bg-blue-500 text-white font-black px-2 py-0.5 rounded-full">VOLT EXPRESS</span>
                            </div>
                            <p className="font-mono text-sm font-black">{formData.fullName}</p>
                            <p className="opacity-80">
                                {formData.address.street}, nº {formData.address.number} - {formData.address.neighborhood}
                            </p>
                            <p className="opacity-80 font-semibold">
                                {formData.address.city} / {formData.address.state} - CEP: {formData.address.cep} ({formData.countryOrigin})
                            </p>
                        </div>
                    </div>
                )}

                {/* ETAPA 3: Bandeira do Cartão SVG & Vencimento */}
                {currentStep === 3 && (
                    <div className="space-y-5 animate-fade-in">
                        <div className="flex justify-between items-center border-b border-black/10 dark:border-white/10 pb-3">
                            <h3 className="font-black text-base flex items-center gap-2">
                                <CardIcon className="w-5 h-5 text-purple-500" />
                                <span>Etapa 3: Seleção de Bandeiras SVG & Dia de Vencimento</span>
                            </h3>
                        </div>

                        {/* Seletor de Bandeira com Ilustrações SVG */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold opacity-80">Escolha a Bandeira do Cartão:</label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                                {/* MASTERCARD */}
                                <button
                                    type="button"
                                    onClick={() => setFormData({
                                        ...formData,
                                        creditCard: { ...formData.creditCard, brand: 'MASTERCARD' }
                                    })}
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-all ${
                                        formData.creditCard.brand === 'MASTERCARD'
                                            ? 'bg-rose-500/15 border-rose-500 ring-2 ring-rose-500/40 font-black scale-105'
                                            : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-rose-400'
                                    }`}
                                >
                                    <svg className="w-10 h-6" viewBox="0 0 36 24" fill="none">
                                        <circle cx="12" cy="12" r="10" fill="#EB001B" />
                                        <circle cx="24" cy="12" r="10" fill="#F79E1B" fillOpacity="0.8" />
                                    </svg>
                                    <span>MASTERCARD</span>
                                </button>

                                {/* VISA */}
                                <button
                                    type="button"
                                    onClick={() => setFormData({
                                        ...formData,
                                        creditCard: { ...formData.creditCard, brand: 'VISA' }
                                    })}
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-all ${
                                        formData.creditCard.brand === 'VISA'
                                            ? 'bg-blue-500/15 border-blue-500 ring-2 ring-blue-500/40 font-black scale-105'
                                            : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-blue-400'
                                    }`}
                                >
                                    <svg className="w-10 h-6" viewBox="0 0 36 24" fill="none">
                                        <rect width="36" height="24" rx="4" fill="#1A1F71" />
                                        <text x="6" y="16" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontStyle="italic">VISA</text>
                                    </svg>
                                    <span>VISA</span>
                                </button>

                                {/* ELO */}
                                <button
                                    type="button"
                                    onClick={() => setFormData({
                                        ...formData,
                                        creditCard: { ...formData.creditCard, brand: 'ELO' }
                                    })}
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-all ${
                                        formData.creditCard.brand === 'ELO'
                                            ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/40 font-black scale-105'
                                            : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-amber-400'
                                    }`}
                                >
                                    <svg className="w-10 h-6" viewBox="0 0 36 24" fill="none">
                                        <rect width="36" height="24" rx="4" fill="#000000" />
                                        <circle cx="12" cy="12" r="5" fill="#EF4444" />
                                        <circle cx="18" cy="12" r="5" fill="#F59E0B" />
                                        <circle cx="24" cy="12" r="5" fill="#3B82F6" />
                                    </svg>
                                    <span>ELO</span>
                                </button>

                                {/* AMEX */}
                                <button
                                    type="button"
                                    onClick={() => setFormData({
                                        ...formData,
                                        creditCard: { ...formData.creditCard, brand: 'AMEX' }
                                    })}
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-all ${
                                        formData.creditCard.brand === 'AMEX'
                                            ? 'bg-cyan-500/15 border-cyan-500 ring-2 ring-cyan-500/40 font-black scale-105'
                                            : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-cyan-400'
                                    }`}
                                >
                                    <svg className="w-10 h-6" viewBox="0 0 36 24" fill="none">
                                        <rect width="36" height="24" rx="4" fill="#006FCF" />
                                        <text x="4" y="16" fill="#FFFFFF" fontSize="9" fontWeight="black">AMEX</text>
                                    </svg>
                                    <span>AMEX</span>
                                </button>

                                {/* HIPERCARD */}
                                <button
                                    type="button"
                                    onClick={() => setFormData({
                                        ...formData,
                                        creditCard: { ...formData.creditCard, brand: 'HIPERCARD' }
                                    })}
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-all ${
                                        formData.creditCard.brand === 'HIPERCARD'
                                            ? 'bg-red-600/15 border-red-600 ring-2 ring-red-600/40 font-black scale-105'
                                            : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-red-500'
                                    }`}
                                >
                                    <svg className="w-10 h-6" viewBox="0 0 36 24" fill="none">
                                        <rect width="36" height="24" rx="4" fill="#B91C1C" />
                                        <text x="3" y="16" fill="#FFFFFF" fontSize="7.5" fontWeight="black">HIPER</text>
                                    </svg>
                                    <span>HIPERCARD</span>
                                </button>
                            </div>
                        </div>

                        {/* Dia de Vencimento, Modalidade & Estado de Ativação */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                            <div className="space-y-1.5">
                                <label className="font-bold opacity-80">Dia de Vencimento da Fatura:</label>
                                <select
                                    value={formData.creditCard.dueDay}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        creditCard: { ...formData.creditCard, dueDay: Number(e.target.value) }
                                    })}
                                    className={`w-full p-3 rounded-xl font-bold cursor-pointer ${inputClass}`}
                                >
                                    <option value={5}>📅 Dia 05 de cada mês</option>
                                    <option value={10}>📅 Dia 10 de cada mês</option>
                                    <option value={15}>📅 Dia 15 de cada mês</option>
                                    <option value={20}>📅 Dia 20 de cada mês</option>
                                    <option value={25}>📅 Dia 25 de cada mês</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-bold opacity-80">Modalidade de Emissão:</label>
                                <select
                                    value={formData.creditCard.cardType}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        creditCard: { ...formData.creditCard, cardType: e.target.value as any }
                                    })}
                                    className={`w-full p-3 rounded-xl font-bold cursor-pointer ${inputClass}`}
                                >
                                    <option value="PHYSICAL">💳 Cartão Físico Postal</option>
                                    <option value="VIRTUAL">📱 Cartão Virtual Recorrente</option>
                                    <option value="BOTH">✨ Ambos (Físico + Virtual)</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-bold opacity-80">Status de Ativação do Cartão:</label>
                                <select
                                    value={formData.creditCard.activationState || 'ACTIVATED'}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        creditCard: { ...formData.creditCard, activationState: e.target.value as any }
                                    })}
                                    className={`w-full p-3 rounded-xl font-bold cursor-pointer ${
                                        formData.creditCard.activationState === 'AWAITING_ACTIVATION'
                                            ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-300 font-black'
                                            : inputClass
                                    }`}
                                >
                                    <option value="ACTIVATED">✅ Já Ativado (Pronto p/ Uso)</option>
                                    <option value="AWAITING_ACTIVATION">⏳ Cliente Aguardando p/ Ativar (App)</option>
                                </select>
                            </div>
                        </div>

                        {/* Pré-visualização do Cartão Gerado */}
                        <div className={`p-5 rounded-2xl relative overflow-hidden text-white font-mono shadow-xl ${
                            formData.creditCard.brand === 'VISA' ? 'bg-gradient-to-br from-blue-700 via-indigo-800 to-black' :
                            formData.creditCard.brand === 'AMEX' ? 'bg-gradient-to-br from-cyan-600 via-teal-800 to-black' :
                            formData.creditCard.brand === 'ELO' ? 'bg-gradient-to-br from-zinc-800 via-neutral-900 to-black border border-white/20' :
                            'bg-gradient-to-br from-rose-700 via-red-900 to-black'
                        }`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] opacity-70 tracking-widest uppercase">VOLT BANK BLACK</p>
                                    <p className="text-xs font-bold">{formData.creditCard.brand}</p>
                                </div>
                                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold">VENC. DIA {formData.creditCard.dueDay}</span>
                            </div>
                            <p className="text-lg font-black tracking-widest my-4">{formData.creditCard.cardNumber}</p>
                            <div className="flex justify-between text-[10px] opacity-80">
                                <span>VAL: {formData.creditCard.expirationDate}</span>
                                <span>CVV: {formData.creditCard.cvv}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ETAPA 4: Saldo, Limites & Sincronia PostgreSQL */}
                {currentStep === 4 && (
                    <div className="space-y-5 animate-fade-in">
                        <div className="flex justify-between items-center border-b border-black/10 dark:border-white/10 pb-3">
                            <h3 className="font-black text-base flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-volt-green" />
                                <span>Etapa 4: Saldo, Limites Financeiros & Sincronia PGDB</span>
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                            <div className="space-y-1.5">
                                <label className="font-bold opacity-80">Saldo em Conta Corrente (R$):</label>
                                <input
                                    type="number"
                                    value={formData.balance}
                                    onChange={(e) => setFormData({ ...formData, balance: Number(e.target.value) })}
                                    className={`w-full p-3 rounded-xl font-mono font-bold ${inputClass}`}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-bold opacity-80">Limite de Crédito Aprovado (R$):</label>
                                <input
                                    type="number"
                                    value={formData.creditCard.limit}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        creditCard: { ...formData.creditCard, limit: Number(e.target.value) }
                                    })}
                                    className={`w-full p-3 rounded-xl font-mono font-bold ${inputClass}`}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-bold opacity-80">Limite Diário de PIX (R$):</label>
                                <input
                                    type="number"
                                    value={formData.dailyPixLimit}
                                    onChange={(e) => setFormData({ ...formData, dailyPixLimit: Number(e.target.value) })}
                                    className={`w-full p-3 rounded-xl font-mono font-bold ${inputClass}`}
                                />
                            </div>
                        </div>

                        {/* Estado Inicial de Faturamento */}
                        <div className="space-y-2 text-xs">
                            <label className="font-bold opacity-80">Estado da Massa & Faturamento Inicial:</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, overdueState: 'EM_DIA' })}
                                    className={`p-3.5 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                                        formData.overdueState === 'EM_DIA'
                                            ? 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/40 font-black'
                                            : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-emerald-300'
                                    }`}
                                >
                                    <span className="text-xl">🟢</span>
                                    <div className="text-left">
                                        <p className="font-bold">Massa Adimplente (Em Dia)</p>
                                        <p className="text-[10px] opacity-70">Compras correntes normais sem atrasos de pagamento</p>
                                    </div>
                                </button>

                                {(Object.keys(OVERDUE_TIERS) as Array<keyof typeof OVERDUE_TIERS>).map((tierKey) => {
                                    const tier = OVERDUE_TIERS[tierKey];
                                    const selected = formData.overdueState === tierKey;
                                    return (
                                        <button
                                            key={tierKey}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, overdueState: tierKey as OverdueState })}
                                            className={`p-3.5 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                                                selected
                                                    ? 'bg-rose-500/15 border-rose-500 ring-2 ring-rose-500/40 font-black'
                                                    : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-rose-300'
                                            }`}
                                        >
                                            <span className="text-xl">🔴</span>
                                            <div className="text-left">
                                                <p className="font-bold">Massa {tier.label}</p>
                                                <p className="text-[10px] opacity-70">{tier.desc}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Resumo Final de Confirmação */}
                        <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 space-y-2 text-xs">
                            <p className="font-black text-sm text-volt-green flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4" /> Resumo da Massa a ser Gravada no PGDB:
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 opacity-90 font-mono text-[11px]">
                                <div><span className="opacity-60">Cliente:</span> {formData.fullName}</div>
                                <div><span className="opacity-60">CPF:</span> {formData.cpf}</div>
                                <div><span className="opacity-60">País:</span> {formData.countryOrigin}</div>
                                <div><span className="opacity-60">Idade:</span> {formData.age}a {formData.hasTutor ? '(Tutor)' : ''}</div>
                                <div><span className="opacity-60">Bandeira:</span> {formData.creditCard.brand}</div>
                                <div><span className="opacity-60">Vencimento:</span> Dia {formData.creditCard.dueDay}</div>
                                <div><span className="opacity-60">Saldo:</span> R$ {formData.balance.toFixed(2)}</div>
                                <div><span className="opacity-60">Limite:</span> R$ {formData.creditCard.limit.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer de Navegação */}
                <div className="flex justify-between items-center pt-4 border-t border-black/10 dark:border-white/10">
                    {currentStep > 1 ? (
                        <button
                            type="button"
                            onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                            className={`px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition-all cursor-pointer ${secondaryBtnClass}`}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Voltar</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onCancel}
                            className={`px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition-all cursor-pointer ${secondaryBtnClass}`}
                        >
                            <span>Cancelar</span>
                        </button>
                    )}

                    {currentStep < 4 ? (
                        <button
                            type="button"
                            onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
                            disabled={
                                (currentStep === 1 && !isStep1Valid()) ||
                                (currentStep === 2 && !isStep2Valid())
                            }
                            className={`px-6 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 ${primaryBtnClass}`}
                        >
                            <span>Avançar</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleFinalSubmit}
                            disabled={isSaving}
                            className={`px-8 py-3 rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${primaryBtnClass}`}
                        >
                            {isSaving ? (
                                <span>Sincronizando com o PGDB...</span>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4 text-black" />
                                    <span>⚡ Criar e Sincronizar Massa no PGDB</span>
                                </>
                            )}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};
