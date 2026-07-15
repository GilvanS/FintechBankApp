import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, CheckCircle2, AlertTriangle, Smartphone, Mail, Hash, User as UserIcon, Key, Utensils, Car, Tv, Heart, MoreHorizontal, Sparkles, Brain, Loader2 } from 'lucide-react';
import { getPixRecipientInfo, performPix, performPixCreditInstallment, getUserByCpf, getUserStatement, addPixContact } from '../services/api';
import { PixContact, Transaction } from '../types';
import { parseCurrency, formatCurrency } from '../utils/formatters';
import Contacts from './Contacts';
import PixKeyManagement from './PixKeyManagement';
import PasswordModal from './PasswordModal';
import { useAuth } from '../context/AuthContext';
import { useAppState } from '../contexts/AppStateContext';

type PixSubView = 'transfer' | 'keyManagement' | 'contacts' | 'confirmation';

interface PixViewProps {
  onBack: () => void;
}

export default function PixView({ onBack }: PixViewProps) {
  const { user, updateUser } = useAuth();
  const { triggerSmartAlertCheck, theme } = useAppState();
  const isMidnight = theme === 'midnight';
  const accent = isMidnight ? '#00E38B' : '#A2FF00';
  const [subView, setSubView] = useState<PixSubView>('transfer');
  const [pixKeyType, setPixKeyType] = useState<'cpf' | 'email' | 'phone' | 'random'>('cpf');
  const [pixKey, setPixKey] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdTx, setCreatedTx] = useState<Transaction | null>(null);

  const [recipientInfo, setRecipientInfo] = useState<{ name: string; cpf: string } | null>(null);
  const [transferDetails, setTransferDetails] = useState<{ key: string, amount: number, description: string, useCredit: boolean, category?: string } | null>(null);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingPinAction, setPendingPinAction] = useState<null | ((pin: string) => Promise<void>)>(null);

  const [useCredit, setUseCredit] = useState(false);

  // AI Auto-categorization states
  const [selectedCategory, setSelectedCategory] = useState<'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros'>('outros');
  const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiReason, setAiReason] = useState<string | null>(null);
  const [aiSuggestedCategory, setAiSuggestedCategory] = useState<string | null>(null);

  const performAutoCategorization = async (desc: string) => {
    if (!desc || desc.trim().length < 3) return;
    
    setIsAutoCategorizing(true);
    try {
      const response = await fetch("/api/gemini/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.category) {
          setSelectedCategory(data.category);
          setAiSuggestedCategory(data.category);
          if (data.confidence !== undefined) setAiConfidence(data.confidence);
          if (data.reason) setAiReason(data.reason);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to auto-categorize transaction:", err);
    } finally {
      setIsAutoCategorizing(false);
    }
    
    // Local fallback rules if API fails or key is not configured
    const cleanDesc = desc.toLowerCase().trim();
    let category: 'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros' = 'outros';
    let reason = "Classificado automaticamente usando o motor de regras local.";
    
    if (
      cleanDesc.includes('uber') || cleanDesc.includes('99') || cleanDesc.includes('taxi') || 
      cleanDesc.includes('posto') || cleanDesc.includes('gasolina') || cleanDesc.includes('combustivel') || 
      cleanDesc.includes('metro') || cleanDesc.includes('onibus') || cleanDesc.includes('pedagio') || 
      cleanDesc.includes('estacionamento') || cleanDesc.includes('cabify') || cleanDesc.includes('carro') ||
      cleanDesc.includes('viagem') || cleanDesc.includes('buser')
    ) {
      category = 'mobilidade';
      reason = "Identificado transporte ou mobilidade na descrição (Motor Local).";
    } else if (
      cleanDesc.includes('restaurante') || cleanDesc.includes('ifood') || cleanDesc.includes('mcdonald') || 
      cleanDesc.includes('burger') || cleanDesc.includes('pizza') || cleanDesc.includes('padaria') || 
      cleanDesc.includes('supermercado') || cleanDesc.includes('mercado') || cleanDesc.includes('cafe') || 
      cleanDesc.includes('doce') || cleanDesc.includes('jantar') || cleanDesc.includes('almoco') || 
      cleanDesc.includes('esfiha') || cleanDesc.includes('comida') || cleanDesc.includes('outback') ||
      cleanDesc.includes('pao') || cleanDesc.includes('subway') || cleanDesc.includes('starbucks')
    ) {
      category = 'refeicao';
      reason = "Identificado alimentação, restaurante ou mercado na descrição (Motor Local).";
    } else if (
      cleanDesc.includes('cinema') || cleanDesc.includes('teatro') || cleanDesc.includes('netflix') || 
      cleanDesc.includes('spotify') || cleanDesc.includes('show') || cleanDesc.includes('ingresso') || 
      cleanDesc.includes('livro') || cleanDesc.includes('game') || cleanDesc.includes('jogos') || 
      cleanDesc.includes('museu') || cleanDesc.includes('disney') || cleanDesc.includes('prime video') ||
      cleanDesc.includes('steam') || cleanDesc.includes('playstation') || cleanDesc.includes('xbox') ||
      cleanDesc.includes('show') || cleanDesc.includes('evento')
    ) {
      category = 'cultura';
      reason = "Identificado entretenimento, lazer, streaming ou cultura na descrição (Motor Local).";
    } else if (
      cleanDesc.includes('farmacia') || cleanDesc.includes('drogaria') || cleanDesc.includes('medico') || 
      cleanDesc.includes('hospital') || cleanDesc.includes('dentista') || cleanDesc.includes('remedio') || 
      cleanDesc.includes('exame') || cleanDesc.includes('clinica') || cleanDesc.includes('saude') ||
      cleanDesc.includes('terapia') || cleanDesc.includes('psicologo') || cleanDesc.includes('pague menos') ||
      cleanDesc.includes('raia') || cleanDesc.includes('drogasil')
    ) {
      category = 'saude';
      reason = "Identificado gastos com saúde, farmácia ou serviços médicos (Motor Local).";
    }
    
    setSelectedCategory(category);
    setAiSuggestedCategory(category);
    setAiConfidence(0.85);
    setAiReason(reason);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      if (!inputValue || inputValue.trim() === '') {
          setAmount('');
          return;
      }
      const formatted = formatCurrency(inputValue);
      setAmount(formatted);
  };

  const handleInitiateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');

    const numericAmount = parseCurrency(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Por favor, insira um valor válido maior que zero.');
      return;
    }

    if (!useCredit && numericAmount > user.balance) {
      setError('Saldo insuficiente para realizar esta transferência.');
      return;
    }

    if (!pixKey.trim()) {
      setError('Por favor, insira a chave Pix.');
      return;
    }

    setLoading(true);
    const recipientResult = await getPixRecipientInfo(pixKey, user.cpf);
    if (recipientResult.success && recipientResult.name && recipientResult.cpf) {
        setTransferDetails({ key: pixKey, amount: numericAmount, description, useCredit, category: selectedCategory });
        setRecipientInfo({ name: recipientResult.name, cpf: recipientResult.cpf });
        setSubView('confirmation');
    } else {
        setError(recipientResult.message || 'Chave PIX inválida ou não encontrada.');
    }
    setLoading(false);
  };

  const handleConfirmFromConfirmationScreen = () => {
      setPendingPinAction(() => async (pin: string) => {
          if (!user || !transferDetails || !recipientInfo) return;
          setLoading(true);
          let result;
          if (transferDetails.useCredit) {
              result = await performPixCreditInstallment(user.cpf, transferDetails.amount, 1, pin);
          } else {
              result = await performPix(user.cpf, transferDetails.key, transferDetails.amount, transferDetails.description, pin, transferDetails.category);
          }
          if (result.success) {
              // Update user balance/statement
              const refreshed = await getUserByCpf(user.cpf);
              if (refreshed.success && refreshed.user) {
                  const stmt = await getUserStatement(user.cpf);
                  if (stmt.success && stmt.transactions) {
                      updateUser({ ...refreshed.user, transactions: stmt.transactions });
                      // Find the new transaction to show in success
                      const newTx = stmt.transactions[0];
                      if (newTx) {
                          setCreatedTx(newTx);
                          triggerSmartAlertCheck(newTx.title || newTx.description, newTx.amount, transferDetails.category || 'outros');
                      }
                  } else {
                      updateUser(refreshed.user);
                  }
              }
              setSubView('transfer');
              setSuccess(true);
              // Salva destinatário como contato silenciosamente (ignora se já existe)
              addPixContact(user.cpf, { name: recipientInfo.name, key: transferDetails.key }).catch(() => {});
          } else {
              setError(`Falha na transferência: ${result.message}`);
              setSubView('transfer');
          }
          setLoading(false);
          setIsPasswordModalOpen(false);
      });
      setIsPasswordModalOpen(true);
  };

  const handlePasswordConfirm = async (pin: string) => {
      if (pendingPinAction) {
          await pendingPinAction(pin);
          setPendingPinAction(null);
      } else {
          setIsPasswordModalOpen(false);
      }
  };

  const resetForm = () => {
    setPixKey('');
    setAmount('');
    setDescription('');
    setSelectedCategory('outros');
    setAiSuggestedCategory(null);
    setAiConfidence(null);
    setAiReason(null);
    setError('');
    setSuccess(false);
    setCreatedTx(null);
    setSubView('transfer');
    setTransferDetails(null);
    setRecipientInfo(null);
  };

  const handleBackAction = () => {
    resetForm();
    onBack();
  };

  const handleSelectContact = (contact: PixContact) => {
      setPixKey(contact.key);
      setSubView('transfer');
  };

  if (!user) return null;

  // Classes derivadas do tema
  const headerClass = isMidnight
    ? 'border-b border-white/10 bg-white/[0.02]'
    : 'border-b-4 border-black bg-volt-yellow-pastel';
  const iconBubbleClass = isMidnight ? 'bg-white/5' : 'bg-white border-2 border-black';
  const titleTextClass = isMidnight ? 'text-white' : 'text-black';
  const subTextClass = isMidnight ? 'text-white/50' : 'text-black/60';
  const closeBtnClass = isMidnight
    ? 'hover:bg-white/10 text-white/50 hover:text-white'
    : 'hover:bg-black/10 text-black/60 hover:text-black';
  const bodyBgClass = isMidnight ? 'bg-[#0a0a0a]' : 'bg-white';
  const tabRowClass = isMidnight ? 'border-b border-white/10' : 'border-b-2 border-black/10';
  const tabInactiveClass = isMidnight ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-black/5 text-black/60 hover:bg-black/10';
  const tabActiveClass = isMidnight ? 'bg-volt-primary-dark text-black' : 'bg-volt-lime text-black border-2 border-black';
  const surfaceClass = isMidnight ? 'bg-white/5' : 'bg-black/5';
  const surfaceBorderClass = isMidnight ? 'bg-white/5 border border-white/10' : 'bg-black/5 border-2 border-black/10';
  const labelClass = isMidnight ? 'text-white/60' : 'text-black/60';
  const inputClass = isMidnight
    ? 'bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:border-volt-primary-dark focus:bg-white/10'
    : 'bg-black/5 border-2 border-black/10 text-black placeholder:text-black/30 focus:border-black focus:bg-white';
  const primaryBtnClass = isMidnight
    ? 'bg-volt-primary-dark text-black shadow-[0_0_20px_rgba(0,227,139,0.25)]'
    : 'bg-volt-lime text-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]';
  const secondaryTextClass = isMidnight ? 'text-white/60 hover:bg-white/5' : 'text-black/60 hover:bg-black/5';
  const dividerClass = isMidnight ? 'border-white/10' : 'border-black/10';

  return (
    <div className={`flex flex-col relative w-full h-full min-h-[calc(100vh-80px)] ${bodyBgClass}`}>
      {/* View Header */}
      <div className={`flex items-center justify-between px-6 py-4 shrink-0 ${headerClass}`}>
          <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBubbleClass}`}>
                  <span className={`material-symbols-outlined ${isMidnight ? 'text-white/80' : 'text-black'}`}>pix</span>
              </div>
              <div>
                  <h2 className={`text-xl font-black uppercase tracking-wider flex items-center gap-2 ${titleTextClass}`}>
                      {subView === 'transfer' && !success && <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: accent }}></span>}
                      {subView === 'transfer' ? (success ? 'Sucesso' : 'Enviar Pix') :
                       subView === 'confirmation' ? 'Confirmar Pix' :
                       subView === 'contacts' ? 'Contatos' : 'Minhas Chaves'}
                  </h2>
                  <p className={`text-xs uppercase tracking-widest ${subTextClass}`}>Área Pix</p>
              </div>
          </div>
          <button
              onClick={handleBackAction}
              className={`p-2 rounded-full transition-colors ${closeBtnClass}`}
          >
              <X size={24} />
          </button>
      </div>

      <div className={`flex-1 overflow-y-auto no-scrollbar relative p-6 flex flex-col items-center pb-28 ${bodyBgClass}`}>
        <div className="w-full max-w-md mx-auto">

      {/* Navigation inside view */}
      {!success && subView !== 'confirmation' && (
          <div className={`flex gap-2 mb-6 pb-4 ${tabRowClass}`}>
              <button onClick={() => setSubView('transfer')} className={`flex-1 text-xs py-2 rounded-lg font-bold transition-colors ${subView === 'transfer' ? tabActiveClass : tabInactiveClass}`}>Enviar</button>
              <button onClick={() => setSubView('contacts')} className={`flex-1 text-xs py-2 rounded-lg font-bold transition-colors ${subView === 'contacts' ? tabActiveClass : tabInactiveClass}`}>Contatos</button>
              <button onClick={() => setSubView('keyManagement')} className={`flex-1 text-xs py-2 rounded-lg font-bold transition-colors ${subView === 'keyManagement' ? tabActiveClass : tabInactiveClass}`}>Chaves</button>
          </div>
      )}

      {subView === 'transfer' && !success && (
        <form onSubmit={handleInitiateTransfer} className="space-y-4">
          {/* Available Balance */}
          <div className={`rounded-xl p-3 flex justify-between items-center ${surfaceClass}`}>
            <span className={`text-xs ${labelClass}`}>Saldo Disponível:</span>
            <span className="text-sm font-bold" style={{ color: accent }}>
              R$ {user.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Key Type Selection */}
          <div>
            <label className={`text-xs block mb-2 uppercase tracking-wider font-semibold ${labelClass}`}>
              Tipo de Chave
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['cpf', 'email', 'phone', 'random'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setPixKeyType(type); setPixKey(''); }}
                  className={`py-2 text-[10px] rounded-lg font-black uppercase transition-all flex flex-col items-center justify-center gap-1 border ${
                    pixKeyType === type
                      ? isMidnight ? 'bg-white/10 border-white text-white' : 'bg-black text-volt-lime border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : isMidnight ? 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10' : 'bg-black/5 border-black/10 text-black/50 hover:bg-black/10'
                  }`}
                >
                  {type === 'cpf' && <UserIcon size={14} />}
                  {type === 'email' && <Mail size={14} />}
                  {type === 'phone' && <Smartphone size={14} />}
                  {type === 'random' && <Key size={14} />}
                  {type === 'cpf' ? 'CPF' : type === 'email' ? 'E-mail' : type === 'phone' ? 'Celular' : 'Aleatória'}
                </button>
              ))}
            </div>
          </div>

          {/* Key Input */}
          <div>
            <label className={`text-xs block mb-1.5 uppercase tracking-wider font-semibold ${labelClass}`}>
              {pixKeyType === 'cpf' ? 'Informe o CPF' :
               pixKeyType === 'email' ? 'Informe o E-mail' :
               pixKeyType === 'phone' ? 'Informe o Celular' : 'Informe a Chave Aleatória'}
            </label>
            <input
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder={
                pixKeyType === 'cpf' ? '000.000.000-00' :
                pixKeyType === 'email' ? 'exemplo@email.com' :
                pixKeyType === 'phone' ? '(11) 99999-9999' : 'Chave aleatória com hifens'
              }
              className={`w-full px-4 py-3 rounded-xl text-sm font-bold uppercase transition-all outline-none ${inputClass}`}
              required
            />
          </div>

          {/* Amount Input */}
          <div>
            <label className={`text-xs block mb-1.5 uppercase tracking-wider font-semibold ${labelClass}`}>
              Valor a Transferir
            </label>
            <div className="relative">
              <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black uppercase ${labelClass}`}>R$</span>
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0,00"
                className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm font-bold transition-all outline-none ${inputClass}`}
                required
              />
            </div>
          </div>

          {/* Use Credit Toggle */}
          <div className={`rounded-xl p-4 border flex items-center justify-between transition-all ${
            useCredit
              ? isMidnight ? 'bg-volt-primary/5 border-volt-primary' : 'bg-volt-lime/10 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
              : isMidnight ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'
          }`}>
              <div className="space-y-0.5">
                  <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${titleTextClass}`}>
                      Pix Parcelado no Crédito
                  </span>
                  <span className="text-[10px] block text-on-surface-variant/70 font-semibold">Use o limite do seu cartão de crédito</span>
              </div>
              <button
                type="button"
                onClick={() => setUseCredit(!useCredit)}
                className={`w-10 h-6 rounded-full transition-all relative ${
                  useCredit
                    ? 'bg-volt-lime border border-black'
                    : isMidnight ? 'bg-zinc-800' : 'bg-zinc-300'
                }`}
              >
                  <div className={`w-4 h-4 rounded-full absolute top-1/2 -translate-y-1/2 transition-all ${
                    useCredit
                      ? 'right-1 bg-black'
                      : isMidnight ? 'left-1 bg-zinc-500' : 'left-1 bg-white border border-zinc-400'
                  }`} />
              </button>
          </div>

          {/* Description Input */}
          <div>
            <label className={`text-xs block mb-1.5 uppercase tracking-wider font-semibold ${labelClass}`}>
              Mensagem (Opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => performAutoCategorization(description)}
              placeholder="Escreva uma mensagem para o comprovante"
              className={`w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all outline-none ${inputClass}`}
            />
          </div>

          {/* Category Selection with AI Suggestion */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className={`text-xs block uppercase tracking-wider font-semibold ${labelClass}`}>
                Categoria do Gasto
              </label>
              {description.trim().length >= 3 && (
                <button
                  type="button"
                  onClick={() => performAutoCategorization(description)}
                  disabled={isAutoCategorizing}
                  className="text-[11px] font-bold text-volt-green flex items-center gap-1 hover:opacity-85 active:scale-95 disabled:opacity-50 transition-all cursor-pointer bg-transparent border-none"
                >
                  {isAutoCategorizing ? (
                    <>
                      <Loader2 size={12} className="animate-spin text-volt-green" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} className="text-volt-green" />
                      Classificar com IA
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Category Options Grid */}
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { type: 'refeicao', label: 'Refeição', icon: Utensils },
                { type: 'mobilidade', label: 'Mobilidade', icon: Car },
                { type: 'cultura', label: 'Cultura', icon: Tv },
                { type: 'saude', label: 'Saúde', icon: Heart },
                { type: 'outros', label: 'Outros', icon: MoreHorizontal },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = selectedCategory === item.type;
                const isSuggested = aiSuggestedCategory === item.type;
                
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(item.type as any);
                      if (item.type !== aiSuggestedCategory) {
                        setAiConfidence(null);
                        setAiReason(null);
                      }
                    }}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border relative transition-all active:scale-95 cursor-pointer ${
                      isSelected
                        ? isMidnight
                          ? 'border-volt-primary bg-volt-primary/10 text-volt-primary shadow-[0_0_12px_rgba(0,255,157,0.15)]'
                          : 'border-black bg-volt-lime text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : isMidnight
                          ? 'border-white/5 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                          : 'border-black/10 bg-black/5 text-black/50 hover:bg-black/10 hover:text-black'
                    }`}
                  >
                    {isSuggested && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-volt-green rounded-full border border-volt-surface flex items-center justify-center">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                      </span>
                    )}
                    <Icon size={16} className="mb-1" />
                    <span className="text-[9px] font-semibold tracking-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* AI Feedback Badge / Alert */}
            <AnimatePresence>
              {(isAutoCategorizing || aiConfidence !== null) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 p-2.5 rounded-xl bg-zinc-900 border border-volt-green/45 shadow-[0_0_12px_rgba(0,255,157,0.15)] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-[#00ff9d] flex items-center gap-1">
                        <Brain size={12} className="text-[#00ff9d]" />
                        Auto-categorização Inteligente
                      </span>
                      {aiConfidence !== null && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-volt-green/15 text-[#00ff9d] font-bold border border-volt-green/30">
                          {Math.round(aiConfidence * 100)}% de certeza
                        </span>
                      )}
                    </div>
                    {isAutoCategorizing ? (
                      <p className="text-[10px] text-zinc-300 animate-pulse">
                        Analisando a descrição para identificar o padrão de gasto...
                      </p>
                    ) : (
                      aiReason && (
                        <p className="text-[10px] text-zinc-100 leading-relaxed italic font-medium">
                          "{aiReason}"
                        </p>
                      )
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Error Message */}
          {error && (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
              isMidnight ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-500 text-red-600'
            }`}>
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <p className="text-xs font-bold leading-normal">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-full font-black uppercase tracking-widest text-xs transition-all active:scale-[0.97] flex items-center justify-center gap-1.5 cursor-pointer ${primaryBtnClass}`}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                Prosseguir <Send size={12} />
              </>
            )}
          </button>
        </form>
      )}

      {/* Confirmation Step */}
      {subView === 'confirmation' && recipientInfo && transferDetails && (
          <div className="space-y-5">
              <div className={`p-4 rounded-2xl border ${surfaceBorderClass}`}>
                  <h3 className={`text-xs font-black uppercase tracking-widest mb-3 ${labelClass}`}>Dados de Envio</h3>
                  <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                          <span className={`uppercase font-black ${labelClass}`}>Destinatário</span>
                          <span className="font-extrabold text-right truncate max-w-[200px]" style={{ color: isMidnight ? '#fff' : '#000' }}>{recipientInfo.name}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                          <span className={`uppercase font-black ${labelClass}`}>CPF</span>
                          <span className="font-extrabold" style={{ color: isMidnight ? '#fff' : '#000' }}>{recipientInfo.cpf}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                          <span className={`uppercase font-black ${labelClass}`}>Instituição</span>
                          <span className="font-extrabold" style={{ color: isMidnight ? '#fff' : '#000' }}>Fintech Volt</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                          <span className={`uppercase font-black ${labelClass}`}>Chave informada</span>
                          <span className="font-extrabold truncate max-w-[200px]" style={{ color: isMidnight ? '#fff' : '#000' }}>{transferDetails.key}</span>
                      </div>
                      {transferDetails.description && (
                          <div className="flex justify-between items-center text-xs">
                              <span className={`uppercase font-black ${labelClass}`}>Mensagem</span>
                              <span className="font-extrabold truncate max-w-[200px]" style={{ color: isMidnight ? '#fff' : '#000' }}>{transferDetails.description}</span>
                          </div>
                      )}
                      <div className="flex justify-between items-center text-xs">
                          <span className={`uppercase font-black ${labelClass}`}>Método</span>
                          <span className="font-extrabold" style={{ color: isMidnight ? '#fff' : '#000' }}>{transferDetails.useCredit ? 'Crédito' : 'Saldo de Conta'}</span>
                      </div>
                  </div>
              </div>

              <div className={`p-4 rounded-2xl text-center border-2 border-black ${isMidnight ? 'bg-white/5 border-white/10' : 'bg-volt-yellow-pastel border-black'}`}>
                  <span className={`text-[10px] font-black uppercase tracking-wider block mb-1 ${labelClass}`}>Valor a transferir</span>
                  <span className="text-3xl font-black tracking-tight" style={{ color: isMidnight ? '#fff' : '#000' }}>
                      R$ {transferDetails.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
              </div>

              <div className="flex gap-3">
                  <button
                    onClick={() => setSubView('transfer')}
                    className={`flex-1 py-3.5 rounded-full text-xs font-black uppercase tracking-wider transition-all border ${
                      isMidnight
                        ? 'bg-transparent border-white/20 text-white hover:bg-white/5'
                        : 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5'
                    }`}
                  >
                      Voltar
                  </button>
                  <button
                    onClick={handleConfirmFromConfirmationScreen}
                    disabled={loading}
                    className={`flex-[2] py-3.5 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${primaryBtnClass}`}
                  >
                      Confirmar Envio
                  </button>
              </div>
          </div>
      )}

      {/* Success View */}
      {success && createdTx && (
        <div className="text-center space-y-6 py-6">
          <div className="w-20 h-20 bg-volt-green/10 border-4 border-volt-green rounded-full flex items-center justify-center mx-auto text-volt-green">
            <CheckCircle2 size={42} className="stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <h3 className={`text-xl font-black uppercase tracking-wider ${titleTextClass}`}>Envio Realizado!</h3>
            <p className={`text-xs px-6 leading-relaxed font-bold ${subTextClass}`}>
              Sua transferência via Pix de <strong className="text-volt-green">R$ {createdTx.amount ? Math.abs(createdTx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}</strong> foi concluída com sucesso.
            </p>
          </div>

          <div className={`p-4 text-left space-y-3 rounded-2xl border ${surfaceBorderClass}`}>
            <div className="flex justify-between items-center text-xs">
              <span className={`uppercase font-black ${labelClass}`}>Destinatário</span>
              <span className="font-extrabold text-right truncate max-w-[200px]" style={{ color: isMidnight ? '#fff' : '#000' }}>
                {recipientInfo ? recipientInfo.name : createdTx.to || 'Destinatário'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className={`uppercase font-black ${labelClass}`}>ID Transação</span>
              <span className="font-mono text-[9px] font-bold uppercase" style={{ color: isMidnight ? '#fff' : '#000' }}>{createdTx.id}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className={`uppercase font-black ${labelClass}`}>Data & Hora</span>
              <span className="font-extrabold" style={{ color: isMidnight ? '#fff' : '#000' }}>
                {new Date(createdTx.date).toLocaleDateString('pt-BR')} • {new Date(createdTx.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <button
            onClick={handleBackAction}
            className={`w-full py-4 rounded-full font-black uppercase tracking-widest text-xs transition-all active:scale-[0.97] cursor-pointer ${primaryBtnClass}`}
          >
            Voltar ao Início
          </button>
        </div>
      )}

      {/* Contacts Subview */}
      {subView === 'contacts' && !success && (
          <Contacts onSelectContact={handleSelectContact} theme={theme} />
      )}

      {/* Keys Management Subview */}
      {subView === 'keyManagement' && !success && (
          <PixKeyManagement theme={theme} />
      )}

        </div>
      </div>

      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={handlePasswordConfirm}
        title="Digite a senha do cartão"
        description="Confirme o seu PIN de 4 dígitos para autorizar a transferência via Pix (padrão: 9898)"
        isLoading={loading}
      />
    </div>
  );
}
