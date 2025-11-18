
import React, { useState, useEffect, useCallback } from 'react';
import { getApiBase, healthCheck } from '../services/api';

const ServerStatus: React.FC = () => {
    const [isOnline, setIsOnline] = useState(false);
    const [apiUrl, setApiUrl] = useState(getApiBase());
    const [loading, setLoading] = useState(true);

    const checkStatus = useCallback(async () => {
        setLoading(true);
        const currentApiUrl = getApiBase();
        setApiUrl(currentApiUrl);

        // Se a URL estiver vazia, estamos offline, sem discussão.
        if (!currentApiUrl) {
            setIsOnline(false);
            setLoading(false);
            return;
        }

        const success = await healthCheck();
        setIsOnline(success);
        setLoading(false);
    }, []);

    useEffect(() => {
        // Roda a verificação inicial
        checkStatus();

        // Adiciona um listener para o evento 'storage' que é disparado na tela de login
        // quando o IP é salvo. Isso força a re-verificação.
        const handleStorageChange = () => {
            checkStatus();
        };
        window.addEventListener('storage', handleStorageChange);

        // Limpa o listener quando o componente é desmontado
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [checkStatus]);

    const statusBg = loading ? 'bg-yellow-500' : isOnline ? 'bg-green-500' : 'bg-red-500';
    const statusText = loading ? 'Verificando...' : isOnline ? 'Online' : 'Offline';

    return (
        <div className="flex items-center justify-between w-full text-sm text-gray-300">
            <div className="flex items-center">
                <span className={`h-3 w-3 rounded-full mr-2 ${statusBg}`}></span>
                <span className="mr-2">Servidor:</span>
                <span className="font-mono text-gray-400 truncate" style={{maxWidth: '150px'}}>{apiUrl || 'N/A'}</span>
            </div>
            <button 
                onClick={checkStatus} 
                disabled={loading}
                className="text-emerald-400 hover:underline disabled:opacity-50 disabled:cursor-wait"
            >
                Re-testar
            </button>
        </div>
    );
};

export default ServerStatus;
