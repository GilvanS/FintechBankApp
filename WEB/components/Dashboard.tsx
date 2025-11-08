
import React, { useState, useCallback } from 'react';
import { useAuth } from '../App';
import { PurchasedItem } from '../types';
// FIX: Import mock API functions for handling user actions.
import { purchaseWithDebit, purchaseWithCard, performPixCreditInstallment, parcelCreditCardInvoice, payCreditCardInvoice } from '../services/mockApi';

// FIX: Import all necessary components for the dashboard views.
import Header from './Header';
import AccountBalance from './AccountBalance';
import MainActions from './MainActions';
import CreditCardInfo from './CreditCardInfo';
import PromotionalBanner from './PromotionalBanner';
import GuardianBanner from './GuardianBanner';
import BottomNavBar from './BottomNavBar';
import Pix from './Pix';
import CardDashboard from './CardDashboard';
import Shop from './Shop';
import Investments from './Investments';
import Profile from './Profile';
import Statement from './Statement';
import Loans from './Loans';
import NewsJournal from './NewsJournal';
import Products from './Products';
import ProductPage from './ProductPage';
import PaymentMethods from './PaymentMethods';
import InstallmentModal from './InstallmentModal';
import PurchaseConfirmation from './PurchaseConfirmation';
import AnticipateInstallments from './AnticipateInstallments';
import PixInstallmentDetails from './PixInstallmentDetails';
import InstallmentReview from './InstallmentReview';
import PasswordModal from './PasswordModal';
import PaymentReceipt from './PaymentReceipt';

// FIX: Define a type for all possible views within the Dashboard.
type DashboardView = 
  | 'home' | 'cards' | 'shop' | 'invest' | 'profile' 
  | 'pix' | 'statement' | 'loans' | 'newsJournal' | 'products'
  | 'productPage' | 'paymentMethods' | 'anticipateInstallments' | 'pixInstallmentDetails' | 'installmentReview';

// FIX: Create the Dashboard component.
const Dashboard: React.FC = () => {
    const { user, updateUser, logout } = useAuth();
    const [view, setView] = useState<DashboardView>('home');

    const [selectedProduct, setSelectedProduct] = useState<PurchasedItem | null>(null);
    const [showInstallmentModal, setShowInstallmentModal] = useState(false);
    const [purchaseDetails, setPurchaseDetails] = useState<any>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    
    const [installmentDetails, setInstallmentDetails] = useState<any>(null);
    
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordModalAction, setPasswordModalAction] = useState<{ action: () => void, title: string } | null>(null);

    const [paymentReceiptDetails, setPaymentReceiptDetails] = useState<any>(null);

    const navigate = useCallback((newView: DashboardView) => {
        setView(newView);
    }, []);

    if (!user) {
        logout();
        return null;
    }

    const handleProductSelect = (product: PurchasedItem) => {
        setSelectedProduct(product);
        navigate('productPage');
    };

    const handlePurchase = (product: PurchasedItem) => {
        setSelectedProduct(product);
        navigate('paymentMethods');
    };
    
    const handleSelectPaymentMethod = (method: 'debit' | 'credit') => {
        if (!selectedProduct) return;
        if (method === 'credit') {
            setShowInstallmentModal(true);
        } else {
            setPasswordModalAction({
                title: 'Confirmar Compra no Débito',
                action: () => confirmDebitPurchase({ cashbackUsed: 0 })
            });
            setShowPasswordModal(true);
        }
    };
    
    const confirmDebitPurchase = async (details: { cashbackUsed: number }) => {
        if (!selectedProduct) return;
        const result = await purchaseWithDebit(user.cpf, selectedProduct, details.cashbackUsed);
        if (result.success && result.user) {
            updateUser(result.user);
            setPurchaseDetails({ item: selectedProduct, method: 'debit', ...details });
            setShowConfirmation(true);
        } else {
            alert(result.message);
        }
    };

    const handleConfirmInstallments = (details: { cashbackUsed: number; installments: number }) => {
        if (!selectedProduct) return;
        setShowInstallmentModal(false);
        setPasswordModalAction({
            title: 'Confirmar Compra no Crédito',
            action: () => confirmCreditPurchase(details)
        });
        setShowPasswordModal(true);
    };
    
    const confirmCreditPurchase = async (details: { cashbackUsed: number; installments: number }) => {
        if (!selectedProduct) return;
        const result = await purchaseWithCard(user.cpf, selectedProduct, details.cashbackUsed, details.installments);
        if (result.success && result.user) {
            updateUser(result.user);
            setPurchaseDetails({ item: selectedProduct, method: 'credit', ...details });
            setShowConfirmation(true);
        } else {
            alert(result.message);
        }
    };
    
    const handleCloseConfirmation = () => {
        setShowConfirmation(false);
        setPurchaseDetails(null);
        setSelectedProduct(null);
        navigate('shop');
    };
    
    const handleGoToInstallmentDetails = (details: any) => {
        setInstallmentDetails(details);
        navigate('pixInstallmentDetails');
    };
    
    const handleConfirmPixInstallment = () => {
        setInstallmentDetails((prev: any) => ({ ...prev, type: 'pix-credit' }));
        navigate('installmentReview');
    };
    
    const handleParcelInvoice = (details: { amount: number; installments: number }) => {
        setInstallmentDetails({ ...details, type: 'invoice' });
        navigate('installmentReview');
    };
    
    const handleConfirmInstallmentReview = () => {
        const isPix = installmentDetails?.type === 'pix-credit';
        setPasswordModalAction({
            title: isPix ? 'Confirmar PIX Parcelado' : 'Confirmar Parcelamento',
            action: isPix ? executePixCreditInstallment : executeInvoiceParcel
        });
        setShowPasswordModal(true);
    };

    const executePixCreditInstallment = async () => {
        if (!installmentDetails) return;
        const result = await performPixCreditInstallment(user.cpf, installmentDetails.amount, installmentDetails.installments);
        if (result.success && result.user) {
            updateUser(result.user);
            navigate('pix');
        } else {
            alert(result.message);
        }
        setInstallmentDetails(null);
    };
    
    const executeInvoiceParcel = async () => {
        if (!installmentDetails) return;
        const result = await parcelCreditCardInvoice(user.cpf, installmentDetails.amount, installmentDetails.installments);
         if (result.success && result.user) {
            updateUser(result.user);
            navigate('cards');
        } else {
            alert(result.message);
        }
        setInstallmentDetails(null);
    };
    
    const handlePayInvoice = () => {
        setPasswordModalAction({
            title: 'Confirmar Pagamento',
            action: executePayInvoice
        });
        setShowPasswordModal(true);
    };
    
    const executePayInvoice = async () => {
        const result = await payCreditCardInvoice(user.cpf);
        if (result.success && result.user && result.transactionId) {
            updateUser(result.user);
            setPaymentReceiptDetails({
                amountPaid: Math.abs(result.user.transactions.find(tx => tx.id === result.transactionId)?.amount || 0),
                date: new Date().toISOString(),
                transactionId: result.transactionId
            });
        } else {
            alert(result.message);
        }
    };

    const renderHome = () => (
        <div className="flex-grow overflow-y-auto no-scrollbar p-4">
            <Header user={user} onNavigateToMenu={() => navigate('profile')} onNavigateToNotifications={() => alert('Notifications coming soon!')} />
            <AccountBalance balance={user.balance} />
            <MainActions onNavigate={(v) => {
                const viewMap: { [key: string]: DashboardView } = {
                    pix: 'pix',
                    pagar: 'pix',
                    cards: 'cards',
                    loans: 'loans',
                    products: 'products',
                    statement: 'statement',
                    newsJournal: 'newsJournal',
                };
                navigate(viewMap[v] || 'home');
            }} />
            <CreditCardInfo creditCard={user.creditCard} onNavigate={() => navigate('cards')} />
            <PromotionalBanner />
            <GuardianBanner />
        </div>
    );

    const renderView = () => {
        switch (view) {
            case 'home': return renderHome();
            case 'cards': return <CardDashboard onBack={() => navigate('home')} onPayInvoice={handlePayInvoice} onParcelInvoice={handleParcelInvoice} onNavigateToAnticipate={() => navigate('anticipateInstallments')} />;
            case 'shop': return <Shop onBack={() => navigate('home')} onProductSelect={handleProductSelect} />;
            case 'invest': return <Investments onBack={() => navigate('home')} />;
            case 'profile': return <Profile />;
            case 'pix': return <Pix currentUser={user} onDataRefresh={() => updateUser({...user})} onBack={() => navigate('home')} isTabRoot onGoToInstallmentDetails={handleGoToInstallmentDetails} />;
            case 'statement': return <Statement onBack={() => navigate('home')} />;
            case 'loans': return <Loans onBack={() => navigate('home')} />;
            case 'newsJournal': return <NewsJournal onBack={() => navigate('home')} />;
            case 'products': return <Products onNavigateToInvestments={() => navigate('invest')} />;
            case 'productPage': return selectedProduct ? <ProductPage product={selectedProduct} onBack={() => navigate('shop')} onPurchase={handlePurchase} /> : renderHome();
            case 'paymentMethods': return <PaymentMethods user={user} item={selectedProduct} onBack={() => navigate('productPage')} onSelectMethod={handleSelectPaymentMethod} />;
            case 'anticipateInstallments': return <AnticipateInstallments onBack={() => navigate('cards')} />;
            case 'pixInstallmentDetails': return installmentDetails ? <PixInstallmentDetails details={installmentDetails} onConfirm={handleConfirmPixInstallment} onBack={() => navigate('pix')} /> : renderHome();
            case 'installmentReview': return installmentDetails ? <InstallmentReview type={installmentDetails.type} user={user} details={installmentDetails} onConfirm={handleConfirmInstallmentReview} onBack={() => navigate(installmentDetails.type === 'pix-credit' ? 'pixInstallmentDetails' : 'cards')} /> : renderHome();
            default: return renderHome();
        }
    };

    return (
        <div className="flex flex-col h-full bg-black text-white relative">
            <div className="flex-grow overflow-hidden">
                 {renderView()}
            </div>
            {['home', 'cards', 'shop', 'invest', 'profile'].includes(view) &&
                <BottomNavBar currentView={view} onNavigate={(v) => navigate(v as DashboardView)} />
            }
            {showInstallmentModal && selectedProduct && (
                <InstallmentModal
                    isOpen={showInstallmentModal}
                    onClose={() => setShowInstallmentModal(false)}
                    item={selectedProduct}
                    user={user}
                    onConfirm={handleConfirmInstallments}
                />
            )}
            {showConfirmation && purchaseDetails && (
                <PurchaseConfirmation details={purchaseDetails} onClose={handleCloseConfirmation} />
            )}
            {showPasswordModal && passwordModalAction && (
                <PasswordModal 
                    title={passwordModalAction.title}
                    onConfirm={() => {
                        passwordModalAction.action();
                        setShowPasswordModal(false);
                    }} 
                    onCancel={() => setShowPasswordModal(false)} 
                />
            )}
            {paymentReceiptDetails && (
                <PaymentReceipt details={paymentReceiptDetails} onClose={() => {
                    setPaymentReceiptDetails(null);
                    navigate('home');
                }} />
            )}
        </div>
    );
};

export default Dashboard;
