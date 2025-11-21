import React, { createContext, useContext } from 'react';
import { User } from '../types';

export interface AuthContextType {
    user: User | null;
    login: (user: Omit<User, 'password'>) => void;
    logout: () => void;
    updateUser: (user: Partial<Omit<User, 'password'>>) => void;
    view: string;
    navigateTo: (view: string) => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
