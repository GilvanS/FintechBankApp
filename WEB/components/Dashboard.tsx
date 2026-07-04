import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { PurchasedItem, Transaction, User } from '../types';
import { payCreditCardInvoice, parcelCreditCardInvoice, purchaseWithDebit, purchaseWithCard, anticipateCreditCardInstallments, getUserByCpf, getUserMe, getUserStatement } from '../services/api';
import { useDialog } from '../contexts/GlobalDialogContext';
import { useAppState } from '../contexts/AppStateContext';

import HomeView from './HomeView';
import Profile from './Profile';
import PixModal from './PixModal';
import Statement from './Statement';
import StatementPaginated from './StatementPaginated';
import CardDashboard from './CardDashboard';
import ShopView from './ShopView';
import ShoppingCart from './ShoppingCart';
import PaymentMethods from './PaymentMethods';
import DepositModal from './DepositModal';
import BoletoModal from './BoletoModal';
import InstallmentModal from './InstallmentModal';
import PurchaseConfirmation from './PurchaseConfirmation';
import BottomNavBar from './BottomNavBar';
import Admin from './Admin';
import Investments from './Investments';
import Wallet from './Wallet';
import Loans from './Loans';
import PointsDashboard from './PointsDashboard';
import AnticipateInstallments from './AnticipateInstallments';
import InstallmentReview from './InstallmentReview';
import PaymentReceipt from './PaymentReceipt';
import PasswordModal from './PasswordModal';
import Products from './Products';
import ClosedInvoice from './ClosedInvoice';
import InstallmentOptions from './InstallmentOptions';
import CurrentInvoice from './CurrentInvoice';
import InvoiceView from './InvoiceView';
import Header from './Header';
import LimitView from './LimitView';
import FinancialHealthModal from './FinancialHealthModal';
import AiRecurringBillModal from './AiRecurringBillModal';
import AiAssistantModal from './AiAssistantModal';
import SmartAlerts from './SmartAlerts';
import { AnimatePresence, motion } from 'motion/react';
import { LayoutGrid } from 'lucide-react';

const BlockedCardModal: React.FC<{ isOpen: boolean; onGoToPayment: () => void; onClose: () => void; }> = ({ isOpen, onGoToPayment, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-surface-dark p-8 rounded-lg shadow-xl w-full max-w-sm text-center">
                <span className="text-5xl mb-4" role="img" aria-label="Blocked">🚫</span>
                <h2 className="text-2xl font-bold mb-2 text-white">Cartão Bloqueado</h2>
                <p className="text-subtle-dark mb-6">
                    Seu cartão foi bloqueado por inadimplência. Efetue o pagamento da sua fatura para liberá-lo.
                </p>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={onGoToPayment} 
                        className="w-full py-3 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90"
                    >
                        Pagar Fatura
                    </button>
                    <button 
                        onClick={onClose} 
                        className="w-full py-3 font-semibold text-primary bg-transparent rounded-lg hover:bg-primary/10"
                    >
                        Voltar
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};


type View = 'home' | 'cards' | 'shop' | 'investments' | 'wallet' | 'loans' | 'profile' | 'statement' | 'pix' | 'deposit' | 'admin' | 'shoppingCart' | 'paymentMethods' | 'productPage' | 'points' | 'anticipateInstallments' | 'installmentReviewInvoice' | 'purchaseConfirmation' | 'products' | 'closedInvoice' | 'invoicePaymentReceipt' | 'installmentOptions' | 'currentInvoice' | 'limit';

const Dashboard: React.FC = () => {
    const { user, updateUser, logout, view: topLevelView, navigateTo } = useAuth();
    const { showDialog } = useDialog();
    const [currentView, setCurrentView] = useState<View>('home');
    const [previousView, setPreviousView] = useState<View>('home');
    const [invoiceSubView, setInvoiceSubView] = useState(false);
    const [statementSubView, setStatementSubView] = useState(false);

    const [cart, setCart] = useState<PurchasedItem[]>([]);
    const [currentItem, setCurrentItem] = useState<PurchasedItem | null>(null);
    const [isPixModalOpen, setIsPixModalOpen] = useState(false);
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const [isBoletoOpen, setIsBoletoOpen] = useState(false);
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
    // Shop is now full-page
    const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
    const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
    const [isHeaderHidden, setIsHeaderHidden] = useState(false);

    const {
        theme,
        setTheme,
        isFinancialHealthOpen,
        setFinancialHealthOpen,
        isAiRecurringModalOpen,
        setAiRecurringModalOpen,
        isAiModalOpen,
        setAiModalOpen,
        isCentralHubOpen,
        setCentralHubOpen,
        activeDrawer,
        setActiveDrawer,
        triggerSmartAlertCheck,
        notifications,
        clearNotification,
        clearAllNotifications,
    } = useAppState();

    const handleThemeToggle = useCallback((newTheme: 'yellow' | 'midnight') => {
        setTheme(newTheme);
    }, [setTheme]);

    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordAction, setPasswordAction] = useState<(() => void) | null>(null);
    const passwordActionPayload = useRef<any>(null); // Ref to hold payload for password actions
    const [passwordModalInfo, setPasswordModalInfo] = useState({ title: '', description: '' });
    const [isProcessing, setIsProcessing] = useState(false);
    const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);
    const [toast, setToast] = useState<{ title: string, message: string } | null>(null);
    
    // States for various flows
    const [purchaseDetails, setPurchaseDetails] = useState<{ items: PurchasedItem[], cashbackUsed: number, method: 'debit' | 'credit', installments: number } | null>(null);
    const [checkoutTotal, setCheckoutTotal] = useState(0);
    const [confirmationDetails, setConfirmationDetails] = useState<any>(null);
    const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
    const [parcelDetails, setParcelDetails] = useState<{ amount: number, installments: number } | null>(null);
    const [invoicePaymentDetails, setInvoicePaymentDetails] = useState<any>(null);
    
    useEffect(() => {
        if (currentView === 'cards' && user?.creditCard.isBlocked) {
            setIsBlockedModalOpen(true);
        } else if (currentView !== 'cards') {
            setIsBlockedModalOpen(false);
        }
    }, [currentView, user]);

    useEffect(() => {
        if (topLevelView === 'admin' && user?.role === 'admin') {
            setCurrentView('admin');
        }
    }, [topLevelView, user]);

    // Refresh automatico ao entrar em telas de cartoes
    useEffect(() => {
        let cancelled = false;

        const refreshUserIfNeeded = async () => {
            if (!user) return;

            const viewsToRefresh: View[] = [
                'currentInvoice',
                'closedInvoice',
                'installmentOptions',
                'anticipateInstallments',
                'points'
            ];

            if (!viewsToRefresh.includes(currentView)) return;

            const refreshed = await getUserByCpf(user.cpf);
            if (refreshed.success && refreshed.user && !cancelled) {
                updateUser(refreshed.user);
            }
        };

        refreshUserIfNeeded();
        return () => { cancelled = true; };
    }, [currentView, user, updateUser]);

    // Refresh quando modal de cards abre
    useEffect(() => {
        if (currentView !== 'cards' || !user) return;
        let cancelled = false;
        getUserByCpf(user.cpf).then(r => {
            if (r.success && r.user && !cancelled) updateUser(r.user);
        });
        return () => { cancelled = true; };
    }, [currentView, user]);

    // Refresh extrato quando modal de statement abre
    useEffect(() => {
        if (!isStatementModalOpen || !user) return;
        let cancelled = false;
        getUserStatement(user.cpf).then(stmt => {
            if (stmt.success && stmt.transactions && !cancelled) {
                updateUser({ transactions: stmt.transactions });
            }
        });
        return () => { cancelled = true; };
    }, [isStatementModalOpen]);
    const handleGoToPaymentFromModal = () => {
        setIsBlockedModalOpen(false);
        handleNavigate('closedInvoice');
    };
    
    const handleCloseBlockedModal = () => {
        setIsBlockedModalOpen(false);
    };

    const handleNavigate = useCallback((newView: View, item?: any) => {
        if (newView === 'pix') {
            setIsPixModalOpen(true);
            return;
        }
        if (newView === 'deposit') {
            setIsDepositModalOpen(true);
            return;
        }
        if (newView === 'admin') {
            setPreviousView(currentView);
            setCurrentView('admin');
            return;
        }
        if (newView === 'shop') {
            if (currentView !== 'shop') setPreviousView(currentView);
            setCurrentView('shop');
            return;
        }

        if (newView === 'statement') {
            setCurrentView('home');
            setIsStatementModalOpen(true);
            return;
        }
        if (newView === 'limit') {
            setPreviousView(currentView);
            setCurrentView('limit' as View);
            return;
        }
        if (newView === currentView) return;
        setPreviousView(currentView);
        setCurrentView(newView);
        if (item) setCurrentItem(item);
    }, [currentView]);

    const handleBack = () => {
        setCurrentView(previousView);
    };

    const handleTransactionCompleteLimit = (newTx: Transaction, amount: number) => {
        if (!user) return;
        const updatedUser = {
            ...user,
            balance: user.balance + amount,
            transactions: [newTx, ...user.transactions],
        };
        updateUser(updatedUser);
        triggerSmartAlertCheck(newTx.description ?? '', amount, 'outros');
    };

    const handleDepositComplete = (newTx: Transaction, amount: number) => {
        if (!user) return;
        const updatedUser = {
            ...user,
            balance: user.balance + amount,
            transactions: [newTx, ...user.transactions],
        };
        updateUser(updatedUser);
    };

    const handleBoletoComplete = (newTx: Transaction, amount: number) => {
        if (!user) return;
        const updatedUser = {
            ...user,
            balance: user.balance + amount,
            transactions: [newTx, ...user.transactions],
        };
        updateUser(updatedUser);
        triggerSmartAlertCheck(newTx.description ?? 'Pagamento de Boleto', amount, 'outros');
    };

    // --- Cart Logic ---
    const handleAddToCart = (item: PurchasedItem) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(i => i.id === item.id);
            if (existingItem) {
                return prevCart.map(i => i.id === item.id ? { ...i, quantity: (i.quantity || 1) + 1 } : i);
            }
            return [...prevCart, { ...item, quantity: 1 }];
        });
    };

    const handleUpdateCartQuantity = (itemId: string, quantity: number) => {
        if (quantity <= 0) {
            setCart(prev => prev.filter(item => item.id !== itemId));
        } else {
            setCart(prev => prev.map(item => item.id === itemId ? { ...item, quantity } : item));
        }
    };
    
    // --- Purchase Flow Logic ---
    const handleInitiatePurchase = (item: PurchasedItem) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(i => i.id === item.id);
            if (existingItem) {
                return prevCart;
            }
            return [...prevCart, { ...item, quantity: 1 }];
        });
        handleNavigate('shoppingCart');
    };

    const handleCheckout = () => {
        const total = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
        setCheckoutTotal(total);
        // Treat cart as a single item for purchase flow
        const checkoutItem: PurchasedItem = {
            id: 'cart-checkout',
            name: `${cart.length} itens no carrinho`,
            price: total,
            description: cart.map(i => i.name).join(', '),
            imageUrl: cart[0]?.imageUrl || ''
        };
        setCurrentItem(checkoutItem);
        handleNavigate('paymentMethods');
    };

    const handleSelectPaymentMethod = (method: 'debit' | 'credit') => {
        if (!currentItem) return;
        if (method === 'credit' && user?.creditCard.isBlocked) {
            setIsBlockedModalOpen(true);
            return;
        }
        const newPurchaseDetails = { items: cart.length > 0 ? cart : [currentItem], cashbackUsed: 0, method: 'debit', installments: 1 };
        passwordActionPayload.current = newPurchaseDetails;
        
        if (method === 'debit') {
            setPasswordModalInfo({ title: 'Confirmar Compra', description: 'Digite seu PIN para autorizar a compra no débito.' });
            setPasswordAction(() => () => executePurchase());
            setIsPasswordModalOpen(true);
        } else {
            setIsInstallmentModalOpen(true);
        }
    };

    const handleConfirmPurchaseWithInstallments = (details: { cashbackUsed: number, installments: number }) => {
        const itemsToPurchase = cart.length > 0 ? cart : (currentItem ? [currentItem] : []);
        const newPurchaseDetails = { items: itemsToPurchase, cashbackUsed: details.cashbackUsed, method: 'credit' as const, installments: details.installments };
        passwordActionPayload.current = newPurchaseDetails;
        setPasswordModalInfo({ title: 'Confirmar Compra', description: 'Digite seu PIN para autorizar a compra no crédito.' });
        setPasswordAction(() => () => executePurchase());
        setIsPasswordModalOpen(true);
    };

    const executePurchase = async () => {
        const details = passwordActionPayload.current as typeof purchaseDetails;
        if (!user || !details) return;

        setIsProcessing(true);
        let result;
        const pin = (passwordActionPayload.current as any)?.pin;

        if (details.method === 'debit') {
            result = await purchaseWithDebit(user.cpf, details.items, details.cashbackUsed, pin);
        } else {
            result = await purchaseWithCard(user.cpf, details.items, details.cashbackUsed, details.installments, pin);
        }

        if (result.success) {
            // 1) Atualiza o usuario priorizando dados completos do cartao
            let latestUser = user;
            const refreshedMe = await getUserMe();
            if (refreshedMe.success && refreshedMe.user) {
                latestUser = refreshedMe.user as User;
            } else {
                const byCpf = await getUserByCpf(user.cpf);
                if (byCpf.success && byCpf.user) {
                    latestUser = byCpf.user as User;
                }
            }

            // 2) Atualiza o extrato da conta SOMENTE para compras no debito
            if (details.method === 'debit') {
                const stmt = await getUserStatement(latestUser.cpf);
                if (stmt.success && stmt.transactions) {
                    latestUser = { ...latestUser, transactions: stmt.transactions as Transaction[] };
                }
            }

            updateUser(latestUser);

            const totalAmount = details.items.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
            const finalAmount = totalAmount - details.cashbackUsed;

            triggerSmartAlertCheck(
                details.items[0].name + (details.items.length > 1 ? ` (+${details.items.length - 1} itens)` : ''),
                -finalAmount,
                'outros'
            );

            const confirmationProduct: PurchasedItem = {
                id: 'purchase-confirm',
                name: cart.length > 1 ? `${cart.length} itens` : details.items[0].name,
                description: `Pagamento de ${finalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                price: finalAmount,
                imageUrl: details.items[0].imageUrl,
            };

            setConfirmationDetails({ 
                product: confirmationProduct, 
                transaction: undefined,
                message: result.message
            });
            setCart([]);
            handleNavigate('purchaseConfirmation');
        } else {
            if (result.message.includes('cartão de crédito está bloqueado')) {
                setIsBlockedModalOpen(true);
            } else {
            showDialog({ title: 'Aviso', message: result.message });
            }
        }
        setIsProcessing(false);
        passwordActionPayload.current = null;
    };


    // --- Other Actions ---
    const handlePayInvoice = (amount: number) => {
        passwordActionPayload.current = { ...(passwordActionPayload.current || {}), amount };
        setPasswordAction(() => () => executePayInvoice());
        const fmtAmt = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        setPasswordModalInfo({ title: 'Pagar Fatura', description: `Confirme o pagamento de ${fmtAmt}.` });
        setIsPasswordModalOpen(true);
    };

    const executePayInvoice = async () => {
        if (!user) return;
        const selectedAmount = (passwordActionPayload.current as any)?.amount;
        const amountToPay = typeof selectedAmount === 'number' ? selectedAmount : user.creditCard.closedInvoice;
        setIsProcessing(true);
        const pin = (passwordActionPayload.current as any)?.pin;

        // Prepara dados do recibo antes do refresh - evita perder o comprovante se o refresh falhar
        const fallbackCardLast4 = user.creditCard?.number?.slice(-4) || '----';
        const totalDueInv = user.creditCard.closedInvoice;
        const isPartialInv = amountToPay < totalDueInv - 0.01;
        setInvoicePaymentDetails({
            amountPaid: amountToPay,
            date: new Date().toISOString(),
            cardLast4: fallbackCardLast4,
            transactionId: `inv-pay-${Date.now()}`,
            isPartial: isPartialInv,
            remainingBalance: isPartialInv ? Math.max(totalDueInv - amountToPay, 0) : 0,
        });

        const result = await payCreditCardInvoice(user.cpf, pin, amountToPay);
        if (result.success) {
            const refreshed = await getUserByCpf(user.cpf);
            if (refreshed.success && refreshed.user) {
                updateUser(refreshed.user);
            }
            handleNavigate('invoicePaymentReceipt');
        } else {
            showDialog({ title: 'Aviso', message: result.message });
        }
        setIsProcessing(false);
        setIsPasswordModalOpen(false);
        passwordActionPayload.current = null;
    };
    
    const handleParcelInvoice = () => {
        handleNavigate('installmentOptions');
    };
    
    const handleSelectInstallmentOption = (details: { amount: number, installments: number }) => {
        setParcelDetails(details);
        passwordActionPayload.current = details; // Also save to ref for the action
        handleNavigate('installmentReviewInvoice');
    };
    
    const handleConfirmParcelInvoice = () => {
        setPasswordAction(() => () => executeParcelInvoice());
        setPasswordModalInfo({ title: 'Parcelar Fatura', description: 'Digite seu PIN para confirmar.' });
        setIsPasswordModalOpen(true);
    };
    
    const executeParcelInvoice = async () => {
        const details = passwordActionPayload.current as { amount: number, installments: number } | null;
        if (!user || !details) return;

        setIsProcessing(true);
        const pin = (passwordActionPayload.current as any)?.pin;
        const result = await parcelCreditCardInvoice(user.cpf, details, pin);
        if (result.success) {
            const refreshed = await getUserByCpf(user.cpf);
            if (refreshed.success && refreshed.user) {
                updateUser(refreshed.user);
            }
            showDialog({ title: 'Aviso', message: result.message });
            handleNavigate('cards');
        } else {
            showDialog({ title: 'Aviso', message: result.message });
        }
        setIsProcessing(false);
        setIsPasswordModalOpen(false);
        passwordActionPayload.current = null;
    };

    const handleAnticipateInstallments = (transactionIds: string[]) => {
        passwordActionPayload.current = transactionIds;
        setPasswordAction(() => () => executeAnticipateInstallments());
        setPasswordModalInfo({ title: 'Antecipar Parcelas', description: 'Digite seu PIN para confirmar.' });
        setIsPasswordModalOpen(true);
    };
    
    const executeAnticipateInstallments = async () => {
        const transactionIds = passwordActionPayload.current as string[] | null;
        if (!user || !transactionIds) return;

        setIsProcessing(true);
        const pin = (passwordActionPayload.current as any)?.pin;
        const result = await anticipateCreditCardInstallments(user.cpf, transactionIds, pin);
        if (result.success) {
            // const refreshed = await getUserByCpf(user.cpf);
            const refreshed = await getUserMe();
            if (refreshed.success && refreshed.user) {
                updateUser(refreshed.user);
            }
            showDialog({ title: 'Aviso', message: result.message });
            handleNavigate('cards');
        } else {
            showDialog({ title: 'Aviso', message: result.message });
        }
        setIsProcessing(false);
        setIsPasswordModalOpen(false);
        passwordActionPayload.current = null;
    };


    const handlePasswordConfirm = (password: string) => {
        // In a real app, you'd verify the password. Here we assume it's correct.
        passwordActionPayload.current = { ...(passwordActionPayload.current || {}), pin: password };
        if (passwordAction) {
            passwordAction();
        }
        setIsPasswordModalOpen(false);
        setPasswordAction(null);
    };
    
    const renderContent = () => {

        switch (currentView) {
            case 'home':
                return (
                    <HomeView
                        user={user!}
                        onNavigate={handleNavigate}
                        theme={theme}
                        setIsFinancialHealthOpen={setFinancialHealthOpen}
                        setIsAiRecurringModalOpen={setAiRecurringModalOpen}
                        setActiveDrawer={setActiveDrawer}
                        openBoletoModal={() => setIsBoletoOpen(true)}
                    />
                );
            case 'cards':
                return (
                    <div className={`fixed inset-0 z-[100] w-full h-full overflow-y-auto no-scrollbar flex justify-center ${theme === 'midnight' ? 'bg-volt-dark' : 'bg-volt-yellow'}`}>
                        <div className="w-full max-w-6xl min-h-full flex flex-col">
                            <CardDashboard onBack={() => handleNavigate('home')} onNavigate={handleNavigate} />
                        </div>
                    </div>
                );
            case 'profile':
                return (
                    <div className={`fixed inset-0 z-[100] w-full h-full overflow-y-auto flex justify-center ${theme === 'midnight' ? 'bg-volt-dark' : 'bg-volt-yellow'}`}>
                        <div className="w-full max-w-md bg-transparent">
                            <Profile onNavigate={handleNavigate} />
                        </div>
                    </div>
                );
            case 'shoppingCart':
                return <ShoppingCart cart={cart} onBack={() => handleNavigate('shop')} onCheckout={handleCheckout} onUpdateQuantity={handleUpdateCartQuantity} />;
            case 'paymentMethods':
                return <PaymentMethods user={user!} item={currentItem} onBack={() => cart.length > 0 ? handleNavigate('shoppingCart') : handleNavigate('shop')} onSelectMethod={handleSelectPaymentMethod} />;
            case 'purchaseConfirmation':
                return <PurchaseConfirmation details={confirmationDetails} onClose={() => handleNavigate('home')} />;
            case 'investments':
                return <Investments onBack={() => handleNavigate('home')} />;
            case 'wallet':
                return <Wallet onBack={() => handleNavigate('home')} />;
            case 'loans':
                return <Loans onBack={() => handleNavigate('home')} />;
            case 'shop':
                if (!user) return null;
                return (
                    <div className={`min-h-full pb-20 w-full max-w-4xl mx-auto ${theme === 'midnight' ? 'bg-[#0f0f0f]' : 'bg-volt-yellow'}`}>
                        <div className={`flex items-center gap-3 p-4 border-b sticky top-0 z-50 ${theme === 'midnight' ? 'border-white/5 bg-[#0f0f0f]' : 'border-black/5 bg-volt-yellow'}`}>
                            <button onClick={handleBack} className={`p-2 -ml-2 rounded-full transition-colors cursor-pointer ${theme === 'midnight' ? 'hover:bg-white/10 text-white' : 'hover:bg-black/10 text-black'}`}>
                                <span className={`text-xl ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>←</span>
                            </button>
                            <h1 className={`text-lg font-bold ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>Shopping Volt</h1>
                        </div>
                        <ShopView 
                            accountBalance={user.balance} 
                            onPurchaseComplete={handleTransactionCompleteLimit} 
                            theme={theme} 
                        />
                    </div>
                );
            case 'points':
                return <PointsDashboard user={user!} onBack={() => handleNavigate('cards')} />;
            case 'anticipateInstallments':
                 return <AnticipateInstallments onBack={() => handleNavigate('cards')} onConfirmAnticipation={handleAnticipateInstallments} isProcessing={isProcessing} />;
            case 'installmentReviewInvoice':
                if (!user || !parcelDetails) return <ClosedInvoice user={user!} onBack={() => handleNavigate('cards')} onPayInvoice={handlePayInvoice} onParcel={handleParcelInvoice} />;
                return <InstallmentReview type="invoice" user={user} details={parcelDetails} onConfirm={handleConfirmParcelInvoice} onBack={() => handleNavigate('installmentOptions')} />;
            case 'invoicePaymentReceipt':
                if (!invoicePaymentDetails) return <CardDashboard onBack={() => handleNavigate('home')} onNavigate={handleNavigate} />;
                return <PaymentReceipt details={invoicePaymentDetails} onClose={() => handleNavigate('home')} />;
             case 'products':
                return <Products onNavigate={handleNavigate} />;
            case 'closedInvoice':
                if (!user) return null;
                return <ClosedInvoice user={user} onBack={() => handleNavigate('cards')} onPayInvoice={handlePayInvoice} onParcel={handleParcelInvoice} />;
            case 'installmentOptions':
                if (!user) return null;
                return <InstallmentOptions user={user} onBack={() => handleNavigate('closedInvoice')} onSelectOption={handleSelectInstallmentOption} />;
            case 'currentInvoice':
                if (!user) return null;
                return (
                    <div className={`min-h-full pb-20 ${theme === 'midnight' ? 'bg-[#0f0f0f]' : 'bg-volt-yellow'}`}>
                        <div className={`flex items-center gap-3 p-4 border-b ${theme === 'midnight' ? 'border-white/5' : 'border-black/5'}`}>
                            <button onClick={handleBack} className={`p-2 -ml-2 rounded-full transition-colors cursor-pointer ${theme === 'midnight' ? 'hover:bg-white/10 text-white' : 'hover:bg-black/10 text-black'}`}>
                                <span className={`text-xl ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>←</span>
                            </button>
                            <h1 className={`text-lg font-bold ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>Fatura</h1>
                        </div>
                        <InvoiceView invoiceAmount={user.creditCard.closedInvoice > 0 ? user.creditCard.closedInvoice : user.creditCard.currentInvoice} />
                    </div>
                );
            case 'limit':
                return (
                    <div className={`min-h-full pb-20 ${theme === 'midnight' ? 'bg-[#0f0f0f]' : 'bg-volt-yellow'}`}>
                        <div className={`flex items-center gap-3 p-4 border-b ${theme === 'midnight' ? 'border-white/5' : 'border-black/5'}`}>
                            <button onClick={handleBack} className={`p-2 -ml-2 rounded-full transition-colors cursor-pointer ${theme === 'midnight' ? 'hover:bg-white/10 text-white' : 'hover:bg-black/10 text-black'}`}>
                                <span className={`text-xl ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>←</span>
                            </button>
                            <div>
                                <h1 className={`text-lg font-bold ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>Limites e Contas</h1>
                                <p className={`text-xs uppercase tracking-widest ${theme === 'midnight' ? 'text-white/50' : 'text-black/50'}`}>Gestão de Limite</p>
                            </div>
                        </div>
                        <div className="overflow-y-auto overflow-x-hidden">
                            <LimitView
                                accountBalance={user!.balance}
                                userProfile={user! as any}
                                onTransactionComplete={handleTransactionCompleteLimit}
                                theme={theme}
                            />
                        </div>
                    </div>
                );
            case 'admin':
                return (
                    <div className={`min-h-full pb-20 ${theme === 'midnight' ? 'bg-[#0f0f0f]' : 'bg-volt-yellow'}`}>
                        <Admin 
                            onClose={() => {
                                if (topLevelView === 'admin') navigateTo('dashboard');
                                handleNavigate('home');
                            }} 
                        />
                    </div>
                );
        }
    };

    if (!user) {
        return <div>Error: No user found.</div>;
    }

    return (
        <div
            id="dashboard"
            data-testid="dashboard"
            data-cy="dashboard"
            data-playwright="dashboard"
            data-current-view={currentView}
            className="h-[100dvh] w-full flex flex-col bg-volt-dark overflow-hidden"
        >
            <SmartAlerts />
            {topLevelView !== 'admin' && !isHeaderHidden && (
                <Header 
                    activeTab={currentView as any}
                    setActiveTab={(tab: any) => handleNavigate(tab)}
                    userProfile={user as any}
                    invoiceSubView={invoiceSubView}
                    setInvoiceSubView={setInvoiceSubView}
                    statementSubView={statementSubView}
                    setStatementSubView={setStatementSubView}
                    notifications={notifications || []}
                    onClearNotification={clearNotification}
                    onClearAllNotifications={clearAllNotifications}
                    theme={theme}
                    onThemeToggle={handleThemeToggle}
                    transactions={user?.transactions || []}
                    isCentralHubOpen={isCentralHubOpen}
                    setIsCentralHubOpen={setCentralHubOpen}
                    isAiModalOpen={isAiModalOpen}
                    setIsAiModalOpen={setAiModalOpen}
                    isFinancialHealthOpen={isFinancialHealthOpen}
                    setIsFinancialHealthOpen={setFinancialHealthOpen}
                    isAiRecurringModalOpen={isAiRecurringModalOpen}
                    setIsAiRecurringModalOpen={setAiRecurringModalOpen}
                    activeDrawer={activeDrawer}
                    setActiveDrawer={setActiveDrawer}
                    onHide={() => setIsHeaderHidden(true)}
                />
            )}
            
            {topLevelView !== 'admin' && isHeaderHidden && (
                <button
                    onClick={() => setIsHeaderHidden(false)}
                    className="fixed top-4 left-4 z-50 px-3 py-2 rounded-full text-black bg-[#A2FF00] hover:bg-[#8ee500] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:scale-90 cursor-pointer flex items-center gap-1.5 font-black text-[11px] uppercase tracking-wider group animate-pulse"
                    title="Mostrar Menu Superior"
                >
                    <LayoutGrid size={14} className="text-black group-hover:rotate-45 transition-transform duration-300" />
                    <span>Menu</span>
                </button>
            )}
            <div
                id="dashboard-content"
                data-testid="dashboard-content"
                data-cy="dashboard-content"
                className={`flex-grow overflow-y-auto no-scrollbar ${isHeaderHidden ? 'pt-4' : 'pt-20'}`}
            >
                {renderContent()}
            </div>
            {topLevelView !== 'admin' && ['home', 'products', 'profile', 'cards', 'limit'].includes(currentView) && !isStatementModalOpen && (
                 <BottomNavBar currentView={currentView} onNavigate={(view) => handleNavigate(view)} theme={theme} />
            )}
            
            <BlockedCardModal isOpen={isBlockedModalOpen} onGoToPayment={handleGoToPaymentFromModal} onClose={handleCloseBlockedModal} />
            
            <PasswordModal
                isOpen={isPasswordModalOpen}
                onClose={() => {
                    setIsPasswordModalOpen(false);
                    setPasswordAction(null);
                }}
                onConfirm={handlePasswordConfirm}
                title={passwordModalInfo.title}
                description={passwordModalInfo.description}
                isLoading={isProcessing}
            />
            {isPixModalOpen && (
                <PixModal 
                    isOpen={isPixModalOpen} 
                    onClose={() => setIsPixModalOpen(false)} 
                />
            )}
            <DepositModal
                isOpen={isDepositModalOpen}
                onClose={() => setIsDepositModalOpen(false)}
                onDepositComplete={handleDepositComplete}
            />
            <BoletoModal
                isOpen={isBoletoOpen}
                onClose={() => setIsBoletoOpen(false)}
                accountBalance={user?.balance ?? 0}
                onTransactionComplete={handleBoletoComplete}
            />
            {currentItem && (
                <InstallmentModal
                    isOpen={isInstallmentModalOpen}
                    onClose={() => setIsInstallmentModalOpen(false)}
                    item={currentItem}
                    user={user}
                    onConfirm={(details) => {
                        setIsInstallmentModalOpen(false);
                        handleConfirmPurchaseWithInstallments(details);
                    }}
                />
            )}

            {isFinancialHealthOpen && (
                <FinancialHealthModal 
                    isOpen={isFinancialHealthOpen} 
                    onClose={() => setFinancialHealthOpen(false)} 
                    transactions={user.transactions} 
                />
            )}
            {isAiModalOpen && (
                <AiAssistantModal 
                    isOpen={isAiModalOpen} 
                    onClose={() => setAiModalOpen(false)} 
                    transactions={user?.transactions || []}
                    theme={theme}
                />
            )}



            {/* ── Statement Modal ───────────────────────── */}
            <AnimatePresence>
                {isStatementModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 pt-16">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => setIsStatementModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full h-fit max-h-[85vh] bg-volt-surface border-2 border-volt-primary shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-3xl flex flex-col overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white/80">receipt_long</span>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-white uppercase tracking-wider">Extrato</h2>
                                        <p className="text-xs text-white/50 uppercase tracking-widest">Histórico de Movimentações</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsStatementModalOpen(false)}
                                    className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                                >
                                    <span className="material-symbols-outlined text-xl">close</span>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto no-scrollbar relative bg-[#131313]">
                                <StatementPaginated
                                    user={user!}
                                    onNavigate={(view) => {
                                        setIsStatementModalOpen(false);
                                        if (view !== 'home' && view !== 'statement') handleNavigate(view as View);
                                    }}
                                    onBack={() => setIsStatementModalOpen(false)}
                                />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Limit Modal ───────────────────────────── */}
            <AnimatePresence>
                {isLimitModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 pt-16">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => setIsLimitModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full h-fit max-h-[85vh] bg-volt-surface border-2 border-volt-primary shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-3xl flex flex-col overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white/80">account_balance</span>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-white uppercase tracking-wider">Limites e Contas</h2>
                                        <p className="text-xs text-white/50 uppercase tracking-widest">Gestão de Limite</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsLimitModalOpen(false)}
                                    className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                                >
                                    <span className="material-symbols-outlined text-xl">close</span>
                                </button>
                            </div>
                            {/* Modal Content Scroll Area */}
                            <div className="shrink min-h-0 overflow-y-auto no-scrollbar relative bg-[#131313]">
                                <LimitView 
                                    accountBalance={user!.balance}
                                    userProfile={user!}
                                    onTransactionComplete={handleTransactionCompleteLimit}
                                    theme={theme} 
                                />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

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
                        <div className="bg-volt-surface border-2 border-volt-primary text-white p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex gap-3 items-start backdrop-blur-md">
                            <div className="bg-volt-primary/10 text-volt-primary p-2 rounded-xl shrink-0 border border-volt-primary/15 flex items-center justify-center">
                                <span className="text-sm font-bold">🔔</span>
                            </div>
                            <div className="flex-1 space-y-0.5">
                                <h5 className="text-[10px] font-black uppercase tracking-wider text-volt-primary">{toast.title}</h5>
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

            <FinancialHealthModal
                isOpen={isFinancialHealthOpen}
                onClose={() => setFinancialHealthOpen(false)}
                transactions={user.transactions || []}
                theme={theme}
            />

            <AiRecurringBillModal
                isOpen={isAiRecurringModalOpen}
                onClose={() => setAiRecurringModalOpen(false)}
                transactions={user.transactions || []}
                recurringBills={JSON.parse(localStorage.getItem('volt_recurring_bills') || '[]')}
                onAddRecurringBill={(title, amount, category, dueDate) => {
                    const bills = JSON.parse(localStorage.getItem('volt_recurring_bills') || '[]');
                    bills.push({ id: `rec_${Date.now()}`, title, amount: -Math.abs(amount), category, dueDate, status: 'pending' });
                    localStorage.setItem('volt_recurring_bills', JSON.stringify(bills));
                }}
                theme={theme}
            />

        </div>
    );
};

export default Dashboard;