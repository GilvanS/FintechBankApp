import React, { useState } from 'react';
import { User } from '../types';

interface PointsDashboardProps {
  user: User;
  onBack: () => void;
}

type PointsView = 'earn' | 'redeem';

const PointsDashboard: React.FC<PointsDashboardProps> = ({ user, onBack }) => {
  const [view, setView] = useState<PointsView>('redeem');

  const RedemptionOption: React.FC<{icon: React.ReactNode, title: string, description: string}> = ({ icon, title, description }) => (
    <button className="w-full flex items-center p-4 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors text-left space-x-4">
        <div className="flex-shrink-0 w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center">
           {icon}
        </div>
        <div className="flex-grow">
            <p className="font-bold text-white">{title}</p>
            <p className="text-sm text-gray-400">{description}</p>
        </div>
        <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
    </button>
  );

  const iconClasses = "w-6 h-6 text-orange-400";

  return (
    <div className="bg-black text-white min-h-full flex flex-col">
      <header className="flex items-center p-4">
          <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-gray-800">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
        <div className="text-center flex-grow">
            <h2 className="text-lg font-bold text-white">Fintech Loop</h2>
        </div>
        <div className="w-10">
             <button className="p-2 rounded-full hover:bg-gray-800">
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4c0-1.105.448-2.099 1.172-2.828M12 12V9.75M12 15.75V15.75M12 21a9 9 0 100-18 9 9 0 000 18z" /></svg>
             </button>
        </div>
      </header>

      <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-6">
        <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
            </div>
            <div>
                <p className="font-bold text-orange-400">Cartão Black</p>
                <p className="text-2xl font-bold text-white">{user.creditCard.pointsBalance.toLocaleString('pt-BR')} pontos</p>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
            <button 
                onClick={() => setView('earn')}
                className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${view === 'earn' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-white'}`}
            >
                Ganhar pontos
            </button>
            <button 
                onClick={() => setView('redeem')}
                className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${view === 'redeem' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-white'}`}
            >
                Resgatar
            </button>
        </div>

        {/* Tab Content */}
        {view === 'earn' && (
            <div className="space-y-4 animate-fade-in">
                <p className="text-gray-300">Acumule pontos pagando sua fatura com débito automático ativo. Os pontos serão creditados em até 10 dias úteis, após a data de vencimento da fatura.</p>
                <div className="bg-gray-900 rounded-lg p-4 text-center font-bold text-white">
                    Você ganha 1 ponto a cada R$ 2,50
                </div>
                 <div className="bg-gray-800 rounded-lg p-4 flex items-center space-x-4">
                    <img src="https://i.imgur.com/2sfh1cS.png" alt="Coin" className="w-16 h-16" />
                    <div className="flex-grow">
                        <p className="font-bold text-white">Débito Automático</p>
                        <p className="text-sm text-gray-400">Ative o Débito Automático da fatura para ganhar pontos no Fintech Loop.</p>
                    </div>
                    <button className="px-4 py-2 bg-orange-500 text-black font-bold text-sm rounded-lg hover:bg-orange-600">Ativar agora</button>
                </div>
            </div>
        )}

        {view === 'redeem' && (
            <div className="space-y-3 animate-fade-in">
                <RedemptionOption icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>} title="Cashback extra Inter Shop" description="Compre pelo Super App e ganhe mais dinheiro de volta. Mínimo 200 pontos." />
                <RedemptionOption icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z"/></svg>} title="Cashback na conta" description="Ganhe dinheiro de volta direto na conta corrente. Mínimo 200 pontos." />
                <RedemptionOption icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>} title="Cashback na fatura" description="Receba um desconto na sua próxima fatura do cartão. Mínimo 200 pontos." />
                <RedemptionOption icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>} title="Pontos TudoAzul" description="Transfira seus pontos para o programa da Azul Linhas Aéreas. Mínimo 5.000 pontos." />
                <RedemptionOption icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>} title="Meu Porquinho" description="Troque seus pontos por investimentos." />
            </div>
        )}
      </main>
      <style>{`
         @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default PointsDashboard;
