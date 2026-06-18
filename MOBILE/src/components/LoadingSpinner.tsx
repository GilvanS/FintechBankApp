import React from 'react';

interface LoadingSpinnerProps {
    message?: string;
    className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Carregando...', className = '' }) => (
    <div className={`flex flex-col items-center justify-center p-8 gap-3 ${className}`}>
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        {message && <p className="text-white/60 text-sm">{message}</p>}
    </div>
);

export default LoadingSpinner;
