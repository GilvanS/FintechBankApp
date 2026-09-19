import { useEffect, useRef } from 'react';

/**
 * Card hover tilt (Transitions.dev)
 *
 * Rastreia o ponteiro no wrapper `.t-tilt` (que nunca se transforma) e escreve
 * quatro custom properties consumidas pelo CSS em styles/global.css:
 *   --tilt-rx / --tilt-ry → rotateX/rotateY do `.t-tilt-card`
 *   --tilt-gx / --tilt-gy → posição do glare (radial-gradients em %)
 * Adiciona `.is-tilting` durante o movimento (follow rápido 1:1) e `.is-hover`
 * para o fade do glare; remove ambas no leave (retorno suave de 1000ms).
 *
 * Toque: ponteiros touch não geram tilt — o arrasto precisa continuar rolando
 * a página (`touch-action: pan-y` no CSS) e o toque usa TAP para virar o cartão.
 */
const MAX_TILT_DEG = 10;

export function useCardTilt<T extends HTMLElement = HTMLDivElement>() {
    const ref = useRef<T | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof window === 'undefined') return;
        // jsdom/ambientes sem matchMedia: pula o guard e segue (só CSS vars + classes)
        if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const setProp = (name: string, value: string) => el.style.setProperty(name, value);

        const handleMove = (e: PointerEvent) => {
            if (e.pointerType === 'touch') return;
            const rect = el.getBoundingClientRect();
            const px = (e.clientX - rect.left) / rect.width; // 0..1
            const py = (e.clientY - rect.top) / rect.height; // 0..1
            setProp('--tilt-rx', `${((0.5 - py) * MAX_TILT_DEG * 2).toFixed(2)}deg`);
            setProp('--tilt-ry', `${((px - 0.5) * MAX_TILT_DEG * 2).toFixed(2)}deg`);
            setProp('--tilt-gx', `${(px * 100).toFixed(1)}%`);
            setProp('--tilt-gy', `${(py * 100).toFixed(1)}%`);
            el.classList.add('is-tilting', 'is-hover');
        };

        const handleLeave = () => {
            el.classList.remove('is-tilting', 'is-hover');
            setProp('--tilt-rx', '0deg');
            setProp('--tilt-ry', '0deg');
        };

        el.addEventListener('pointermove', handleMove);
        el.addEventListener('pointerleave', handleLeave);
        return () => {
            el.removeEventListener('pointermove', handleMove);
            el.removeEventListener('pointerleave', handleLeave);
            handleLeave();
        };
    }, []);

    return ref;
}
