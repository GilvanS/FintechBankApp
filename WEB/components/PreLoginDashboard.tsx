import React from 'react';

interface PreLoginDashboardProps {
    onNavigateToLogin: () => void;
    onNavigateToSignUp: () => void;
}

const PreLoginDashboard: React.FC<PreLoginDashboardProps> = ({ onNavigateToLogin, onNavigateToSignUp }) => {

    const GridItem: React.FC<{ icon: string; label: string; className?: string; onClick: () => void; testId: string; }> = ({ icon, label, className = '', onClick, testId }) => {
        // Criar ID único baseado no testId
        const elementId = testId.replace(/prelogin-action-/, '');
        return (
            <button 
                onClick={onClick} 
                className={`flex flex-col items-center justify-center p-4 rounded-xl bg-surface-dark hover:bg-gray-800 transition-colors duration-200 w-full h-full aspect-square test-action-button ${className}`}
                id={`btn-${elementId}`}
                name={`action-${elementId}`}
                data-testid={testId}
                data-cy={testId}
                data-playwright={testId}
                aria-label={label}
                role="button"
                type="button"
            >
                <span className="material-symbols-outlined text-3xl text-primary mb-2" aria-hidden="true">{icon}</span>
                <span className="text-xs sm:text-sm font-medium text-subtle-dark text-center">{label}</span>
            </button>
        );
    };

    return (
        <div 
            className="text-dark flex flex-col items-center justify-between min-h-full p-4 sm:p-6 lg:p-8 test-prelogin-page"
            id="prelogin-dashboard"
            data-testid="prelogin-dashboard"
            data-cy="prelogin-dashboard"
            data-playwright="prelogin-dashboard"
            role="main"
        >
            <div 
                className="w-full max-w-md mx-auto text-center flex-grow flex flex-col justify-center test-prelogin-content"
                id="prelogin-content"
                data-testid="prelogin-content"
                data-cy="prelogin-content"
            >
                <header className="mb-10 test-prelogin-header" id="prelogin-header" data-testid="prelogin-header">
                    <h1 
                        className="text-2xl font-semibold text-white test-prelogin-greeting" 
                        id="prelogin-greeting"
                        data-testid="prelogin-greeting"
                        data-cy="prelogin-greeting"
                        data-playwright="prelogin-greeting"
                    >
                        Olá!
                    </h1>
                </header>
                <main id="prelogin-main" data-testid="prelogin-main" data-cy="prelogin-main">
                    <div 
                        className="grid grid-cols-3 gap-3 mb-12 test-actions-grid" 
                        id="prelogin-actions-grid"
                        data-testid="prelogin-actions-grid"
                        data-cy="prelogin-actions-grid"
                        data-playwright="prelogin-actions-grid"
                        role="grid" 
                        aria-label="Ações rápidas"
                    >
                        <GridItem 
                            icon="swap_horiz" 
                            label="PIX e transferir" 
                            onClick={onNavigateToLogin} 
                            testId="prelogin-action-pix"
                        />
                        <GridItem 
                            icon="barcode_scanner" 
                            label="Pagar" 
                            onClick={onNavigateToLogin} 
                            testId="prelogin-action-pay"
                        />
                        <GridItem 
                            icon="receipt_long" 
                            label="Extrato" 
                            onClick={onNavigateToLogin} 
                            testId="prelogin-action-statement"
                        />
                        <GridItem 
                            icon="credit_card" 
                            label="Cartões" 
                            className="col-span-2" 
                            onClick={onNavigateToLogin} 
                            testId="prelogin-action-cards"
                        />
                        <GridItem 
                            icon="storefront" 
                            label="Marketplace" 
                            onClick={onNavigateToLogin} 
                            testId="prelogin-action-marketplace"
                        />
                    </div>
                </main>
            </div>
            <div 
                className="w-full max-w-md mx-auto text-center test-prelogin-footer" 
                id="prelogin-footer"
                data-testid="prelogin-footer"
                data-cy="prelogin-footer"
            >
                <div 
                    className="flex flex-col items-center gap-4 test-cta-buttons" 
                    id="prelogin-cta-buttons"
                    data-testid="prelogin-cta-buttons"
                    data-cy="prelogin-cta-buttons"
                    data-playwright="prelogin-cta-buttons"
                >
                    <button
                        onClick={onNavigateToLogin}
                        className="w-full max-w-xs px-8 py-4 font-semibold text-background-dark transition-transform duration-300 transform rounded-lg shadow-lg bg-primary hover:scale-105 hover:shadow-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/50 test-login-button"
                        id="btn-login"
                        name="login-button"
                        data-testid="prelogin-login-button"
                        data-cy="prelogin-login-button"
                        data-playwright="prelogin-login-button"
                        aria-label="Acessar minha conta"
                        role="button"
                        type="button"
                    >
                        Acessar minha conta
                    </button>
                    <button
                        onClick={onNavigateToSignUp}
                        className="w-full max-w-xs px-8 py-3 font-semibold transition-colors duration-300 border border-subtle-dark rounded-lg text-subtle-dark hover:text-primary hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 test-signup-button"
                        id="btn-signup"
                        name="signup-button"
                        data-testid="prelogin-signup-button"
                        data-cy="prelogin-signup-button"
                        data-playwright="prelogin-signup-button"
                        aria-label="Não é cliente? Abra uma conta"
                        role="button"
                        type="button"
                    >
                        Não é cliente? Abra uma conta
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreLoginDashboard;