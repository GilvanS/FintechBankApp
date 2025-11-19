}

const AnticipateInstallments: React.FC<AnticipateInstallmentsProps> = ({ onBack, onConfirmAnticipation, isProcessing }) => {
    const { user } = useAuth();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const installmentTransactions = useMemo(() => {
        if (!user) return [];
        return user.creditCard.transactions.filter(tx => tx.installments && tx.type === 'CREDIT');
    }, [user]);

    const handleToggle = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const selectedTransactions = useMemo(() => {
        return installmentTransactions.filter(tx => selectedIds.includes(tx.id));
    }, [selectedIds, installmentTransactions]);

    const { totalOriginal, discount, totalFinal } = useMemo(() => {
        const totalOriginal = selectedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
        const discount = totalOriginal * 0.05; // 5% discount
        const totalFinal = totalOriginal - discount;
        return { totalOriginal, discount, totalFinal };
    }, [selectedTransactions]);
    
    if (!user) return null;

    const canAfford = user.balance >= totalFinal;

    return (
        <div className="bg-background-dark text-white min-h-full flex flex-col">
            <header className="flex items-center p-4">
                <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="text-xl font-bold text-white">Antecipar Parcelas</h2>
            </header>

            {installmentTransactions.length > 0 ? (
                <>
                    <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-4">
                        <p className="text-sm text-gray-400">Selecione as parcelas que deseja antecipar para ganhar descontos. O pagamento será debitado do seu saldo em conta.</p>
                        <div className="space-y-2">
                            {installmentTransactions.map(tx => (
                                <label key={tx.id} htmlFor={`tx-${tx.id}`} className={`block p-3 rounded-lg border-2 transition-colors cursor-pointer ${selectedIds.includes(tx.id) ? 'bg-primary/20 border-primary' : 'bg-surface-dark border-transparent'}`}>
                                    <div className="flex items-center">
                                        <input
                                            id={`tx-${tx.id}`}
                                            type="checkbox"
                                            checked={selectedIds.includes(tx.id)}
                                            onChange={() => handleToggle(tx.id)}
                                            className="h-5 w-5 rounded bg-background-dark border-subtle-dark text-primary focus:ring-primary"
                                        />
                                        <div className="ml-3 flex-grow">
                                            <p className="font-semibold text-white">{tx.merchant}</p>
                                            <p className="text-xs text-gray-400">Parcela {tx.installments}</p>
                                        </div>
                                        <p className="font-semibold text-white">{tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </main>

                    <footer className="p-4 border-t border-subtle-dark/50 space-y-3">
                         {selectedIds.length > 0 && (
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-gray-400">Valor original</span> <span className="text-white">{totalOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">Desconto (5%)</span> <span className="text-primary">{discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                                <div className="flex justify-between font-bold text-base"><span className="text-gray-300">Total a pagar</span> <span className="text-white">{totalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                                {!canAfford && <p className="text-red-400 text-xs text-center pt-2">Saldo em conta insuficiente.</p>}
                            </div>
                        )}
                        <button
                            onClick={() => onConfirmAnticipation(selectedIds)}
                            disabled={isProcessing || selectedIds.length === 0 || !canAfford}
                            className="w-full py-3 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isProcessing ? 'Processando...' : `Antecipar ${selectedIds.length} Parcela(s)`}
                        </button>
                    </footer>
                </>
            ) : (
                <main className="flex-grow flex flex-col items-center justify-center text-center p-4">
                    <span className="material-symbols-outlined text-6xl text-gray-600 mb-4">event_repeat</span>
                    <h3 className="text-lg font-semibold text-white">Nenhuma parcela futura</h3>
                    <p className="text-gray-400">Você não tem compras parceladas na sua fatura atual.</p>
                </main>
            )}
        </div>
    );
};

export default AnticipateInstallments;
