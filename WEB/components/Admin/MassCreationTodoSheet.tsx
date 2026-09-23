import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ListTodo } from 'lucide-react';
import { MassProgressStatus, MassProgressStepId } from '../../types';

export interface MassTodoItem {
    id: MassProgressStepId;
    title: string;
    status: MassProgressStatus;
    detail?: string | null;
}

interface Props {
    open: boolean;
    onClose: () => void;
    isMidnight: boolean;
    title: string;
    items: MassTodoItem[];
}

const VOLT_GREEN = '#00ff9d';
const VOLT_CYAN = '#00E5FF';
const VOLT_PINK = '#FF5C8D';

/** Ícone por status real: pontilhado (pending) → arco girando (running) → check (done),
 * 🏥 (uti — auditoria achou anomalia não-bloqueante) ou X (error). Cores do VOLT:
 * volt-green é o acento do Midnight, preto do Yellow; cyan/pink só como terciárias. */
const TodoStatusIcon: React.FC<{ status: MassProgressStatus; isMidnight: boolean }> = ({ status, isMidnight }) => {
    const reduce = useReducedMotion() ?? false;
    const accent = isMidnight ? VOLT_GREEN : '#000000';
    const track = isMidnight ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.25)';

    if (status === 'uti') {
        return (
            <span
                aria-hidden="true"
                className="grid size-5 shrink-0 place-items-center rounded-full text-[11px] leading-none"
                style={{ boxShadow: `inset 0 0 0 2px ${VOLT_CYAN}` }}
            >
                🏥
            </span>
        );
    }

    return (
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 overflow-visible" aria-hidden="true">
            {status === 'pending' && (
                <circle cx="12" cy="12" r="9" fill="none" stroke={track} strokeWidth="2" strokeDasharray="2 3" strokeLinecap="round" />
            )}
            {status === 'running' && (
                <>
                    <circle cx="12" cy="12" r="9" fill="none" stroke={track} strokeWidth="2" />
                    <motion.circle
                        cx="12" cy="12" r="9"
                        pathLength="1"
                        fill="none"
                        stroke={accent}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray="0.3 0.7"
                        style={{ transformOrigin: '12px 12px' }}
                        animate={reduce ? undefined : { rotate: 360 }}
                        transition={reduce ? undefined : { duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                </>
            )}
            {status === 'done' && (
                <>
                    <circle cx="12" cy="12" r="9" fill={accent} />
                    <motion.path
                        d="M7.5 12.25 10.5 15.25 16.75 8.75"
                        fill="none"
                        stroke={isMidnight ? '#000000' : '#FFFFFF'}
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                    />
                </>
            )}
            {status === 'error' && (
                <>
                    <circle cx="12" cy="12" r="9" fill={VOLT_PINK} />
                    <path d="M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5" fill="none" stroke="#000000" strokeWidth="2.25" strokeLinecap="round" />
                </>
            )}
        </svg>
    );
};

/**
 * Painel de progresso do Gerador de Massa: bloco no fluxo normal da página (empurra o
 * conteúdo pra baixo, sem overlay) listando as etapas REAIS da criação — cadastro,
 * ciclos de fatura, pre-flight audit e validação final — conforme o backend reporta
 * via SSE (mass.progress) e confirma na resposta do POST /admin/users/mass.
 */
export const MassCreationTodoSheet: React.FC<Props> = ({ open, onClose, isMidnight, title, items }) => {
    const total = items.length;
    const concluidas = items.filter((i) => i.status === 'done' || i.status === 'uti').length;
    const falhou = items.some((i) => i.status === 'error');
    const finalizado = !falhou && total > 0 && concluidas === total;
    const header = falhou ? 'Processo Interrompido' : finalizado ? 'Processo Finalizado' : title;

    const cardClass = isMidnight
        ? 'bg-volt-surface border border-white/10 text-white'
        : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black';

    const hideBtnClass = isMidnight
        ? 'border border-white/20 bg-white/5 hover:bg-white/10 text-white'
        : 'border-2 border-black bg-white hover:bg-black/5 text-black';

    return (
        <AnimatePresence initial={false}>
            {open && (
                <motion.section
                    aria-label="Progresso de criação da massa"
                    className={`w-full overflow-hidden rounded-2xl ${cardClass}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                >
                    <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <ListTodo className={`size-4 ${isMidnight ? 'text-volt-green' : 'text-black'}`} />
                            <h3 className="flex-1 text-[11px] font-black uppercase tracking-wide opacity-80">{header}</h3>
                            <span className="text-xs font-bold tabular-nums opacity-60">{concluidas}/{total}</span>
                        </div>

                        <ol aria-live="polite" className="space-y-0.5">
                            {items.map((item, index) => (
                                <li key={item.id} className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5">
                                    <TodoStatusIcon status={item.status} isMidnight={isMidnight} />
                                    <span className={`flex-1 min-w-0 text-sm font-bold truncate ${item.status === 'pending' ? 'opacity-50' : ''}`}>
                                        <span className="opacity-60 tabular-nums">{index + 1}/{total} · </span>
                                        {item.title}
                                    </span>
                                    <AnimatePresence>
                                        {item.detail && item.status !== 'pending' && (
                                            <motion.span
                                                initial={{ opacity: 0, x: 6 }}
                                                animate={{ opacity: 0.7, x: 0 }}
                                                className={`text-xs font-mono truncate max-w-[50%] text-right ${item.status === 'error' ? 'text-[#FF5C8D]' : ''}`}
                                                title={item.detail}
                                            >
                                                {item.detail}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </li>
                            ))}
                        </ol>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold cursor-pointer ${hideBtnClass}`}
                            >
                                Ocultar Progresso
                            </button>
                        </div>
                    </div>
                </motion.section>
            )}
        </AnimatePresence>
    );
};
