import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://192.168.0.103:3001';

const ServerStatus = () => {
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (response.ok) {
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }
    } catch (error) {
      setIsOnline(false);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const openInBrowser = (url) => {
    window.open(url, '_blank');
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg text-white text-sm">
      <p className="font-mono text-xs mb-2">Servidor: {API_BASE_URL}</p>
      <div className="flex items-center mb-4">
        <div className={`w-3 h-3 rounded-full mr-2 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}>
        </div>
        <p>{isLoading ? 'Verificando...' : isOnline ? 'Servidor Online' : 'Servidor fora do ar'}</p>
        <button onClick={checkStatus} className="ml-auto text-blue-400 hover:underline">Re-testar</button>
      </div>
      <div className="flex flex-col space-y-2 text-center">
         <button onClick={() => openInBrowser(`${API_BASE_URL}/health`)} className="text-blue-400 hover:underline">Testar Conexão Health</button>
        <button onClick={() => openInBrowser(`${API_BASE_URL}/api-docs`)} className="text-blue-400 hover:underline">Testar API Docs</button>
      </div>
    </div>
  );
};

export default ServerStatus;
