import React, { useMemo } from 'react';

/**
 * Matrix dot loader — Transitions.dev
 *
 * Grade 4×4 de pontinhos que pulsam numa onda de cor compartilhada. O JS
 * constrói os 16 <i> e entrega a cada um um delay --d (ms) que define a
 * posição na fase — a variante é só uma tabela de delays:
 *
 *   scan:    col × cycle/10 (onda varre coluna a coluna)
 *   twinkle: ordem embaralhada × cycle/16
 *   orbit:   anel [1,2,7,11,14,13,8,4] × cycle/8 (centro fixo)
 *   pulse:   centro [5,6,9,10] primeiro, resto cycle*0.16 atrás
 *
 * Rounded: cantos [0,3,12,15] viram .is-gap (não renderizam nada).
 * Cores via --matrix-base/--matrix-active (ver global.css) — o painel
 * Admin sobrescreve por tema. aria-hidden: é textura, não dado.
 */

type Variant = 'scan' | 'twinkle' | 'orbit' | 'pulse';

const CYCLE = 1200; // ms — precisa casar com --matrix-cycle em global.css

const DELAYS: Record<Variant, number[]> = {
    scan: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => (i % 4) * (CYCLE / 10)),
    twinkle: [7, 2, 11, 5, 14, 9, 0, 12, 3, 15, 6, 10, 13, 1, 8, 4].map((d) => d * (CYCLE / 16)),
    orbit: [1, 2, 7, 11, 14, 13, 8, 4].map((d) => d * (CYCLE / 8)),
    pulse: [5, 6, 9, 10, 0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 14, 15].map((d, i) =>
        i < 4 ? 0 : CYCLE * 0.16
    ),
};

// Cantos da grade 4×4 (rounded variants)
const CORNERS = [0, 3, 12, 15];

interface Props {
    /** Tabela de delays que define o padrão da onda. Padrão: scan (como na referência). */
    variant?: Variant;
    /** Vira os 4 cantos em buracos (silhueta arredondada). */
    rounded?: boolean;
    /** Escala — multiplica o tamanho do ponto/gap. Padrão 1 (grade ≈ 14×14px). */
    scale?: number;
    className?: string;
    style?: React.CSSProperties;
}

const MatrixDotLoader: React.FC<Props> = ({
    variant = 'scan',
    rounded = false,
    scale = 1,
    className = '',
    style,
}) => {
    const dots = useMemo(
        () =>
            Array.from({ length: 16 }, (_, i) => {
                const isGap = rounded && CORNERS.includes(i);
                const delay = DELAYS[variant][i] ?? 0;
                return (
                    <i
                        key={i}
                        className={isGap ? 'is-gap' : undefined}
                        style={{ ['--d' as string]: delay }}
                    />
                );
            }),
        [variant, rounded]
    );

    return (
        <div
            className={`t-matrix ${className}`}
            data-variant={variant}
            aria-hidden="true"
            style={{
                gridTemplateColumns: `repeat(4, ${2 * scale}px)`,
                gridAutoRows: `${2 * scale}px`,
                gap: `${2 * scale}px`,
                ...style,
            }}
        >
            {dots}
        </div>
    );
};

export default React.memo(MatrixDotLoader);
