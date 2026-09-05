import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';

interface SpinningIcosahedronProps {
  color: string;
}

/** Single decorative wireframe mesh — DESIGN.md forbids full-screen 3D scenes/AI-slop, this is one discreet accent, not a hero backdrop. */
const SpinningIcosahedron: React.FC<SpinningIcosahedronProps> = ({ color }) => {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.15;
      meshRef.current.rotation.y += delta * 0.25;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1.3, 0]} />
      <meshBasicMaterial color={color} wireframe />
    </mesh>
  );
};

interface Props {
  theme: 'yellow' | 'midnight';
  size?: number;
}

/** Decorative header accent for the Analytics view. Transparent background, no lighting setup needed (wireframe basic material). */
const Hero3D: React.FC<Props> = ({ theme, size = 96 }) => {
  const color = theme === 'midnight' ? '#00ff9d' : '#000000';
  return (
    <div style={{ width: size, height: size }} aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 3.2] }} gl={{ alpha: true }}>
        <SpinningIcosahedron color={color} />
      </Canvas>
    </div>
  );
};

export default Hero3D;
