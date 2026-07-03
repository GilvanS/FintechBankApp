import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, CheckCircle2, AlertTriangle, Smartphone, Mail, Hash, User as UserIcon, Key } from 'lucide-react';
import { getPixRecipientInfo, performPix, performPixCreditInstallment, getUserByCpf, getUserStatement, addPixContact } from '../services/api';
import { PixContact, Transaction } from '../types';
import { parseCurrency, formatCurrency } from '../utils/formatters';
import Contacts from './Contacts';
import PixKeyManagement from './PixKeyManagement';
import PasswordModal from './PasswordModal';
import { useAuth } from '../context/AuthContext';
import { useAppState } from '../contexts/AppStateContext';

type PixSubView = 'transfer' | 'keyManagement' | 'contacts' | 'confirmation';

interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PixModal({ isOpen, onClose }: PixModalProps) {
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
  const [transferDetails, setTransferDetails] = useState<{ key: string, amount: number, description: string, useCredit: boolean } | null>(null);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingPinAction, setPendingPinAction] = useState<null | ((pin: string) => Promise<void>)>(null);

  const [useCredit, setUseCredit] = useState(false);

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
        setTransferDetails({ key: pixKey, amount: numericAmount, description, useCredit });
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
              result = await performPixCreditInstallment(user.cpf, transferDetails.amount, 1);
          } else {
              result = await performPix(user.cpf, transferDetails.key, transferDetails.amount, transferDetails.description);
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
                          triggerSmartAlertCheck(newTx.title || newTx.description, newTx.amount, 'outros');
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
    setError('');
    setSuccess(false);
    setCreatedTx(null);
    setSubView('transfer');
    setTransferDetails(null);
    setRecipientInfo(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSelectContact = (contact: PixContact) => {
      setPixKey(contact.key);
      setSubView('transfer');
  };

  if (!user) return null;

  // Classes derivadas do tema — mantém a mesma estrutura visual, troca só as cores.
  const cardClass = isMidnight
    ? 'bg-[#0a0a0a] text-white border border-white/10 shadow-2xl'
    : 'bg-white text-black border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]';
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
  const tabActiveClass = isMidnight ? 'bg-[#00E38B] text-black' : 'bg-volt-lime text-black border-2 border-black';
  const surfaceClass = isMidnight ? 'bg-white/5' : 'bg-black/5';
  const surfaceBorderClass = isMidnight ? 'bg-white/5 border border-white/10' : 'bg-black/5 border-2 border-black/10';
  const labelClass = isMidnight ? 'text-white/60' : 'text-black/60';
  const inputClass = isMidnight
    ? 'bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:border-[#00E38B] focus:bg-white/10'
    : 'bg-black/5 border-2 border-black/10 text-black placeholder:text-black/30 focus:border-black focus:bg-white';
  const primaryBtnClass = isMidnight
    ? 'bg-[#00E38B] text-black shadow-[0_0_20px_rgba(0,227,139,0.25)]'
    : 'bg-volt-lime text-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]';
  const secondaryTextClass = isMidnight ? 'text-white/60 hover:bg-white/5' : 'text-black/60 hover:bg-black/5';
  const dividerClass = isMidnight ? 'border-white/10' : 'border-black/10';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={`flex flex-col relative w-full h-[85vh] rounded-3xl overflow-hidden z-10 ${cardClass}`}
          >
            {/* Modal Header */}
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
                    onClick={handleClose}
                    className={`p-2 rounded-full transition-colors ${closeBtnClass}`}
                >
                    <X size={24} />
                </button>
            </div>

            <div className={`flex-1 overflow-y-auto no-scrollbar relative p-6 flex flex-col items-center ${bodyBgClass}`}>
              <div className="w-full max-w-md mx-auto">


            {/* Navigation inside modal */}
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
                    {[
                      { type: 'cpf', label: 'CPF', icon: UserIcon },
                      { type: 'email', label: 'E-mail', icon: Mail },
                      { type: 'phone', label: 'Celular', icon: Smartphone },
                      { type: 'random', label: 'Aleatória', icon: Hash },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isActive = pixKeyType === item.type;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setPixKeyType(item.type as any)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl text-center border transition-all ${
                            isActive
                              ? (isMidnight ? 'border-[#00E38B] bg-[#00E38B]/10 text-[#00E38B]' : 'border-black bg-volt-lime/20 text-black')
                              : (isMidnight ? 'border-white/5 bg-white/5 text-white/60 hover:bg-white/10' : 'border-black/10 bg-black/5 text-black/60 hover:bg-black/10')
                          }`}
                        >
                          <Icon size={16} className="mb-1" />
                          <span className="text-[10px] font-bold">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pix Key Input */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className={`text-xs uppercase tracking-wider font-semibold ${labelClass}`}>
                      Chave Pix
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                      placeholder={
                        pixKeyType === 'cpf'
                          ? '000.000.000-00'
                          : pixKeyType === 'email'
                          ? 'nome@exemplo.com'
                          : pixKeyType === 'phone'
                          ? '(11) 99999-9999'
                          : 'Chave aleatória'
                      }
                      className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-all ${inputClass}`}
                    />
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className={`text-xs block mb-1.5 uppercase tracking-wider font-semibold ${labelClass}`}>
                    Valor (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold" style={{ color: isMidnight ? accent : '#000' }}>R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={amount}
                      onChange={handleAmountChange}
                      placeholder="0,00"
                      className={`w-full rounded-xl pl-11 pr-4 py-3 text-lg font-bold focus:outline-none transition-all ${inputClass}`}
                    />
                  </div>
                </div>

                {/* Use Credit Toggle */}
                <div className={`rounded-xl p-3 flex items-center justify-between ${surfaceBorderClass}`}>
                    <div>
                        <h4 className={`text-sm font-bold ${titleTextClass}`}>PIX no Crédito</h4>
                        <p className={`text-[10px] ${labelClass}`}>Usa o limite do seu cartão</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={useCredit} onChange={e => setUseCredit(e.target.checked)} className="sr-only peer" />
                        <div
                          className={`w-11 h-6 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${isMidnight ? 'bg-white/20 after:border-gray-300 peer-checked:after:border-white' : 'bg-black/20 after:border-black/30 peer-checked:after:border-black'}`}
                          style={{ backgroundColor: useCredit ? accent : undefined }}
                        ></div>
                    </label>
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
                    placeholder="Ex: Almoço de ontem, Presente..."
                    className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-all ${inputClass}`}
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs"
                  >
                    <AlertTriangle size={14} className="shrink-0" />
                    <p>{error}</p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full mt-4 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-95 active:scale-95 disabled:scale-100 disabled:opacity-50 transition-all cursor-pointer ${primaryBtnClass}`}
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Send size={16} />
                      Continuar
                    </>
                  )}
                </button>
              </form>
            )}

            {subView === 'confirmation' && recipientInfo && transferDetails && (
               <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className={`rounded-xl p-4 text-center mb-6 ${surfaceClass}`}>
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${isMidnight ? 'bg-white/10' : 'bg-black/10'}`}>
                          <UserIcon size={32} className={isMidnight ? 'text-white/60' : 'text-black/60'} />
                      </div>
                      <p className={`text-sm ${labelClass}`}>Transferindo para</p>
                      <h4 className={`text-xl font-bold ${titleTextClass}`}>{recipientInfo.name}</h4>
                      <p className={`text-xs mt-1 ${isMidnight ? 'text-white/40' : 'text-black/40'}`}>CPF: {recipientInfo.cpf}</p>
                  </div>

                  <div className="space-y-2 mb-6">
                      <div className={`flex justify-between items-center py-2 border-b ${dividerClass}`}>
                          <span className={`text-sm ${labelClass}`}>Valor</span>
                          <span className={`font-bold text-lg ${titleTextClass}`}>R$ {transferDetails.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className={`flex justify-between items-center py-2 border-b ${dividerClass}`}>
                          <span className={`text-sm ${labelClass}`}>Forma</span>
                          <span className={`font-medium ${titleTextClass}`}>{transferDetails.useCredit ? 'PIX no Crédito' : 'Saldo em Conta'}</span>
                      </div>
                      {transferDetails.description && (
                         <div className={`flex justify-between items-center py-2 border-b ${dividerClass}`}>
                            <span className={`text-sm ${labelClass}`}>Mensagem</span>
                            <span className={`font-medium ${titleTextClass}`}>{transferDetails.description}</span>
                        </div>
                      )}
                  </div>

                  <button
                    onClick={handleConfirmFromConfirmationScreen}
                    disabled={loading}
                    className={`w-full font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-95 active:scale-95 transition-all ${primaryBtnClass}`}
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setSubView('transfer')}
                    className={`w-full bg-transparent font-bold py-3.5 rounded-xl transition-all ${secondaryTextClass}`}
                  >
                    Cancelar
                  </button>
               </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 space-y-4"
              >
                <div className="flex justify-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1 }}
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: isMidnight ? 'rgba(0,227,139,0.15)' : 'rgba(162,255,0,0.25)', color: isMidnight ? accent : '#000' }}
                  >
                    <CheckCircle2 size={40} className="stroke-[2.5]" />
                  </motion.div>
                </div>

                <div>
                  <h4 className={`text-lg font-bold ${titleTextClass}`}>Pix Enviado com Sucesso!</h4>
                  <p className={`text-xs mt-1 ${labelClass}`}>Sua transferência foi realizada instantaneamente.</p>
                </div>

                <div className={`rounded-xl p-4 text-left space-y-2 max-w-xs mx-auto ${surfaceClass}`}>
                  <div className="flex justify-between text-xs">
                    <span className={labelClass}>Valor:</span>
                    <span className={`font-bold ${titleTextClass}`}>
                      R$ {createdTx ? Math.abs(createdTx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className={labelClass}>Destino:</span>
                    <span className={`font-semibold truncate max-w-[150px] ${titleTextClass}`}>{recipientInfo?.name || pixKey}</span>
                  </div>
                  {createdTx?.description && (
                    <div className="flex justify-between text-xs">
                      <span className={labelClass}>Descrição:</span>
                      <span className={`italic truncate max-w-[150px] ${titleTextClass}`}>{createdTx.description}</span>
                    </div>
                  )}
                  <div className={`flex justify-between text-[10px] border-t pt-2 mt-2 ${isMidnight ? 'text-white/40 border-white/5' : 'text-black/40 border-black/10'}`}>
                    <span>{createdTx?.date ? new Date(createdTx.date).toLocaleDateString('pt-BR') : ''}</span>
                    <span>{createdTx?.date ? new Date(createdTx.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                </div>

                <div className="pt-2 flex gap-3 justify-center">
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                    style={{ color: isMidnight ? accent : '#000', borderColor: isMidnight ? 'rgba(0,227,139,0.2)' : 'rgba(0,0,0,0.3)' }}
                  >
                    Novo Envio
                  </button>
                  <button
                    onClick={handleClose}
                    className={`px-6 py-2 rounded-xl text-xs font-bold shadow-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer ${primaryBtnClass}`}
                  >
                    Concluir
                  </button>
                </div>
              </motion.div>
            )}

            {subView === 'contacts' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={titleTextClass}>
                    <Contacts
                        onSelectContact={handleSelectContact}
                        onBack={() => setSubView('transfer')}
                    />
                </motion.div>
            )}

            {subView === 'keyManagement' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${titleTextClass} h-[400px] overflow-y-auto overflow-x-hidden`}>
                    <PixKeyManagement onBack={() => setSubView('transfer')} />
                </motion.div>
            )}
              </div>
            </div>
          </motion.div>
          {/* PasswordModal dentro do z-[100] para não ficar atrás do backdrop */}
          <PasswordModal
              isOpen={isPasswordModalOpen}
              onClose={() => {
                  setIsPasswordModalOpen(false);
                  setPendingPinAction(null);
              }}
              onConfirm={handlePasswordConfirm}
              title="Confirmar Transferência"
              description="Digite sua senha de 4 dígitos."
              isLoading={loading}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
