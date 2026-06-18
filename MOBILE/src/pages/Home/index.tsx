import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import HomeView from '../../components/HomeView';
import BottomNavBar from '../../components/BottomNavBar';
import { useAuth } from '../../context/AuthContext';
import PasswordModal from '../../components/PasswordModal';
import BlockedCardModal from '../../components/BlockedCardModal';
import { PurchasedItem, View, User, Transaction } from '../../types';
import { purchaseWithDebit, purchaseWithCard, getUserMe, getUserByCpf, getUserStatement, payCreditCardInvoice, parcelCreditCardInvoice } from '../../services/api';

// OTIMIZADO: Lazy loading de componentes pesados para melhorar performance inicial
const Pix = lazy(() => import('../../components/Pix'));
const CardDashboard = lazy(() => import('../../components/CardDashboard'));
const Products = lazy(() => import('../../components/Products'));
const Profile = lazy(() => import('../../components/Profile'));
const Admin = lazy(() => import('../../components/Admin'));
const ShoppingCart = lazy(() => import('../../components/ShoppingCart'));
const Statement = lazy(() => import('../../components/Statement'));
const StatementPaginated = lazy(() => import('../../components/StatementPaginated'));
const Shop = lazy(() => import('../../components/Shop'));
const CurrentInvoiceView = lazy(() => import('../../components/CurrentInvoiceView'));
const ClosedInvoiceView = lazy(() => import('../../components/ClosedInvoiceView'));
const PaymentMethods = lazy(() => import('../../components/PaymentMethods'));
const InstallmentModal = lazy(() => import('../../components/InstallmentModal'));
const PurchaseConfirmation = lazy(() => import('../../components/PurchaseConfirmation'));
const InstallmentOptions = lazy(() => import('../../components/InstallmentOptions'));
const InstallmentReviewInvoice = lazy(() => import('../../components/InstallmentReviewInvoice'));
const InvoicePaymentReceipt = lazy(() => import('../../components/InvoicePaymentReceipt'));
const TransactionReceipt = lazy(() => import('../../components/TransactionReceipt'));

// Componente de loading simples
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full min-h-[200px]">
    <div className="text-white/70">Carregando...</div>
  </div>
);

interface HomeProps {
  user: User;
  onLogout: () => void;
  refreshUserData: () => Promise<void>;
    onNavigateApp: (newView: 'admin' | 'login' | 'home' | 'cards' | 'shop' | 'profile' | 'prelogin' | 'signup' | 'resetPassword') => void;
}

const Home: React.FC<HomeProps> = ({ user, onLogout, refreshUserData, onNavigateApp }) => {
  const [currentView, setCurrentView] = useState<View>('home');
  const { logout, updateUser } = useAuth(); 
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState<PurchasedItem[]>([]);
  const [currentItem, setCurrentItem] = useState<PurchasedItem | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordAction, setPasswordAction] = useState<(() => void) | null>(null);
  const passwordActionPayload = useRef<any>(null);
  const [passwordModalInfo, setPasswordModalInfo] = useState({ title: '', description: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState<{ items: PurchasedItem[], cashbackUsed: number, method: 'debit' | 'credit', installments: number } | null>(null);
  const [confirmationDetails, setConfirmationDetails] = useState<any>(null);
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
  const [parcelDetails, setParcelDetails] = useState<{ amount: number, installments: number } | null>(null);
    const [invoicePaymentDetails, setInvoicePaymentDetails] = useState<{ amountPaid: number; date: string; cardLast4: string; transactionId: string; title?: string; amountLabel?: string } | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Refresh de dados do usuário ao montar (garante dados frescos após login via token)
  useEffect(() => {
    refreshUserData().finally(() => setIsLoading(false));
  }, []);

  // Log para debug da navegação
  useEffect(() => {
    console.log('🔵 [Home] currentView mudou para:', currentView);
    console.log('🔵 [Home] User role:', user?.role);
  }, [currentView, user?.role]);

  const handleNavigate = (view: View) => {
    console.log('🔵 [Home] handleNavigate chamado com view:', view);
    console.log('🔵 [Home] User role:', user?.role);
    setCurrentView(view);
    console.log('🔵 [Home] currentView atualizado para:', view);
  };

  const handleAddToCart = (item: PurchasedItem) => {
    setCart(prev => {
        const existing = prev.find(i => i.id === item.id);
        return existing ? prev.map(i => i.id === item.id ? { ...i, quantity: (i.quantity || 1) + 1 } : i) : [...prev, { ...item, quantity: 1 }];
    });
  };

  const handleInitiatePurchase = (item: PurchasedItem) => {
    if (!cart.some(i => i.id === item.id)) {
        setCart(prev => [...prev, { ...item, quantity: 1}]);
    }
    setCurrentView('shoppingCart');
  };

  const handleUpdateCartQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
        setCart(prev => prev.filter(item => item.id !== itemId));
    } else {
        setCart(prev => prev.map(item => item.id === itemId ? { ...item, quantity } : item));
    }
  };

  const handleCheckout = () => {
    const total = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
    const checkoutItem: PurchasedItem = {
        id: 'cart-checkout',
        name: `${cart.length} itens no carrinho`,
        price: total,
        description: cart.map(i => i.name).join(', '),
        imageUrl: cart[0]?.imageUrl || ''
    };
    setCurrentItem(checkoutItem);
    setCurrentView('paymentMethods');
  };

  const handleSelectPaymentMethod = (method: 'debit' | 'credit') => {
    const itemsToPurchase = cart.length > 0 ? cart : (currentItem ? [currentItem] : []);
    if (itemsToPurchase.length === 0) return;
    
    if (method === 'credit' && user?.creditCard.isBlocked) {
        setIsBlockedModalOpen(true);
        return;
    }
    const newPurchaseDetails = { items: itemsToPurchase, cashbackUsed: 0, method, installments: 1 };
    passwordActionPayload.current = newPurchaseDetails;
    
    if (method === 'debit') {
        setPasswordModalInfo({ title: 'Confirmar Compra', description: 'Digite seu PIN para autorizar a compra no débito.' });
        setPasswordAction(() => () => executePurchase());
        setIsPasswordModalOpen(true);
    } else {
        // Para crédito, precisamos do item para o modal de parcelamento
        const totalPrice = itemsToPurchase.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
        const installmentItem: PurchasedItem = {
            id: 'cart-checkout',
            name: cart.length > 1 ? `${cart.length} itens` : itemsToPurchase[0].name,
            price: totalPrice,
            description: itemsToPurchase.map(i => i.name).join(', '),
            imageUrl: itemsToPurchase[0]?.imageUrl || ''
        };
        setCurrentItem(installmentItem);
        setIsInstallmentModalOpen(true);
    }
  };

  const handleConfirmPurchaseWithInstallments = (details: { cashbackUsed: number, installments: number }) => {
    const itemsToPurchase = cart.length > 0 ? cart : (currentItem ? [currentItem] : []);
    const newPurchaseDetails = { items: itemsToPurchase, cashbackUsed: details.cashbackUsed, method: 'credit' as const, installments: details.installments };
    passwordActionPayload.current = newPurchaseDetails;
    setPasswordModalInfo({ title: 'Confirmar Compra', description: 'Digite seu PIN para autorizar a compra no crédito.' });
    setPasswordAction(() => () => executePurchase());
    setIsInstallmentModalOpen(false);
    setIsPasswordModalOpen(true);
  };

  const executePurchase = async () => {
    const details = passwordActionPayload.current as typeof purchaseDetails;
    if (!user || !details) return;

    setIsProcessing(true);
    let result;
    const pin = (passwordActionPayload.current as any)?.pin;

    try {
        if (details.method === 'debit') {
            result = await purchaseWithDebit(user.cpf, details.items, details.cashbackUsed, pin);
        } else {
            result = await purchaseWithCard(user.cpf, details.items, details.cashbackUsed, details.installments, pin);
        }

        if (result.success) {
            // Atualiza o usuario
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

            // Buscar comprovante da compra (debito ou credito)
            if (details.method === 'debit') {
                const stmt = await getUserStatement(latestUser.cpf);
                if (stmt.success && stmt.transactions) {
                    latestUser = { ...latestUser, transactions: stmt.transactions as Transaction[] };
                    
                    // Buscar a transação mais recente (a compra que acabou de ser feita)
                    // Filtrar apenas transações SHOP_DEBIT e pegar a mais recente
                    const shopTransactions = stmt.transactions.filter(tx => tx.type === 'SHOP_DEBIT');
                    if (shopTransactions.length > 0) {
                        // A mais recente é a primeira (ordenada por DESC)
                        const purchaseTransaction = shopTransactions[0];
                        // Criar nome do merchant baseado nos itens comprados
                        const merchantName = cart.length > 1 ? `${cart.length} itens` : details.items[0].name;
                        // Adicionar informações da compra para o comprovante
                        const transactionWithDetails: Transaction = {
                            ...purchaseTransaction,
                            merchant: merchantName,
                            category: 'shopping',
                            description: purchaseTransaction.description || `Compra shop - ${merchantName}`
                        };
                        setSelectedTransaction(transactionWithDetails);
                        setCart([]);
                        updateUser(latestUser);
                        await refreshUserData();
                        setIsProcessing(false);
                        setIsPasswordModalOpen(false);
                        passwordActionPayload.current = null;
                        setCurrentView('transactionReceipt');
                        return; // Sair aqui para mostrar o comprovante
                    }
                }
            } else if (details.method === 'credit') {
                // Para compras no credito, buscar a transacao SHOP_CREDIT ou INVOICE_INSTALLMENT mais recente
                // Atualizar dados do usuario para pegar as transacoes do cartao
                await refreshUserData();
                const refreshedMe = await getUserMe();
                if (refreshedMe.success && refreshedMe.user) {
                    latestUser = refreshedMe.user as User;
                }
                
                const creditCard = latestUser.creditCard;
                if (creditCard && creditCard.transactions && creditCard.transactions.length > 0) {
                    // Buscar transacao SHOP_CREDIT mais recente (compra a vista) ou INVOICE_INSTALLMENT (compra parcelada)
                    const shopCreditTx = creditCard.transactions.find(tx => 
                        tx.type === 'CREDIT' && tx.merchant && tx.merchant !== 'Pagamento fatura' && tx.merchant !== 'Antecipacao de parcelas'
                    );
                    
                    if (shopCreditTx) {
                        // Criar nome do merchant baseado nos itens comprados
                        const merchantName = cart.length > 1 ? `${cart.length} itens` : (details.items[0].name || 'Compra shop');
                        // Adicionar informações da compra para o comprovante
                        const transactionWithDetails: Transaction = {
                            ...shopCreditTx,
                            type: shopCreditTx.type as any,
                            merchant: shopCreditTx.merchant || merchantName,
                            category: 'shopping',
                            description: shopCreditTx.merchant || `Compra shop - ${merchantName}`,
                            installments: details.installments > 1 ? `${details.installments}x` : undefined,
                            totalInstallments: details.installments > 1 ? details.installments : undefined,
                            currentInstallment: details.installments > 1 ? 1 : undefined
                        };
                        setSelectedTransaction(transactionWithDetails);
                        setCart([]);
                        updateUser(latestUser);
                        await refreshUserData();
                        setIsProcessing(false);
                        setIsPasswordModalOpen(false);
                        passwordActionPayload.current = null;
                        setCurrentView('transactionReceipt');
                        return; // Sair aqui para mostrar o comprovante
                    }
                }
            }

            updateUser(latestUser);
            await refreshUserData();
            setCart([]);
            setIsProcessing(false);
            setIsPasswordModalOpen(false);
            passwordActionPayload.current = null;
            setCurrentView('home');
        } else {
            setIsProcessing(false);
            setIsPasswordModalOpen(false);
            if (result.message && result.message.includes('cartão de crédito está bloqueado')) {
                setIsBlockedModalOpen(true);
            } else {
                alert(result.message || 'Erro ao processar compra.');
            }
            passwordActionPayload.current = null;
        }
    } catch (error: any) {
        setIsProcessing(false);
        setIsPasswordModalOpen(false);
        passwordActionPayload.current = null;
        console.error('❌ [executePurchase] Erro:', error);
        alert(error?.message || 'Erro ao processar compra.');
    }
  };

  const handlePasswordConfirm = (password: string) => {
    // Garantir que passwordActionPayload.current existe e incluir o PIN
    passwordActionPayload.current = { ...(passwordActionPayload.current || {}), pin: password };
    if (passwordAction) {
        passwordAction();
    }
  };

  // ========== FLUXO DE PAGAMENTO DE FATURA ==========
  const handlePayInvoice = () => {
    passwordActionPayload.current = {}; // Inicializar objeto para receber o PIN
    setPasswordAction(() => () => executePayInvoice());
    setPasswordModalInfo({ title: 'Pagar Fatura', description: 'Digite seu PIN para confirmar o pagamento.' });
    setIsPasswordModalOpen(true);
  };

  const executePayInvoice = async () => {
    if (!user) return;
    const amountToPay = user.creditCard.closedInvoice;
    setIsProcessing(true);
    const pin = (passwordActionPayload.current as any)?.pin;

    // Validar PIN antes de prosseguir
    if (!pin || pin.length !== 4) {
        alert('PIN inválido. Por favor, digite um PIN de 4 dígitos.');
        setIsProcessing(false);
        setIsPasswordModalOpen(false);
        passwordActionPayload.current = null;
        return;
    }

    // Prepara dados do recibo antes do refresh - evita perder o comprovante se o refresh falhar
    const fallbackCardLast4 = user.creditCard?.number?.slice(-4) || '----';
    setInvoicePaymentDetails({
        amountPaid: amountToPay,
        date: new Date().toISOString(),
        cardLast4: fallbackCardLast4,
        transactionId: `inv-pay-${Date.now()}`
    });

    try {
        const result = await payCreditCardInvoice(user.cpf, pin);
        if (result.success) {
            const refreshed = await getUserByCpf(user.cpf);
            if (refreshed.success && refreshed.user) {
                updateUser(refreshed.user);
                await refreshUserData();
            }
            setCurrentView('invoicePaymentReceipt');
        } else {
            alert(result.message);
        }
    } catch (error: any) {
        alert(error?.message || 'Erro ao processar pagamento.');
    } finally {
        setIsProcessing(false);
        setIsPasswordModalOpen(false);
        passwordActionPayload.current = null;
    }
  };

  const handleParcelInvoice = () => {
    setCurrentView('installmentOptions');
  };

  const handleSelectInstallmentOption = (details: { amount: number, installments: number }) => {
    setParcelDetails(details);
    passwordActionPayload.current = details;
    setCurrentView('installmentReviewInvoice');
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

    try {
        const result = await parcelCreditCardInvoice(user.cpf, details, pin);
        if (result.success) {
            const refreshed = await getUserByCpf(user.cpf);
            if (refreshed.success && refreshed.user) {
                updateUser(refreshed.user);
                await refreshUserData();
            }

            const fallbackCardLast4 = user.creditCard?.number?.slice(-4) || '----';
            setInvoicePaymentDetails({
                amountPaid: details.amount,
                date: new Date().toISOString(),
                cardLast4: fallbackCardLast4,
                transactionId: `inv-parcel-${Date.now()}`,
                title: 'Parcelamento Realizado!',
                amountLabel: 'Valor Parcelado'
            });

            setCurrentView('invoicePaymentReceipt');
        } else {
            alert(result.message);
        }
    } catch (error: any) {
        alert(error?.message || 'Erro ao processar parcelamento.');
    } finally {
        setIsProcessing(false);
        setIsPasswordModalOpen(false);
        passwordActionPayload.current = null;
    }
  };

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const renderContent = () => {
    if (!user) {
      return <div className="flex items-center justify-center h-full"><p className="text-white">Authentication error.</p></div>;
    }
    
    // OTIMIZADO: Componentes pesados são carregados sob demanda com Suspense
    switch (currentView) {
        case 'home': 
            return <HomeView user={user} onNavigate={handleNavigate} />;
        case 'pix': 
            return <Suspense fallback={<LoadingFallback />}><Pix onBack={() => handleNavigate('home')} /></Suspense>;
        case 'cards': 
            return <Suspense fallback={<LoadingFallback />}><CardDashboard onBack={() => handleNavigate('home')} onNavigate={handleNavigate} /></Suspense>;
        case 'shop': 
            return <Suspense fallback={<LoadingFallback />}><Shop onBack={() => handleNavigate('home')} onAddToCart={handleAddToCart} onInitiatePurchase={handleInitiatePurchase} cartItemCount={cart.reduce((s, i) => s + (i.quantity || 0), 0)} onNavigate={handleNavigate} /></Suspense>;
        case 'shoppingCart': 
            return <Suspense fallback={<LoadingFallback />}><ShoppingCart onBack={() => handleNavigate('shop')} cart={cart} onCheckout={handleCheckout} onUpdateQuantity={handleUpdateCartQuantity} /></Suspense>;
        case 'paymentMethods': {
            // Se temos carrinho, criar item agregado com total
            const paymentItem = cart.length > 0 ? {
                id: 'cart-checkout',
                name: `${cart.length} itens no carrinho`,
                price: cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0),
                description: cart.map(i => i.name).join(', '),
                imageUrl: cart[0]?.imageUrl || ''
            } : currentItem;
            return <Suspense fallback={<LoadingFallback />}><PaymentMethods user={user} item={paymentItem} onBack={() => handleNavigate('shoppingCart')} onSelectMethod={handleSelectPaymentMethod} /></Suspense>;
        }
        case 'purchaseConfirmation': 
            return confirmationDetails ? <Suspense fallback={<LoadingFallback />}><PurchaseConfirmation details={confirmationDetails} onClose={() => handleNavigate('home')} /></Suspense> : <HomeView user={user} onNavigate={handleNavigate} />;
        case 'transactionReceipt': 
            return selectedTransaction ? <Suspense fallback={<LoadingFallback />}><TransactionReceipt transaction={selectedTransaction} onBack={() => { setSelectedTransaction(null); handleNavigate('home'); }} /></Suspense> : <HomeView user={user} onNavigate={handleNavigate} />;
        case 'statement': 
            return <Suspense fallback={<LoadingFallback />}><StatementPaginated onNavigate={handleNavigate} onBack={() => handleNavigate('home')} /></Suspense>;
        case 'currentInvoice': 
            return <Suspense fallback={<LoadingFallback />}><CurrentInvoiceView user={user} onBack={() => handleNavigate('cards')} /></Suspense>;
        case 'closedInvoice': 
            return <Suspense fallback={<LoadingFallback />}><ClosedInvoiceView user={user} onBack={() => handleNavigate('cards')} onPayInvoice={handlePayInvoice} onParcel={handleParcelInvoice} /></Suspense>;
        case 'installmentOptions': 
            return <Suspense fallback={<LoadingFallback />}><InstallmentOptions user={user} onBack={() => handleNavigate('closedInvoice')} onSelectOption={handleSelectInstallmentOption} /></Suspense>;
        case 'installmentReviewInvoice': 
            return parcelDetails ? <Suspense fallback={<LoadingFallback />}><InstallmentReviewInvoice user={user} details={parcelDetails} onConfirm={handleConfirmParcelInvoice} onBack={() => handleNavigate('installmentOptions')} /></Suspense> : <Suspense fallback={<LoadingFallback />}><ClosedInvoiceView user={user} onBack={() => handleNavigate('cards')} onPayInvoice={handlePayInvoice} onParcel={handleParcelInvoice} /></Suspense>;
        case 'invoicePaymentReceipt': 
            return invoicePaymentDetails ? <Suspense fallback={<LoadingFallback />}><InvoicePaymentReceipt details={invoicePaymentDetails} onClose={() => handleNavigate('home')} /></Suspense> : <Suspense fallback={<LoadingFallback />}><CardDashboard onBack={() => handleNavigate('home')} onNavigate={handleNavigate} /></Suspense>;
        case 'products': 
            return <Suspense fallback={<LoadingFallback />}><Products onNavigate={handleNavigate} /></Suspense>;
        case 'profile': 
            return <Suspense fallback={<LoadingFallback />}><Profile onNavigate={handleNavigate} /></Suspense>;
        case 'admin': {
            console.log('🔵 [Home] Renderizando view admin');
            console.log('🔵 [Home] User role:', user?.role);
            if (user?.role === 'admin') {
                console.log('✅ [Home] Renderizando componente Admin');
                return <Suspense fallback={<LoadingFallback />}><Admin onBack={() => handleNavigate('profile')} /></Suspense>;
            } else {
                console.log('❌ [Home] Usuário não é admin, redirecionando para profile');
                return <Suspense fallback={<LoadingFallback />}><Profile onNavigate={handleNavigate} /></Suspense>;
            }
        }
        default: 
            return <HomeView user={user} onNavigate={handleNavigate} />;
    }
  };

  const showBottomNav = ['home', 'cards', 'shop', 'products', 'profile'].includes(currentView);

  return (
    <div className="h-full w-full flex flex-col bg-background-dark" style={{ position: 'relative', overflow: 'visible' }} id="app-home" data-testid="app-home" aria-label="App principal">
        <div className={`flex-grow overflow-y-auto no-scrollbar ${showBottomNav ? 'pb-16' : ''}`} style={{ position: 'relative', zIndex: 1 }}>
            {renderContent()}
        </div>
        {showBottomNav && (
            <BottomNavBar currentView={currentView} onNavigate={handleNavigate} />
        )}
        {isInstallmentModalOpen && currentItem && (
            <Suspense fallback={null}>
                <InstallmentModal
                    isOpen={isInstallmentModalOpen}
                    onClose={() => setIsInstallmentModalOpen(false)}
                    item={currentItem}
                    user={user}
                    onConfirm={handleConfirmPurchaseWithInstallments}
                />
            </Suspense>
        )}
        <PasswordModal
            isOpen={isPasswordModalOpen}
            onClose={() => setIsPasswordModalOpen(false)}
            onConfirm={handlePasswordConfirm}
            title={passwordModalInfo.title}
            description={passwordModalInfo.description}
            isLoading={isProcessing}
        />
        <BlockedCardModal
            isOpen={isBlockedModalOpen}
            onGoToPayment={() => {
                setIsBlockedModalOpen(false);
                handleNavigate('cards');
            }}
            onClose={() => setIsBlockedModalOpen(false)}
        />
    </div>
  );
};

export default Home;
