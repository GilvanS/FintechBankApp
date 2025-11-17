
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const ServerStatus: React.FC = () => {
    const [isServerOnline, setIsServerOnline] = useState(false);
    const [loading, setLoading] = useState(true);
    const apiUrl = import.meta.env.VITE_API_BASE_URL;

    const checkServerStatus = useCallback(async () => {
        setLoading(true);
        try {
            await api.get('/health');
            setIsServerOnline(true);
        } catch (error) {
            setIsServerOnline(false);
            console.error("Health check failed:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkServerStatus();
    }, [checkServerStatus]);

    const statusColor = isServerOnline ? 'text-green-400' : 'text-red-400';
    const statusText = isServerOnline ? 'Online' : 'Offline';

    return (
        <div className="bg-gray-800 p-3 rounded-lg text-center my-4 text-sm text-gray-300">
            <p className="mb-2">
                <span className="font-semibold">Servidor:</span> {apiUrl || 'N/A'}
            </p>
            <div className="flex items-center justify-center">
                <span className={`h-3 w-3 rounded-full mr-2 ${isServerOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className={statusColor}>{statusText}</span>
                {!loading && (
                    <button onClick={checkServerStatus} className="ml-4 text-primary hover:underline text-xs">
                        Re-testar
                    </button>
                )}
            </div>
        </div>
    );
};

export default ServerStatus;
