import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

/**
 * Hook para animar modais e popups com GSAP.
 * Anima o overlay (fade in) e o container da caixa (escala + mola + slide up).
 */
export function useModalAnimation(isOpen: boolean) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useGSAP(() => {
        if (!isOpen) return;

        // Animação do backdrop
        if (overlayRef.current) {
            gsap.fromTo(
                overlayRef.current,
                { opacity: 0 },
                { opacity: 1, duration: 0.25, ease: 'power2.out' }
            );
        }

        // Animação da caixa do popup (efeito pop + mola)
        if (contentRef.current) {
            gsap.fromTo(
                contentRef.current,
                { scale: 0.85, opacity: 0, y: 16 },
                { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.7)' }
            );
        }
    }, [isOpen]);

    return { overlayRef, contentRef };
}

/**
 * Hook para botões de funcionalidade.
 * Aplica feedback tátil (espressão no clique, leve elevação no hover).
 */
export function useButtonAnimation() {
    const buttonRef = useRef<HTMLButtonElement>(null);

    const { contextSafe } = useGSAP({ scope: buttonRef });

    const handleMouseEnter = contextSafe(() => {
        if (buttonRef.current) {
            gsap.to(buttonRef.current, { scale: 1.03, duration: 0.15, ease: 'power1.out' });
        }
    });

    const handleMouseLeave = contextSafe(() => {
        if (buttonRef.current) {
            gsap.to(buttonRef.current, { scale: 1, duration: 0.15, ease: 'power1.out' });
        }
    });

    const handleMouseDown = contextSafe(() => {
        if (buttonRef.current) {
            gsap.to(buttonRef.current, { scale: 0.95, duration: 0.08, ease: 'power1.in' });
        }
    });

    const handleMouseUp = contextSafe(() => {
        if (buttonRef.current) {
            gsap.to(buttonRef.current, { scale: 1.03, duration: 0.1, ease: 'power1.out' });
        }
    });

    return {
        buttonRef,
        buttonProps: {
            onMouseEnter: handleMouseEnter,
            onMouseLeave: handleMouseLeave,
            onMouseDown: handleMouseDown,
            onMouseUp: handleMouseUp,
        },
    };
}
