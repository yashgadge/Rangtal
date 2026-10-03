import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Scenes.css';

gsap.registerPlugin(ScrollTrigger);

export default function EventInfo() {
  const containerRef = useRef(null);

  useEffect(() => {
    const items = gsap.utils.toArray('.info-item');
    const header = containerRef.current.querySelector('.hero-organized');
    
    gsap.fromTo(header, { opacity: 0, y: 30 }, {
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top 80%",
      },
      opacity: 1,
      y: 0,
      duration: 1
    });

    gsap.fromTo(items, 
      { y: 50, opacity: 0 },
      {
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 70%",
        },
        y: 0,
        opacity: 1,
        stagger: 0.2,
        duration: 1,
        ease: "power3.out"
      }
    );
  }, []);

  return (
    <section className="scene-container" id="info" ref={containerRef}>
      <div className="info-scene">
        
        <div className="hero-organized" style={{ marginBottom: '2rem' }}>
          <div className="text-script-medium" style={{ color: 'var(--color-gold)' }}>Celebrate The Culture</div>
          <h2 className="text-display-large" style={{ color: 'var(--color-ivory)' }}>THE ULTIMATE GARBA EXPERIENCE</h2>
        </div>
        
        <div className="info-grid">
          <div className="info-item">
            <h4>Venue</h4>
            <p>JSPM Cricket Ground<br/>Wagholi, Pune</p>
          </div>
          <div className="info-item">
            <h4>Timing</h4>
            <p>7:00 PM to 12:00 AM<br/>Daily from 11 Oct to 19 Oct</p>
          </div>
          <div className="info-item">
            <h4>Dress Code</h4>
            <p>Traditional Indian<br/>Mandatory</p>
          </div>
        </div>
        
      </div>
    </section>
  );
}
