import React, { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useNavigate } from 'react-router-dom';
import EventPass from '../3d/EventPass.jsx';
import './Scenes.css';

gsap.registerPlugin(ScrollTrigger);

const DandiyaIcon = () => (
  <div className="dandiya-wrapper">
    <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="dandiya-icon">
      <path d="M25 75 L75 25" stroke="url(#goldGradient)" strokeWidth="8" strokeLinecap="round" />
      <path d="M25 25 L75 75" stroke="url(#goldGradient)" strokeWidth="8" strokeLinecap="round" />
      <circle cx="25" cy="75" r="6" fill="#FF6B00" />
      <circle cx="75" cy="25" r="6" fill="#FF6B00" />
      <circle cx="25" cy="25" r="6" fill="#FF6B00" />
      <circle cx="75" cy="75" r="6" fill="#FF6B00" />
      <circle cx="50" cy="50" r="20" stroke="#FFD700" strokeWidth="2" fill="none" strokeDasharray="5 5" className="dandiya-spin" />
      <defs>
        <linearGradient id="goldGradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD700" />
          <stop offset="1" stopColor="#FF6B00" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

export default function Passes() {
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const cards = gsap.utils.toArray('.pass-card');
    
    gsap.fromTo(cards, 
      { x: -50, opacity: 0 },
      {
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 70%",
        },
        x: 0,
        opacity: 1,
        stagger: 0.2,
        duration: 1,
        ease: "power3.out"
      }
    );
  }, []);

  return (
    <section className="scene-container passes-scene" id="pass" ref={containerRef}>
      <h2 className="text-display-large" style={{ color: 'var(--color-gold)' }}>EVENT PASSES</h2>
      <p className="text-body" style={{ marginTop: '1rem', color: 'var(--color-ivory)' }}>EXCLUSIVE FOR JSPM STUDENTS</p>
      
      <div className="passes-grid">
        <div className="pass-details">
          <div className="pass-card">
            <DandiyaIcon />
            <h3>SEASON PASS</h3>
            <div className="price">₹1499</div>
            <div className="pass-divider"></div>
            <ul>
              <li>Access to all 9 nights of Navratri</li>
              <li>Priority entry lane access</li>
              <li>Exclusive food court access</li>
            </ul>
            <button className="nav-cta cta-glow pass-btn-buy" onClick={() => navigate('/register')} style={{ width: '100%', padding: '1rem', background: 'linear-gradient(135deg, var(--color-gold), var(--color-orange))', color: '#000', fontWeight: 'bold' }}>BUY SEASON PASS</button>
          </div>

          <div className="pass-card">
            <DandiyaIcon />
            <h3>DAILY PASS</h3>
            <div className="price">₹299</div>
            <div className="pass-divider"></div>
            <ul>
              <li>Valid for single day entry</li>
              <li>Standard entry lane access</li>
              <li>Access to main dancing arena</li>
            </ul>
            <button className="nav-cta cta-glow pass-btn-buy" onClick={() => navigate('/register')} style={{ width: '100%', padding: '1rem' }}>BUY DAILY PASS</button>
          </div>
        </div>

        <div className="pass-3d-container">
          <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 2]}>
            <ambientLight intensity={0.5} />
            <spotLight position={[5, 5, 5]} intensity={2} color="#FFD700" penumbra={1} />
            <spotLight position={[-5, -5, -5]} intensity={1} color="#FF6B00" />
            <EventPass />
          </Canvas>
        </div>
      </div>
    </section>
  );
}
