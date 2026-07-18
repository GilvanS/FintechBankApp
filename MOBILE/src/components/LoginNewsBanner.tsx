import React from 'react';

const LoginNewsBanner: React.FC = () => {
    return (
        <div className="bg-white/80 border border-black/30 rounded-2xl p-4 flex items-center space-x-4">
            <div className="text-3xl">🛡️</div>
            <div>
                <h3 className="text-sm font-bold text-black">Segurança Reforçada</h3>
                <p className="text-xs text-black/60">Implementamos novas camadas de proteção.</p>
            </div>
        </div>
    );
};

export default LoginNewsBanner;
