import React, { useEffect } from 'react';
import Hero from '../components/experience/Hero.jsx';
import EventInfo from '../components/experience/EventInfo.jsx';
import Passes from '../components/experience/Passes.jsx';
import CustomCursor from '../components/ui/CustomCursor.jsx';
import '../components/experience/Scenes.css';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function Home() {
  const { scrollY } = useScroll();
  
  // Parallax effects for background layers
  const bg1Y = useTransform(scrollY, [0, 1000], [0, 150]);
  const bg2Y = useTransform(scrollY, [0, 1000], [0, 50]);

  useEffect(() => {
    document.body.classList.add('custom-cursor');
    return () => {
      document.body.classList.remove('custom-cursor');
    };
  }, []);

  return (
    <div className="app-container" style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#050505', color: 'white' }}>
      <CustomCursor />
      
      {/* Background Decor Layer - CSS Depth instead of WebGL */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {/* Glow Effects */}
        <div style={{ position: 'absolute', top: '10%', left: '10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(255, 215, 0, 0.05) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(255, 107, 0, 0.05) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(80px)' }} />

        {/* Parallax Dancers */}
        <motion.img 
          src="/assets/garba_dancers.png" 
          alt="" 
          style={{ position: 'absolute', bottom: '-10%', left: '-5%', height: '80vh', objectFit: 'contain', opacity: 0.15, y: bg1Y }} 
        />
        <motion.img 
          src="/assets/garba_dancers_2.png" 
          alt="" 
          style={{ position: 'absolute', top: '10%', right: '-5%', height: '70vh', objectFit: 'contain', opacity: 0.15, y: bg2Y }} 
        />
      </div>

      {/* Normal scrolling content layer */}
      <main className="content-layer" style={{ position: 'relative', zIndex: 10 }}>
        <Hero />
        <EventInfo />
        <Passes />
      </main>
    </div>
  );
}
