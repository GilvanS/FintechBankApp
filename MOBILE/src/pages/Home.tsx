
import React, { useState, useEffect, useRef } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useAuth } from '../context/AuthContext';
import { View, Article, PurchasedItem, Transaction, User } from '../types';
import { purchaseWithDebit, purchaseWithCard, getUserMe, getUserByCpf, getUserStatement } from '../services/api';

import Header from '../components/Header';
import HomeView from '../components/HomeView';
import Profile from '../components/Profile';
import Pix from '../components/Pix';
import Shop from '../components/Shop';
import CardDashboard from '../components/CardDashboard';
import Statement from '../components/Statement';
import ShoppingCart from '../components/ShoppingCart';
import PaymentMethods from '../components/PaymentMethods';
import PurchaseConfirmation from '../components/PurchaseConfirmation';
import InstallmentModal from '../components/InstallmentModal';
import PasswordModal from '../components/PasswordModal';
import BlockedCardModal from '../components/BlockedCardModal';

const Home: React.FC = () => {
    const { user, logout, updateUser, view, navigateTo } = useAuth();
    const [news, setNews] = useState<Article[]>([]);
    const [cart, setCart] = useState<PurchasedItem[]>([]);
    const [currentItem, setCurrentItem] = useState<PurchasedItem | null>(null);
    const [checkoutTotal, setCheckoutTotal] = useState(0);
    const [purchaseDetails, setPurchaseDetails] = useState<{ items: PurchasedItem[], cashbackUsed: number, method: 'debit' | 'credit', installments: number } | null>(null);
    const [confirmationDetails, setConfirmationDetails] = useState<any>(null);

    const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [passwordAction, setPasswordAction] = useState<(() => void) | null>(null);
    const passwordActionPayload = useRef<any>(null);
    const [passwordModalInfo, setPasswordModalInfo] = useState({ title: '', description: '' });

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const newsData = await api.getNews();
                setNews(newsData);
            } catch (error) {
                console.error("Failed to fetch news", error);
            }
        };

        fetchNews();
    }, []);

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

    const handleInitiatePurchase = (item: PurchasedItem) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(i => i.id === item.id);
            if (existingItem) {
                return prevCart;
            }
            return [...prevCart, { ...item, quantity: 1 }];
        });
        navigateTo('shoppingCart');
    };

    const handleCheckout = () => {
        const total = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
        setCheckoutTotal(total);
        const checkoutItem: PurchasedItem = {
            id: 'cart-checkout',
            name: `${cart.length} itens no carrinho`,
            price: total,
            description: cart.map(i => i.name).join(', '),
            imageUrl: cart[0]?.imageUrl || ''
        };
        setCurrentItem(checkoutItem);
        navigateTo('paymentMethods');
    };

    const handleSelectPaymentMethod = (method: 'debit' | 'credit') => {
        if (!currentItem) return;
        if (method === 'credit' && user?.creditCard.isBlocked) {
            setIsBlockedModalOpen(true);
            return;
        }
        const newPurchaseDetails = { items: cart.length > 0 ? cart : [currentItem], cashbackUsed: 0, method, installments: 1 };
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
            navigateTo('purchaseConfirmation');
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

    const handlePasswordConfirm = (password: string) => {
        passwordActionPayload.current = { ...(passwordActionPayload.current || {}), pin: password };
        if (passwordAction) {
            passwordAction();
        }
        setIsPasswordModalOpen(false);
        setPasswordAction(null);
    };

    if (!user) {
        return null;
    }

    const renderContent = () => {
        switch (view) {
            case 'profile':
                return <Profile user={user} onLogout={logout} />;
            case 'pix':
                return <Pix user={user} onBack={() => navigateTo('home')} refreshUserData={updateUser} />;
            case 'shop':
                return <Shop onBack={() => navigateTo('home')} onAddToCart={handleAddToCart} onInitiatePurchase={handleInitiatePurchase} cartItemCount={cart.length} onNavigate={navigateTo} />;
            case 'cards':
                return <CardDashboard user={user} onBack={() => navigateTo('home')} onNavigate={navigateTo} />;
            case 'statement':
                return <Statement user={user} onBack={() => navigateTo('home')} />;
            case 'shoppingCart':
                return <ShoppingCart cart={cart} onBack={() => navigateTo('shop')} onCheckout={handleCheckout} onUpdateQuantity={handleUpdateCartQuantity} />;
            case 'paymentMethods':
                return <PaymentMethods user={user} item={currentItem} onBack={() => cart.length > 0 ? navigateTo('shoppingCart') : navigateTo('shop')} onSelectMethod={handleSelectPaymentMethod} />;
            case 'purchaseConfirmation':
                return <PurchaseConfirmation details={confirmationDetails} onClose={() => navigateTo('home')} />;
            case 'home':
            default:
                return <HomeView user={user} onNavigate={navigateTo} news={news} />;
        }
    };

    return (
        <IonPage>
            <Header onNavigate={navigateTo} />
            <IonContent className="no-scrollbar">
                {renderContent()}
            </IonContent>
            <BlockedCardModal isOpen={isBlockedModalOpen} onGoToPayment={() => { setIsBlockedModalOpen(false); navigateTo('cards'); }} onClose={() => setIsBlockedModalOpen(false)} />
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
        </IonPage>
    );
};

export default Home;
