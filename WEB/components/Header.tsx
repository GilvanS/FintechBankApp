import React from 'react';
// FIX: Corrected import path for User type from parent directory.
import { User } from '../types';

interface HeaderProps {
  user: User;
  onNavigateToMenu: () => void;
  onNavigateToNotifications: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onNavigateToMenu, onNavigateToNotifications }) => {
  return (
    <header className="bg-volt-yellow px-4 pt-6 pb-4 flex justify-between items-center">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-black text-volt-yellow flex items-center justify-center font-black text-lg border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {user.fullName.charAt(0)}
        </div>
        <div>
            <span className="text-xs font-bold text-black/60 uppercase tracking-widest">Olá,</span>
            <h1 className="font-black text-lg leading-tight text-black" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{user.fullName.split(' ')[0]}</h1>
        </div>
      </div>
      <div className="flex items-center space-x-2">
          <button onClick={onNavigateToNotifications} className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-volt-yellow border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:opacity-80 transition-opacity">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </button>
      </div>
    </header>
  );
};

export default Header;