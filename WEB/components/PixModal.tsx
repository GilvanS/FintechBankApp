import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, CheckCircle2, AlertTriangle, Smartphone, Mail, Hash, User as UserIcon, BookUser, Key } from 'lucide-react';
import { getPixContacts, getPixRecipientInfo, performPix, performPixCreditInstallment, getUserByCpf, getUserStatement, addPixContact } from '../services/api';
import { PixContact, Transaction } from '../types';
import { parseCurrency, formatCurrency } from '../utils/formatters';
import Contacts from './Contacts';
import PixKeyManagement from './PixKeyManagement';
import PasswordModal from './PasswordModal';
import { useAuth } from '../context/AuthContext';

type PixSubView = 'transfer' | 'keyManagement' | 'contacts' | 'confirmation';

interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PixModal({ isOpen, onClose }: PixModalProps) {
  const { user, updateUser } = useAuth();
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

  const [contacts, setContacts] = useState<PixContact[]>([]);
  const [useCredit, setUseCredit] = useState(false);

  useEffect(() => {
      const fetchContacts = async () => {
          if (user) {
              const fetchedContacts = await getPixContacts(user.cpf);
              setContacts(fetchedContacts);
          }
      };
      if (isOpen) {
          fetchContacts();
      }
  }, [user, isOpen]);

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
                      if (newTx) setCreatedTx(newTx);
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
            className="relative w-full h-full max-w-5xl max-h-[90vh] bg-[#0a0a0a] border border-white/10 shadow-2xl rounded-[2rem] flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white/80">pix</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                            {subView === 'transfer' && !success && <span className="w-2 h-2 rounded-full bg-[#00E38B] animate-pulse"></span>}
                            {subView === 'transfer' ? (success ? 'Sucesso' : 'Enviar Pix') : 
                             subView === 'confirmation' ? 'Confirmar Pix' : 
                             subView === 'contacts' ? 'Contatos' : 'Minhas Chaves'}
                        </h2>
                        <p className="text-xs text-white/50 uppercase tracking-widest">Área Pix</p>
                    </div>
                </div>
                <button
                    onClick={handleClose}
                    className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar relative bg-[#0a0a0a] p-6 flex flex-col items-center">
              <div className="w-full max-w-md mx-auto">


            {/* Navigation inside modal */}
            {!success && subView !== 'confirmation' && (
                <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
                    <button onClick={() => setSubView('transfer')} className={`flex-1 text-xs py-2 rounded-lg font-bold transition-colors ${subView === 'transfer' ? 'bg-[#00E38B] text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>Enviar</button>
                    <button onClick={() => setSubView('contacts')} className={`flex-1 text-xs py-2 rounded-lg font-bold transition-colors ${subView === 'contacts' ? 'bg-[#00E38B] text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>Contatos</button>
                    <button onClick={() => setSubView('keyManagement')} className={`flex-1 text-xs py-2 rounded-lg font-bold transition-colors ${subView === 'keyManagement' ? 'bg-[#00E38B] text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>Chaves</button>
                </div>
            )}

            {subView === 'transfer' && !success && (
              <form onSubmit={handleInitiateTransfer} className="space-y-4">
                {/* Available Balance */}
                <div className="bg-white/5 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs text-white/60">Saldo Disponível:</span>
                  <span className="text-sm font-bold text-[#00E38B]">
                    R$ {user.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Key Type Selection */}
                <div>
                  <label className="text-xs text-white/60 block mb-2 uppercase tracking-wider font-semibold">
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
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setPixKeyType(item.type as any)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl text-center border transition-all ${
                            pixKeyType === item.type
                              ? 'border-[#00E38B] bg-[#00E38B]/10 text-[#00E38B]'
                              : 'border-white/5 bg-white/5 text-white/60 hover:bg-white/10'
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
                    <label className="text-xs text-white/60 uppercase tracking-wider font-semibold">
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
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00E38B] focus:bg-white/10 transition-all placeholder:text-white/20"
                    />
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="text-xs text-white/60 block mb-1.5 uppercase tracking-wider font-semibold">
                    Valor (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00E38B] font-bold">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={amount}
                      onChange={handleAmountChange}
                      placeholder="0,00"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-lg font-bold text-white focus:outline-none focus:border-[#00E38B] focus:bg-white/10 transition-all"
                    />
                  </div>
                </div>

                {/* Use Credit Toggle */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-bold text-white">PIX no Crédito</h4>
                        <p className="text-[10px] text-white/60">Usa o limite do seu cartão</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={useCredit} onChange={e => setUseCredit(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00E38B]"></div>
                    </label>
                </div>

                {/* Description Input */}
                <div>
                  <label className="text-xs text-white/60 block mb-1.5 uppercase tracking-wider font-semibold">
                    Mensagem (Opcional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Almoço de ontem, Presente..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00E38B] focus:bg-white/10 transition-all placeholder:text-white/20"
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl text-xs"
                  >
                    <AlertTriangle size={14} className="shrink-0" />
                    <p>{error}</p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 bg-[#00E38B] text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,227,139,0.25)] hover:opacity-95 active:scale-95 disabled:scale-100 disabled:opacity-50 transition-all cursor-pointer"
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
                  <div className="bg-white/5 rounded-xl p-4 text-center mb-6">
                      <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                          <UserIcon size={32} className="text-white/60" />
                      </div>
                      <p className="text-sm text-white/60">Transferindo para</p>
                      <h4 className="text-xl font-bold text-white">{recipientInfo.name}</h4>
                      <p className="text-xs text-white/40 mt-1">CPF: {recipientInfo.cpf}</p>
                  </div>
                  
                  <div className="space-y-2 mb-6">
                      <div className="flex justify-between items-center py-2 border-b border-white/10">
                          <span className="text-sm text-white/60">Valor</span>
                          <span className="font-bold text-white text-lg">R$ {transferDetails.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-white/10">
                          <span className="text-sm text-white/60">Forma</span>
                          <span className="font-medium text-white">{transferDetails.useCredit ? 'PIX no Crédito' : 'Saldo em Conta'}</span>
                      </div>
                      {transferDetails.description && (
                         <div className="flex justify-between items-center py-2 border-b border-white/10">
                            <span className="text-sm text-white/60">Mensagem</span>
                            <span className="font-medium text-white">{transferDetails.description}</span>
                        </div>
                      )}
                  </div>

                  <button
                    onClick={handleConfirmFromConfirmationScreen}
                    disabled={loading}
                    className="w-full bg-[#00E38B] text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,227,139,0.25)] hover:opacity-95 active:scale-95 transition-all"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setSubView('transfer')}
                    className="w-full bg-transparent text-white/60 font-bold py-3.5 rounded-xl hover:bg-white/5 transition-all"
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
                    className="w-16 h-16 rounded-full bg-[#00E38B]/15 flex items-center justify-center text-[#00E38B]"
                  >
                    <CheckCircle2 size={40} className="stroke-[2.5]" />
                  </motion.div>
                </div>

                <div>
                  <h4 className="text-lg font-bold text-white">Pix Enviado com Sucesso!</h4>
                  <p className="text-xs text-white/60 mt-1">Sua transferência foi realizada instantaneamente.</p>
                </div>

                <div className="bg-white/5 rounded-xl p-4 text-left space-y-2 max-w-xs mx-auto">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Valor:</span>
                    <span className="font-bold text-white">
                      R$ {createdTx ? Math.abs(createdTx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Destino:</span>
                    <span className="font-semibold text-white truncate max-w-[150px]">{recipientInfo?.name || pixKey}</span>
                  </div>
                  {createdTx?.title && (
                    <div className="flex justify-between text-xs">
                      <span className="text-white/60">Descrição:</span>
                      <span className="text-white italic truncate max-w-[150px]">{createdTx.title}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] text-white/40 border-t border-white/5 pt-2 mt-2">
                    <span>{createdTx?.formattedDate}</span>
                    <span>{createdTx?.time}</span>
                  </div>
                </div>

                <div className="pt-2 flex gap-3 justify-center">
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-[#00E38B] border border-[#00E38B]/20 hover:bg-[#00E38B]/5 transition-all cursor-pointer"
                  >
                    Novo Envio
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-6 py-2 rounded-xl text-xs font-bold bg-[#00E38B] text-black shadow-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                  >
                    Concluir
                  </button>
                </div>
              </motion.div>
            )}

            {subView === 'contacts' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white">
                     {/* Inline Contacts View */}
                     {contacts.length === 0 ? (
                         <div className="text-center py-8 text-white/40">Nenhum contato salvo.</div>
                     ) : (
                         <div className="space-y-3 mt-4">
                             {contacts.map(c => (
                                 <div key={c.id} onClick={() => handleSelectContact(c)} className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 cursor-pointer transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                                            <BookUser size={18} className="text-[#00E38B]" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">{c.name}</p>
                                            <p className="text-xs text-white/60">{c.key}</p>
                                        </div>
                                    </div>
                                 </div>
                             ))}
                         </div>
                     )}
                </motion.div>
            )}

            {subView === 'keyManagement' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white h-[400px] overflow-y-auto overflow-x-hidden">
                    <PixKeyManagement onBack={() => setSubView('transfer')} />
                </motion.div>
            )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Password Modal */}
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
    </AnimatePresence>
  );
}
