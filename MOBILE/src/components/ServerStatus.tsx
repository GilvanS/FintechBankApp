
import React, { useState, useEffect, useCallback } from 'react';
import { healthCheck } from '../services/api';

const ServerStatus: React.FC = () => {
    const [isOnline, setIsOnline] = useState(false);
    const [loading, setLoading] = useState(true);

    const checkStatus = useCallback(async () => {
        setLoading(true);
        const success = await healthCheck();
        setIsOnline(success);
        setLoading(false);
    }, []);

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 30000); // Re-verifica a cada 30 segundos

        return () => clearInterval(interval);
    }, [checkStatus]);

    const statusBg = loading ? 'bg-yellow-500' : isOnline ? 'bg-green-500' : 'bg-red-500';
    const statusText = loading ? 'Verificando...' : isOnline ? 'Online' : 'Offline';

    return (
        <div className="flex items-center justify-center w-full text-sm text-gray-300 py-1">
            <div className="flex items-center">
                <span className={`h-2 w-2 rounded-full mr-2 ${statusBg}`}></span>
                <span className="mr-1">Servidor:</span>
                <span className="font-medium text-gray-400">{statusText}</span>
            </div>
        </div>
    );
};

export default ServerStatus;
