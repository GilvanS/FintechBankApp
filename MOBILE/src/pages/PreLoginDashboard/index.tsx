import React from 'react';
import './PreLoginDashboard.css';

// Define a interface de props para aceitar a função de navegação
interface PreLoginDashboardProps {
  onNavigateToLogin: () => void;
}

const PreLoginDashboard: React.FC<PreLoginDashboardProps> = ({ onNavigateToLogin }) => {
  // Remove o uso do useHistory, que não se aplica aqui

  return (
    <div className="font-display bg-background-dark text-text-dark antialiased">
      <div className="flex flex-col items-center justify-between min-h-screen p-4 sm:p-6 lg:p-8 pb-24 safe-bottom">
        
        {/* Header com Olá e Engrenagem */}
        <div className="w-full max-w-md mx-auto flex justify-between items-center mb-10 pt-4">
          <h1 className="text-2xl font-semibold text-text-dark">
            Olá!
          </h1>
          {/* O botão de configurações agora também chama a função de navegação para o login */}
          <button onClick={onNavigateToLogin} className="text-subtle-dark hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-3xl">settings</span>
          </button>
        </div>

        {/* Conteúdo Principal Centralizado */}
        <div className="w-full max-w-md mx-auto flex-grow flex flex-col justify-center">
          <main>
            <div className="grid grid-cols-3 gap-3 mb-12">
              {/* Ícones de ação - podem ser desativados ou ter navegação própria se necessário */}
              <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface-dark/50 opacity-50">
                <span className="material-symbols-outlined text-3xl text-primary mb-2">swap_horiz</span>
                <span className="text-xs sm:text-sm font-medium text-text-dark">PIX e transferir</span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface-dark/50 opacity-50">
                <span className="material-symbols-outlined text-3xl text-primary mb-2">barcode_scanner</span>
                <span className="text-xs sm:text-sm font-medium text-text-dark">Pagar</span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface-dark/50 opacity-50">
                <span className="material-symbols-outlined text-3xl text-primary mb-2">receipt_long</span>
                <span className="text-xs sm:text-sm font-medium text-text-dark">Extrato</span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface-dark/50 opacity-50 col-span-2">
                <span className="material-symbols-outlined text-3xl text-primary mb-2">credit_card</span>
                <span className="text-xs sm:text-sm font-medium text-text-dark">Cartões</span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface-dark/50 opacity-50">
                <span className="material-symbols-outlined text-3xl text-primary mb-2">storefront</span>
                <span className="text-xs sm:text-sm font-medium text-text-dark">Marketplace</span>
              </div>
            </div>
          </main>
        </div>
        
        {/* Botões Inferiores */}
        <div className="w-full max-w-md mx-auto text-center">
          <div className="flex flex-col items-center gap-4">
            {/* O botão principal de login agora usa a prop onNavigateToLogin */}
            <button onClick={onNavigateToLogin} className="w-full max-w-xs px-8 py-4 font-semibold text-white transition-transform duration-300 transform rounded-lg shadow-lg bg-primary hover:scale-105 hover:shadow-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/50">
              Entre na conta
            </button>
            {/* O botão de abrir conta pode ter sua própria função de navegação no futuro */}
            <button className="w-full max-w-xs px-8 py-3 font-semibold transition-colors duration-300 border border-subtle-dark/50 rounded-lg text-subtle-dark hover:text-primary hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50">
              Não é cliente? Abra uma conta
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PreLoginDashboard;
