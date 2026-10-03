import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function GarbaCircle() {
  const outerRingRef = useRef();
  const innerRingRef = useRef();
  const dotsRef = useRef();

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (outerRingRef.current) outerRingRef.current.rotation.z = time * 0.1;
    if (innerRingRef.current) innerRingRef.current.rotation.z = -time * 0.15;
    if (dotsRef.current) dotsRef.current.rotation.z = time * 0.05;
  });

  return (
    <group position={[0, 0, -8]}>
      {/* Outer Decorative Ring */}
      <mesh ref={outerRingRef}>
        <torusGeometry args={[6, 0.03, 16, 100]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.6} />
      </mesh>
      
      <mesh ref={innerRingRef}>
        <torusGeometry args={[5.5, 0.01, 16, 100]} />
        <meshStandardMaterial color="#FF9933" emissive="#FF9933" emissiveIntensity={0.8} />
      </mesh>

      {/* Mandala Dots */}
      <group ref={dotsRef}>
        {Array.from({ length: 24 }).map((_, i) => (
          <mesh key={i} position={[
            Math.cos((i / 24) * Math.PI * 2) * 5.75,
            Math.sin((i / 24) * Math.PI * 2) * 5.75,
            0
          ]} rotation={[0, 0, (i / 24) * Math.PI * 2]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#FFF" emissive="#FFF" emissiveIntensity={1} />
          </mesh>
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh key={`inner-${i}`} position={[
            Math.cos((i / 12) * Math.PI * 2) * 5.2,
            Math.sin((i / 12) * Math.PI * 2) * 5.2,
            0
          ]} rotation={[0, 0, (i / 12) * Math.PI * 2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
            <meshStandardMaterial color="#FF6B00" emissive="#FF6B00" emissiveIntensity={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
