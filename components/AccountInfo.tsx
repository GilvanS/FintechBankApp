import React, { useState } from 'react';
import { User } from '../types';

interface AccountInfoProps {
    user: User;
    onBack?: () => void; // Make onBack optional for preview usage
}

const AccountInfo: React.FC<AccountInfoProps> = ({ user, onBack }) => {
    const [isVisible, setIsVisible] = useState(true);

    const formattedBalance = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(user.balance);

    const isPreview = !onBack;

    if (isPreview) {
        return (
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-md font-semibold text-gray-800">Saldo em conta</h2>
                    <button onClick={() => setIsVisible(!isVisible)} className="text-gray-400">
                        {isVisible ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a10.05 10.05 0 015.313-6.494m4.23-1.031a10.034 10.034 0 015.494 6.494M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" /></svg>
                        )}
                    </button>
                </div>
                <p className={`text-2xl font-bold mt-1 text-gray-900 transition-all duration-300 ${!isVisible ? 'blur-md' : ''}`}>
                    {isVisible ? formattedBalance : 'R$ ••••••'}
                </p>
            </div>
        )
    }

  return (
    <div className="bg-white p-4 min-h-full">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-100">
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
        </button>
        <h2 className="text-2xl font-bold text-gray-800">Minha Conta</h2>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-500">Nome Completo</p>
          <p className="font-semibold text-gray-800">{user.fullName}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">CPF</p>
          <p className="font-semibold text-gray-800">{user.cpf}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">E-mail</p>
          <p className="font-semibold text-gray-800">{user.email}</p>
        </div>
      </div>
    </div>
  );
};

export default AccountInfo;