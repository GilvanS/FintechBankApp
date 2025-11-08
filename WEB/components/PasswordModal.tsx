import React, { useState } from 'react';

interface PasswordModalProps {
    title: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ title, onConfirm, onCancel }) => {
    const [pressedSequence, setPressedSequence] = useState<string[]>([]);
    const [error, setError] = useState('');

    const handleKeyPress = (buttonId: string) => {
        setError('');
        if (pressedSequence.length < 4) {
            setPressedSequence(prev => [...prev, buttonId]);
        }
    };

    const handleDelete = () => {
        setError('');
        setPressedSequence(prev => prev.slice(0, -1));
    };

    const handleConfirm = () => {
        // PIN 9898 corresponds to this sequence of button presses:
        // '9' is on button 'B4' ("4 ou 9")
        // '8' is on button 'B1' ("1 ou 8")
        const correctSequence = ['B4', 'B1', 'B4', 'B1'];
        
        const isCorrect = pressedSequence.length === correctSequence.length &&
                          pressedSequence.every((value, index) => value === correctSequence[index]);

        if (isCorrect) {
            onConfirm();
        } else {
            setError('Senha incorreta. Tente novamente.');
            setPressedSequence([]);
        }
    };

    const pinDots = Array(4).fill(0).map((_, i) => (
        <div key={i} className={`w-4 h-4 rounded-full transition-colors ${i < pressedSequence.length ? 'bg-orange-400' : 'bg-gray-600'}`}></div>
    ));

    const KeyButton: React.FC<{ value: string, double?: boolean, onClick: () => void }> = ({ value, double = false, onClick }) => (
        <button onClick={onClick} className={`rounded-lg h-14 flex items-center justify-center font-semibold text-2xl transition-colors ${double ? 'text-lg' : ''} text-white bg-gray-700/50 hover:bg-gray-700`}>
            {value}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-end sm:items-center justify-center z-50 animate-fade-in">
            <div className="bg-gray-900 w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-6 flex flex-col items-center">
                <button onClick={onCancel} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
                <p className="text-sm text-gray-400">senha eletrônica</p>

                <div className="my-6 flex space-x-4">
                    {pinDots}
                </div>
                {error && <p className="text-sm text-red-400 mb-4 h-5">{error}</p>}
                {!error && <div className="h-5 mb-4"></div>}
                
                <div className="w-full grid grid-cols-3 gap-3">
                    <KeyButton value="1 ou 8" double onClick={() => handleKeyPress('B1')} />
                    <KeyButton value="2 ou 7" double onClick={() => handleKeyPress('B2')} />
                    <KeyButton value="3 ou 6" double onClick={() => handleKeyPress('B3')} />
                    <KeyButton value="4 ou 9" double onClick={() => handleKeyPress('B4')} />
                    <KeyButton value="5 ou 0" double onClick={() => handleKeyPress('B5')} />
                    <button onClick={handleDelete} className="rounded-lg h-14 flex items-center justify-center text-white bg-gray-700/50 hover:bg-gray-700">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 002.828 0L21 9.828a2 2 0 000-2.828l-2.828-2.828a2 2 0 00-2.828 0L3 12z" /></svg>
                    </button>
                </div>

                <button onClick={handleConfirm} disabled={pressedSequence.length !== 4} className="w-full mt-6 py-4 font-semibold text-black bg-orange-500 rounded-lg hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed">
                    acessar
                </button>
            </div>
             <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default PasswordModal;