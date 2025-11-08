import React from 'react';
import { User } from '../types';

interface HeaderProps {
  user: User;
  onNavigateToMenu: () => void;
  onNavigateToNotifications: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onNavigateToMenu, onNavigateToNotifications }) => {
  return (
    <header className="bg-black text-white p-4 flex justify-between items-center">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold text-lg">
            {user.fullName.charAt(0)}
        </div>
        <div>
            <span className="text-sm text-gray-400">Olá,</span>
            <h1 className="font-bold text-lg leading-tight">{user.fullName.split(' ')[0]}</h1>
        </div>
      </div>
      <div className="flex items-center space-x-2">
          <button className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </button>
          <button onClick={onNavigateToNotifications} className="relative p-2 rounded-full text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </button>
      </div>
    </header>
  );
};

export default Header;