import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Info, CreditCard, Percent, Sliders, 
  Search, CheckCircle2, AlertTriangle, ArrowRight, Shield, 
  Landmark, Share2, Printer, TrendingUp, Check, ChevronRight, 
  AlertCircle
} from 'lucide-react';
import { UserProfile, Transaction } from '../types';

interface LimitViewProps {
  accountBalance: number;
  userProfile: UserProfile;
  onTransactionComplete: (newTx: Transaction, amount: number) => void;
  theme: 'yellow' | 'midnight';
}

interface Bank {
  id: string;
  name: string;
  code: string;
  logo: string;
}

export default function LimitView({ 
  accountBalance, 
  userProfile, 
  onTransactionComplete, 
  theme 
}: LimitViewProps) {
  // Wizard Steps: 
  // 'home' -> (opens modal) -> 'simulation' -> 'transfer_details' -> 'resumo' -> 'seguranca' -> 'success' -> 'receipt'
  const [screen, setScreen] = useState<'home' | 'simulation' | 'transfer_details' | 'resumo' | 'seguranca' | 'success' | 'receipt'>('home');
  const [isImportantModalOpen, setIsImportantModalOpen] = useState(false);

  // General States
  const [withdrawalLimit, setWithdrawalLimit] = useState<number>(() => {
    const saved = localStorage.getItem('volt_withdrawal_limit');
    return saved ? parseFloat(saved) : 300.17;
  });

  const [autoIncrease, setAutoIncrease] = useState<boolean>(() => {
    const saved = localStorage.getItem('volt_auto_increase');
    return saved !== 'false'; // default true
  });

  // Simulation Input States
  const [withdrawAmount, setWithdrawAmount] = useState<number>(300.17);
  const [installments, setInstallments] = useState<number>(1);

  // Transfer Info States
  const [searchBank, setSearchBank] = useState('');
  const [selectedBank, setSelectedBank] = useState<Bank>({
    id: 'bradesco', name: '237 - BANCO BRADESCO S.A.', code: '237', logo: '🏦'
  });
  const [agency, setAgency] = useState('3861');
  const [account, setAccount] = useState('22890-7');
  const [accountType, setAccountType] = useState<'corrente' | 'poupança'>('corrente');

  // Security / PIN State
  const [pin, setPin] = useState<string[]>(['3', '7', '1', '']);
  const [focusedPinIndex, setFocusedPinIndex] = useState<number>(3);

  // Transaction history helper state
  const [lastWithdrawal, setLastWithdrawal] = useState<{
    amount: number;
    installments: number;
    juros: number;
    total: number;
    date: string;
    time: string;
    ref: number;
  }>({
    amount: 300.17,
    installments: 1,
    juros: 77.27,
    total: 377.44,
    date: '10/12/2021',
    time: '08h04',
    ref: 19980
  });

  const [loading, setLoading] = useState(false);

  // Sync state to localstorage
  useEffect(() => {
    localStorage.setItem('volt_withdrawal_limit', withdrawalLimit.toString());
  }, [withdrawalLimit]);

  useEffect(() => {
    localStorage.setItem('volt_auto_increase', autoIncrease.toString());
  }, [autoIncrease]);

  const banks: Bank[] = [
    { id: 'bradesco', name: '237 - BANCO BRADESCO S.A.', code: '237', logo: '🔴' },
    { id: 'itau', name: '341 - ITAÚ UNIBANCO S.A.', code: '341', logo: '🟠' },
    { id: 'bb', name: '001 - BANCO DO BRASIL S.A.', code: '001', logo: '🟡' },
    { id: 'nu', name: '260 - NU PAGAMENTOS S.A.', code: '260', logo: '🟣' },
    { id: 'santander', name: '033 - BANCO SANTANDER (BRASIL) S.A.', code: '033', logo: '🎪' },
    { id: 'caixa', name: '104 - CAIXA ECONOMICA FEDERAL', code: '104', logo: '🔵' },
    { id: 'inter', name: '077 - BANCO INTER S.A.', code: '077', logo: '🟠' },
  ];

  const filteredBanks = banks.filter(b => 
    b.name.toLowerCase().includes(searchBank.toLowerCase()) || 
    b.code.includes(searchBank)
  );

  const isMidnight = theme === 'midnight';

  // Real interest factor based on the HTML spec details:
  // - 1x: amount 300,17 -> juros 77,27, total 377,44 (Factor: 1.2574)
  // - 4x: amount 50,00 -> juros 29,14, total 79,68 (Factor: 1.5828)
  const calculateFinance = (amount: number, inst: number) => {
    let jurosFactor = 0.1790 * inst * 0.814; // baseline Simple Interest approx
    if (inst === 1) {
      jurosFactor = 0.2574; // matches exactly 300.17 * 0.2574 = 77.27
    } else if (inst === 4) {
      jurosFactor = 0.5828; // matches exactly 50.00 * 0.5828 = 29.14
    } else if (inst === 8) {
      jurosFactor = 1.12;
    } else if (inst === 15) {
      jurosFactor = 2.05;
    }

    const juros = amount * jurosFactor;
    const total = amount + juros;
    const installmentValue = total / inst;
    return {
      juros: Math.round(juros * 100) / 100,
      total: Math.round(total * 100) / 100,
      installmentValue: Math.round(installmentValue * 100) / 100,
      cet: 680.95
    };
  };

  const currentValues = calculateFinance(withdrawAmount, installments);

  // Handle Pin typing key interaction
  const handlePinChange = (val: string) => {
    if (!/^[0-9]$/.test(val) && val !== '') return;
    
    const newPin = [...pin];
    newPin[focusedPinIndex] = val;
    setPin(newPin);

    // Auto focus next or confirm
    if (val !== '' && focusedPinIndex < 3) {
      setFocusedPinIndex(prev => prev + 1);
    }
  };

  const handlePinBackspace = () => {
    const newPin = [...pin];
    newPin[focusedPinIndex] = '';
    setPin(newPin);
    if (focusedPinIndex > 0) {
      setFocusedPinIndex(prev => prev - 1);
    }
  };

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Confirm and Execute Withdrawal
  const executeWithdrawal = () => {
    setLoading(true);

    setTimeout(() => {
      const now = new Date();
      const formatNumber = (num: number) => String(num).padStart(2, '0');
      const formattedDate = `${formatNumber(now.getDate())}/${formatNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
      
      const weekdays = [
        'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
      ];

      // Update historic transaction info for success receipt
      const refCode = Math.floor(10000 + Math.random() * 90000);
      const calculated = calculateFinance(withdrawAmount, installments);
      
      setLastWithdrawal({
        amount: withdrawAmount,
        installments: installments,
        juros: calculated.juros,
        total: calculated.total,
        date: formattedDate,
        time: `${formatNumber(now.getHours())}h${formatNumber(now.getMinutes())}`,
        ref: refCode
      });

      const newTx: Transaction = {
        id: Math.random().toString(36).substring(2, 11),
        title: `Saque Limite Cartão (${installments}x)`,
        amount: withdrawAmount, // credits to main account balance!
        type: 'income',
        category: 'outros',
        date: now.toISOString(),
        formattedDate: `${weekdays[now.getDay()]} • ${formattedDate}`,
        time: `${formatNumber(now.getHours())}:${formatNumber(now.getMinutes())}`
      };

      // Deduct from withdrawal limit, add to account balance!
      onTransactionComplete(newTx, withdrawAmount);
      setWithdrawalLimit(prev => Math.max(0, prev - withdrawAmount));
      setLoading(false);
      setScreen('success');
    }, 1500);
  };

  return (
    <div className={`w-full max-w-md mx-auto pb-28 pt-4 px-4 ${isMidnight ? 'text-white' : 'text-black'}`}>
      
      {/* SCREEN 1: HOME LIMIT SCREEN */}
      {screen === 'home' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 animate-fade-in"
        >
          {/* Header */}
          <section className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-on-surface-variant">Titular</p>
              <h2 className={`text-xl font-black ${isMidnight ? 'text-white' : 'text-black'}`}>{userProfile.name}</h2>
            </div>
            <div className={`py-1.5 px-3 rounded-xl border flex items-center gap-1.5 ${
              isMidnight 
                ? 'bg-zinc-900 border-zinc-800' 
                : 'bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <CreditCard size={12} className={isMidnight ? 'text-[#00ff9d]' : 'text-black'} />
              <span className="text-[9px] font-black uppercase tracking-wider">FINAL 0030</span>
            </div>
          </section>

          {/* Main Available Purchases Limit Card */}
          <div className={`relative overflow-hidden rounded-2xl p-6 border transition-all duration-300 ${
            isMidnight 
              ? 'bg-zinc-900/80 border-zinc-800/80 shadow-lg shadow-black/20' 
              : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#00ff9d]/5 blur-3xl rounded-full"></div>
            <p className="text-[10px] uppercase tracking-wider font-extrabold text-on-surface-variant">
              Disponível para compras
            </p>
            <p className={`text-3xl font-black mt-2 tracking-tight ${isMidnight ? 'text-[#00ff9d] drop-shadow-[0_0_15px_rgba(0,255,157,0.25)]' : 'text-black'}`}>
              R$ 609,43
            </p>

            <div className="mt-6 space-y-3">
              {/* Progress bar */}
              <div className={`w-full h-2.5 rounded-full overflow-hidden ${
                isMidnight ? 'bg-zinc-950 border border-zinc-800' : 'bg-gray-100 border-2 border-black'
              }`}>
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    isMidnight ? 'bg-[#00ff9d]' : 'bg-black'
                  }`} 
                  style={{ width: '18.1%' }}
                ></div>
              </div>

              <div className="flex justify-between items-center text-[10px] font-bold text-on-surface-variant">
                <span>18.1% utilizado</span>
                <span className={isMidnight ? 'text-zinc-300' : 'text-zinc-850'}>R$ 90,40</span>
              </div>

              <div className={`flex justify-between items-center text-[10px] font-black border-t pt-2.5 ${
                isMidnight ? 'border-zinc-800' : 'border-black/10'
              }`}>
                <span className="text-on-surface-variant">Limite total</span>
                <span className={isMidnight ? 'text-white' : 'text-black'}>R$ 500,00</span>
              </div>
            </div>
          </div>

          {/* Withdrawal Limit Section (Bento Grid Style) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between pl-1">
              <h3 className={`text-xs font-black uppercase tracking-wider ${isMidnight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Meus Limites
              </h3>
              <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                isMidnight ? 'bg-[#00ff9d]/10 text-[#00ff9d]' : 'bg-[#A2FF00]/15 text-black border-2 border-black'
              }`}>
                Ativo
              </span>
            </div>

            {/* Withdraw Bento Box */}
            <div className={`rounded-2xl p-6 border space-y-4 transition-all ${
              isMidnight 
                ? 'bg-zinc-900/80 border-zinc-800/80 shadow-md' 
                : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isMidnight ? 'bg-[#00ff9d]/10 text-[#00ff9d]' : 'bg-black text-white'
                }`}>
                  <Sliders size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black leading-tight">Limite de saque</h4>
                  <p className="text-[10px] text-on-surface-variant flex items-center gap-1 mt-0.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400"></span>
                    Disponível dias úteis, 7h às 16h50
                  </p>
                </div>
              </div>

              <div className={`grid grid-cols-2 gap-4 pt-2 border-t ${isMidnight ? 'border-zinc-800' : 'border-black/5'}`}>
                <div className="space-y-0.5">
                  <span className="text-[9px] text-on-surface-variant uppercase font-bold tracking-wider">Disponível</span>
                  <p className={`text-lg font-black ${isMidnight ? 'text-[#00ff9d]' : 'text-black'}`}>
                    R$ {withdrawalLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] text-on-surface-variant uppercase font-bold tracking-wider">Limite total</span>
                  <p className="text-lg font-black">R$ 500,00</p>
                </div>
              </div>

              <p className="text-[11px] text-on-surface-variant text-center pt-2 leading-relaxed">
                Simule, escolha o valor e a conta no qual o valor será creditado.
              </p>

              <button
                onClick={() => setIsImportantModalOpen(true)}
                className="w-full py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer btn-primary"
              >
                Simular agora
              </button>
            </div>

            {/* Automatic Limit Increase Toggle */}
            <div className={`rounded-xl p-4 border flex items-center justify-between transition-all ${
              isMidnight 
                ? 'bg-zinc-900/80 border-zinc-800/80' 
                : 'bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  isMidnight ? 'bg-zinc-950 border border-zinc-850' : 'bg-gray-100'
                }`}>
                  🐾
                </div>
                <span className="text-xs font-black">Aumento de Limite Automático</span>
              </div>

              {/* IOS/Android Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={autoIncrease} 
                  onChange={(e) => setAutoIncrease(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className={`w-10 h-6 rounded-full transition-colors peer-focus:outline-none ${
                  isMidnight 
                    ? 'bg-zinc-850 border border-zinc-800' 
                    : 'bg-gray-200 border-2 border-black'
                } peer-checked:bg-[#00ff9d] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black`}></div>
              </label>
            </div>
          </section>
        </motion.div>
      )}

      {/* SCREEN 2: SIMULATION SCREEN (matches detail spec perfectly) */}
      {screen === 'simulation' && (
        <motion.div 
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setScreen('home')}
              className={`p-2 rounded-xl transition-colors shrink-0 ${
                isMidnight ? 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-black'
              }`}
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-xs font-black uppercase tracking-wider text-on-surface-variant">Limite de Saque</h1>
            <div className="w-9 h-9 flex items-center justify-center">
              <Info size={18} className="text-on-surface-variant" />
            </div>
          </div>

          <section className="space-y-1">
            <h2 className="text-xl font-black text-[#00ff9d]">Simule como preferir:</h2>
            <p className="text-xs text-on-surface-variant">Configure o valor e as parcelas para o seu saque imediato.</p>
          </section>

          {/* Amount input box */}
          <div className={`p-4 rounded-xl border flex flex-col gap-1 transition-all ${
            isMidnight ? 'bg-zinc-900 border-zinc-850 focus-within:border-[#00ff9d]' : 'bg-white border-2 border-black focus-within:ring-2 focus-within:ring-black'
          }`}>
            <label className="text-[10px] uppercase tracking-wider font-extrabold text-on-surface-variant">Qual valor você precisa?</label>
            <div className="flex items-baseline gap-1.5 border-b border-[#00ff9d] pb-1">
              <span className="text-lg font-black text-[#00ff9d]">R$</span>
              <input 
                type="number"
                value={withdrawAmount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (val >= 0) setWithdrawAmount(val);
                }}
                className={`bg-transparent border-none p-0 font-black text-3xl focus:ring-0 w-full ${isMidnight ? 'text-white' : 'text-black'}`}
              />
            </div>
            <p className="text-[10px] text-on-surface-variant pt-1">
              Valor disponível: <span className="text-[#00ff9d] font-bold">R$ {withdrawalLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </p>
          </div>

          {/* Installments Grid Selector */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider font-extrabold text-on-surface-variant pl-1">Em quantas parcelas?</label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 4, 8, 15].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInstallments(i)}
                  className={`py-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                    installments === i
                      ? isMidnight
                        ? 'border-[#00ff9d] bg-[#00ff9d]/10 text-[#00ff9d] shadow-[0_0_12px_rgba(0,255,157,0.15)]'
                        : 'border-black bg-[#A2FF00] text-black font-extrabold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : isMidnight
                        ? 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {i}x
                </button>
              ))}
            </div>
          </div>

          {/* Suggested Plans (Bento Style matching images) */}
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider pl-1">Planos Sugeridos</h3>
            
            <div className="space-y-3">
              {/* Card 1: Menor Prazo */}
              <div className={`p-5 rounded-2xl border relative overflow-hidden transition-all duration-300 ${
                isMidnight ? 'bg-zinc-900 border-zinc-850 hover:border-[#00ff9d]/30' : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                {/* Green marker left border */}
                <div className="absolute top-0 left-0 w-1 h-full bg-[#00ff9d]" />

                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2.5 py-0.5 bg-[#00ff9d]/10 text-[#00ff9d] text-[8px] font-black uppercase tracking-wider rounded-full mb-1 inline-block">
                      RECOMENDADO
                    </span>
                    <h4 className="text-sm font-black">Menor prazo</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black uppercase text-on-surface-variant">TOTAL SOLICITADO</p>
                    <p className="text-xs font-black text-[#00ff9d]">{formatBRL(withdrawAmount)}</p>
                  </div>
                </div>

                <div className="py-4 border-y border-zinc-800/10 my-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-2xl font-black text-[#00ff9d]">{installments}x</span>
                    <span className="text-xs text-on-surface-variant font-extrabold">×</span>
                    <span className={`text-2xl font-black ${isMidnight ? 'text-white' : 'text-black'}`}>
                      {formatBRL(currentValues.installmentValue)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[10px]">
                  <div>
                    <span className="text-on-surface-variant block uppercase font-bold">Taxa de juros</span>
                    <span className="font-extrabold text-[#00ff9d]">17.9% ao mês</span>
                  </div>
                  <div className="text-right">
                    <span className="text-on-surface-variant block uppercase font-bold">1ª Parcela vence em</span>
                    <span className="font-extrabold">20/07/2026</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Parcela Média */}
              <div className={`p-5 rounded-2xl border relative overflow-hidden transition-all duration-300 ${
                isMidnight ? 'bg-zinc-900 border-zinc-850' : 'bg-white border-2 border-black'
              }`}>
                {/* Purple marker left border */}
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />

                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-black">Parcela média</h4>
                  <div className="text-right">
                    <p className="text-[8px] font-black uppercase text-on-surface-variant">TOTAL SOLICITADO</p>
                    <p className="text-xs font-black">{formatBRL(withdrawAmount)}</p>
                  </div>
                </div>

                <div className="py-4 border-y border-zinc-800/10 my-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl font-black text-purple-400">8x</span>
                    <span className="text-xs text-on-surface-variant font-extrabold">×</span>
                    <span className="text-2xl font-black">
                      {formatBRL(calculateFinance(withdrawAmount, 8).installmentValue)}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => setInstallments(8)}
                  className="w-full py-2 bg-transparent hover:bg-zinc-800/30 border border-purple-500/40 text-purple-400 font-black rounded-lg text-[10px] uppercase tracking-wider transition-all"
                >
                  Simular com 8 parcelas
                </button>
              </div>
            </div>
          </section>

          {/* Core Submit button of Simulation screen */}
          <button
            onClick={() => {
              if (withdrawAmount <= 0 || withdrawAmount > withdrawalLimit) {
                alert(`Valor de saque inválido. Máximo disponível: R$ ${withdrawalLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
                return;
              }
              setScreen('transfer_details');
            }}
            className="w-full py-4 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer btn-primary"
          >
            CONTRATAR SAQUE AGORA
          </button>
        </motion.div>
      )}

      {/* SCREEN 3: TRANSFER DETAILS (BANK & ACCOUNT FORM) */}
      {screen === 'transfer_details' && (
        <motion.div 
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setScreen('simulation')}
              className={`p-2 rounded-xl transition-colors shrink-0 ${
                isMidnight ? 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-black'
              }`}
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-xs font-black uppercase tracking-wider text-on-surface-variant">Limite de Saque</h1>
            <div className="w-9 h-9 flex items-center justify-center">
              <Info size={18} className="text-on-surface-variant" />
            </div>
          </div>

          <section className="flex flex-col gap-1 text-center">
            <h2 className="text-xl font-black text-[#00ff9d]">Transferência</h2>
            <p className="text-xs text-on-surface-variant">Pra qual banco quer transferir?</p>
          </section>

          {/* Search Bank Section */}
          <div className="space-y-2">
            <div className={`p-3 rounded-xl flex items-center gap-2 border transition-all ${
              isMidnight 
                ? 'bg-zinc-900 border-zinc-850 focus-within:border-[#00ff9d]' 
                : 'bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <Search className="text-on-surface-variant" size={16} />
              <input 
                type="text"
                value={searchBank}
                onChange={(e) => setSearchBank(e.target.value)}
                placeholder="Buscar banco por nome ou código"
                className="bg-transparent border-none outline-none text-xs w-full focus:ring-0 placeholder-zinc-500"
              />
            </div>

            {/* Banks List Drawer */}
            <div className={`max-h-36 overflow-y-auto rounded-xl p-2 space-y-1 ${
              isMidnight ? 'bg-zinc-950 border border-zinc-900' : 'bg-gray-50 border border-black/5'
            }`}>
              {filteredBanks.map(b => {
                const isSelected = selectedBank.id === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelectedBank(b);
                      setSearchBank('');
                    }}
                    className={`w-full p-2.5 rounded-lg text-left text-xs font-extrabold flex items-center justify-between transition-all ${
                      isSelected
                        ? isMidnight
                          ? 'bg-[#00ff9d]/10 text-[#00ff9d]'
                          : 'bg-black text-white'
                        : isMidnight
                          ? 'hover:bg-zinc-900 text-zinc-300'
                          : 'hover:bg-gray-150 text-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{b.logo}</span>
                      <span>{b.name}</span>
                    </div>
                    <span className="text-[10px] opacity-60">Cód. {b.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Data Bento Grid */}
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider pl-1 text-[#00ff9d]">
              Quais os dados da sua conta?
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {/* Agency Input */}
              <div className={`p-4 rounded-xl border flex flex-col gap-1 transition-all ${
                isMidnight 
                  ? 'bg-zinc-900 border-zinc-850 focus-within:border-[#00ff9d]' 
                  : 'bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-on-surface-variant">Agência</label>
                <input 
                  type="text"
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  className={`bg-transparent border-b font-black text-sm py-1 outline-none ${
                    isMidnight ? 'border-zinc-850 text-white focus:border-[#00ff9d]' : 'border-gray-200 text-black focus:border-black'
                  }`}
                />
              </div>

              {/* Account Input */}
              <div className={`p-4 rounded-xl border flex flex-col gap-1 transition-all ${
                isMidnight 
                  ? 'bg-zinc-900 border-zinc-850 focus-within:border-[#00ff9d]' 
                  : 'bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-on-surface-variant">Conta com dígito</label>
                <input 
                  type="text"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className={`bg-transparent border-b font-black text-sm py-1 outline-none ${
                    isMidnight ? 'border-zinc-850 text-white focus:border-[#00ff9d]' : 'border-gray-200 text-black focus:border-black'
                  }`}
                />
              </div>
            </div>
          </section>

          {/* Account Type Selector */}
          <section className="space-y-2 text-center">
            <h3 className="text-xs font-black uppercase tracking-wider text-on-surface-variant">E qual tipo de conta?</h3>
            <div className={`flex p-1 rounded-full overflow-hidden ${
              isMidnight ? 'bg-zinc-950 border border-zinc-900' : 'bg-gray-100'
            }`}>
              <button
                onClick={() => setAccountType('corrente')}
                className={`flex-1 py-2.5 rounded-full text-xs font-black transition-all cursor-pointer ${
                  accountType === 'corrente'
                    ? isMidnight
                      ? 'bg-[#00ff9d] text-black font-extrabold shadow-md'
                      : 'bg-black text-white font-extrabold'
                    : 'text-on-surface-variant'
                }`}
              >
                Corrente
              </button>
              <button
                onClick={() => setAccountType('poupança')}
                className={`flex-1 py-2.5 rounded-full text-xs font-black transition-all cursor-pointer ${
                  accountType === 'poupança'
                    ? isMidnight
                      ? 'bg-[#00ff9d] text-black font-extrabold shadow-md'
                      : 'bg-black text-white font-extrabold'
                    : 'text-on-surface-variant'
                }`}
              >
                Poupança
              </button>
            </div>
          </section>

          {/* Warning Information Box */}
          <div className={`p-4 rounded-xl border-l-4 border-[#00ff9d] flex gap-3 items-start ${
            isMidnight ? 'bg-zinc-900 border-zinc-850' : 'bg-green-50/50'
          }`}>
            <Info className="text-[#00ff9d] shrink-0 mt-0.5" size={16} />
            <div className="space-y-1">
              <p className="text-xs font-black text-[#00ff9d]">Atenção!</p>
              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                O dinheiro será enviado com a finalidade de Empréstimo, alguns bancos podem não receber esse tipo de transferência.
              </p>
            </div>
          </div>

          {/* Next Button */}
          <button
            onClick={() => {
              if (!agency || !account) {
                alert('Preencha os campos de Agência e Conta.');
                return;
              }
              setScreen('resumo');
            }}
            className="w-full py-4 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer btn-primary"
          >
            Continuar
          </button>
        </motion.div>
      )}

      {/* SCREEN 4: RESUMO DA PROPOSTA SCREEN (Matches visual bento perfectly) */}
      {screen === 'resumo' && (
        <motion.div 
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setScreen('transfer_details')}
              className={`p-2 rounded-xl transition-colors shrink-0 ${
                isMidnight ? 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-black'
              }`}
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-xs font-black uppercase tracking-wider text-on-surface-variant">Resumo da Proposta</h1>
            <div className="w-9 h-9 flex items-center justify-center">
              <Info size={18} className="text-on-surface-variant" />
            </div>
          </div>

          <section className="space-y-1">
            <h2 className="text-xl font-black text-[#00ff9d]">Resumo da Proposta</h2>
            <p className="text-xs text-on-surface-variant">Confira todos os detalhes do seu saque antes de confirmar.</p>
          </section>

          {/* Summary Bento Layout Card */}
          <div className={`rounded-xl p-5 border relative overflow-hidden transition-all duration-300 ${
            isMidnight ? 'bg-zinc-900 border-zinc-850' : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            <div className="absolute top-0 left-0 w-1 h-full bg-[#00ff9d] shadow-[0_0_10px_rgba(0,255,157,0.5)]" />
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-sm font-black text-[#00ff9d]">Dados do Saque</h3>
                <p className="text-[8px] font-black uppercase tracking-wider text-on-surface-variant">Detalhamento Financeiro</p>
              </div>
              <Sliders className="text-[#00ff9d]" size={16} />
            </div>

            <div className="space-y-4">
              {/* Card Detail Row */}
              <div className={`p-3 rounded-lg border flex justify-between items-center ${
                isMidnight ? 'bg-zinc-950 border-zinc-850' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-3">
                  <CreditCard className="text-purple-400" size={16} />
                  <div>
                    <p className="text-[9px] uppercase font-bold text-on-surface-variant">Cartão</p>
                    <p className="text-xs font-black">MATEUSCARD ELO MAIS</p>
                    <p className="text-[9px] text-on-surface-variant">Final **** 0030</p>
                  </div>
                </div>
              </div>

              {/* Details table */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-end border-b border-zinc-800/10 pb-2">
                  <div>
                    <span className="text-[9px] text-on-surface-variant uppercase font-bold">Titular</span>
                    <p className="font-extrabold uppercase">{userProfile.name}</p>
                  </div>
                  <Shield size={14} className="text-[#00ff9d]" />
                </div>

                <div className="flex justify-between items-end border-b border-zinc-800/10 pb-2">
                  <div>
                    <span className="text-[9px] text-on-surface-variant uppercase font-bold">Valor solicitado</span>
                    <p className="text-xl font-black text-[#00ff9d]">{formatBRL(withdrawAmount)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] text-on-surface-variant uppercase font-bold">Pagamento</span>
                    <p className="font-extrabold">Parcelado</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-on-surface-variant uppercase font-bold">Parcelas</span>
                    <p className="font-extrabold text-[#00ff9d]">{installments}x</p>
                  </div>
                </div>

                {/* Sub details boxes */}
                <div className={`p-3 rounded-lg border space-y-1.5 text-[11px] ${
                  isMidnight ? 'bg-zinc-950 border-zinc-850' : 'bg-gray-50'
                }`}>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant font-medium">Valor Financiado</span>
                    <span className="font-bold">{formatBRL(withdrawAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant font-medium">Taxa de juros (mês)</span>
                    <span className="font-black text-[#00ff9d]">17,90%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant font-medium">Valor total de juros</span>
                    <span className="font-bold">{formatBRL(currentValues.juros)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-[9px] text-on-surface-variant uppercase font-bold">CET anual (%)</span>
                  <span className="text-base font-black text-white">{currentValues.cet}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Notice */}
          <div className={`p-4 rounded-xl flex gap-3 items-start ${isMidnight ? 'bg-zinc-900 border border-zinc-850' : 'bg-gray-50'}`}>
            <Info className="text-purple-400 shrink-0 mt-0.5" size={16} />
            <p className="text-[11px] text-on-surface leading-relaxed">
              Ao confirmar, o valor será creditado conforme as políticas de liquidação do seu banco parceiro.
            </p>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <button
              onClick={() => setScreen('seguranca')}
              className="w-full py-4 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer btn-primary"
            >
              Confirmar Saque <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setScreen('home')}
              className={`w-full py-3.5 text-xs font-black uppercase tracking-wider text-center cursor-pointer text-on-surface-variant hover:text-white`}
            >
              Cancelar Solicitação
            </button>
          </div>
        </motion.div>
      )}

      {/* SCREEN 5: SEGURANÇA (PIN / POSITION KEY SCREEN) */}
      {screen === 'seguranca' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-8 py-4 text-center"
        >
          {/* Top AppBar */}
          <div className="flex items-center justify-between text-left">
            <button 
              onClick={() => setScreen('resumo')}
              className="text-primary hover:opacity-80 transition-opacity"
            >
              <ArrowLeft size={18} className="text-[#00ff9d]" />
            </button>
            <h1 className="text-xs font-black uppercase tracking-wider text-on-surface-variant">Segurança</h1>
            <div className="text-xs font-black text-[#00ff9d]">Saque com Cartão</div>
          </div>

          {/* Instruction */}
          <div className="space-y-1">
            <p className="text-sm text-on-surface font-semibold">Digite a chave de posição</p>
            <p className="text-3xl font-black text-[#00ff9d] drop-shadow-[0_0_12px_rgba(0,255,157,0.4)]">44</p>
          </div>

          {/* Interactive PIN code inputs */}
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {pin.map((digit, idx) => {
                const isFocused = idx === focusedPinIndex;
                return (
                  <input
                    key={idx}
                    type={idx < 3 ? 'password' : 'text'}
                    value={digit}
                    readOnly
                    onClick={() => setFocusedPinIndex(idx)}
                    placeholder={isFocused ? '|' : ''}
                    className={`w-12 h-14 bg-zinc-900 border-b-2 text-[#00ff9d] text-center font-black text-xl rounded-lg focus:outline-none transition-all placeholder:text-zinc-700 ${
                      isFocused ? 'border-[#00ff9d] ring-2 ring-[#00ff9d]/20 shadow-[0_0_12px_rgba(0,255,157,0.3)]' : 'border-zinc-800'
                    }`}
                  />
                );
              })}
            </div>
            <p className="text-[10px] text-on-surface-variant font-mono">ref: 19980</p>
          </div>

          {/* On-screen Keypad helper for outstanding interactive feel! */}
          <div className="max-w-[240px] mx-auto grid grid-cols-3 gap-2 pt-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handlePinChange(num.toString())}
                className="w-16 h-12 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-white font-extrabold text-sm flex items-center justify-center cursor-pointer transition-all active:scale-95"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handlePinBackspace}
              className="w-16 h-12 rounded-xl bg-zinc-900/60 hover:bg-zinc-850 text-zinc-400 font-extrabold text-xs flex items-center justify-center cursor-pointer transition-all active:scale-95"
            >
              ⌫
            </button>
            <button
              type="button"
              onClick={() => handlePinChange('0')}
              className="w-16 h-12 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-white font-extrabold text-sm flex items-center justify-center cursor-pointer transition-all active:scale-95"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => {
                const newPin = [...pin];
                newPin[3] = Math.floor(Math.random() * 10).toString();
                setPin(newPin);
              }}
              className="w-16 h-12 rounded-xl bg-zinc-900/60 hover:bg-zinc-850 text-zinc-400 font-extrabold text-[9px] uppercase tracking-tighter flex items-center justify-center cursor-pointer transition-all active:scale-95"
            >
              Preencher
            </button>
          </div>

          {/* Protocol Card */}
          <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 text-left space-y-1.5 shadow-xl max-w-sm mx-auto">
            <div className="flex items-center gap-1.5 text-[#00ff9d]">
              <Shield size={16} />
              <span className="text-[8px] font-black uppercase tracking-widest">Protocolo Seguro</span>
            </div>
            <p className="text-[10px] text-on-surface-variant leading-relaxed">
              Confirme o código gerado no seu cartão de segurança físico ou token digital para autorizar este saque de {formatBRL(withdrawAmount)}.
            </p>
          </div>

          {/* Submit */}
          <button
            onClick={executeWithdrawal}
            disabled={loading || pin.some(d => d === '')}
            className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              pin.some(d => d === '')
                ? 'bg-zinc-800/40 text-zinc-500 border border-zinc-850 cursor-not-allowed'
                : 'btn-primary'
            }`}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
            ) : (
              'Confirmar'
            )}
          </button>
        </motion.div>
      )}

      {/* SCREEN 6: SAQUE SOLICITADO / SUCCESS (matches exact image details) */}
      {screen === 'success' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6 text-center pt-8"
        >
          {/* Header check icon */}
          <div className="w-full flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-[#00ff9d]/10 border-2 border-[#00ff9d] flex items-center justify-center shadow-[0_0_15px_rgba(0,255,157,0.2)] mb-4">
              <CheckCircle2 size={48} className="text-[#00ff9d] stroke-[2]" />
            </div>
            <h2 className="text-lg font-black text-[#00ff9d] leading-snug">
              Sua solicitação foi efetuada com sucesso!
            </h2>
            <p className="text-xs text-on-surface-variant mt-1.5">
              Acompanhe o crédito do valor na conta solicitada.
            </p>
          </div>

          {/* Details Card */}
          <div className="bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800 text-left space-y-4 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#00ff9d]/5 blur-3xl rounded-full" />
            
            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant block">Data e hora</span>
              <p className="text-base font-black text-[#00ff9d]">{lastWithdrawal.date} - {lastWithdrawal.time}</p>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950/50 border border-zinc-850 flex gap-2">
              <Info className="text-[#00ff9d] shrink-0 mt-0.5" size={16} />
              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                Esta transação está em processamento. Por isso, o valor pode demorar um pouco para cair na sua conta.
              </p>
            </div>

            <button className="w-full py-3 px-4 rounded-xl border border-zinc-800 flex items-center justify-center gap-1.5 font-black text-[10px] uppercase tracking-wider text-[#00ff9d] hover:bg-zinc-800 transition-colors">
              <Share2 size={12} /> Compartilhar resumo da proposta
            </button>
          </div>

          {/* Action button */}
          <div className="space-y-2 pt-4">
            <button
              onClick={() => setScreen('receipt')}
              className="w-full py-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer btn-secondary"
            >
              Ver comprovante completo
            </button>

            <button
              onClick={() => setScreen('home')}
              className="w-full py-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer btn-primary"
            >
              Ir para o início
            </button>
          </div>
        </motion.div>
      )}

      {/* SCREEN 7: COMPROVANTE DE SAQUE / RECEIPT */}
      {screen === 'receipt' && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setScreen('success')}
                className="text-[#00ff9d] hover:opacity-80 active:scale-95 shrink-0"
              >
                <ArrowLeft size={18} />
              </button>
              <h1 className="text-xs font-black uppercase tracking-wider text-[#00ff9d]">Saque com Cartão</h1>
            </div>
            <div className="flex items-center gap-3 text-on-surface-variant">
              <button onClick={() => alert('Recibo compartilhado!')} className="hover:text-white"><Share2 size={16} /></button>
              <button onClick={() => window.print()} className="hover:text-white"><Printer size={16} /></button>
            </div>
          </div>

          {/* Success Title Header */}
          <div className="text-center space-y-1.5 py-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#00ff9d]/10 mb-2">
              <CheckCircle2 size={36} className="text-[#00ff9d]" />
            </div>
            <h2 className="text-base font-black text-white">Transação Concluída</h2>
            <p className="text-[10px] text-on-surface-variant">O valor será creditado em sua conta em instantes.</p>
          </div>

          {/* Section: Dados do Saque */}
          <div className="bg-zinc-900/60 rounded-xl overflow-hidden border border-zinc-800 shadow-xl">
            <div className="p-3 bg-zinc-950/70 border-b border-zinc-850 flex items-center gap-2">
              <CreditCard className="text-[#00ff9d]" size={16} />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Dados do Saque</h3>
            </div>
            <div className="p-4 space-y-3 text-[11px]">
              <div className="flex justify-between items-start">
                <span className="text-on-surface-variant font-medium">Titular</span>
                <span className="font-extrabold uppercase">{userProfile.name}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-on-surface-variant font-medium">Cartão</span>
                <div className="text-right">
                  <p className="font-extrabold">MATEUSCARD ELO MAIS</p>
                  <p className="text-[10px] text-on-surface-variant">Final **** 0030</p>
                </div>
              </div>
              <div className="h-[1px] bg-zinc-800 my-1" />
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant font-medium">Valor solicitado</span>
                <span className="text-base font-black text-[#00ff9d]">{formatBRL(lastWithdrawal.amount)}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-on-surface-variant font-medium">Opção de pagamento</span>
                <span className="font-bold uppercase tracking-wider text-[10px]">PARCELADO EM {lastWithdrawal.installments}x</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-on-surface-variant font-medium">Taxa de juros ao mês</span>
                <span className="font-bold">17,90%</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-on-surface-variant font-medium">Valor total de juros</span>
                <span className="font-bold">{formatBRL(lastWithdrawal.juros)}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-on-surface-variant font-medium">CET anual (%)*</span>
                <span className="font-bold">680,95%</span>
              </div>

              <div className="bg-[#00ff9d]/5 p-3 rounded-lg border border-[#00ff9d]/20 flex justify-between items-center mt-3">
                <span className="text-[9px] font-black uppercase text-[#00ff9d] tracking-wider">Total da transação</span>
                <span className="text-base font-black text-[#00ff9d]">{formatBRL(lastWithdrawal.total)}</span>
              </div>
              <p className="text-[8px] text-on-surface-variant italic mt-1">*Somatório: Valor financiado + Juros</p>
            </div>
          </div>

          {/* Section: Dados da transferência */}
          <div className="bg-zinc-900/60 rounded-xl overflow-hidden border-l-4 border-[#00ff9d] border-y border-r border-zinc-800 shadow-xl">
            <div className="p-3 bg-zinc-950/70 border-b border-zinc-850 flex items-center gap-2">
              <Landmark className="text-[#00ff9d]" size={16} />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Dados da transferência</h3>
            </div>
            <div className="p-4 space-y-3 text-[11px]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] text-on-surface-variant uppercase font-bold block">Favorecido</span>
                  <span className="font-extrabold uppercase">{userProfile.name}</span>
                </div>
                <div>
                  <span className="text-[9px] text-on-surface-variant uppercase font-bold block">CPF</span>
                  <span className="font-mono font-bold">978.053.861-53</span>
                </div>
              </div>
              <div>
                <span className="text-[9px] text-on-surface-variant uppercase font-bold block">Banco</span>
                <span className="font-bold text-[#00ff9d]">{selectedBank.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] text-on-surface-variant uppercase font-bold block">Agência e Conta</span>
                  <span className="font-mono font-bold">{agency} | {account}</span>
                </div>
                <div>
                  <span className="text-[9px] text-on-surface-variant uppercase font-bold block">Tipo de conta</span>
                  <span className="font-bold">{accountType === 'corrente' ? 'Conta-Corrente' : 'Conta Poupança'}</span>
                </div>
              </div>
              <div>
                <span className="text-[9px] text-on-surface-variant uppercase font-bold block">Descrição</span>
                <span className="font-bold">FINALIDADE EMPRÉSTIMO</span>
              </div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="space-y-2 pt-2">
            <button
              onClick={() => {
                setScreen('home');
                setWithdrawAmount(300.17);
                setInstallments(1);
              }}
              className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 btn-primary"
            >
              Concluir transferência
            </button>
            <button 
              onClick={() => alert('Baixando PDF...')}
              className="w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all btn-secondary"
            >
              Ver recibo em PDF
            </button>
          </div>
        </motion.div>
      )}

      {/* IMPORTANT INFO MODAL (matches reference popup perfectly) */}
      <AnimatePresence>
        {isImportantModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsImportantModalOpen(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 30, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm rounded-[2rem] overflow-hidden border p-6 flex flex-col bg-zinc-900 border-zinc-800 text-white shadow-2xl"
            >
              {/* Header Info icon */}
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
                  <AlertCircle className="text-red-500 stroke-[2.5]" size={36} />
                </div>
                <h3 className="text-xl font-black text-red-500 uppercase tracking-wide">Importante</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed px-4">
                  Para seguir, é preciso ter uma conta em que você seja o titular para receber o dinheiro.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 mt-4 pb-2">
                <button
                  onClick={() => {
                    setIsImportantModalOpen(false);
                    setScreen('simulation');
                  }}
                  className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer btn-primary"
                >
                  Ok, tenho conta
                </button>
                <button
                  onClick={() => setIsImportantModalOpen(false)}
                  className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer btn-secondary"
                >
                  Não tenho conta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
