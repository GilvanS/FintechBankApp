
import React from 'react';

const PreLoginNewsBanner: React.FC = () => {
    return (
        <div className="bg-gray-900 rounded-2xl p-4 flex items-center space-x-4">
            <div className="text-3xl">🎉</div>
            <div>
                <h3 className="text-sm font-bold text-white">Bem-vindo ao Novo App!</h3>
                <p className="text-xs text-gray-400">Uma experiência totalmente nova para você.</p>
            </div>
        </div>
    );
};

export default PreLoginNewsBanner;
