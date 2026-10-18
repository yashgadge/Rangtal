import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Hero from '../components/experience/Hero.jsx';
import EventInfo from '../components/experience/EventInfo.jsx';
import Passes from '../components/experience/Passes.jsx';
import '../components/experience/Scenes.css';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function Home() {
  const { scrollY } = useScroll();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate('/account');
      }
    });
    return () => unsubscribe();
  }, [navigate]);
  
  // Parallax effects for background layers
  const bg1Y = useTransform(scrollY, [0, 1000], [0, 150]);
  const bg2Y = useTransform(scrollY, [0, 1000], [0, 50]);

  return (
    <div className="app-container" style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#1A050B', color: 'white' }}>
      
      {/* Background Decor Layer - Subtle Ambient Glows */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {/* Ambient Glow Effects to support the maroon theme */}
        <div style={{ position: 'absolute', top: '10%', left: '10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(210, 80, 0, 0.03) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(128, 0, 0, 0.05) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(80px)' }} />
      </div>

      {/* Normal scrolling content layer */}
      <main className="content-layer" style={{ position: 'relative', zIndex: 10, backgroundColor: '#1A050B' }}>
        <Hero />
        <EventInfo />
        <Passes />
      </main>
    </div>
  );
}
