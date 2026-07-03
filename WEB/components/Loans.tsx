import React from 'react';

interface LoansProps {
    onBack: () => void;
}

const Loans: React.FC<LoansProps> = ({ onBack }) => {
    return (
        <div className="bg-volt-dark text-white p-4 min-h-full">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-white/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h1 className="text-2xl font-bold">Empréstimos</h1>
            </div>
            <div className="bg-volt-surface rounded-3xl text-center py-16 px-6">
                <div className="text-6xl mb-4">💰</div>
                <h3 className="text-xl font-bold text-white">Crédito para você</h3>
                <p className="text-on-surface-variant mt-2">
                    Em breve, você poderá simular e contratar empréstimos pelo app.
                </p>
            </div>
        </div>
    );
};

export default Loans;