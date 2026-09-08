import React, { useState } from 'react';
import { CardBrand, CardTier, OnboardPlan } from './CardPreview3D';

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

  // Section 4: Opções do Cartão
  cardBrand: CardBrand;
  cardTier: CardTier;
  cardDueDay: number;
  cardPrintedName: string;

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
  cardBrand: 'VISA',
  cardTier: 'GOLD',
  cardDueDay: 10,
  cardPrintedName: '',
  plan: 'FREE',
  pixKey: '',
};

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
      className="max-w-4xl mx-auto space-y-8 bg-slate-900 text-slate-100 p-6 md:p-8 rounded-2xl border border-slate-800 shadow-2xl overflow-y-auto max-h-[85vh]"
    >
      {/* Section 1: Dados Pessoais */}
      <section className="space-y-4 bg-slate-950/60 p-6 rounded-xl border border-slate-800/80">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
          <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-sm border border-cyan-500/30">
            1
          </span>
          <h2 className="text-xl font-semibold text-slate-100">
            Dados Pessoais
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="onboard-name"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Nome Completo
            </label>
            <input
              id="onboard-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Digite seu nome completo"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label
              htmlFor="onboard-cpf"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              CPF
            </label>
            <input
              id="onboard-cpf"
              type="text"
              name="cpf"
              value={formData.cpf}
              onChange={handleChange}
              placeholder="000.000.000-00"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="onboard-birthDate"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Data de Nascimento
            </label>
            <input
              id="onboard-birthDate"
              type="date"
              name="birthDate"
              value={formData.birthDate}
              onChange={handleChange}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        {/* Conditional Tutor Section */}
        {requiresTutor && (
          <div className="mt-6 pt-4 border-t border-amber-500/30 bg-amber-950/20 p-4 rounded-lg border">
            <div className="flex items-center gap-2 text-amber-400 font-medium text-sm mb-3">
              <span>⚠️</span>
              <h3>Dados do Tutor Legal (Menor de 18 Anos)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="onboard-tutorName"
                  className="block text-xs font-medium text-amber-200 mb-1"
                >
                  Nome do Tutor Legal
                </label>
                <input
                  id="onboard-tutorName"
                  type="text"
                  name="tutorName"
                  value={formData.tutorName || ''}
                  onChange={handleChange}
                  placeholder="Nome do responsável legal"
                  required={requiresTutor}
                  className="w-full bg-slate-900 border border-amber-600/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label
                  htmlFor="onboard-tutorCpf"
                  className="block text-xs font-medium text-amber-200 mb-1"
                >
                  CPF do Tutor Legal
                </label>
                <input
                  id="onboard-tutorCpf"
                  type="text"
                  name="tutorCpf"
                  value={formData.tutorCpf || ''}
                  onChange={handleChange}
                  placeholder="000.000.000-00"
                  required={requiresTutor}
                  className="w-full bg-slate-900 border border-amber-600/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Contato & Acesso */}
      <section className="space-y-4 bg-slate-950/60 p-6 rounded-xl border border-slate-800/80">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
          <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-sm border border-cyan-500/30">
            2
          </span>
          <h2 className="text-xl font-semibold text-slate-100">
            Contato &amp; Acesso
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="onboard-email"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              E-mail
            </label>
            <input
              id="onboard-email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="seu.email@exemplo.com"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label
              htmlFor="onboard-phone"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Celular
            </label>
            <input
              id="onboard-phone"
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="(11) 99999-9999"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label
              htmlFor="onboard-password"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Senha
            </label>
            <input
              id="onboard-password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label
              htmlFor="onboard-confirmPassword"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Confirmar Senha
            </label>
            <input
              id="onboard-confirmPassword"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>
      </section>

      {/* Section 3: Endereço */}
      <section className="space-y-4 bg-slate-950/60 p-6 rounded-xl border border-slate-800/80">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
          <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-sm border border-cyan-500/30">
            3
          </span>
          <h2 className="text-xl font-semibold text-slate-100">Endereço</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="onboard-country"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              País
            </label>
            <input
              id="onboard-country"
              type="text"
              name="country"
              value={formData.country}
              onChange={handleChange}
              placeholder="Brasil"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label
              htmlFor="onboard-cep"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              CEP
            </label>
            <input
              id="onboard-cep"
              type="text"
              name="cep"
              value={formData.cep}
              onChange={handleChange}
              placeholder="00000-000"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label
              htmlFor="onboard-state"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              UF
            </label>
            <select
              id="onboard-state"
              name="state"
              value={formData.state}
              onChange={handleChange}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            >
              {[
                'AC',
                'AL',
                'AP',
                'AM',
                'BA',
                'CE',
                'DF',
                'ES',
                'GO',
                'MA',
                'MT',
                'MS',
                'MG',
                'PA',
                'PB',
                'PR',
                'PE',
                'PI',
                'RJ',
                'RN',
                'RS',
                'RO',
                'RR',
                'SC',
                'SP',
                'SE',
                'TO',
              ].map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="onboard-street"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
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
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label
              htmlFor="onboard-number"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
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
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label
              htmlFor="onboard-neighborhood"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Bairro
            </label>
            <input
              id="onboard-neighborhood"
              type="text"
              name="neighborhood"
              value={formData.neighborhood}
              onChange={handleChange}
              placeholder="Bairro"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="onboard-city"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
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
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>
      </section>

      {/* Section 4: Opções do Cartão */}
      <section className="space-y-4 bg-slate-950/60 p-6 rounded-xl border border-slate-800/80">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
          <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-sm border border-cyan-500/30">
            4
          </span>
          <h2 className="text-xl font-semibold text-slate-100">
            Opções do Cartão
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="onboard-cardBrand"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Bandeira
            </label>
            <select
              id="onboard-cardBrand"
              name="cardBrand"
              value={formData.cardBrand}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            >
              <option value="VISA">VISA</option>
              <option value="MASTERCARD">MASTERCARD</option>
              <option value="ELO">ELO</option>
              <option value="AMEX">AMEX</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="onboard-cardTier"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Categoria/Tier
            </label>
            <select
              id="onboard-cardTier"
              name="cardTier"
              value={formData.cardTier}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            >
              <option value="GOLD">GOLD (Sem Anuidade)</option>
              <option value="PLATINUM">PLATINUM (R$ 29,90/mês)</option>
              <option value="BLACK">BLACK (R$ 89,90/mês)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="onboard-cardDueDay"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Dia de Vencimento
            </label>
            <select
              id="onboard-cardDueDay"
              name="cardDueDay"
              value={formData.cardDueDay}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            >
              <option value={5}>Dia 5</option>
              <option value={10}>Dia 10</option>
              <option value={15}>Dia 15</option>
              <option value={20}>Dia 20</option>
              <option value={25}>Dia 25</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="onboard-cardPrintedName"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Nome no Cartão
            </label>
            <input
              id="onboard-cardPrintedName"
              type="text"
              name="cardPrintedName"
              value={formData.cardPrintedName}
              onChange={handleChange}
              placeholder="NOME COMO FIGURARÁ NO CARTÃO"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 uppercase"
            />
          </div>
        </div>
      </section>

      {/* Section 5: Plano da Conta & PIX */}
      <section className="space-y-4 bg-slate-950/60 p-6 rounded-xl border border-slate-800/80">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
          <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-sm border border-cyan-500/30">
            5
          </span>
          <h2 className="text-xl font-semibold text-slate-100">
            Plano da Conta &amp; PIX
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="onboard-plan"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Plano da Conta
            </label>
            <select
              id="onboard-plan"
              name="plan"
              value={formData.plan}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            >
              <option value="FREE">Plano Gratuito (FREE)</option>
              <option value="PRO">Plano Pro (R$ 19,90/mês)</option>
              <option value="VIP_BLACK">Plano VIP Black (R$ 49,90/mês)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="onboard-pixKey"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Chave PIX (opcional)
            </label>
            <input
              id="onboard-pixKey"
              type="text"
              name="pixKey"
              value={formData.pixKey}
              onChange={handleChange}
              placeholder="CPF, E-mail, Celular ou Aleatória"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>
      </section>

      {/* Submit Button */}
      <div className="pt-4 flex justify-end">
        <button
          type="submit"
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-cyan-500/20 active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          Concluir Cadastro
        </button>
      </div>
    </form>
  );
}
