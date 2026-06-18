import React from 'react';

interface ErrorStateProps {
    message?: string;
    onRetry?: () => void;
    className?: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({
    message = 'Algo deu errado. Tente novamente.',
    onRetry,
    className = '',
}) => (
    <div className={`flex flex-col items-center justify-center p-8 gap-4 ${className}`}>
        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        </div>
        <p className="text-white/60 text-sm text-center">{message}</p>
        {onRetry && (
            <button
                onClick={onRetry}
                className="px-4 py-2 bg-primary text-background-dark text-sm font-semibold rounded-lg hover:bg-primary/90"
            >
                Tentar novamente
            </button>
        )}
    </div>
);

export default ErrorState;
