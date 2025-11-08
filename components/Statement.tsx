
import React, { useState } from 'react';
import { useAuth } from '../App';
import { Transaction } from '../types';
import AccountInfo from './AccountInfo';
import PixReceipt from './PixReceipt';

interface StatementProps {
  onBack: () => void;
}

const Statement: React.FC<StatementProps> = ({ onBack }) => {
  const { user } = useAuth();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  if (!user) return null;
  
  if (selectedTransaction) {
    return <PixReceipt transaction={selectedTransaction} onBack={() => setSelectedTransaction(null)} />
  }

  const groupedTransactions: { [key: string]: Transaction[] } = user.transactions.reduce((acc, tx) => {
    const date = new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(tx);
    return acc;
  }, {} as { [key: string]: Transaction[] });


  return (
    <div className="bg-black text-white p-4 min-h-full flex flex-col">
      <header className="flex items-center mb-6">
        <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-800">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h1 className="text-2xl font-bold">Extrato da Conta</h1>
      </header>
      
      <div className="px-4 mb-6">
         <AccountInfo balance={user.balance} />
      </div>

      <main className="flex-grow overflow-y-auto no-scrollbar">
        {Object.entries(groupedTransactions).map(([date, transactions]) => (
          <div key={date}>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider py-3 px-4">{date}</h2>
            <ul className="space-y-1">
              {transactions.map(tx => (
                <li key={tx.id}>
                  <button onClick={() => setSelectedTransaction(tx)} className="w-full flex items-center p-4 rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors">
                    <div className="flex-grow text-left">
                      <p className="font-semibold text-md text-white">{tx.description}</p>
                      <p className="text-sm text-gray-400">{tx.type === 'PIX_SENT' ? `Para: ${tx.recipientName || tx.to}` : (tx.type === 'PIX_RECEIVED' ? `De: ${tx.senderName || tx.from}` : 'Operação na conta')}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold text-lg ${tx.amount > 0 ? 'text-green-400' : 'text-white'}`}>
                        {tx.amount < 0 ? '-' : ''} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(tx.amount))}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
         {user.transactions.length === 0 && (
            <p className="text-center text-gray-500 py-10">Nenhuma transação ainda.</p>
        )}
      </main>
    </div>
  );
};

export default Statement;
