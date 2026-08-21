import React, { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useAppState } from '../../contexts/AppStateContext';
import { adminCreateMassUser } from '../../services/api';
import { showToast } from '../../utils/toast';
import { generateRandomMassData, GeneratedMassData, OVERDUE_TIERS } from '../../utils/massGenerator';
import { useButtonAnimation } from '../../hooks/useGsapMotion';
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
    X as CloseIcon
} from 'lucide-react';

interface Props {
    onSuccess?: () => void;
    onCancel?: () => void;
}

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CARD_GRADIENT: Record<GeneratedMassData['creditCard']['brand'], string> = {
    VISA: 'from-blue-700 via-indigo-800 to-black',
    AMEX: 'from-cyan-600 via-teal-800 to-black',
    ELO: 'from-zinc-800 via-neutral-900 to-black',
    MASTERCARD: 'from-rose-700 via-red-900 to-black',
    HIPERCARD: 'from-rose-700 via-red-900 to-black'
};

export const MainMassCreatorFlow: React.FC<Props> = ({ onSuccess, onCancel }) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    const [formData, setFormData] = useState<GeneratedMassData>(() => generateRandomMassData('Brasil'));
    const [isSaving, setIsSaving] = useState(false);
    const [cardFlipped, setCardFlipped] = useState(false);
    const [cardHovering, setCardHovering] = useState(false);

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
    const handleRandomFill = (country?: string) => {
        const random = generateRandomMassData(country);
        setFormData(random);
        showToast(`🎲 Dados gerados com sucesso (${random.countryOrigin})!`, 'success');
        pulseGrid();
    };

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
                hasTutor: false,
                tutor: undefined,
                address: formData.address,
                countryOrigin: formData.countryOrigin,
                cardBrand: formData.creditCard.brand,
                dueDay: formData.creditCard.dueDay,
                cardType: formData.creditCard.cardType,
                cardActivation: formData.creditCard.activationState
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
        <div className="w-full max-w-6xl mx-auto space-y-4">
            {/* Header: título + ações principais (sempre visíveis, sem avançar de tela) */}
            <div className={`p-4 rounded-3xl ${cardClass} flex flex-col sm:flex-row items-stretch sm:items-center gap-3`}>
                <div className="flex-1 min-w-0 flex items-center gap-3">
                    <span className="p-2 rounded-xl bg-volt-yellow/20 text-volt-yellow font-bold shrink-0">⚡</span>
                    <div className="min-w-0">
                        <h2 className="text-base font-black uppercase tracking-wide leading-tight">Gerador de Massa 3.0</h2>
                        <p className="text-[10px] opacity-70 leading-tight">Painel único — gere, ajuste e conclua sem trocar de tela.</p>
                    </div>
                </div>

                <div className="flex gap-2 shrink-0">
                    <button
                        ref={dicesBtn.buttonRef}
                        {...dicesBtn.buttonProps}
                        type="button"
                        onClick={() => handleRandomFill()}
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
                        <span>{isSaving ? 'Gravando...' : 'Concluir e Criar'}</span>
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

            {/* Grid principal: esquerda (perfil, endereço, financeiro) | direita (cartão em destaque) */}
            <div ref={gridRef} className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-4">
                <div className="space-y-4">
                    {/* PERFIL */}
                    <div data-mass-section className={`p-4 rounded-3xl ${cardClass} space-y-3`}>
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
                                <span className="text-amber-500">⚠ fora da faixa padrão (18–80)</span>
                            ) : (
                                <span className="text-emerald-500">✓ titular direto</span>
                            )}
                        </div>
                    </div>

                    {/* ENDEREÇO */}
                    <div data-mass-section className={`p-4 rounded-3xl ${cardClass} space-y-3`}>
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

                    {/* FINANCEIRO */}
                    <div data-mass-section className={`p-4 rounded-3xl ${cardClass} space-y-3`}>
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
                                onClick={() => setFormData({ ...formData, overdueState: 'EM_DIA' })}
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
                                onClick={() => setFormData({ ...formData, overdueState: 'EM_ATRASO_15D' })}
                                title={OVERDUE_TIERS.EM_ATRASO_15D.desc}
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
                    </div>
                </div>

                {/* CARTÃO — coluna em destaque, sozinho, com flip 3D */}
                <div data-mass-section className={`p-4 rounded-3xl ${cardClass} space-y-3 lg:sticky lg:top-4 self-start`}>
                    <div className="flex justify-between items-center border-b border-black/10 dark:border-white/10 pb-2.5">
                        <h3 className="font-black text-sm flex items-center gap-1.5">
                            <CardIcon className="w-4 h-4 text-purple-500" />
                            <span>Cartão</span>
                        </h3>
                        <span className="text-[10px] opacity-60">clique ou passe o mouse pra virar</span>
                    </div>

                    {/* Cartão com perspectiva 3D — frente (dados) / verso (CVV) */}
                    <div className="[perspective:1200px] select-none">
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setCardFlipped((f) => !f)}
                            onMouseEnter={() => setCardHovering(true)}
                            onMouseLeave={() => setCardHovering(false)}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setCardFlipped((f) => !f)}
                            aria-label="Virar cartão para ver CVV"
                            className="relative h-40 sm:h-44 cursor-pointer"
                            style={{
                                transformStyle: 'preserve-3d',
                                transition: 'transform 0.7s',
                                transform: cardFlipped || cardHovering ? 'rotateY(180deg)' : 'rotateY(0deg)'
                            }}
                        >
                            {/* FRENTE */}
                            <div
                                style={{ backfaceVisibility: 'hidden' }}
                                className={`absolute inset-0 p-5 rounded-2xl text-white font-mono shadow-xl bg-gradient-to-br ${CARD_GRADIENT[formData.creditCard.brand]}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[10px] opacity-70 tracking-widest uppercase">VOLT BANK BLACK</p>
                                        <p className="text-xs font-bold">{formData.creditCard.brand}</p>
                                    </div>
                                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold">VENC. DIA {formData.creditCard.dueDay}</span>
                                </div>
                                <p className="text-lg font-black tracking-widest my-5">{formData.creditCard.cardNumberMasked}</p>
                                <div className="flex justify-between text-[10px] opacity-80">
                                    <span>VAL: {formData.creditCard.expirationDate}</span>
                                    <span>tap p/ ver CVV</span>
                                </div>
                            </div>

                            {/* VERSO */}
                            <div
                                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                                className={`absolute inset-0 rounded-2xl text-white font-mono shadow-xl bg-gradient-to-br ${CARD_GRADIENT[formData.creditCard.brand]}`}
                            >
                                <div className="h-9 bg-black/70 mt-5" />
                                <div className="px-5 pt-3 flex justify-between items-center">
                                    <div className="flex-1 h-6 bg-white/90 rounded-sm" />
                                    <div className="ml-2 px-2.5 py-1 bg-white text-black text-xs font-black rounded">{formData.creditCard.cvv}</div>
                                </div>
                                <p className="px-5 mt-3 text-[10px] opacity-60">Uso exclusivo de massa de teste — não é um cartão real.</p>
                            </div>
                        </div>
                    </div>

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
                            <select
                                value={formData.creditCard.dueDay}
                                onChange={(e) => setFormData({ ...formData, creditCard: { ...formData.creditCard, dueDay: Number(e.target.value) } })}
                                className={`w-full p-2 rounded-xl font-bold cursor-pointer ${inputClass}`}
                            >
                                <option value={5}>Dia 05</option>
                                <option value={10}>Dia 10</option>
                                <option value={15}>Dia 15</option>
                                <option value={20}>Dia 20</option>
                                <option value={25}>Dia 25</option>
                            </select>
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
                    <div><span className="opacity-60">Estado:</span> {formData.overdueState === 'EM_DIA' ? '🟢 Adimplente' : '🔴 Inadimplente'}</div>
                </div>
            </div>
        </div>
    );
};
