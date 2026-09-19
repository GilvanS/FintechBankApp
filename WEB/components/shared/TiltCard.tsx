import React from 'react';
import { useCardTilt } from '../../hooks/useCardTilt';

interface TiltCardProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * Wrapper do efeito Card hover tilt (Transitions.dev).
 *
 * Estrutura: `<div class="t-tilt">` (hit-area plana, rastreia o ponteiro e
 * nunca se transforma) → `<div class="t-tilt-card">` (o elemento que inclina
 * via --tilt-rx/--tilt-ry) → conteúdo + `<div class="t-tilt-glare">` (brilho
 * seguindo o cursor via --tilt-gx/--tilt-gy). CSS em styles/global.css.
 *
 * Touch: o tilt só reage a mouse/pen (hook ignora pointerType touch) e
 * `touch-action: pan-y` mantém o scroll da página funcionando — em telas de
 * toque o cartão vira via tap, sem sequestrar o gesto.
 */
export const TiltCard: React.FC<TiltCardProps> = ({ children, className = '', style }) => {
    const tiltRef = useCardTilt<HTMLDivElement>();

    return (
        <div ref={tiltRef} className={`t-tilt ${className}`} style={style}>
            <div className="t-tilt-card">
                {children}
                <div className="t-tilt-glare" />
            </div>
        </div>
    );
};

export default React.memo(TiltCard);
