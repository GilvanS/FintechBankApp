import React, { useState } from 'react';
import { ArrowLeft, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react';
import OnboardFormContainer, { OnboardFormData } from './OnboardFormContainer';
import CardPreview3D from './CardPreview3D';
import { signUp } from '../../services/api';
import { useToast, ToastContainer } from '../Toast';

export interface NewOnboardViewProps {
  onSignUpSuccess?: () => void;
  onNavigateToLogin?: () => void;
}

export default function NewOnboardView({
  onSignUpSuccess,
  onNavigateToLogin,
}: NewOnboardViewProps) {
  const { toast, showSuccess, showError, hide } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<OnboardFormData>({
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
  });

  const handleFormDataChange = (updatedData: OnboardFormData) => {
    setFormData(updatedData);
  };

  const handleSubmit = async (data: OnboardFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const cpfClean = data.cpf ? data.cpf.replace(/\D/g, '') : '';
      const payload = {
        fullName: data.name,
        cpf: cpfClean,
        email: data.email,
        password: data.password,
        username: data.email ? data.email.split('@')[0] : '',
        name: data.name,
        birthDate: data.birthDate,
        tutorName: data.tutorName,
        tutorCpf: data.tutorCpf,
        phone: data.phone,
        country: data.country,
        cep: data.cep,
        street: data.street,
        number: data.number,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        cardBrand: data.cardBrand,
        cardTier: data.cardTier,
        cardDueDay: data.cardDueDay,
        cardPrintedName: data.cardPrintedName,
        plan: data.plan,
        pixKey: data.pixKey,
      };

      const res = await signUp(payload as any);
      if (res && res.success) {
        showSuccess(res.message || 'Conta Allure criada com sucesso!');
        if (onSignUpSuccess) {
          onSignUpSuccess();
        }
      } else {
        showError(res?.message || 'Erro ao realizar cadastro.');
      }
    } catch (err: any) {
      showError(err?.message || 'Erro inesperado ao realizar cadastro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col w-full font-sans overflow-x-hidden">
      {/* Toast Notification Container */}
      <ToastContainer toast={toast} onClose={hide} />

      {/* Header Bar */}
      <header className="w-full border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <button
          onClick={onNavigateToLogin}
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20">
            V
          </div>
          <span className="font-bold text-lg tracking-tight text-white">Volt Bank</span>
          <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            Nova Conta Allure 360°
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">Experiência Allure VIP</span>
          <span className="md:hidden">Allure</span>
        </div>
      </header>

      {/* Main 50/50 Split Screen Content */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-8 items-start">
        {/* Left Panel: Form Wizard Container (Scrollable) */}
        <div
          data-testid="onboard-left-panel"
          className="w-full bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm overflow-y-auto max-h-[calc(100vh-7rem)]"
        >
          <OnboardFormContainer
            initialData={formData}
            onFormDataChange={handleFormDataChange}
            onSubmit={handleSubmit}
          />
        </div>

        {/* Right Panel: Card & Plan 3D Preview (Sticky & Reactive) */}
        <div
          data-testid="onboard-right-panel"
          className="w-full lg:sticky lg:top-24 space-y-6 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-slate-800/80 rounded-2xl shadow-xl backdrop-blur-sm"
        >
          <div className="text-center space-y-1 mb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Pré-visualização em Tempo Real
            </h2>
            <p className="text-xs text-slate-400">
              Interaja com o formulário ao lado para personalizar seu cartão e conta
            </p>
          </div>

          <CardPreview3D
            brand={formData.cardBrand || 'VISA'}
            tier={formData.cardTier || 'GOLD'}
            printedName={formData.cardPrintedName || formData.name || 'NOME NO CARTÃO'}
            billingDueDay={formData.cardDueDay || 10}
            plan={formData.plan || 'FREE'}
            estimatedLimit={5000}
          />

          <div className="w-full max-w-md bg-slate-900/70 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 space-y-2">
            <div className="flex items-center justify-between text-slate-300 font-medium">
              <span>Benefícios do Plano Selecionado ({formData.plan}):</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Cartão Físico & Virtual sem anuidade oculta</li>
              <li>Acesso instantâneo à Área Pix 24/7</li>
              <li>Integração total com ecossistema Volt Allure</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
