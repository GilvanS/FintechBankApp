import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ListTodo, RotateCcw, X as CloseIcon } from 'lucide-react';

export interface MassCreationTodoSnapshot {
    fullName: string;
    cardBrand: string;
    dueDay: number;
    adimplente: boolean;
    cycleCount: number;
}

interface Props {
    open: boolean;
    onClose: () => void;
    isMidnight: boolean;
    snapshot: MassCreationTodoSnapshot | null;
}

type TaskStatus = 'pending' | 'in-progress' | 'completed';

interface Task {
    id: string;
    title: string;
    detail: string;
}

const TICKS_PER_TASK = 4;
const TICK_MS = 280;

const buildTasks = (snap: MassCreationTodoSnapshot): Task[] => [
    { id: 'perfil', title: 'Perfil', detail: snap.fullName || '—' },
    { id: 'cartao', title: 'Cartão de Crédito', detail: `${snap.cardBrand} • dia ${snap.dueDay}` },
    { id: 'financeiro', title: 'Financeiro', detail: `${snap.adimplente ? 'Adimplente' : 'Inadimplente'} • ${snap.cycleCount} ciclo${snap.cycleCount === 1 ? '' : 's'}` },
];

const statusAt = (step: number, index: number): TaskStatus => {
    const start = index * TICKS_PER_TASK;
    const end = start + TICKS_PER_TASK;
    if (step >= end) return 'completed';
    if (step >= start) return 'in-progress';
    return 'pending';
};

/** Ícone de status animado: bolinha pontilhada (pending) → anel enchendo (in-progress) →
 * check com "pop" (completed). Mesmo princípio visual do componente de referência
 * (beui.dev todo-list), mas com as cores/pesos do VOLT em vez de emerald/muted genéricos —
 * ver DESIGN.md: volt-green é o único acento no Midnight, preto é o acento no Yellow. */
const TodoStatusIcon: React.FC<{ status: TaskStatus; progress: number; isMidnight: boolean }> = ({ status, progress, isMidnight }) => {
    const accent = isMidnight ? '#00ff9d' /* volt-green */ : '#000000';
    const track = isMidnight ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.25)';
    return (
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 overflow-visible" aria-hidden="true">
            <circle
                cx="12" cy="12" r="9"
                fill="none"
                stroke={track}
                strokeWidth="2"
                strokeDasharray={status === 'pending' ? '2 3' : undefined}
                strokeLinecap="round"
            />
            {status === 'in-progress' && (
                <motion.circle
                    cx="12" cy="12" r="9"
                    pathLength="1"
                    fill="none"
                    stroke={accent}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{ transformOrigin: '12px 12px', rotate: -90 }}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: progress }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                />
            )}
            {status === 'completed' && (
                <>
                    <circle cx="12" cy="12" r="9" fill={accent} />
                    <motion.path
                        d="M7.5 12.25 10.5 15.25 16.75 8.75"
                        fill="none"
                        stroke={isMidnight ? '#000000' : '#FFFFFF'}
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                    />
                </>
            )}
        </svg>
    );
};

/**
 * Preview visual (2026-09-22): mostra, em forma de lista de tarefas animada, os 3 blocos
 * de dados que o Gerador de Massa 4.0 está prestes a gravar (Perfil, Cartão de Crédito,
 * Financeiro). O avanço é SIMULADO por um ticker local (não amarrado à resposta real do
 * POST /admin/... — decisão explícita: "só visual/preview por agora"), tanto no botão
 * dedicado quanto durante o clique real em "Concluir e Criar" (MainMassCreatorFlow abre
 * este sheet nos dois casos com o mesmo snapshot de dados atuais).
 */
export const MassCreationTodoSheet: React.FC<Props> = ({ open, onClose, isMidnight, snapshot }) => {
    const [step, setStep] = useState(0);
    const [runId, setRunId] = useState(0);
    const timerRef = useRef<number | undefined>(undefined);

    const tasks = snapshot ? buildTasks(snapshot) : [];
    const totalSteps = tasks.length * TICKS_PER_TASK;
    const completedCount = tasks.reduce((acc, _t, i) => acc + (statusAt(step, i) === 'completed' ? 1 : 0), 0);

    useEffect(() => {
        if (!open) return;
        setStep(0);
    }, [open, runId]);

    useEffect(() => {
        if (!open || tasks.length === 0) return;
        if (step >= totalSteps) return;
        timerRef.current = window.setTimeout(() => setStep((s) => s + 1), TICK_MS);
        return () => window.clearTimeout(timerRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, step, totalSteps]);

    const sheetClass = isMidnight
        ? 'bg-volt-surface border-t border-white/10 text-white'
        : 'bg-white border-4 border-black border-b-0 text-black';

    const replayBtnClass = isMidnight
        ? 'border border-white/20 bg-white/5 hover:bg-white/10 text-white'
        : 'border-2 border-black bg-white hover:bg-black/5 text-black';

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className={`mt-4 w-full overflow-hidden rounded-xl border ${sheetClass}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                >
                    <div className="p-5 pb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ListTodo className={`size-4 ${isMidnight ? 'text-volt-green' : 'text-black'}`} />
                            <h3 className="flex-1 text-[11px] font-black uppercase tracking-wide opacity-80">
                                Progresso de Geração
                            </h3>
                            <span className="text-xs font-bold tabular-nums opacity-60">{completedCount}/{tasks.length}</span>
                        </div>

                        <ol className="space-y-1">
                            {tasks.map((task, index) => {
                                const status = statusAt(step, index);
                                const localStep = step - index * TICKS_PER_TASK;
                                const progress = status === 'in-progress' ? Math.min(1, (localStep + 1) / TICKS_PER_TASK) : 0;
                                return (
                                    <motion.li
                                        key={task.id}
                                        layout="position"
                                        className="flex items-center gap-2.5 rounded-xl px-1.5 py-2"
                                    >
                                        <TodoStatusIcon status={status} progress={progress} isMidnight={isMidnight} />
                                        <span className={`flex-1 text-sm font-bold ${status === 'pending' ? 'opacity-50' : ''}`}>
                                            {task.title}
                                        </span>
                                        <AnimatePresence>
                                            {status === 'completed' && (
                                                <motion.span
                                                    initial={{ opacity: 0, x: 6 }}
                                                    animate={{ opacity: 0.65, x: 0 }}
                                                    className="text-xs font-mono truncate max-w-[55%] text-right"
                                                >
                                                    {task.detail}
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </motion.li>
                                );
                            })}
                        </ol>

                        <button
                            type="button"
                            onClick={onClose}
                            className={`mt-4 ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold cursor-pointer ${replayBtnClass}`}
                        >
                            <span>Ocultar Progresso</span>
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
