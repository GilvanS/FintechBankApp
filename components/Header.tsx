
import React from 'react';

interface HeaderProps {
    userName: string;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ userName, onLogout }) => {
    return (
        <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-md sticky top-0">
            <div>
                <h1 className="text-xl font-bold text-gray-800 dark:text-white">Olá, {userName.split(' ')[0]}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Bem-vindo de volta!</p>
            </div>
            <button onClick={onLogout} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                 <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>
            </button>
        </header>
    );
};

export default Header;
