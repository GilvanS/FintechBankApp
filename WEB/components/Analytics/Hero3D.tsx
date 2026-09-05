import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';

interface SpinningIcosahedronProps {
  color: string;
  spin: boolean;
}

/** Single decorative wireframe mesh — DESIGN.md forbids full-screen 3D scenes/AI-slop, this is one discreet accent, not a hero backdrop. */
const SpinningIcosahedron: React.FC<SpinningIcosahedronProps> = ({ color, spin }) => {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (!spin || !meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.15;
    meshRef.current.rotation.y += delta * 0.25;
  });

  return (
    <mesh ref={meshRef} rotation={[0.4, 0.6, 0]}>
      <icosahedronGeometry args={[1.3, 0]} />
      <meshBasicMaterial color={color} wireframe />
    </mesh>
  );
};

const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
};

interface Props {
  theme: 'yellow' | 'midnight';
  size?: number;
}

/**
 * Decorative header accent for the Analytics view. Transparent background, no lighting setup
 * needed (wireframe basic material). Purely decorative (aria-hidden, no pointer events) — respects
 * prefers-reduced-motion by freezing the render loop instead of animating a static frame.
 */
const Hero3D: React.FC<Props> = ({ theme, size = 96 }) => {
  const color = theme === 'midnight' ? '#00ff9d' : '#000000';
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div style={{ width: size, height: size, pointerEvents: 'none' }} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 3.2] }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        dpr={[1, 2]}
        frameloop={prefersReducedMotion ? 'demand' : 'always'}
      >
        <SpinningIcosahedron color={color} spin={!prefersReducedMotion} />
      </Canvas>
    </div>
  );
};

export default React.memo(Hero3D);
