import React, { useState } from 'react';
import { CardBrand, CardTier, OnboardPlan, CardProductType } from './CardPreview3D';
import { ShieldCheck, CreditCard, UserCheck, MapPin, Sparkles, Award, Globe } from 'lucide-react';

export interface OnboardFormData {
  // Section 1: Dados Pessoais
  name: string;
  cpf: string;
  birthDate: string;
  tutorName?: string;
  tutorCpf?: string;

  // Section 2: Contato & Acesso
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;

  // Section 3: Endereço
  country: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;

  // Section 4: Opções do Cartão & Produto
  productType: CardProductType;
  cardBrand: CardBrand;
  cardTier: CardTier;
  cardDueDay: number;
  cardPrintedName: string;
  instantEmbossing: boolean;

  // Section 5: Plano da Conta & PIX
  plan: OnboardPlan;
  pixKey: string;
}

export interface OnboardFormContainerProps {
  initialData?: Partial<OnboardFormData>;
  onFormDataChange?: (data: OnboardFormData) => void;
  onSubmit?: (data: OnboardFormData) => void;
}

export function isUnderage(birthDateString: string): boolean {
  if (!birthDateString) return false;
  const birthDate = new Date(birthDateString);
  if (isNaN(birthDate.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age < 18;
}

const defaultFormData: OnboardFormData = {
  name: '',
  cpf: '',
  birthDate: '',
  tutorName: '',
  tutorCpf: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  country: 'Brasil',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: 'SP',
  productType: 'PHYSICAL',
  cardBrand: 'VISA',
  cardTier: 'GOLD',
  cardDueDay: 10,
  cardPrintedName: '',
  instantEmbossing: true,
  plan: 'FREE',
  pixKey: '',
};

/** Formata progressivamente enquanto digita, travando no nº real de dígitos (11 pro
 *  CPF) — maxLength sozinho no input não basta, pois sem máscara dava pra digitar
 *  11 dígitos + pontuação e passar de 11 dígitos reais. */
function formatCpf(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

function formatCep(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}

export default function OnboardFormContainer({
  initialData,
  onFormDataChange,
  onSubmit,
}: OnboardFormContainerProps) {
  const [formData, setFormData] = useState<OnboardFormData>({
    ...defaultFormData,
    ...initialData,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    let newValue: any = value;
    if (name === 'cardDueDay') {
      newValue = Number(value);
    } else if (name === 'cpf' || name === 'tutorCpf') {
      newValue = formatCpf(value);
    } else if (name === 'phone') {
      newValue = formatPhone(value);
    } else if (name === 'cep') {
      newValue = formatCep(value);
    }

    const updatedData = {
      ...formData,
      [name]: newValue,
    };

    // Auto update cardPrintedName if user hasn't explicitly set it or when name changes
    if (name === 'name' && (!formData.cardPrintedName || formData.cardPrintedName === formData.name.toUpperCase())) {
      updatedData.cardPrintedName = value.toUpperCase();
    }

    setFormData(updatedData);
    if (onFormDataChange) {
      onFormDataChange(updatedData);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(formData);
    }
  };

  const requiresTutor = isUnderage(formData.birthDate);

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full space-y-6 select-none"
    >
      {/* 2 cards empilhados (1 coluna) — lado a lado deixava cada campo espremido
          numa faixa estreita, difícil de ler/preencher. */}
      <div className="flex flex-col gap-6">

        {/* CARD MODAL 1: DADOS PESSOAIS, CONTATO E ENDEREÇO */}
        <div className="modal-card p-6 space-y-6">
          {/* Header Card 1 */}
          <div className="flex items-center gap-3 border-b border-volt-surface-high pb-3">
            <span className="w-9 h-9 rounded-xl bg-volt-green/20 text-volt-green font-black flex items-center justify-center text-sm border border-volt-green/30">
              1
            </span>
            <div>
              <h2 className="text-lg font-bold text-volt-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-volt-green" /> Identificação &amp; Endereço
              </h2>
              <p className="text-xs text-volt-muted">Seus dados básicos e localização residencial</p>
            </div>
          </div>

          {/* Section 1: Dados Pessoais */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="onboard-name" className="block text-xs font-medium text-volt-muted mb-1">
                  Nome Completo
                </label>
                <input
                  id="onboard-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Nome e Sobrenome"
                  required
                  className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white placeholder-volt-muted focus:outline-none focus:border-volt-green focus:ring-1 focus:ring-volt-green"
                />
              </div>

              <div>
                <label htmlFor="onboard-cpf" className="block text-xs font-medium text-volt-muted mb-1">
                  CPF
                </label>
                <input
                  id="onboard-cpf"
                  type="text"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleChange}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  required
                  className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white placeholder-volt-muted focus:outline-none focus:border-volt-green focus:ring-1 focus:ring-volt-green"
                />
              </div>
            </div>

            <div>
              <label htmlFor="onboard-birthDate" className="block text-xs font-medium text-volt-muted mb-1">
                Data de Nascimento
              </label>
              <input
                id="onboard-birthDate"
                type="date"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleChange}
                required
                className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white focus:outline-none focus:border-volt-green focus:ring-1 focus:ring-volt-green"
              />
            </div>

            {/* Conditional Tutor Section */}
            {requiresTutor && (
              <div className="bg-amber-950/40 border border-amber-500/40 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" /> Dados do Tutor Legal (Menor de 18 Anos)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="onboard-tutorName" className="block text-[11px] font-medium text-amber-200/90 mb-1">
                      Nome do Tutor Legal
                    </label>
                    <input
                      id="onboard-tutorName"
                      type="text"
                      name="tutorName"
                      value={formData.tutorName || ''}
                      onChange={handleChange}
                      placeholder="Nome do Responsável"
                      required={requiresTutor}
                      className="w-full bg-volt-surface border border-amber-600/50 rounded-lg px-3 py-2 text-sm text-volt-white placeholder-volt-muted focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label htmlFor="onboard-tutorCpf" className="block text-[11px] font-medium text-amber-200/90 mb-1">
                      CPF do Tutor Legal
                    </label>
                    <input
                      id="onboard-tutorCpf"
                      type="text"
                      name="tutorCpf"
                      value={formData.tutorCpf || ''}
                      onChange={handleChange}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      required={requiresTutor}
                      className="w-full bg-volt-surface border border-amber-600/50 rounded-lg px-3 py-2 text-sm text-volt-white placeholder-volt-muted focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Contato & Acesso */}
          <div className="space-y-4 pt-2 border-t border-volt-surface-high/80">
            <h3 className="text-sm font-bold text-volt-white uppercase tracking-wider">Contato &amp; Acesso</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="onboard-email" className="block text-xs font-medium text-volt-muted mb-1">
                  E-mail
                </label>
                <input
                  id="onboard-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="voce@exemplo.com"
                  required
                  className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white placeholder-volt-muted focus:outline-none focus:border-volt-green focus:ring-1 focus:ring-volt-green"
                />
              </div>

              <div>
                <label htmlFor="onboard-phone" className="block text-xs font-medium text-volt-muted mb-1">
                  Celular
                </label>
                <input
                  id="onboard-phone"
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(11) 99999-9999"
                  maxLength={16}
                  required
                  className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white placeholder-volt-muted focus:outline-none focus:border-volt-green focus:ring-1 focus:ring-volt-green"
                />
              </div>

              <div>
                <label htmlFor="onboard-password" className="block text-xs font-medium text-volt-muted mb-1">
                  Senha
                </label>
                <input
                  id="onboard-password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="6 a 12 caracteres"
                  maxLength={12}
                  required
                  className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white placeholder-volt-muted focus:outline-none focus:border-volt-green focus:ring-1 focus:ring-volt-green"
                />
              </div>

              <div>
                <label htmlFor="onboard-confirmPassword" className="block text-xs font-medium text-volt-muted mb-1">
                  Confirmar Senha
                </label>
                <input
                  id="onboard-confirmPassword"
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repita a senha"
                  maxLength={12}
                  required
                  className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white placeholder-volt-muted focus:outline-none focus:border-volt-green focus:ring-1 focus:ring-volt-green"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Endereço Global */}
          <div className="space-y-4 pt-2 border-t border-volt-surface-high/80">
            <h3 className="text-sm font-bold text-volt-white uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-volt-green" /> Endereço Residencial
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label htmlFor="onboard-country" className="block text-xs font-medium text-volt-muted mb-1">
                  País
                </label>
                <select
                  id="onboard-country"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white focus:outline-none focus:border-volt-green"
                >
                  <option value="Brasil">Brasil 🇧🇷</option>
                  <option value="Estados Unidos">Estados Unidos 🇺🇸</option>
                  <option value="Portugal">Portugal 🇵🇹</option>
                  <option value="Espanha">Espanha 🇪🇸</option>
                  <option value="Japão">Japão 🇯🇵</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="onboard-cep" className="block text-xs font-medium text-volt-muted mb-1">
                  CEP / ZipCode
                </label>
                <input
                  id="onboard-cep"
                  type="text"
                  name="cep"
                  value={formData.cep}
                  onChange={handleChange}
                  placeholder="00000-000"
                  maxLength={9}
                  required
                  className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white placeholder-volt-muted focus:outline-none focus:border-volt-green"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label htmlFor="onboard-street" className="block text-xs font-medium text-volt-muted mb-1">
                  Logradouro
                </label>
                <input
                  id="onboard-street"
                  type="text"
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  placeholder="Rua / Avenida"
                  required
                  className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white focus:outline-none focus:border-volt-green"
                />
              </div>
              <div className="col-span-1">
                <label htmlFor="onboard-number" className="block text-xs font-medium text-volt-muted mb-1">
                  Número
                </label>
                <input
                  id="onboard-number"
                  type="text"
                  name="number"
                  value={formData.number}
                  onChange={handleChange}
                  placeholder="123"
                  required
                  className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white focus:outline-none focus:border-volt-green"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label htmlFor="onboard-city" className="block text-xs font-medium text-volt-muted mb-1">
                  Cidade
                </label>
                <input
                  id="onboard-city"
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Cidade"
                  required
                  className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white focus:outline-none focus:border-volt-green"
                />
              </div>
              <div className="col-span-1">
                <label htmlFor="onboard-neighborhood" className="block text-xs font-medium text-volt-muted mb-1">
                  Bairro
                </label>
                <input
                  id="onboard-neighborhood"
                  type="text"
                  name="neighborhood"
                  value={formData.neighborhood}
                  onChange={handleChange}
                  placeholder="Bairro"
                  className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white focus:outline-none focus:border-volt-green"
                />
              </div>
              <div className="col-span-1">
                <label htmlFor="onboard-state" className="block text-xs font-medium text-volt-muted mb-1">
                  UF
                </label>
                <input
                  id="onboard-state"
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  maxLength={2}
                  required
                  className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white uppercase focus:outline-none focus:border-volt-green"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CARD MODAL 2: SELEÇÃO DE PRODUTOS DE CARTÃO & PLANOS DA CONTA */}
        <div className="modal-card p-6 space-y-6 flex flex-col justify-between">
          {/* Header Card 2 */}
          <div className="flex items-center gap-3 border-b border-volt-surface-high pb-3">
            <span className="w-9 h-9 rounded-xl bg-volt-green/20 text-volt-green font-black flex items-center justify-center text-sm border border-volt-green/30">
              2
            </span>
            <div>
              <h2 className="text-lg font-bold text-volt-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-volt-green" /> Produto, Cartão &amp; Plano
              </h2>
              <p className="text-xs text-volt-muted">Escolha o produto ideal para o seu perfil</p>
            </div>
          </div>

          {/* Section 4: Produtos de Cartão */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-volt-white uppercase tracking-wider">Tipo de Produto</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'PHYSICAL', label: 'Físico', icon: '💳', desc: 'Internacional' },
                { id: 'VIRTUAL', label: 'Virtual', icon: '⚡', desc: 'Instantâneo' },
                { id: 'BUSINESS', label: 'PJ Business', icon: '💼', desc: 'Corporativo' },
                { id: 'CASHBACK', label: 'Cashback 2.5%', icon: '💰', desc: 'Extra' },
                { id: 'STUDENT', label: 'Estudante', icon: '🎓', desc: 'Sem Anuidade' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const updated = { ...formData, productType: p.id as CardProductType };
                    setFormData(updated);
                    if (onFormDataChange) onFormDataChange(updated);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    formData.productType === p.id
                      ? 'bg-volt-green/10 border-volt-green text-volt-green shadow-[0_0_12px_rgba(162,255,0,0.2)]'
                      : 'bg-volt-surface border-volt-surface-high text-volt-muted hover:border-volt-surface-high'
                  }`}
                >
                  <span className="text-xl">{p.icon}</span>
                  <div>
                    <div className="font-bold text-xs mt-1">{p.label}</div>
                    <div className="text-[10px] opacity-70">{p.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Bandeira & Tier */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label htmlFor="onboard-cardBrand" className="block text-xs font-medium text-volt-muted mb-1">
                  Bandeira
                </label>
                <select
                  id="onboard-cardBrand"
                  name="cardBrand"
                  value={formData.cardBrand}
                  onChange={handleChange}
                  className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white focus:outline-none focus:border-volt-green"
                >
                  <option value="VISA">VISA</option>
                  <option value="MASTERCARD">MASTERCARD</option>
                  <option value="ELO">ELO</option>
                  <option value="AMEX">AMEX</option>
                  <option value="HIPERCARD">HIPERCARD 🔴🟦</option>
                </select>
              </div>

              <div>
                <label htmlFor="onboard-cardTier" className="block text-xs font-medium text-volt-muted mb-1">
                  Categoria (Tier)
                </label>
                <select
                  id="onboard-cardTier"
                  name="cardTier"
                  value={formData.cardTier}
                  onChange={handleChange}
                  className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white focus:outline-none focus:border-volt-green"
                >
                  <option value="BRONZE">BRONZE (Simples / Gratuito)</option>
                  <option value="GOLD">GOLD (Gratuito)</option>
                  <option value="PLATINUM">PLATINUM (R$ 15/mês)</option>
                  <option value="BLACK">VIP BLACK (R$ 39/mês)</option>
                </select>
              </div>
            </div>

            {/* Ativação & Embossing Instantâneo */}
            <div className="bg-volt-surface-high border border-volt-green/30 p-3.5 rounded-xl flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-volt-green flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-volt-green" /> Embossing Digital Instantâneo
                </div>
                <div className="text-[10px] text-volt-muted mt-0.5">
                  Ativação imediata com gravação de chip e cartão em tempo real
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const updated = { ...formData, instantEmbossing: !formData.instantEmbossing };
                  setFormData(updated);
                  if (onFormDataChange) onFormDataChange(updated);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  formData.instantEmbossing
                    ? 'bg-volt-green text-black border-volt-green shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                    : 'bg-volt-dark border-volt-surface-high text-volt-muted'
                }`}
              >
                {formData.instantEmbossing ? 'Ativado ✨' : 'Desativado'}
              </button>
            </div>

            {/* Dia de Vencimento Pills */}
            <div>
              <label className="block text-xs font-medium text-volt-muted mb-2">
                Dia de Vencimento da Fatura
              </label>
              <div className="flex gap-2">
                {[5, 10, 15, 20, 25].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      const updated = { ...formData, cardDueDay: day };
                      setFormData(updated);
                      if (onFormDataChange) onFormDataChange(updated);
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                      formData.cardDueDay === day
                        ? 'bg-volt-green text-black border-volt-green shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                        : 'bg-volt-surface border-volt-surface-high text-volt-muted hover:border-volt-surface-high'
                    }`}
                  >
                    Dia {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="onboard-cardPrintedName" className="block text-xs font-medium text-volt-muted mb-1">
                Nome Impresso no Cartão
              </label>
              <input
                id="onboard-cardPrintedName"
                type="text"
                name="cardPrintedName"
                value={formData.cardPrintedName}
                onChange={handleChange}
                placeholder="NOME COMO NO CARTÃO"
                className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white uppercase focus:outline-none focus:border-volt-green"
              />
            </div>
          </div>

          {/* Section 5: Plano da Conta & PIX */}
          <div className="space-y-4 pt-2 border-t border-volt-surface-high/80">
            <h3 className="text-sm font-bold text-volt-white uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" /> Plano da Conta
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'FREE', label: 'Gratuito', price: 'R$ 0' },
                { id: 'PRO', label: 'Volt Pro', price: 'R$ 19,90/m' },
                { id: 'VIP_BLACK', label: 'VIP Black', price: 'R$ 49,90/m' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const updated = { ...formData, plan: p.id as OnboardPlan };
                    setFormData(updated);
                    if (onFormDataChange) onFormDataChange(updated);
                  }}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    formData.plan === p.id
                      ? 'bg-amber-500/10 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.2)]'
                      : 'bg-volt-surface border-volt-surface-high text-volt-muted hover:border-volt-surface-high'
                  }`}
                >
                  <div className="font-bold text-xs">{p.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{p.price}</div>
                </button>
              ))}
            </div>

            <div>
              <label htmlFor="onboard-pixKey" className="block text-xs font-medium text-volt-muted mb-1">
                Chave PIX Inicial (Opcional)
              </label>
              <input
                id="onboard-pixKey"
                type="text"
                name="pixKey"
                value={formData.pixKey}
                onChange={handleChange}
                placeholder="CPF ou Celular"
                className="w-full bg-volt-surface border border-volt-surface-high rounded-lg px-3 py-2 text-sm text-volt-white placeholder-volt-muted focus:outline-none focus:border-volt-green"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full mt-4 py-3.5 bg-volt-green text-black font-black uppercase tracking-wider rounded-xl hover:bg-[#a3ff12] transition-all shadow-[0_0_20px_rgba(162,255,0,0.3)] hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" /> Finalizar Cadastro &amp; Abrir Conta
          </button>
        </div>

      </div>
    </form>
  );
}