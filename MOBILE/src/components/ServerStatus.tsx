import React, { useState, useEffect, useCallback } from 'react';

// A função getApiBase é importada do serviço de API principal.
import { getApiBase } from '../services/api';

const ServerStatus: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('');

  const checkStatus = useCallback(async () => {
    setStatus('loading');
    const currentApiBase = getApiBase();
    setApiBaseUrl(currentApiBase);
    try {
      // Usamos o endpoint /health que criamos no backend
      const response = await fetch(`${currentApiBase}/health`, {
          method: 'GET',
          headers: {
              'Accept': 'application/json',
          }
      });
      // response.ok verifica se o status http é 2xx
      if (response.ok) {
        setStatus('online');
      } else {
        setStatus('offline');
      }
    } catch (error) {
      // Qualquer erro de rede (CORS, servidor offline, etc) resulta em offline
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkStatus();
    // Re-testar automaticamente quando o IP customizado muda
    const handler = () => checkStatus();
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [checkStatus]);

  const StatusIndicator: React.FC = () => {
    const baseClasses = "w-3 h-3 rounded-full mr-2";
    if (status === 'loading') {
      return <div className={`${baseClasses} bg-gray-400 animate-pulse`}></div>;
    }
    if (status === 'online') {
      return <div className={`${baseClasses} bg-green-500`}></div>;
    }
    return <div className={`${baseClasses} bg-red-500`}></div>;
  };

  const StatusText: React.FC = () => {
    const textClasses = "text-gray-700";
    if (status === 'loading') {
      return <p className={textClasses}>Verificando...</p>;
    }
    if (status === 'online') {
      return <p className={textClasses}>Servidor Online</p>;
    }
    return <p className={textClasses}>Servidor fora do ar</p>;
  };
  
  return (
    <div className="bg-gray-100 p-3 rounded-lg w-full text-sm font-sans">
      <p className="text-gray-500 text-xs mb-2">Servidor: {apiBaseUrl}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <StatusIndicator />
          <StatusText />
        </div>
        <button onClick={checkStatus} className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold">
          Re-testar
        </button>
      </div>
    </div>
  );
};

export default ServerStatus;
