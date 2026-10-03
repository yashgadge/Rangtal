import React from 'react';
import './Scenes.css';

export default function Hero() {
  // This data can be easily swapped out with props or state fetched from Firebase/Admin Panel
  const eventData = {
    date: "11-19 OCT",
    location: "JSPM GROUND"
  };

  return (
    <section className="scene-container hero-scene" id="experience">
      
      {/* Decorative Border Frame */}
      <div className="hero-frame">
        <div className="hero-frame-inner"></div>
      </div>

      {/* Side Info Panels (Editable via admin panel data) */}
      <div className="hero-side-info left">
        <div className="side-line"></div>
        <div className="side-info-label">DATE</div>
        <div className="side-info-value">{eventData.date}</div>
        <div className="side-line"></div>
      </div>

      <div className="hero-side-info right">
        <div className="side-line"></div>
        <div className="side-info-label">VENUE</div>
        <div className="side-info-value">{eventData.location}</div>
        <div className="side-line"></div>
      </div>

      <div className="hero-top">
        <div className="hero-tagline">ONLY FOR JSPM STUDENTS..!!</div>
        <div className="hero-subtitle">FIRST EVER JSPM WAGHOLI'S</div>
      </div>

      <div className="hero-center">
        <h1 className="text-display-massive" style={{ textShadow: '0 10px 30px rgba(255, 153, 51, 0.4)' }}>Rangtal</h1>
        <div className="text-script-massive">Garba Night</div>
      </div>

      <div className="hero-bottom">
        <div className="ornament-line">COMING SOON</div>
        
        <div className="hero-organized" style={{ marginTop: '1.5rem' }}>
          <div className="hero-subtitle" style={{ fontSize: '0.9rem', color: 'var(--color-ivory)' }}>ORGANISED BY</div>
          <div className="text-script-medium" style={{ color: 'var(--color-gold)' }}>Rhythm Rebels</div>
        </div>

        <button className="nav-cta cta-glow" style={{ marginTop: '2rem', fontSize: '1.2rem', padding: '1rem 4rem', borderRadius: '50px', background: 'linear-gradient(135deg, var(--color-gold), var(--color-orange))', color: '#000', fontWeight: 'bold', fontFamily: 'var(--font-body)', letterSpacing: '0.1em' }}>
          GET YOUR PASS
        </button>
      </div>

    </section>
  );
}
