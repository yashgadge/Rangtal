import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export default function EventPass() {
  const passRef = useRef();

  useFrame((state) => {
    if (passRef.current) {
      passRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1;
      passRef.current.rotation.x = THREE.MathUtils.lerp(passRef.current.rotation.x, (state.pointer.y * Math.PI) / 10, 0.1);
      passRef.current.rotation.y = THREE.MathUtils.lerp(passRef.current.rotation.y, (state.pointer.x * Math.PI) / 10, 0.1);
    }
  });

  return (
    <group ref={passRef} position={[0, 0, 0]}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[2, 3, 0.05]} />
        <meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[1.9, 2.9]} />
        <meshBasicMaterial color="#D4AF37" wireframe />
      </mesh>

      <Text position={[0, 1, 0.04]} fontSize={0.3} color="#D4AF37" anchorX="center" anchorY="middle">
        RANGTAL
      </Text>
      
      <Text position={[0, 0.6, 0.04]} fontSize={0.15} color="#FF9933" anchorX="center" anchorY="middle">
        VIP PASS
      </Text>

      <mesh position={[0, -0.5, 0.03]}>
        <circleGeometry args={[0.3, 32]} />
        <meshBasicMaterial color="#FF6B00" wireframe />
      </mesh>
    </group>
  );
}
