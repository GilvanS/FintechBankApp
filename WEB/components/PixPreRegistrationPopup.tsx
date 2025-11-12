import React from 'react';
import { useToast, ToastContainer } from './Toast';

interface PixPreRegistrationPopupProps {
    onClose: () => void;
}

const PixPreRegistrationPopup: React.FC<PixPreRegistrationPopupProps> = ({ onClose }) => {
    const { toast, showInfo, hide } = useToast();

    const handleClose = () => {
        showInfo('Pre-cadastro PIX indisponivel no momento');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md text-center">
                <h2 className="text-2xl font-bold mb-4 text-white">Pré-Cadastro PIX</h2>
                <p className="text-gray-300 mb-6">Funcionalidade em desenvolvimento.</p>
                <button onClick={handleClose} className="px-4 py-2 text-white bg-orange-600 rounded-md hover:bg-orange-700">Fechar</button>
            </div>
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default PixPreRegistrationPopup;
