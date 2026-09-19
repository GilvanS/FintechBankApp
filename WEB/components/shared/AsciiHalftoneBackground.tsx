import React, { useEffect, useRef } from 'react';
import { applyAsciiHalftone } from '../../utils/ditherEffects';

interface Props {
    className?: string;
    style?: React.CSSProperties;
    /** Tamanho do "pixel" ASCII em px — controlável ao vivo (menor = mais denso). */
    cellSize?: number;
    /** Cor de fundo (tema dark por padrão). */
    bg?: string;
    /** Cor dos caracteres ASCII. */
    color?: string;
    /** URL/object-URL opcional: aplica o dither ASCII sobre essa imagem (cover-fit) em vez do campo procedural animado. */
    imageSrc?: string;
}

/**
 * Fundo animado ASCII/Halftone (reaproveita utils/ditherEffects.ts, já usado
 * em AnalyticsView) — desenha um glow radial "respirando" em escala de cinza
 * e converte pra caracteres via applyAsciiHalftone a cada frame (~15fps,
 * suficiente pro efeito, poupa CPU). Com imageSrc, desenha a imagem (cover)
 * em vez do glow e aplica o mesmo dither por cima.
 */
export default function AsciiHalftoneBackground({ className, style, cellSize = 8, bg = '#131313', color = '#00ff9d', imageSrc }: Props) {
    const rootRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        if (!imageSrc) {
            imgRef.current = null;
            return;
        }
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (!cancelled) imgRef.current = img;
        };
        img.src = imageSrc;
        return () => {
            cancelled = true;
        };
    }, [imageSrc]);

    useEffect(() => {
        const root = rootRef.current;
        const canvas = canvasRef.current;
        if (!root || !canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let raf = 0;
        let lastDraw = 0;
        const FRAME_MS = 1000 / 15; // 15fps já é suficiente pro efeito, poupa CPU

        // O canvas roda numa resolução interna PEQUENA e fixa, sempre — o
        // dither já reduz tudo a blocos, então desenhar + rodar
        // getImageData/fillText do applyAsciiHalftone na resolução real da
        // tela (antes: largura/altura * até 2x DPR, podendo passar de 3000px
        // num desktop) era caro à toa e deixava a navegação lenta. O CSS
        // (width/height: 100% no elemento) estica esse buffer pequeno pra
        // preencher o container de qualquer tamanho, sem custo extra.
        const MAX_DIM = 400;
        const resize = () => {
            const rw = root.clientWidth || 1;
            const rh = root.clientHeight || 1;
            const aspect = rw / rh;
            const w = aspect >= 1 ? MAX_DIM : Math.max(1, Math.round(MAX_DIM * aspect));
            const h = aspect >= 1 ? Math.max(1, Math.round(MAX_DIM / aspect)) : MAX_DIM;
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
        };

        const drawGlowField = (w: number, h: number, t: number) => {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            const cx = w * (0.5 + 0.15 * Math.sin(t * 0.6));
            const cy = h * (0.55 + 0.1 * Math.cos(t * 0.4));
            const r = Math.max(w, h) * (reduceMotion ? 0.6 : 0.55 + 0.08 * Math.sin(t * 0.9));
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.35, '#8a8a8a');
            grad.addColorStop(1, '#000000');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        };

        const drawImageField = (w: number, h: number) => {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            const img = imgRef.current;
            if (!img || !img.naturalWidth) return;
            const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
            const iw = img.naturalWidth * scale;
            const ih = img.naturalHeight * scale;
            ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
        };

        const render = (now: number) => {
            raf = requestAnimationFrame(render);
            if (lastDraw !== 0 && now - lastDraw < FRAME_MS) return;
            lastDraw = now;

            resize();
            const w = canvas.width;
            const h = canvas.height;
            if (w < 2 || h < 2) return;

            if (imageSrc) {
                drawImageField(w, h);
            } else {
                drawGlowField(w, h, now / 1000);
            }
            applyAsciiHalftone(ctx, w, h, { cellSize, bg, color });
        };

        raf = requestAnimationFrame(render);
        return () => cancelAnimationFrame(raf);
    }, [cellSize, bg, color, imageSrc]);

    return (
        <div ref={rootRef} className={className} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
            <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }} />
        </div>
    );
}
