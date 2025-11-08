import React, { useState, useEffect } from 'react';

interface InfoPopupProps {
  sessionKey: string;
  title: string;
  children: React.ReactNode;
  buttonText: string;
}

const InfoPopup: React.FC<InfoPopupProps> = ({ sessionKey, title, children, buttonText }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if the popup has been shown in the current session
    if (!sessionStorage.getItem(sessionKey)) {
      // Delay appearance slightly for better UX
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [sessionKey]);

  const handleClose = () => {
    // Mark as shown for this session and hide
    sessionStorage.setItem(sessionKey, 'true');
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 bg-gray-800 text-white rounded-xl p-4 shadow-2xl z-20 animate-slide-up-fade">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-md">{title}</h3>
        <button onClick={handleClose} className="text-sm font-semibold text-green-400 hover:text-green-300">
          Fechar
        </button>
      </div>
      <div className="text-sm text-gray-300 mb-4">
        {children}
      </div>
      <button onClick={handleClose} className="w-full py-2.5 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500 transition-colors">
        {buttonText}
      </button>
      <style>{`
        @keyframes slide-up-fade {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up-fade {
            animation: slide-up-fade 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default InfoPopup;