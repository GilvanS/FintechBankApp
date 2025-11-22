import React, { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useAuth } from '../context/AuthContext';
import { PurchasedItem, User } from '../types';
import { purchaseWithDebit, purchaseWithCard, getUserMe, getUserByCpf, getUserStatement } from '../services/api';

import Header from '../components/Header';
import BottomNavBar from '../components/BottomNavBar';
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

type View = 'home' | 'cards' | 'shop' | 'profile' | 'pix' | 'statement' | 'shoppingCart' | 'paymentMethods' | 'purchaseConfirmation';

const Home: React.FC<{ user: User, onLogout: () => void, refreshUserData: () => void }> = ({ user, onLogout, refreshUserData }) => {
    const [view, setView] = useState<View>('home');
    const [cart, setCart] = useState<PurchasedItem[]>([]);
    const [currentItem, setCurrentItem] = useState<PurchasedItem | null>(null);
    const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);
    const [passwordAction, setPasswordAction] = useState<{ action: (pin: string) => void, title: string, description: string } | null>(null);
    const [confirmationDetails, setConfirmationDetails] = useState<any>(null);

    const navigateTo = (newView: View) => {
        setView(newView);
    };

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
        setCurrentItem(item);
        navigateTo('paymentMethods');
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
        navigateTo('paymentMethods');
    };

    const handleSelectPaymentMethod = (method: 'debit' | 'credit') => {
        if (!currentItem) return;
        if (method === 'credit' && user.creditCard.isBlocked) {
            setIsBlockedModalOpen(true);
            return;
        }
        if (method === 'credit') {
            setIsInstallmentModalOpen(true);
        } else {
            setPasswordAction({
                action: (pin) => executePurchase({ ...getPurchaseDetails(), pin, installments: 1, method: 'debit' }),
                title: 'Confirmar Compra',
                description: 'Digite sua senha de 4 dígitos para confirmar.'
            });
            setIsPasswordModalOpen(true);
        }
    };

    const getPurchaseDetails = () => ({
        items: cart.length > 0 ? cart : (currentItem ? [currentItem] : []),
        cashbackUsed: 0, // Simplified for now
    });

    const handleConfirmPurchaseWithInstallments = (details: { cashbackUsed: number, installments: number }) => {
        setPasswordAction({
            action: (pin) => executePurchase({ ...getPurchaseDetails(), ...details, pin, method: 'credit' }),
            title: 'Confirmar Compra',
            description: 'Digite sua senha de 4 dígitos para confirmar.'
        });
        setIsPasswordModalOpen(true);
    };

    const executePurchase = async (details: any) => {
        if (!user) return;

        let result;
        if (details.method === 'debit') {
            result = await purchaseWithDebit(user.cpf, details.items, details.cashbackUsed, details.pin);
        } else {
            result = await purchaseWithCard(user.cpf, details.items, details.cashbackUsed, details.installments, details.pin);
        }

        if (result.success) {
            refreshUserData();
            const totalAmount = details.items.reduce((sum: number, item: any) => sum + item.price * (item.quantity || 1), 0);
            const finalAmount = totalAmount - details.cashbackUsed;
            const confirmationProduct: PurchasedItem = {
                id: 'purchase-confirm',
                name: cart.length > 1 ? `${cart.length} itens` : details.items[0].name,
                description: `Pagamento de ${finalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                price: finalAmount,
                imageUrl: details.items[0].imageUrl,
            };
            setConfirmationDetails({ product: confirmationProduct, message: result.message });
            setCart([]);
            navigateTo('purchaseConfirmation');
        } else {
            alert(result.message);
        }
    };

    const renderContent = () => {
        switch (view) {
            case 'profile': return <Profile user={user} onLogout={onLogout} />;
            case 'pix': return <Pix user={user} onBack={() => navigateTo('home')} refreshUserData={refreshUserData} />;
            case 'shop': return <Shop onBack={() => navigateTo('home')} onAddToCart={handleAddToCart} onInitiatePurchase={handleInitiatePurchase} cartItemCount={cart.length} onNavigate={navigateTo} />;
            case 'cards': return <CardDashboard user={user} onBack={() => navigateTo('home')} onNavigate={navigateTo} />;
            case 'statement': return <Statement user={user} onBack={() => navigateTo('home')} />;
            case 'shoppingCart': return <ShoppingCart cart={cart} onBack={() => navigateTo('shop')} onCheckout={handleCheckout} onUpdateQuantity={handleUpdateCartQuantity} />;
            case 'paymentMethods': return <PaymentMethods user={user} item={currentItem} onBack={() => cart.length > 0 ? navigateTo('shoppingCart') : navigateTo('shop')} onSelectMethod={handleSelectMethod} />;
            case 'purchaseConfirmation': return <PurchaseConfirmation details={confirmationDetails} onClose={() => navigateTo('home')} />;
            case 'home':
            default: return <HomeView user={user} onNavigate={navigateTo} />;
        }
    };

    const navBarViews: View[] = ['home', 'cards', 'shop', 'profile', 'pix', 'statement'];

    return (
        <IonPage>
            <Header user={user} onNavigateToMenu={() => {}} onNavigateToNotifications={() => {}} />
            <IonContent className="no-scrollbar">{renderContent()}</IonContent>
            {navBarViews.includes(view) && (
                <BottomNavBar currentView={view} onNavigate={(v) => navigateTo(v as View)} />
            )}

            <BlockedCardModal isOpen={isBlockedModalOpen} onGoToPayment={() => { setIsBlockedModalOpen(false); navigateTo('cards'); }} onClose={() => setIsBlockedModalOpen(false)} />
            {passwordAction && (
                <PasswordModal
                    isOpen={isPasswordModalOpen}
                    onClose={() => setIsPasswordModalOpen(false)}
                    onConfirm={(pin) => { passwordAction.action(pin); setIsPasswordModalOpen(false); }}
                    title={passwordAction.title}
                    description={passwordAction.description}
                />
            )}
            {currentItem && (
                <InstallmentModal
                    isOpen={isInstallmentModalOpen}
                    onClose={() => setIsInstallmentModalOpen(false)}
                    item={currentItem}
                    user={user}
                    onConfirm={(details) => { setIsInstallmentModalOpen(false); handleConfirmPurchaseWithInstallments(details); }}
                />
            )}
        </IonPage>
    );
};

export default Home;
