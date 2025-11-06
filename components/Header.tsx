
import React from 'react';
import { User } from '../types';

interface HeaderProps {
  user: User;
  onNavigateToSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onNavigateToSettings }) => {
  return (
    <header className="bg-black text-white p-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
            <svg className="w-6 h-6 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
            </svg>
            <span className="font-bold text-xl tracking-wider">Fintech</span>
        </div>
        <div className="flex items-center space-x-4">
            <button className="relative p-1 rounded-full text-gray-300 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </button>
            <span className="text-gray-500">AJUDA</span>
        </div>
      </div>
      <div className="flex justify-between items-center">
         <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold text-lg">
                {user.fullName.charAt(0)}
            </div>
            <h1 className="font-semibold text-lg">{user.fullName.split(' ')[0].toUpperCase()}</h1>
        </div>
        <button onClick={onNavigateToSettings} className="p-2 rounded-full text-gray-300 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
      </div>
    </header>
  );
};

export default Header;