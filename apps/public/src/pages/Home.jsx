import React, { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Preload } from '@react-three/drei';

import Hero from '../components/experience/Hero.jsx';
import EventInfo from '../components/experience/EventInfo.jsx';
import Passes from '../components/experience/Passes.jsx';
import Scene3D from '../components/3d/Scene3D.jsx';
import CustomCursor from '../components/ui/CustomCursor.jsx';
import '../components/experience/Scenes.css';

export default function Home() {
  useEffect(() => {
    document.body.classList.add('custom-cursor');
    return () => {
      document.body.classList.remove('custom-cursor');
    };
  }, []);

  return (
    <div className="app-container">
      <CustomCursor />
      
      {/* Background Decor Layer */}
      <img src="/assets/garba_dancers.png" alt="" className="bg-dancer-1" />
      <img src="/assets/garba_dancers_2.png" alt="" className="bg-dancer-2" />

      {/* Global Background 3D */}
      <div className="canvas-container">
        <Canvas camera={{ position: [0, 0, 10], fov: 45 }} dpr={[1, 2]}>
          <Scene3D />
          <Preload all />
        </Canvas>
      </div>

      {/* Normal scrolling content layer */}
      <main className="content-layer">
        <Hero />
        <EventInfo />
        <Passes />
      </main>
    </div>
  );
}
