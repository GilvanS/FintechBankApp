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
      className="font-display bg-volt-yellow text-black antialiased min-h-screen flex flex-col items-center justify-between p-4 sm:p-6 lg:p-8 pb-24 safe-bottom"
      data-testid="prelogin-screen"
      id="prelogin-screen"
    >
      <header 
        className="w-full max-w-md flex justify-between items-center mb-10 pt-4"
        data-testid="prelogin-header"
        id="prelogin-header"
      >
        <h1 
          className="text-2xl font-semibold text-black"
          data-testid="prelogin-title"
          id="prelogin-title"
          aria-label="Olá!"
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
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/70 border border-black/20"
            data-testid="prelogin-feature-pix"
            id="prelogin-feature-pix"
            aria-label="PIX e transferir"
          >
            <span 
                className="material-symbols-outlined text-3xl text-black mb-2" 
                aria-hidden="true"
                style={{ 
                    fontFamily: "'Material Symbols Outlined', 'Roboto', sans-serif",
                    fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                }}
            >
                swap_horiz
            </span>
            <span className="text-xs sm:text-sm font-medium text-black">PIX e transferir</span>
          </div>
          <div 
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/70 border border-black/20"
            data-testid="prelogin-feature-pay"
            id="prelogin-feature-pay"
            aria-label="Pagar"
          >
            <span 
                className="material-symbols-outlined text-3xl text-black mb-2" 
                aria-hidden="true"
                style={{ 
                    fontFamily: "'Material Symbols Outlined', 'Roboto', sans-serif",
                    fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                }}
            >
                barcode_scanner
            </span>
            <span className="text-xs sm:text-sm font-medium text-black">Pagar</span>
          </div>
          <div 
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/70 border border-black/20"
            data-testid="prelogin-feature-statement"
            id="prelogin-feature-statement"
            aria-label="Extrato"
          >
            <span 
                className="material-symbols-outlined text-3xl text-black mb-2" 
                aria-hidden="true"
                style={{ 
                    fontFamily: "'Material Symbols Outlined', 'Roboto', sans-serif",
                    fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                }}
            >
                receipt_long
            </span>
            <span className="text-xs sm:text-sm font-medium text-black">Extrato</span>
          </div>
          <div 
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/70 border border-black/20 col-span-2"
            data-testid="prelogin-feature-cards"
            id="prelogin-feature-cards"
            aria-label="Cartões"
          >
            <span className="material-symbols-outlined text-3xl text-black mb-2" aria-hidden="true">credit_card</span>
            <span className="text-xs sm:text-sm font-medium text-black">Cartões</span>
          </div>
          <div 
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/70 border border-black/20"
            data-testid="prelogin-feature-marketplace"
            id="prelogin-feature-marketplace"
            aria-label="Marketplace"
          >
            <span className="material-symbols-outlined text-3xl text-black mb-2" aria-hidden="true">storefront</span>
            <span className="text-xs sm:text-sm font-medium text-black">Marketplace</span>
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
          className="w-full max-w-xs px-8 py-4 font-semibold text-black transition-transform duration-300 transform rounded-lg shadow-lg bg-volt-lime border-2 border-black hover:scale-105 hover:shadow-black/40 focus:outline-none focus:ring-4 focus:ring-black/30 mb-4"
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
          className="w-full max-w-xs px-8 py-3 font-semibold transition-colors duration-300 border border-black/60 rounded-lg text-black hover:text-black hover:border-black focus:outline-none focus:ring-2 focus:ring-black/30"
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
