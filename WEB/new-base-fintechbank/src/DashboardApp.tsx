import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import * as api from './services/api';
import { motion, AnimatePresence } from 'motion/react';
import { ActiveTab, Transaction, CreditCard, UserProfile, AppNotification } from './types';
import Header from './components/Header';
import Navbar from './components/Navbar';
import HomeView from './components/HomeView';
import CardsView from './components/CardsView';
import InvoiceView from './components/InvoiceView';
import StatementView from './components/StatementView';
import ShopView from './components/ShopView';
import ProfileView from './components/ProfileView';
import LimitView from './components/LimitView';
import { GlobalModalProvider, useGlobalModal } from './context/GlobalModalContext';

// Initial Mock Data
const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx1',
    title: 'Sabor & Arte',
    amount: -42.90,
    type: 'expense',
    category: 'refeicao',
    date: '2026-06-23T12:45:00.000Z',
    formattedDate: 'Terça-feira, 23/06/2026',
    time: '12:45',
  },
  {
    id: 'tx2',
    title: 'Uber *Trip',
    amount: -18.50,
    type: 'expense',
    category: 'mobilidade',
    date: '2026-06-22T08:12:00.000Z',
    formattedDate: 'Segunda-feira, 22/06/2026',
    time: '08:12',
  },
  {
    id: 'tx3',
    title: 'Cineflix Prime',
    amount: -35.00,
    type: 'expense',
    category: 'cultura',
    date: '2026-05-15T21:30:00.000Z',
    formattedDate: 'Sexta-feira, 15/05/2026',
    time: '21:30',
  },
  {
    id: 'tx4',
    title: 'Supermercado Sol',
    amount: -210.50,
    type: 'expense',
    category: 'refeicao',
    date: '2026-04-10T15:10:00.000Z',
    formattedDate: 'Sexta-feira, 10/04/2026',
    time: '15:10',
  },
  {
    id: 'tx5',
    title: 'Recarga de Saldo',
    amount: 500.00,
    type: 'income',
    category: 'outros',
    date: '2026-06-24T10:00:00.000Z',
    formattedDate: 'Quarta-feira, 24/06/2026',
    time: '10:00',
  },
  {
    id: 'tx6',
    title: 'Consulta Médica',
    amount: -120.00,
    type: 'expense',
    category: 'saude',
    date: '2026-03-18T14:20:00.000Z',
    formattedDate: 'Quarta-feira, 18/03/2026',
    time: '14:20',
  },
  {
    id: 'tx7',
    title: 'Posto Volt Gas',
    amount: -95.00,
    type: 'expense',
    category: 'mobilidade',
    date: '2026-02-05T09:15:00.000Z',
    formattedDate: 'Quinta-feira, 05/02/2026',
    time: '09:15',
  },
  {
    id: 'tx8',
    title: 'Livraria Central',
    amount: -65.00,
    type: 'expense',
    category: 'cultura',
    date: '2026-01-20T16:40:00.000Z',
    formattedDate: 'Terça-feira, 20/01/2026',
    time: '16:40',
  }
];

const VALID_TABS: ActiveTab[] = ['home', 'cards', 'limit', 'shop', 'profile'];

function DashboardShell() {
  const { openPix, openDeposit, openBiometric } = useGlobalModal();
  const { user } = useAuth();
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();

  // Derive active tab from URL (TASK 2)
  const activeTab: ActiveTab = VALID_TABS.includes(tab as ActiveTab) ? (tab as ActiveTab) : 'home';

  // Sub-navigation view toggles (instead of rendering tabs, they render detail overlays)
  const [invoiceSubView, setInvoiceSubView] = useState(false);
  const [statementSubView, setStatementSubView] = useState(false);

  // Core Financial States — balance seeded from auth (TASK 3)
  const [accountBalance, setAccountBalance] = useState<number>(() => user?.balance ?? 12450.65);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(() => {
    return localStorage.getItem('volt_biometric_enabled') === 'true';
  });
  const [balanceIsVisible, setBalanceIsVisible] = useState(() => {
    const biometric = localStorage.getItem('volt_biometric_enabled') === 'true';
    return !biometric;
  });
  const [invoiceAmount, setInvoiceAmount] = useState<number>(1750.80);

  // Analytical and AI modal states lifted for the Header Central Hub
  const [isFinancialHealthOpen, setIsFinancialHealthOpen] = useState(false);
  const [isAiRecurringModalOpen, setIsAiRecurringModalOpen] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<'balance' | 'analytics' | 'insights' | 'trends' | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isCentralHubOpen, setIsCentralHubOpen] = useState(false);

  const handleBiometricToggle = (enabled: boolean) => {
    setBiometricEnabled(enabled);
    localStorage.setItem('volt_biometric_enabled', String(enabled));
    if (enabled) {
      setBalanceIsVisible(false);
    }
  };

  const handleToggleBalanceVisibility = () => {
    if (biometricEnabled && !balanceIsVisible) {
      openBiometric({ onSuccess: () => setBalanceIsVisible(true), theme });
    } else {
      setBalanceIsVisible(!balanceIsVisible);
    }
  };

  // Theme state: 'yellow' or 'midnight'
  const [theme, setTheme] = useState<'yellow' | 'midnight'>(() => {
    const saved = localStorage.getItem('volt_theme');
    if (saved === 'midnight' || saved === 'yellow') {
      return saved;
    }
    // Check OS-level dark/light mode setting
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'yellow';
    }
    return 'yellow';
  });

  // User Profile — seeded from AuthContext, synced to localStorage
  const [userProfile, setUserProfile] = useState<UserProfile>(() => ({
    name: user?.fullName ?? 'Usuário',
    email: user?.email ?? '',
    avatarUrl: user?.avatarUrl ?? '',
  }));

  // Credit Card Config
  const [creditCard, setCreditCard] = useState<CreditCard>({
    number: '•••• •••• •••• 8842',
    holder: 'GILVAN',
    expiry: '08/30',
    cvv: '123',
    isBlocked: false,
    isNfcEnabled: true,
    type: 'physical',
    limitTotal: 5000,
    limitUsed: 1750.80,
  });

  // Transactions array
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);

  // Toast state for real-time push notifications
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const checkRecurringBillNotifications = () => {
    // 1. Fetch recurring bills from localStorage or use defaults
    let bills: any[] = [];
    const savedBills = localStorage.getItem('volt_recurring_bills');
    if (savedBills) {
      bills = JSON.parse(savedBills);
    } else {
      bills = [
        { id: 'rec_1', title: 'Spotify Premium', amount: -24.90, category: 'cultura', dueDate: '26/06/2026', status: 'pending' },
        { id: 'rec_2', title: 'Netflix Ultra HD', amount: -55.90, category: 'cultura', dueDate: '27/06/2026', status: 'pending' },
        { id: 'rec_3', title: 'Internet Volt Fibra', amount: -119.90, category: 'outros', dueDate: '28/06/2026', status: 'pending' },
        { id: 'rec_4', title: 'Light Volt Energia', amount: -180.00, category: 'outros', dueDate: '20/06/2026', status: 'paid', paidAtDate: '20/06/2026' },
        { id: 'rec_5', title: 'Gym Pass Academia', amount: -89.90, category: 'saude', dueDate: '30/06/2026', status: 'pending' },
      ];
    }

    // 2. Fetch notifications from localStorage or use defaults
    let currentNotifs: AppNotification[] = [];
    const savedNotifs = localStorage.getItem('volt_notifications');
    if (savedNotifs) {
      currentNotifs = JSON.parse(savedNotifs);
    } else {
      currentNotifs = [
        { id: 'notif_1', title: 'Compra aprovada', description: 'R$ 499,00 na Apple Store', time: 'Há 5 min' },
        { id: 'notif_2', title: 'Fatura fechada', description: 'Fatura de Outubro fechou em R$ 1.210,00', time: 'Ontem' },
        { id: 'notif_3', title: 'Rendimento CDI', description: 'Seu saldo rendeu R$ 2,45 ontem (110% do CDI)', time: 'Ontem' },
      ];
    }

    // Helper to parse due date in format DD/MM/YYYY
    const parseDueDate = (dateStr: string) => {
      const parts = dateStr.split('/');
      if (parts.length !== 3) return null;
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed month
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    };

    // Determine today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let triggeredAny = false;
    let updatedNotifs = [...currentNotifs];

    bills.forEach((bill) => {
      if (bill.status !== 'pending') return;

      const dueDateObj = parseDueDate(bill.dueDate);
      if (!dueDateObj) return;
      dueDateObj.setHours(0, 0, 0, 0);

      // Diff in ms
      const diffTime = dueDateObj.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      // Trigger if exactly 2 days before due date
      if (diffDays === 2) {
        const uniqueNotifId = `bill-due-2days-${bill.id}-${bill.dueDate}`;
        const alreadyExists = updatedNotifs.some(n => n.id === uniqueNotifId);

        if (!alreadyExists) {
          const absAmount = Math.abs(bill.amount);
          const formattedAmt = absAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          
          const newNotif: AppNotification = {
            id: uniqueNotifId,
            title: 'Vencimento Próximo 📅',
            description: `A conta "${bill.title}" no valor de R$ ${formattedAmt} vence em 2 dias (${bill.dueDate}).`,
            time: 'Agora'
          };

          updatedNotifs = [newNotif, ...updatedNotifs];
          triggeredAny = true;

          // Trigger push toast
          setToast({
            title: '⚠️ VENCIMENTO PRÓXIMO',
            message: `Aviso Volt: A conta "${bill.title}" no valor de R$ ${formattedAmt} vence em 2 dias (${bill.dueDate}).`
          });
        }
      }
    });

    if (triggeredAny || !savedNotifs) {
      localStorage.setItem('volt_notifications', JSON.stringify(updatedNotifs));
    }
    setNotifications(updatedNotifs);
  };

  const handleClearNotification = (id: string) => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    localStorage.setItem('volt_notifications', JSON.stringify(updated));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    localStorage.setItem('volt_notifications', JSON.stringify([]));
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Apply body class when theme changes
  useEffect(() => {
    if (theme === 'midnight') {
      document.body.className = 'theme-midnight dark';
      document.documentElement.classList.add('dark');
    } else {
      document.body.className = 'theme-yellow';
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('volt_theme', theme);
  }, [theme]);

  // Load state from local storage on mount
  useEffect(() => {
    const storedBalance = localStorage.getItem('volt_balance');
    const storedInvoice = localStorage.getItem('volt_invoice');
    const storedProfile = localStorage.getItem('volt_profile');
    const storedCard = localStorage.getItem('volt_card');
    const storedTxs = localStorage.getItem('volt_txs');

    if (storedBalance) setAccountBalance(parseFloat(storedBalance));
    if (storedInvoice) setInvoiceAmount(parseFloat(storedInvoice));
    if (storedProfile) setUserProfile(JSON.parse(storedProfile));
    if (storedCard) setCreditCard(JSON.parse(storedCard));
    if (storedTxs) setTransactions(JSON.parse(storedTxs));

    // Check recurring bill notifications
    checkRecurringBillNotifications();

    // TASK 3: sync with real API data
    if (user?.cpf) {
      api.getTransactions(user.cpf).then(txs => {
        if (txs.length > 0) {
          setTransactions(txs);
          localStorage.setItem('volt_txs', JSON.stringify(txs));
        }
      }).catch(() => {/* keep local data */});

      api.getCreditCard(user.cpf).then(card => {
        if (card) {
          setCreditCard(card);
          if (card.limitUsed) setInvoiceAmount(card.limitUsed);
          localStorage.setItem('volt_card', JSON.stringify(card));
        }
      }).catch(() => {});

      api.getRecurringBills(user.cpf).then(bills => {
        if (bills.length > 0) {
          localStorage.setItem('volt_recurring_bills', JSON.stringify(bills));
          checkRecurringBillNotifications();
        }
      }).catch(() => {});
    }
  }, []);

  // Sync to local storage
  const saveState = (
    balance: number,
    invoice: number,
    profile: UserProfile,
    card: CreditCard,
    txs: Transaction[]
  ) => {
    localStorage.setItem('volt_balance', balance.toString());
    localStorage.setItem('volt_invoice', invoice.toString());
    localStorage.setItem('volt_profile', JSON.stringify(profile));
    localStorage.setItem('volt_card', JSON.stringify(card));
    localStorage.setItem('volt_txs', JSON.stringify(txs));
  };

  const handleUpdateTransactionNote = (txId: string, note: string) => {
    const updatedTxs = transactions.map(tx => tx.id === txId ? { ...tx, note } : tx);
    setTransactions(updatedTxs);
    saveState(accountBalance, invoiceAmount, userProfile, creditCard, updatedTxs);
  };

  const handleTransactionComplete = (newTx: Transaction, amount: number) => {
    const updatedBalance = accountBalance + amount;
    const updatedTxs = [newTx, ...transactions];
    
    setAccountBalance(updatedBalance);
    setTransactions(updatedTxs);
    saveState(updatedBalance, invoiceAmount, userProfile, creditCard, updatedTxs);

    // Check for real-time notification trigger
    const isNotificationEnabled = localStorage.getItem('volt_notifications_enabled') === 'true';
    const notificationThreshold = parseFloat(localStorage.getItem('volt_notifications_amount') || '500');
    const absAmount = Math.abs(newTx.amount);

    if (isNotificationEnabled && absAmount >= notificationThreshold) {
      setToast({
        title: '🔔 Compra Elevada Realizada',
        message: `Aviso Volt: Uma transação de R$ ${absAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi confirmada em "${newTx.title}".`
      });
    }

    // Check for Smart Alerts
    const isSmartAlertsEnabled = localStorage.getItem('volt_smart_alerts_enabled') === 'true';
    if (isSmartAlertsEnabled) {
      const minAmount = parseFloat(localStorage.getItem('volt_smart_alerts_min_amount') || '100');
      const savedCategories = localStorage.getItem('volt_smart_alerts_categories');
      const categories: string[] = savedCategories ? JSON.parse(savedCategories) : ['refeicao', 'mobilidade', 'cultura', 'saude', 'outros'];
      const timePreset = localStorage.getItem('volt_smart_alerts_time_preset') || 'always';
      
      let isCategoryMatch = categories.includes(newTx.category);
      let isAmountMatch = absAmount >= minAmount;
      let isTimeMatch = false;

      if (timePreset === 'always') {
        isTimeMatch = true;
      } else if (timePreset === 'night') {
        // Between 22:00 and 06:00
        const t = newTx.time || "12:00";
        isTimeMatch = t >= '22:00' || t <= '06:00';
      } else if (timePreset === 'business') {
        // Between 08:00 and 18:00
        const t = newTx.time || "12:00";
        isTimeMatch = t >= '08:00' && t <= '18:00';
      } else if (timePreset === 'custom') {
        const startT = localStorage.getItem('volt_smart_alerts_start_time') || '22:00';
        const endT = localStorage.getItem('volt_smart_alerts_end_time') || '06:00';
        const t = newTx.time || "12:00";
        if (startT === endT) {
          isTimeMatch = true;
        } else if (startT < endT) {
          isTimeMatch = t >= startT && t <= endT;
        } else {
          isTimeMatch = t >= startT || t <= endT;
        }
      }

      if (isCategoryMatch && isAmountMatch && isTimeMatch) {
        const catLabels: Record<string, string> = {
          refeicao: 'Refeição 🍔',
          mobilidade: 'Mobilidade 🚗',
          cultura: 'Cultura 🎬',
          saude: 'Saúde 🏥',
          outros: 'Outros 💳'
        };
        const catLabel = catLabels[newTx.category] || newTx.category;

        // Trigger custom smart alert toast
        setToast({
          title: '🔮 Alerta Inteligente Volt',
          message: `Gasto monitorado detectado: R$ ${absAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em "${newTx.title}" (${catLabel}) às ${newTx.time}.`
        });

        // Add to persistent notification system
        const newNotifId = `smart-alert-${Date.now()}-${Math.random()}`;
        const newNotif: AppNotification = {
          id: newNotifId,
          title: '🔮 Alerta Inteligente',
          description: `Compra monitorada de R$ ${absAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} realizada em "${newTx.title}" (${catLabel}) às ${newTx.time}.`,
          time: 'Agora',
          read: false
        };

        const currentNotifs = JSON.parse(localStorage.getItem('volt_notifications') || '[]');
        const updatedNotifs = [newNotif, ...currentNotifs];
        localStorage.setItem('volt_notifications', JSON.stringify(updatedNotifs));
        setNotifications(updatedNotifs);
      }
    }
  };

  const handleDepositComplete = (newTx: Transaction, amount: number) => {
    const updatedBalance = accountBalance + amount;
    const updatedTxs = [newTx, ...transactions];

    setAccountBalance(updatedBalance);
    setTransactions(updatedTxs);
    saveState(updatedBalance, invoiceAmount, userProfile, creditCard, updatedTxs);
  };

  const updateProfile = (fields: Partial<UserProfile>) => {
    const updated = { ...userProfile, ...fields };
    setUserProfile(updated);
    saveState(accountBalance, invoiceAmount, updated, creditCard, transactions);
  };

  const updateCreditCard = (fields: Partial<CreditCard>) => {
    const updated = { ...creditCard, ...fields };
    setCreditCard(updated);
    saveState(accountBalance, invoiceAmount, userProfile, updated, transactions);
  };

  const payInvoice = (amount: number): boolean => {
    if (accountBalance >= amount) {
      const updatedBalance = accountBalance - amount;
      const updatedInvoice = 0.00;

      // Add a transaction for paying the invoice
      const now = new Date();
      const formatNumber = (num: number) => String(num).padStart(2, '0');
      const formattedDate = `${formatNumber(now.getDate())}/${formatNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
      
      const weekdays = [
        'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
      ];

      const newTx: Transaction = {
        id: Math.random().toString(36).substring(2, 11),
        title: 'Pagamento de Fatura Volt',
        amount: -amount,
        type: 'expense',
        category: 'outros',
        date: now.toISOString(),
        formattedDate: `${weekdays[now.getDay()]}, ${formattedDate}`,
        time: `${formatNumber(now.getHours())}:${formatNumber(now.getMinutes())}`
      };

      const updatedTxs = [newTx, ...transactions];

      setAccountBalance(updatedBalance);
      setInvoiceAmount(updatedInvoice);
      setTransactions(updatedTxs);
      
      saveState(updatedBalance, updatedInvoice, userProfile, creditCard, updatedTxs);
      return true;
    }
    return false;
  };

  // Switch tabs — navigate to URL route (TASK 2)
  const handleTabChange = (newTab: ActiveTab) => {
    setInvoiceSubView(false);
    setStatementSubView(false);
    navigate(`/dashboard/${newTab}`);
  };

  // Render subview or tab view cleanly with an elegant slide-up or fade-in transition
  const renderContent = () => {
    if (invoiceSubView) {
      return (
        <div key="invoice_view">
          <InvoiceView invoiceAmount={invoiceAmount} />
        </div>
      );
    }
    if (statementSubView) {
      return (
        <div key="statement_view">
          <StatementView 
            transactions={transactions} 
            theme={theme} 
            onUpdateTransactionNote={handleUpdateTransactionNote}
          />
        </div>
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <div key="home_view">
            <HomeView
              accountBalance={accountBalance}
              balanceIsVisible={balanceIsVisible}
              toggleBalanceVisibility={handleToggleBalanceVisibility}
              setActiveTab={handleTabChange}
              setInvoiceSubView={setInvoiceSubView}
              setStatementSubView={setStatementSubView}
              invoiceAmount={invoiceAmount}
              openPixModal={() => openPix({ accountBalance, onTransactionComplete: handleTransactionComplete })}
              openDepositModal={() => openDeposit({ onDepositComplete: handleDepositComplete })}
              transactions={transactions}
              onTransactionComplete={handleTransactionComplete}
              theme={theme}
              onBillsUpdated={checkRecurringBillNotifications}
              isFinancialHealthOpen={isFinancialHealthOpen}
              setIsFinancialHealthOpen={setIsFinancialHealthOpen}
              isAiRecurringModalOpen={isAiRecurringModalOpen}
              setIsAiRecurringModalOpen={setIsAiRecurringModalOpen}
              activeDrawer={activeDrawer}
              setActiveDrawer={setActiveDrawer}
            />
          </div>
        );
      case 'cards':
        return (
          <div key="cards_view">
            <CardsView
              creditCard={creditCard}
              updateCreditCard={updateCreditCard}
              userProfile={userProfile}
              setInvoiceSubView={setInvoiceSubView}
              invoiceAmount={invoiceAmount}
              payInvoice={payInvoice}
            />
          </div>
        );
      case 'shop':
        return (
          <div key="shop_view">
            <ShopView
              accountBalance={accountBalance}
              onPurchaseComplete={handleTransactionComplete}
              theme={theme}
              showToast={(title, message) => setToast({ title, message })}
            />
          </div>
        );
      case 'limit':
        return (
          <div key="limit_view">
            <LimitView
              accountBalance={accountBalance}
              userProfile={userProfile}
              onTransactionComplete={handleTransactionComplete}
              theme={theme}
              showToast={(title, message) => setToast({ title, message })}
            />
          </div>
        );
      case 'profile':
        return (
          <div key="profile_view">
            <ProfileView
              userProfile={userProfile}
              onProfileUpdate={updateProfile}
              theme={theme}
              onThemeToggle={setTheme}
              biometricEnabled={biometricEnabled}
              onBiometricToggle={handleBiometricToggle}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-volt-dark text-on-surface flex flex-col font-sans selection:bg-volt-green selection:text-volt-dark">
      {/* Universal Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        userProfile={userProfile}
        invoiceSubView={invoiceSubView}
        setInvoiceSubView={setInvoiceSubView}
        statementSubView={statementSubView}
        setStatementSubView={setStatementSubView}
        notifications={notifications}
        onClearNotification={handleClearNotification}
        onClearAllNotifications={handleClearAllNotifications}
        theme={theme}
        onThemeToggle={setTheme}
        transactions={transactions}
        isFinancialHealthOpen={isFinancialHealthOpen}
        setIsFinancialHealthOpen={setIsFinancialHealthOpen}
        isAiRecurringModalOpen={isAiRecurringModalOpen}
        setIsAiRecurringModalOpen={setIsAiRecurringModalOpen}
        activeDrawer={activeDrawer}
        setActiveDrawer={setActiveDrawer}
        isAiModalOpen={isAiModalOpen}
        setIsAiModalOpen={setIsAiModalOpen}
        isCentralHubOpen={isCentralHubOpen}
        setIsCentralHubOpen={setIsCentralHubOpen}
      />

      {/* Main View Transition Container */}
      <main className="flex-1 mt-20 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + (invoiceSubView ? '_inv' : '') + (statementSubView ? '_stmt' : '')}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Persistent Bottom Tab Bar */}
      <Navbar />

      {/* Real-time Push Notification Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -80, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -80, x: '-50%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed top-6 left-1/2 z-50 w-full max-w-sm px-4"
          >
            <div className={`bg-volt-surface border-2 border-volt-green text-white p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex gap-3 items-start backdrop-blur-md`}>
              <div className="bg-volt-green/10 text-volt-green p-2 rounded-xl shrink-0 border border-volt-green/15 flex items-center justify-center">
                <span className="text-sm font-bold">🔔</span>
              </div>
              <div className="flex-1 space-y-0.5">
                <h5 className="text-[10px] font-black uppercase tracking-wider text-volt-green">{toast.title}</h5>
                <p className="text-[11px] text-white font-black leading-snug">{toast.message}</p>
              </div>
              <button
                onClick={() => setToast(null)}
                className="text-white/40 hover:text-white text-[10px] font-bold font-mono cursor-pointer px-1.5 py-0.5 rounded-lg hover:bg-white/5 transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DashboardApp() {
  return (
    <GlobalModalProvider>
      <DashboardShell />
    </GlobalModalProvider>
  );
}
