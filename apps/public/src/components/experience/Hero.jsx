import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { motion } from 'framer-motion';
import GlassSurface from '../ui/GlassSurface';
import './Hero.css';

export default function Hero() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const ctaRef = useRef(null);
  
  const [settings, setSettings] = useState({
    EVENT: { eventName: 'Rangtal Garba Night', eventDate: '17 NOV 2026', location: 'JSPM UNIVERSITY GROUND', organizer: 'JSPM Wagholi Campus' },
    REGISTRATION: { requireCollegeId: true }
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const snap = await getDoc(doc(db, 'eventSettings', 'global'));
        if (snap.exists()) {
          setSettings(prev => ({ ...prev, ...snap.data() }));
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      }
    }
    loadSettings();
  }, []);

  // High-performance 3D Camera Loop
  useEffect(() => {
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const scroll = { y: 0, targetY: 0 };
    let animationFrameId;

    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      mouse.targetX = (e.clientX / innerWidth - 0.5) * 2; // -1 to 1
      mouse.targetY = (e.clientY / innerHeight - 0.5) * 2; // -1 to 1
    };
    
    const handleScroll = () => {
      scroll.targetY = window.scrollY;
    };

    const isMobile = window.matchMedia('(max-width: 768px)').matches || ('ontouchstart' in window);

    // Disable heavy parallax/scroll updates on mobile for rock-solid stability
    if (!isMobile) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    const render = () => {
      // Smooth interpolation (lerp) for buttery camera movement
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;
      scroll.y += (scroll.targetY - scroll.y) * 0.08;

      if (heroRef.current) {
        heroRef.current.style.setProperty('--cam-x', mouse.x.toFixed(4));
        heroRef.current.style.setProperty('--cam-y', mouse.y.toFixed(4));
        heroRef.current.style.setProperty('--scroll-y', scroll.y.toFixed(2));
      }
      
      if (ctaRef.current) {
        // Smooth, gentle physics for the fixed button
        const velocity = scroll.targetY - scroll.y;
        const yOffset = Math.max(-10, Math.min(10, velocity * 0.08));
        const scale = 1 - Math.abs(velocity * 0.0003);
        ctaRef.current.style.transform = `translate(-50%, ${yOffset}px) scale(${Math.max(0.97, scale)})`;
      }
      
      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      <section className="hero-cinematic-container" ref={heroRef} id="experience">
        <div className="scene-volume">
        
        {/* =========================================================
            Z = -600: DEEP BACKGROUND (Sky & Distant Architecture)
        ========================================================= */}
        <div className="scene-layer layer-deep-bg">
          <div className="bg-plate"></div>
          <div className="bg-atmosphere"></div>
        </div>

        {/* =========================================================
            Z = -300: ARCHITECTURE & FESTIVAL LIGHTS
        ========================================================= */}
        <div className="scene-layer layer-architecture">
          <div className="central-mandala"></div>
        </div>

        {/* =========================================================
            Z = -150: FAR CROWD (Silhouettes and blurry dancers)
        ========================================================= */}
        <div className="scene-layer layer-crowd-far">
          <div className="crowd-member c-far-1"></div>
          <div className="crowd-member c-far-2"></div>
          <div className="crowd-member c-far-3"></div>
          <div className="crowd-member c-far-4"></div>
          <div className="crowd-member c-far-5"></div>
          <div className="crowd-member c-far-6"></div>
          <div className="crowd-member c-far-7"></div>
          <div className="crowd-member c-far-8"></div>
        </div>

        {/* =========================================================
            Z = -100: HANGING LANTERNS / FESTIVAL DECOR
        ========================================================= */}
        <div className="scene-layer layer-lanterns">
           <div className="lantern l1"></div>
           <div className="lantern l2"></div>
           <div className="lantern l3"></div>
           <div className="lantern l4"></div>
           <div className="lantern l5"></div>
           <div className="lantern l6"></div>
        </div>

        {/* =========================================================
            Z = -50: NEAR CROWD
        ========================================================= */}
        <div className="scene-layer layer-crowd-near">
          <div className="crowd-member c-near-1"></div>
          <div className="crowd-member c-near-2"></div>
          <div className="crowd-member c-near-3"></div>
          <div className="crowd-member c-near-4"></div>
        </div>

        {/* =========================================================
            Z = 0: PHYSICAL FLOOR 
        ========================================================= */}
        <div className="scene-layer layer-floor">
          <div className="stage-floor"></div>
        </div>

        {/* =========================================================
            Z = 50: HERO DANCERS
        ========================================================= */}
        <div className="scene-layer layer-hero-dancers">
          <div className="hero-dancer hero-dancer-left"></div>
          <div className="hero-dancer hero-dancer-right"></div>
        </div>

        {/* =========================================================
            Z = 120: CENTRAL TYPOGRAPHY & UI
        ========================================================= */}
        <div className="scene-layer layer-ui">
          <div className="hero-content-wrapper">
            
            <div className="hero-top-info">
              {(settings.EVENT?.showStudentBadge ?? true) && (
                <div className="luxury-badge">
                  <span className="badge-icon">✦</span>
                  {settings.EVENT?.studentBadgeText || 'ONLY FOR JSPM STUDENTS'}
                  <span className="badge-icon">✦</span>
                </div>
              )}
              <div className="hero-kicker">THE BIGGEST GARBA MAHOTSAV</div>
            </div>

            <div className="hero-title-container">
              <h1 className="hero-title-main">
                {settings.EVENT?.eventName?.split(' ')[0] || 'Rangtal'}
              </h1>
              <div className="hero-title-secondary">
                {settings.EVENT?.eventName?.split(' ').slice(1).join(' ') || 'Garba Night'}
              </div>
            </div>

            <div className="hero-action-area">
              <div className="luxury-event-info">
                <span className="info-val">
                  {(() => {
                    const dStr = settings.EVENT?.eventDate;
                    if (!dStr) return '17-November - 2026';
                    try {
                      const d = new Date(dStr);
                      if (isNaN(d.getTime())) return dStr;
                      const day = d.getDate();
                      const month = d.toLocaleString('default', { month: 'long' });
                      const year = d.getFullYear();
                      return `${day}-${month} - ${year}`;
                    } catch { return dStr; }
                  })()}
                </span>
                <span className="info-sep">|</span>
                <span className="info-val">{settings.EVENT?.location || 'JSPM UNIVERSITY GROUND'}</span>
              </div>
              <div className="hero-organized-by" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="organized-label">ORGANISED BY</div>
                <div className="organized-val">{settings.EVENT?.organizer || 'JSPM Wagholi Campus'}</div>
              </div>
            </div>

          </div>
        </div>

        {/* =========================================================
            Z = 250: EXTREME FOREGROUND
        ========================================================= */}
        <div className="scene-layer layer-foreground">
          {/* Physical foreground elements (blurred) */}
          <div className="fg-object fg-dandiya-left"></div>
          <div className="fg-object fg-dandiya-right"></div>
          <div className="fg-object fg-petals-bottom"></div>
          
          {/* Subtle lighting/bokeh in foreground */}
          <div className="fg-object fg-lantern-glow-left"></div>
          <div className="fg-object fg-lantern-glow-right"></div>
        </div>

        {/* =========================================================
            Z = 400: FLOATING EMBERS / PARTICLES (Extreme Depth)
        ========================================================= */}
        <div className="scene-layer layer-particles">
           <div className="particle p1"></div>
           <div className="particle p2"></div>
           <div className="particle p3"></div>
           <div className="particle p4"></div>
           <div className="particle p5"></div>
           <div className="particle p6"></div>
           <div className="particle p7"></div>
           <div className="particle p8"></div>
        </div>

      </div>
      
      {/* Static overlay (vignette / fade out) outside the 3D volume */}
      <div className="cinematic-fade-bottom"></div>

      </section>

      {/* Floating Action Button with Physics (Moved OUTSIDE the 3D section to fix position: fixed) */}
      <div className="floating-cta-container" ref={ctaRef}>
        <GlassSurface
          width={320}
          height={70}
          borderRadius={50}
          borderWidth={0.07}
          backgroundOpacity={0.1}
          saturation={1}
          brightness={50}
          opacity={0.93}
          blur={11}
          displace={0.5}
          distortionScale={-180}
          redOffset={0}
          greenOffset={10}
          blueOffset={20}
          mixBlendMode="screen"
        >
          <button 
            className="glass-btn-content"
            onClick={() => navigate('/account')}
          >
            <span>GET YOUR PASS</span>
            <span className="cta-arrow">→</span>
          </button>
        </GlassSurface>
      </div>
    </>
  );
}
