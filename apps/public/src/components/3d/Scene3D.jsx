import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Particles from './Particles.jsx';
import GarbaCircle from './GarbaCircle.jsx';

export default function Scene3D() {
  const groupRef = useRef();

  useFrame((state) => {
    if (groupRef.current) {
      // Subtle constant rotation instead of scroll-linked
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <>
      <color attach="background" args={['#050505']} />
      <ambientLight intensity={0.2} color="#FF9933" />
      <pointLight position={[0, 0, 0]} intensity={1} color="#D4AF37" distance={20} />
      
      <spotLight position={[5, 5, 5]} angle={0.3} penumbra={1} intensity={2} color="#FF6B00" castShadow />
      <spotLight position={[-5, -5, -5]} angle={0.3} penumbra={1} intensity={1} color="#800000" />
      
      <group ref={groupRef}>
        <Particles count={2000} />
        <GarbaCircle />
      </group>
    </>
  );
}
