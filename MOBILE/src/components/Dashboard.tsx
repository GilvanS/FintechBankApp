import Pix from './Pix';
import Statement from './Statement';
import CardDashboard from './CardDashboard';
import Shop from './Shop';
import ShoppingCart from './ShoppingCart';
import PaymentMethods from './PaymentMethods';
import InstallmentModal from './InstallmentModal';
import PurchaseConfirmation from './PurchaseConfirmation';
import BottomNavBar from './BottomNavBar';
import Admin from './Admin';
import Investments from './Investments';
import PointsDashboard from './PointsDashboard';
import AnticipateInstallments from './AnticipateInstallments';
import InstallmentReview from './InstallmentReview';
import PaymentReceipt from './PaymentReceipt';
import PasswordModal from './PasswordModal';
import Products from './Products';
import ClosedInvoice from './ClosedInvoice';
import InstallmentOptions from './InstallmentOptions';
import CurrentInvoice from './CurrentInvoice';

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


type View = 'home' | 'cards' | 'shop' | 'investments' | 'profile' | 'statement' | 'pix' | 'admin' | 'shoppingCart' | 'paymentMethods' | 'productPage' | 'points' | 'anticipateInstallments' | 'installmentReviewInvoice' | 'purchaseConfirmation' | 'products' | 'closedInvoice' | 'invoicePaymentReceipt' | 'installmentOptions' | 'currentInvoice';

const Dashboard: React.FC = () => {
    const { user, updateUser, logout, view: topLevelView, navigateTo } = useAuth();
    const [currentView, setCurrentView] = useState<View>('home');
    const [previousView, setPreviousView] = useState<View>('home');

    const [cart, setCart] = useState<PurchasedItem[]>([]);
    const [currentItem, setCurrentItem] = useState<PurchasedItem | null>(null);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordAction, setPasswordAction] = useState<(() => void) | null>(null);
    const passwordActionPayload = useRef<any>(null); // Ref to hold payload for password actions
    const [passwordModalInfo, setPasswordModalInfo] = useState({ title: '', description: '' });
    const [isProcessing, setIsProcessing] = useState(false);
    const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);
    
    // States for various flows
    const [purchaseDetails, setPurchaseDetails] = useState<{ items: PurchasedItem[], cashbackUsed: number, method: 'debit' | 'credit', installments: number } | null>(null);
    const [checkoutTotal, setCheckoutTotal] = useState(0);
    const [confirmationDetails, setConfirmationDetails] = useState<any>(null);
    const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
    const [parcelDetails, setParcelDetails] = useState<{ amount: number, installments: number } | null>(null);
    const [invoicePaymentDetails, setInvoicePaymentDetails] = useState<any>(null);
    
    useEffect(() => {
        // Show modal if user navigates to cards and the card is blocked
        if (currentView === 'cards' && user?.creditCard.isBlocked) {
            setIsBlockedModalOpen(true);
        } else {
            setIsBlockedModalOpen(false);
        }
    }, [currentView, user]);

    // Refresh automatico ao entrar em telas de cartoes
    useEffect(() => {
        let cancelled = false;

        const refreshUserIfNeeded = async () => {
            if (!user) return;

            const viewsToRefresh: View[] = [
                'cards',
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

    // NOVO: Refresh do extrato quando entrar na view 'statement'
    useEffect(() => {
        let cancelled = false;

        const refreshStatementIfNeeded = async () => {
            if (!user || currentView !== 'statement') return;
            const stmt = await getUserStatement(user.cpf);
            if (stmt.success && stmt.transactions && !cancelled) {
                updateUser({ transactions: stmt.transactions });
            }
        };

        refreshStatementIfNeeded();
        return () => { cancelled = true; };
    }, [currentView, user, updateUser]);
    const handleGoToPaymentFromModal = () => {
        setIsBlockedModalOpen(false);
        handleNavigate('closedInvoice');
    };
    
    const handleCloseBlockedModal = () => {
        setIsBlockedModalOpen(false);
        handleBack();
    };

    const handleNavigate = useCallback((newView: View, item?: any) => {
        if (newView === currentView) return;
        setPreviousView(currentView);
        setCurrentView(newView);
        if (item) setCurrentItem(item);
    }, [currentView]);

    const handleBack = () => {
        setCurrentView(previousView);
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
        // Add item to cart
        setCart(prevCart => {
            const existingItem = prevCart.find(i => i.id === item.id);
            if (existingItem) {
                 // If item already in cart, just go to cart
                return prevCart;
            }
            return [...prevCart, { ...item, quantity: 1 }];
        });
        // Navigate to shopping cart
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
                alert(result.message);
            }
        }
        setIsProcessing(false);
        passwordActionPayload.current = null;
    };


    // --- Other Actions ---
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

        const result = await payCreditCardInvoice(user.cpf, pin);
        if (result.success) {
            const refreshed = await getUserByCpf(user.cpf);
            if (refreshed.success && refreshed.user) {
                updateUser(refreshed.user);
            }
            handleNavigate('invoicePaymentReceipt');
        } else {
            alert(result.message);
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
            alert(result.message);
            handleNavigate('cards');
        } else {
            alert(result.message);
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
            alert(result.message);
            handleNavigate('cards');
        } else {
            alert(result.message);
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
        if (topLevelView === 'admin' && user?.role === 'admin') {
            return <Admin onBack={() => navigateTo('dashboard')} />;
        }

        switch (currentView) {
            case 'home':
                return <HomeView user={user!} onNavigate={handleNavigate} />;
            case 'profile':
                return <Profile onNavigate={navigateTo} />;
            case 'pix':
                return <Pix onBack={() => handleNavigate('home')} />;
            case 'statement':
                return <Statement user={user!} onNavigate={handleNavigate} onBack={() => handleNavigate('home')} />;
            case 'cards':
                return <CardDashboard onBack={() => handleNavigate('home')} onNavigate={handleNavigate} />;
            case 'shop':
                return <Shop onBack={() => handleNavigate('home')} onAddToCart={handleAddToCart} onInitiatePurchase={handleInitiatePurchase} cartItemCount={cart.length} onNavigate={handleNavigate} />;
            case 'shoppingCart':
                return <ShoppingCart cart={cart} onBack={() => handleNavigate('shop')} onCheckout={handleCheckout} onUpdateQuantity={handleUpdateCartQuantity} />;
            case 'paymentMethods':
                return <PaymentMethods user={user!} item={currentItem} onBack={() => cart.length > 0 ? handleNavigate('shoppingCart') : handleNavigate('shop')} onSelectMethod={handleSelectPaymentMethod} />;
            case 'purchaseConfirmation':
                return <PurchaseConfirmation details={confirmationDetails} onClose={() => handleNavigate('home')} />;
            case 'investments':
                return <Investments onBack={() => handleNavigate('home')} />;
            case 'points':
                return <PointsDashboard user={user!} onBack={() => handleNavigate('cards')} />;
            case 'anticipateInstallments':
                 return <AnticipateInstallments onBack={() => handleNavigate('cards')} onConfirmAnticipation={handleAnticipateInstallments} isProcessing={isProcessing} />;
            case 'installmentReviewInvoice':
                if (!user || !parcelDetails) return <ClosedInvoice user={user!} onBack={handleBack} onPayInvoice={handlePayInvoice} onParcel={handleParcelInvoice} />;
                return <InstallmentReview type="invoice" user={user} details={parcelDetails} onConfirm={handleConfirmParcelInvoice} onBack={() => handleNavigate('installmentOptions')} />;
            case 'invoicePaymentReceipt':
                if (!invoicePaymentDetails) return <CardDashboard onBack={() => handleNavigate('home')} onNavigate={handleNavigate} />;
                return <PaymentReceipt details={invoicePaymentDetails} onClose={() => handleNavigate('home')} />;
             case 'products':
                return <Products onNavigate={handleNavigate} />;
            case 'closedInvoice':
                if (!user) return null;
                return <ClosedInvoice user={user} onBack={handleBack} onPayInvoice={handlePayInvoice} onParcel={handleParcelInvoice} />;
            case 'installmentOptions':
                if (!user) return null;
                return <InstallmentOptions user={user} onBack={() => handleNavigate('closedInvoice')} onSelectOption={handleSelectInstallmentOption} />;
            case 'currentInvoice':
                if (!user) return null;
                return <CurrentInvoice user={user} onBack={handleBack} />;
            default:
                return <HomeView user={user!} onNavigate={handleNavigate} />;
        }
    };

    if (!user) {
        return <div>Error: No user found.</div>;
    }

    return (
        <div className="h-full w-full flex flex-col bg-background-dark overflow-hidden">
            <div className="flex-grow overflow-y-auto no-scrollbar">
                {renderContent()}
            </div>
            {['home', 'cards', 'shop', 'products', 'profile'].includes(currentView) && (
                 <BottomNavBar currentView={currentView} onNavigate={(view) => handleNavigate(view)} />
            )}
            
            <BlockedCardModal isOpen={isBlockedModalOpen} onGoToPayment={handleGoToPaymentFromModal} onClose={handleCloseBlockedModal} />
            
            <PasswordModal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
                onConfirm={handlePasswordConfirm}
                title={passwordModalInfo.title}
                description={passwordModalInfo.description}
                isLoading={isProcessing}
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
        </div>
    );
};

export default Dashboard;
