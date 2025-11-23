import React, { useState, useEffect, useRef } from 'react';
import HomeView from '../../components/HomeView';
import BottomNavBar from '../../components/BottomNavBar';
import { useAuth } from '../../context/AuthContext';
import Pix from '../../components/Pix';
import CardDashboard from '../../components/CardDashboard';
import Products from '../../components/Products';
import Profile from '../../components/Profile';
import Admin from '../../components/Admin';
import ShoppingCart from '../../components/ShoppingCart';
import Statement from '../../components/Statement';
import Shop from '../../components/Shop';
import CurrentInvoiceView from '../../components/CurrentInvoiceView';
import ClosedInvoiceView from '../../components/ClosedInvoiceView';
import PaymentMethods from '../../components/PaymentMethods';
import InstallmentModal from '../../components/InstallmentModal';
import PasswordModal from '../../components/PasswordModal';
import PurchaseConfirmation from '../../components/PurchaseConfirmation';
import BlockedCardModal from '../../components/BlockedCardModal';
import InstallmentOptions from '../../components/InstallmentOptions';
import InstallmentReviewInvoice from '../../components/InstallmentReviewInvoice';
import InvoicePaymentReceipt from '../../components/InvoicePaymentReceipt';
import { Article } from '../../components/NewsSection';
import { PurchasedItem, View, User, Transaction } from '../../types';
import { purchaseWithDebit, purchaseWithCard, getUserMe, getUserByCpf, getUserStatement, payCreditCardInvoice, parcelCreditCardInvoice } from '../../services/api';

interface HomeProps {
  user: User;
  onLogout: () => void;
  refreshUserData: () => Promise<void>;
}

const Home: React.FC<HomeProps> = ({ user, onLogout, refreshUserData }) => {
  const [currentView, setCurrentView] = useState<View>('home');
  const { logout, updateUser } = useAuth(); 
  const [news, setNews] = useState<Article[]>([]);
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
  const [invoicePaymentDetails, setInvoicePaymentDetails] = useState<{ amountPaid: number; date: string; cardLast4: string; transactionId: string } | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
        try {
            const response = await fetch('/api/news');
            if (!response.ok) {
                throw new Error('Failed to fetch news from proxy');
            }
            const data = await response.json();
            setNews(data);
        } catch (error) {
            console.error("Error fetching news:", error);
            setNews([]);
        } finally {
            setIsLoading(false);
        }
    };
    fetchNews();
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
            result = await purchaseWithDebit(user.cpf, details.items, details.cashbackUsed);
        } else {
            result = await purchaseWithCard(user.cpf, details.items, details.cashbackUsed, details.installments);
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

            // Atualiza o extrato da conta SOMENTE para compras no debito
            if (details.method === 'debit') {
                const stmt = await getUserStatement(latestUser.cpf);
                if (stmt.success && stmt.transactions) {
                    latestUser = { ...latestUser, transactions: stmt.transactions as Transaction[] };
                }
            }

            updateUser(latestUser);
            await refreshUserData();

            const totalAmount = details.items.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
            const finalAmount = totalAmount - details.cashbackUsed;

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
            setCurrentView('purchaseConfirmation');
        } else {
            if (result.message.includes('cartão de crédito está bloqueado')) {
                setIsBlockedModalOpen(true);
            } else {
                alert(result.message);
            }
        }
    } catch (error: any) {
        alert(error?.message || 'Erro ao processar compra.');
    } finally {
        setIsProcessing(false);
        setIsPasswordModalOpen(false);
        passwordActionPayload.current = null;
    }
  };

  const handlePasswordConfirm = (password: string) => {
    if (passwordActionPayload.current) {
        (passwordActionPayload.current as any).pin = password;
    }
    if (passwordAction) {
        passwordAction();
    }
  };

  // ========== FLUXO DE PAGAMENTO DE FATURA ==========
  const handlePayInvoice = () => {
    setPasswordAction(() => () => executePayInvoice());
    setPasswordModalInfo({ title: 'Pagar Fatura', description: 'Digite seu PIN para confirmar o pagamento.' });
    setIsPasswordModalOpen(true);
  };

  const executePayInvoice = async () => {
    if (!user) return;
    const amountToPay = user.creditCard.closedInvoice;
    setIsProcessing(true);
    const pin = (passwordActionPayload.current as any)?.pin;

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
            alert(result.message);
            setCurrentView('cards');
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
    
    switch (currentView) {
        case 'home': 
            return <HomeView user={user} onNavigate={handleNavigate} />;
        case 'pix': return <Pix onBack={() => handleNavigate('home')} />;
        case 'cards': return <CardDashboard user={user} onBack={() => handleNavigate('home')} onNavigate={handleNavigate} />;
        case 'shop': return <Shop onBack={() => handleNavigate('home')} onAddToCart={handleAddToCart} onInitiatePurchase={handleInitiatePurchase} cartItemCount={cart.reduce((s, i) => s + (i.quantity || 0), 0)} onNavigate={handleNavigate} />;
        case 'shoppingCart': return <ShoppingCart onBack={() => handleNavigate('shop')} cart={cart} onCheckout={handleCheckout} onUpdateQuantity={handleUpdateCartQuantity} />;
        case 'paymentMethods': {
            // Se temos carrinho, criar item agregado com total
            const paymentItem = cart.length > 0 ? {
                id: 'cart-checkout',
                name: `${cart.length} itens no carrinho`,
                price: cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0),
                description: cart.map(i => i.name).join(', '),
                imageUrl: cart[0]?.imageUrl || ''
            } : currentItem;
            return <PaymentMethods user={user} item={paymentItem} onBack={() => handleNavigate('shoppingCart')} onSelectMethod={handleSelectPaymentMethod} />;
        }
        case 'purchaseConfirmation': return confirmationDetails ? <PurchaseConfirmation details={confirmationDetails} onClose={() => handleNavigate('home')} /> : <HomeView user={user} onNavigate={handleNavigate} />;
        case 'statement': return <Statement user={user} onBack={() => handleNavigate('home')} />;
        case 'currentInvoice': return <CurrentInvoiceView user={user} onBack={() => handleNavigate('cards')} />;
        case 'closedInvoice': return <ClosedInvoiceView user={user} onBack={() => handleNavigate('cards')} onPayInvoice={handlePayInvoice} onParcel={handleParcelInvoice} />;
        case 'installmentOptions': return <InstallmentOptions user={user} onBack={() => handleNavigate('closedInvoice')} onSelectOption={handleSelectInstallmentOption} />;
        case 'installmentReviewInvoice': return parcelDetails ? <InstallmentReviewInvoice user={user} details={parcelDetails} onConfirm={handleConfirmParcelInvoice} onBack={() => handleNavigate('installmentOptions')} /> : <ClosedInvoiceView user={user} onBack={() => handleNavigate('cards')} onPayInvoice={handlePayInvoice} onParcel={handleParcelInvoice} />;
        case 'invoicePaymentReceipt': return invoicePaymentDetails ? <InvoicePaymentReceipt details={invoicePaymentDetails} onClose={() => handleNavigate('home')} /> : <CardDashboard user={user} onBack={() => handleNavigate('home')} onNavigate={handleNavigate} />;
        case 'products': return <Products onNavigate={handleNavigate} />;
        case 'profile': return <Profile onNavigate={handleNavigate} />;
        case 'admin': {
            console.log('🔵 [Home] Renderizando view admin');
            console.log('🔵 [Home] User role:', user?.role);
            if (user?.role === 'admin') {
                console.log('✅ [Home] Renderizando componente Admin');
                return <Admin onBack={() => handleNavigate('profile')} />;
            } else {
                console.log('❌ [Home] Usuário não é admin, redirecionando para profile');
                return <Profile onNavigate={handleNavigate} />;
            }
        }
        default: return <HomeView user={user} onNavigate={handleNavigate} />;
    }
  };

  const showBottomNav = ['home', 'cards', 'shop', 'products', 'profile'].includes(currentView);

  return (
    <div className="h-full w-full flex flex-col bg-background-dark" style={{ position: 'relative', overflow: 'visible' }}>
        <div className={`flex-grow overflow-y-auto no-scrollbar ${showBottomNav ? 'pb-16' : ''}`} style={{ position: 'relative', zIndex: 1 }}>
            {renderContent()}
        </div>
        {showBottomNav && (
            <BottomNavBar currentView={currentView} onNavigate={handleNavigate} />
        )}
        {isInstallmentModalOpen && currentItem && (
            <InstallmentModal
                isOpen={isInstallmentModalOpen}
                onClose={() => setIsInstallmentModalOpen(false)}
                item={currentItem}
                user={user}
                onConfirm={handleConfirmPurchaseWithInstallments}
            />
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
