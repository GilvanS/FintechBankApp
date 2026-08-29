import { ArrowRightLeft, ScanBarcode, ReceiptText, CreditCard, Store } from 'lucide-react';
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
      className="font-display bg-zinc-950 text-white antialiased min-h-screen flex flex-col items-center justify-between p-4 sm:p-6 lg:p-8 pb-24 safe-bottom"
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
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900/80 border-2 border-zinc-800 shadow-lg hover:border-[#A2FF00]/50 transition-all"
            data-testid="prelogin-feature-pix"
            id="prelogin-feature-pix"
            aria-label="PIX e transferir"
          >
            <ArrowRightLeft size={32} className="text-[#A2FF00] mb-2 stroke-[2.5]" />
            <span className="text-xs sm:text-sm font-black text-white tracking-wide">PIX e transferir</span>
          </div>
          <div 
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900/80 border-2 border-zinc-800 shadow-lg hover:border-[#A2FF00]/50 transition-all"
            data-testid="prelogin-feature-pay"
            id="prelogin-feature-pay"
            aria-label="Pagar"
          >
            <ScanBarcode size={32} className="text-[#A2FF00] mb-2 stroke-[2.5]" />
            <span className="text-xs sm:text-sm font-black text-white tracking-wide">Pagar</span>
          </div>
          <div 
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900/80 border-2 border-zinc-800 shadow-lg hover:border-[#A2FF00]/50 transition-all"
            data-testid="prelogin-feature-statement"
            id="prelogin-feature-statement"
            aria-label="Extrato"
          >
            <ReceiptText size={32} className="text-[#A2FF00] mb-2 stroke-[2.5]" />
            <span className="text-xs sm:text-sm font-black text-white tracking-wide">Extrato</span>
          </div>
          <div 
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900/80 border-2 border-zinc-800 shadow-lg hover:border-[#A2FF00]/50 transition-all col-span-2"
            data-testid="prelogin-feature-cards"
            id="prelogin-feature-cards"
            aria-label="Cartões"
          >
            <CreditCard size={32} className="text-[#A2FF00] mb-2 stroke-[2.5]" />
            <span className="text-xs sm:text-sm font-black text-white tracking-wide">Cartões</span>
          </div>
          <div 
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900/80 border-2 border-zinc-800 shadow-lg hover:border-[#A2FF00]/50 transition-all"
            data-testid="prelogin-feature-marketplace"
            id="prelogin-feature-marketplace"
            aria-label="Marketplace"
          >
            <Store size={32} className="text-[#A2FF00] mb-2 stroke-[2.5]" />
            <span className="text-xs sm:text-sm font-black text-white tracking-wide">Marketplace</span>
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
          className="w-full max-w-xs px-8 py-4 font-black text-black text-sm uppercase tracking-wider bg-[#00ff9d] hover:bg-[#00e38b] rounded-2xl shadow-[0_0_25px_rgba(0,255,157,0.5)] border-2 border-[#00ff9d] active:scale-95 transition-all mb-4 cursor-pointer"
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
          className="w-full max-w-xs px-8 py-3.5 font-bold text-white text-xs uppercase tracking-wider bg-zinc-900 border-2 border-zinc-700 hover:border-zinc-500 rounded-2xl active:scale-95 transition-all cursor-pointer"
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
