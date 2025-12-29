import React from 'react';
import './PreLoginDashboard.css';

// Define a interface de props para aceitar a função de navegação
interface PreLoginDashboardProps {
  onNavigateToLogin: () => void;
  onNavigateToSignUp: () => void;
}

const PreLoginDashboard: React.FC<PreLoginDashboardProps> = ({ onNavigateToLogin, onNavigateToSignUp }) => {
  // Remove o uso do useHistory, que não se aplica aqui

  return (
    <div 
      className="font-display bg-background-dark text-text-dark antialiased min-h-screen flex flex-col items-center justify-between p-4 sm:p-6 lg:p-8 pb-24 safe-bottom"
      data-testid="prelogin-screen"
      id="prelogin-screen"
    >
      <header 
        className="w-full max-w-md flex justify-between items-center mb-10 pt-4"
        data-testid="prelogin-header"
        id="prelogin-header"
      >
        <h1 
          className="text-2xl font-semibold text-text-dark"
          data-testid="prelogin-title"
          id="prelogin-title"
        >
          Olá!
        </h1>
      </header>

      <main 
        className="w-full max-w-md flex-grow flex flex-col justify-center"
        data-testid="prelogin-main"
        id="prelogin-main"
      >
        <div 
          className="grid grid-cols-3 gap-3 mb-12"
          data-testid="prelogin-features-grid"
        >
          <div 
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface-dark/50 opacity-50"
            data-testid="prelogin-feature-pix"
          >
            <span className="material-symbols-outlined text-3xl text-primary mb-2" aria-hidden="true">swap_horiz</span>
            <span className="text-xs sm:text-sm font-medium text-text-dark">PIX e transferir</span>
          </div>
          <div 
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface-dark/50 opacity-50"
            data-testid="prelogin-feature-pay"
          >
            <span className="material-symbols-outlined text-3xl text-primary mb-2" aria-hidden="true">barcode_scanner</span>
            <span className="text-xs sm:text-sm font-medium text-text-dark">Pagar</span>
          </div>
          <div 
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface-dark/50 opacity-50"
            data-testid="prelogin-feature-statement"
          >
            <span className="material-symbols-outlined text-3xl text-primary mb-2" aria-hidden="true">receipt_long</span>
            <span className="text-xs sm:text-sm font-medium text-text-dark">Extrato</span>
          </div>
          <div 
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface-dark/50 opacity-50 col-span-2"
            data-testid="prelogin-feature-cards"
          >
            <span className="material-symbols-outlined text-3xl text-primary mb-2" aria-hidden="true">credit_card</span>
            <span className="text-xs sm:text-sm font-medium text-text-dark">Cartões</span>
          </div>
          <div 
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface-dark/50 opacity-50"
            data-testid="prelogin-feature-marketplace"
          >
            <span className="material-symbols-outlined text-3xl text-primary mb-2" aria-hidden="true">storefront</span>
            <span className="text-xs sm:text-sm font-medium text-text-dark">Marketplace</span>
          </div>
        </div>
      </main>
      
      <footer 
        className="w-full max-w-md text-center"
        data-testid="prelogin-footer"
        id="prelogin-footer"
      >
        <button 
          onClick={onNavigateToLogin} 
          className="w-full max-w-xs px-8 py-4 font-semibold text-white transition-transform duration-300 transform rounded-lg shadow-lg bg-primary hover:scale-105 hover:shadow-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/50 mb-4"
          data-testid="prelogin-login-button"
          id="btn-prelogin-login"
          name="btn-prelogin-login"
          aria-label="Entre na conta"
          title="Entre na conta - Botão para fazer login"
        >
          Entre na conta
        </button>
        <button 
          onClick={onNavigateToSignUp} 
          className="w-full max-w-xs px-8 py-3 font-semibold transition-colors duration-300 border border-subtle-dark/50 rounded-lg text-subtle-dark hover:text-primary hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          data-testid="prelogin-signup-button"
          id="btn-prelogin-signup"
          name="btn-prelogin-signup"
          aria-label="Não é cliente? Abra uma conta"
          title="Não é cliente? Abra uma conta - Botão para criar nova conta"
        >
          Não é cliente? Abra uma conta
        </button>
      </footer>
    </div>
  );
};

export default PreLoginDashboard;
