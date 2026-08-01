import React from 'react';

interface AuditResultCardProps {
    auditResult: any;
    isMidnight: boolean;
    innerCardClass: string;
}

const AuditResultCard: React.FC<AuditResultCardProps> = ({ auditResult, isMidnight, innerCardClass }) => {
    if (!auditResult?.success || !(auditResult?.summary || auditResult?.consistency)) {
        return null;
    }

    return (
        <div className={`w-full max-w-sm p-4 rounded-xl text-left text-xs leading-relaxed ${innerCardClass}`}>
            {/* Consistência — suporta ambos os formatos: auditConsistency (summary) e auditFull (consistency) */}
            {(() => {
                const s = auditResult.summary || auditResult.consistency;
                if (!s) return null;
                return (
                    <div className="space-y-1 mb-3">
                        <p className="font-semibold text-[11px] uppercase tracking-wider opacity-70">📐 Consistência</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <p>Escaneados: <strong>{s.totalScanned ?? '—'}</strong></p>
                            <p>✅ Consistentes: <strong className="text-emerald-500">{s.usersConsistent ?? '—'}</strong></p>
                            <p>⚠️ Desatualizados: <strong className={(s.usersDesatualizados || 0) > 0 ? 'text-red-500' : ''}>{s.usersDesatualizados ?? '—'}</strong></p>
                            <p>Invoices: <strong>{s.invoicesConsistent ?? '—'}/{s.totalInvoices ?? '—'}</strong></p>
                        </div>
                        {((auditResult.details?.length || auditResult.consistency?.details?.length || 0) > 0) && (
                            <div className="mt-1 max-h-20 overflow-y-auto">
                                {(auditResult.details || auditResult.consistency?.details || []).slice(0, 5).map((d: any, i: number) => (
                                    <p key={i} className="text-red-400 text-[10px]">
                                        {d.cpf} | userDO={d.userDaysOverdue ?? d.userDaysOverdue} x real={d.realTimeDays} | diff={d.diffUser}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })()}

            {auditResult.summary?.totalUsers !== undefined && (
                <div className="space-y-1 pt-2 border-t border-dashed border-black/10 dark:border-white/10">
                    <p className="font-semibold text-[11px] uppercase tracking-wider opacity-70">🧾 Auditoria de Encargos</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <p>Total massas: <strong>{auditResult.summary.totalUsers}</strong></p>
                        <p>✅ Consistentes: <strong className="text-emerald-500">{auditResult.summary.consistent}</strong></p>
                        <p>⚠️ Divergentes: <strong className={(auditResult.summary.divergent || 0) > 0 ? 'text-red-500' : ''}>{auditResult.summary.divergent}</strong></p>
                        <p>Sem fatura: <strong>{auditResult.summary.noInvoice}</strong></p>
                    </div>
                    {auditResult.hasDivergence && (auditResult.details || []).filter((d: any) => d.divergence).length > 0 && (
                        <div className="mt-1 max-h-24 overflow-y-auto">
                            {(auditResult.details || []).filter((d: any) => d.divergence).slice(0, 5).map((d: any, i: number) => (
                                <p key={i} className="text-red-400 text-[10px]">
                                    {d.cpf} | comp=({d.computed.multa.toFixed(2)}/{d.computed.total.toFixed(2)}) vs armz=({d.stored.multa.toFixed(2)}/{d.stored.total.toFixed(2)}) | Δ R$ {d.diff.total.toFixed(2)}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {auditResult.payments && (
                <div className="space-y-1 pt-2 border-t border-dashed border-black/10 dark:border-white/10">
                    <p className="font-semibold text-[11px] uppercase tracking-wider opacity-70">💳 Pagamentos</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <p>Double-Count: <strong>{(auditResult.payments?.doubleCount?.discrepancies ?? 0) > 0
                            ? <span className="text-red-500">{auditResult.payments.doubleCount.discrepancies} ⚠️</span>
                            : <span className="text-emerald-500">0 ✅</span>}
                        </strong></p>
                        <p>Saldo Negativo: <strong>{(auditResult.payments?.negativeBalance?.issues ?? 0) > 0
                            ? <span className="text-red-500">{auditResult.payments.negativeBalance.issues} ⚠️</span>
                            : <span className="text-emerald-500">0 ✅</span>}
                        </strong></p>
                        {auditResult.payments?.negativeBalance?.totalExcess != null && auditResult.payments.negativeBalance.totalExcess > 0 && (
                            <p className="col-span-2">Excesso total: <strong className="text-red-500">R$ {auditResult.payments.negativeBalance.totalExcess.toFixed(2)}</strong></p>
                        )}
                    </div>
                </div>
            )}

            {(auditResult.tip || ((auditResult.consistency?.details || []).length > 0) || (auditResult.details?.length > 0 && auditResult.hasDivergence)) && (
                <p className={`mt-2 italic text-[10px] ${isMidnight ? 'text-white/40' : 'text-black/40'}`}>
                    {auditResult.tip || 'Discrepâncias encontradas. Execute os scripts da pasta scripts/ para corrigir.'}
                </p>
            )}
        </div>
    );
};

export default AuditResultCard;
