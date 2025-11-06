import React from 'react';
import { User } from '../types';

interface HeaderProps {
  user: User;
  onNavigateToSettings: () => void;
  onNavigateToNotifications: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onNavigateToSettings, onNavigateToNotifications }) => {
  const notificationCount = user.notifications.filter(n => !n.is_read).length;

  return (
    <header className="bg-orange-500 text-white p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white/30 text-white flex items-center justify-center font-bold text-lg">
            {user.fullName.charAt(0)}
          </div>
          <div>
            <h1 className="font-semibold text-lg">Olá, {user.fullName.split(' ')[0]}</h1>
          </div>
        </div>
        <div className="flex items-center space-x-2">
            <button onClick={onNavigateToNotifications} className="relative p-2 rounded-full hover:bg-white/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {notificationCount > 0 && 
                    <span className="absolute top-1 right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                }
            </button>
            <button onClick={onNavigateToSettings} className="p-2 rounded-full hover:bg-white/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
        </div>
      </div>
       <div className="text-sm">
          Agência: 0001 Conta: {user.cpf.slice(0, 5)}-{user.cpf.slice(5, 6)}
        </div>
    </header>
  );
};

export default Header;