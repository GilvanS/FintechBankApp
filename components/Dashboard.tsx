import React, { useState } from 'react';
import { useAuth } from '../App';
import { PurchasedItem } from '../types';

// Main Tab Components
import Profile from './Profile';
import CardDashboard from './CardDashboard';
import Shop from './Shop';
import Investments from './Investments';
import BottomNavBar from './BottomNavBar';

// Overlay/Sub-View Components
import ProductPage from './ProductPage';
import PaymentMethods from './PaymentMethods';
import InstallmentModal from './InstallmentModal';
import PurchaseConfirmation from './PurchaseConfirmation';
import NewsJournal from './NewsJournal';
import Loans from './Loans';
import Wallet from './Wallet';
import Pix from './Pix';
import Statement from './Statement';
import Notifications from './Notifications';
import PixInstallmentDetails from './PixInstallmentDetails';
import PasswordModal from './PasswordModal';
import InstallmentReview from './InstallmentReview';
import PaymentReceipt from './PaymentReceipt';
import AnticipateInstallments from './AnticipateInstallments';


// Home View Components
import Header from './Header';
import AccountBalance from './AccountBalance';
import MainActions from './MainActions';
import CreditCardInfo from './CreditCardInfo';
import PromotionalBanner from './PromotionalBanner';

// API
import { purchaseWithDebit, purchaseWithCard, performPixCreditInstallment, payCreditCardInvoice, parcelCreditCardInvoice } from '../services/mockApi';

// Define view types
type MainView = 'home' | 'cards' | 'shop' | 'invest' | 'profile';
type OverlayView =
    | 'pix'
    | 'statement'
    | 'pagar'
    | 'loans'
    | 'newsJournal'
    | 'wallet'
    | 'productPage'
    | 'paymentMethods'
    | 'installmentModal'
    | 'purchaseConfirmation'
    | 'pixInstallmentDetails'
    | 'passwordModal'
    | 'notifications'
    | 'installmentReview'
    | 'paymentReceipt'
    | 'anticipate';

const Dashboard: React.FC = () => {
    const { user, updateUser, logout } = useAuth();
    const [mainView, setMainView] = useState<MainView>('home');
    const [overlayView, setOverlayView] = useState<OverlayView | null>(null);
    const [overlayData, setOverlayData] = useState<any>(null);
    const [passwordModalAction, setPasswordModalAction] = useState<{ onConfirm: () => void, title?: string } | null>(null);

    const handleDataRefresh = () => {
        // In a real app, this would re-fetch user data.
        console.log("Data refresh requested.");
    };

    const handleNavigate = (view: string, data?: any) => {
        setOverlayView(view as OverlayView);
        if (data) {
            setOverlayData(data);
        }
    };
    
    const handleCloseOverlay = () => {
        setOverlayView(null);
        setOverlayData(null);
    };

    const handleProductSelect = (product: PurchasedItem) => {
        handleNavigate('productPage', { product });
    };

    const handlePurchase = (product: PurchasedItem) => {
        handleNavigate('paymentMethods', { item: product });
    };

    const handleSelectPaymentMethod = (method: 'debit' | 'credit') => {
        if (overlayData.item) {
            if (method === 'credit') {
                setOverlayView('installmentModal');
            } else {
                const action = async () => {
                    const result = await purchaseWithDebit(user!.cpf, overlayData.item, 0);
                    setPasswordModalAction(null);
                    if (result.success && result.user) {
                        updateUser(result.user);
                        setOverlayView('purchaseConfirmation');
                        setOverlayData({ details: { item: overlayData.item } });
                    } else {
                        alert(result.message);
                        handleCloseOverlay();
                    }
                };
                setPasswordModalAction({ onConfirm: action, title: "Confirmar Compra" });
                handleNavigate('passwordModal');
            }
        }
    };

    const handleConfirmInstallments = (details: { cashbackUsed: number; installments: number }) => {
        const action = async () => {
            const result = await purchaseWithCard(user!.cpf, overlayData.item, details.cashbackUsed, details.installments);
            setPasswordModalAction(null);
            if(result.success && result.user) {
                updateUser(result.user);
                setOverlayView('purchaseConfirmation');
                setOverlayData({ details: { item: overlayData.item, ...details } });
            } else {
                alert(result.message);
                handleCloseOverlay();
            }
        };
        setPasswordModalAction({ onConfirm: action, title: "Confirmar Compra" });
        setOverlayView('passwordModal');
    };
    
    const handleGoToInstallmentDetails = (details: any) => {
        setOverlayView('pixInstallmentDetails');
        setOverlayData(details);
    };

    const handleConfirmPixInstallment = () => {
        const action = async () => {
             const result = await performPixCreditInstallment(user!.cpf, overlayData.amount, overlayData.installments);
             setPasswordModalAction(null);
             if (result.success && result.user) {
                 updateUser(result.user);
                 handleCloseOverlay();
             } else {
                 alert(result.message);
             }
        };
        setPasswordModalAction({ onConfirm: action, title: 'Confirmar PIX Parcelado' });
        setOverlayView('passwordModal');
    };

    const handlePayInvoice = () => {
        const action = async () => {
            const result = await payCreditCardInvoice(user!.cpf);
            setPasswordModalAction(null);
            handleCloseOverlay();
            if (result.success && result.user) {
                updateUser(result.user);
                handleNavigate('paymentReceipt', {
                    details: {
                        amountPaid: user!.creditCard.closedInvoice,
                        date: new Date().toISOString(),
                        transactionId: result.transactionId!,
                    }
                });
            } else {
                alert(result.message);
            }
        };
        setPasswordModalAction({ onConfirm: action, title: 'Confirmar Pagamento' });
        handleNavigate('passwordModal');
    };

    const handleParcelInvoice = (payload: { amount: number, installments: number }) => {
        handleNavigate('installmentReview', { type: 'invoice', ...payload });
    };

    const handleConfirmInvoiceParceling = () => {
        const action = async () => {
            const result = await parcelCreditCardInvoice(user!.cpf, overlayData.amount, overlayData.installments);
            setPasswordModalAction(null);
            handleCloseOverlay();
            if (result.success && result.user) {
                updateUser(result.user);
                alert('Fatura parcelada com sucesso!');
                setMainView('cards');
            } else {
                alert(result.message);
            }
        };
        setPasswordModalAction({ onConfirm: action, title: 'Confirmar Parcelamento' });
        handleNavigate('passwordModal');
    };


    if (!user) {
        logout();
        return null;
    }

    const handleMainActionNavigate = (view: string) => {
        if (['cards', 'shop', 'invest', 'profile'].includes(view)) {
            setMainView(view as MainView);
        } else if (view === 'products') {
            setMainView('shop');
        } else {
            handleNavigate(view);
        }
    };

    const renderMainView = () => {
        switch (mainView) {
            case 'home':
                return (
                    <div className="flex flex-col h-full bg-black text-white">
                        <Header user={user} onNavigateToMenu={() => setMainView('profile')} onNavigateToNotifications={() => handleNavigate('notifications')} />
                        <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-4">
                            <AccountBalance balance={user.balance} />
                            <MainActions onNavigate={handleMainActionNavigate} />
                            <CreditCardInfo creditCard={user.creditCard} onNavigate={() => setMainView('cards')} />
                            <PromotionalBanner />
                        </main>
                    </div>
                );
            case 'cards':
                return <CardDashboard 
                    onBack={() => setMainView('home')} 
                    onPayInvoice={handlePayInvoice}
                    onParcelInvoice={handleParcelInvoice}
                    onNavigateToAnticipate={() => handleNavigate('anticipate')}
                />;
            case 'shop':
                return <Shop onBack={() => setMainView('home')} onProductSelect={handleProductSelect} />;
            case 'invest':
                return <Investments onBack={() => setMainView('home')} />;
            case 'profile':
                return <Profile />;
            default:
                return <div>Not Found</div>;
        }
    };

    const renderOverlayView = () => {
        switch (overlayView) {
            case 'pix':
            case 'pagar':
                return <Pix currentUser={user} onDataRefresh={handleDataRefresh} onBack={handleCloseOverlay} onGoToInstallmentDetails={handleGoToInstallmentDetails} />;
            case 'statement':
                return <Statement onBack={handleCloseOverlay} />;
            case 'newsJournal':
                return <NewsJournal onBack={handleCloseOverlay} />;
            case 'loans':
                return <Loans onBack={handleCloseOverlay} />;
            case 'wallet':
                return <Wallet onBack={handleCloseOverlay} />;
            case 'productPage':
                return <ProductPage product={overlayData.product} onBack={() => handleNavigate('shop')} onPurchase={handlePurchase} />;
            case 'paymentMethods':
                return <PaymentMethods user={user} item={overlayData.item} onBack={() => handleNavigate('productPage', {product: overlayData.item})} onSelectMethod={handleSelectPaymentMethod} />;
            case 'installmentModal':
                return <InstallmentModal isOpen={true} item={overlayData.item} user={user} onClose={() => handleNavigate('paymentMethods', {item: overlayData.item})} onConfirm={handleConfirmInstallments} />;
            case 'purchaseConfirmation':
                return <PurchaseConfirmation details={overlayData.details} onClose={handleCloseOverlay} />;
            case 'pixInstallmentDetails':
                return <PixInstallmentDetails details={overlayData} onBack={() => setOverlayView('pix')} onConfirm={handleConfirmPixInstallment} />;
            case 'installmentReview':
                return <InstallmentReview type={overlayData.type} user={user} details={overlayData} onBack={handleCloseOverlay} onConfirm={overlayData.type === 'invoice' ? handleConfirmInvoiceParceling : handleConfirmPixInstallment} />;
            case 'paymentReceipt':
                return <PaymentReceipt details={overlayData.details} onClose={handleCloseOverlay} />;
            case 'anticipate':
                return <AnticipateInstallments onBack={handleCloseOverlay} />;
            case 'passwordModal':
                return passwordModalAction ? <PasswordModal title={passwordModalAction.title || "Confirmar Operação"} onConfirm={passwordModalAction.onConfirm} onCancel={() => { setPasswordModalAction(null); handleCloseOverlay(); }} /> : null;
            case 'notifications':
                return <Notifications onBack={handleCloseOverlay} />;
            default:
                return null;
        }
    };

    return (
        <div className="h-full flex flex-col bg-black">
            <div className="flex-grow overflow-hidden relative">
                <div className="h-full">
                   {renderMainView()}
                </div>
                {overlayView && (
                    <div className="absolute inset-0 z-20 bg-black h-full overflow-y-auto no-scrollbar">
                         {renderOverlayView()}
                    </div>
                )}
            </div>
            {!overlayView && <BottomNavBar currentView={mainView} onNavigate={setMainView} />}
        </div>
    );
};

export default Dashboard;