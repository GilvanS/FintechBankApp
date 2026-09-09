import React, { useState } from 'react';
import { ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
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
    // h-screen + overflow-y-auto AQUI: #root/body/html deste app não propagam scroll pra
    // fora de si (ficam travados em 100vh mesmo com filho mais alto — ver outras telas do
    // app, mesmo padrão). Por isso a página INTEIRA precisa ser o único container de
    // scroll — nada de scroll aninhado dentro dela (por isso os painéis internos não têm
    // mais overflow-y-auto próprio).
    <div className="h-screen overflow-y-auto bg-volt-dark text-volt-white flex flex-col w-full font-sans overflow-x-hidden">
      {/* Toast Notification Container */}
      <ToastContainer toast={toast} onClose={hide} />

      {/* Header Bar — só o botão Voltar, sem logo/título/badge, pra maximizar espaço
          vertical da página. */}
      <header className="w-full px-6 py-4 sticky top-0 z-30">
        <button
          onClick={onNavigateToLogin}
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-volt-muted hover:text-volt-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>
      </header>

      {/* Main 50/50 Split Screen Content — largura TOTAL da página (sem max-width
          artificial), scroll é da PÁGINA inteira, não de uma caixa interna. */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 w-full px-6 sm:px-8 lg:px-12 pb-8 gap-8 items-start">
        {/* Left Panel: Form Wizard Container */}
        <div
          data-testid="onboard-left-panel"
          className="modal-card w-full p-6"
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
          className="modal-card w-full lg:sticky lg:top-24 space-y-6 flex flex-col items-center justify-center p-6"
        >
          <div className="text-center space-y-1 mb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-volt-green flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-volt-green" />
              Pré-visualização em Tempo Real
            </h2>
            <p className="text-xs text-volt-muted">
              Interaja com o formulário ao lado para personalizar seu cartão e conta
            </p>
          </div>

          <CardPreview3D
            brand={formData.cardBrand || 'VISA'}
            tier={formData.cardTier || 'GOLD'}
            productType={formData.productType || 'PHYSICAL'}
            printedName={formData.cardPrintedName || formData.name || 'NOME NO CARTÃO'}
            billingDueDay={formData.cardDueDay || 10}
            plan={formData.plan || 'FREE'}
            estimatedLimit={5000}
            isEmbossing={formData.instantEmbossing}
          />

          <div className="modal-card w-full max-w-lg p-4 text-xs space-y-2">
            <div className="flex items-center justify-between text-volt-white font-medium">
              <span>Benefícios do Plano Selecionado ({formData.plan}):</span>
              <CheckCircle2 className="w-4 h-4 text-volt-green" />
            </div>
            <ul className="list-disc list-inside space-y-1 text-volt-muted">
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
