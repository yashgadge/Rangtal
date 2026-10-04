import React, { useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import GlassSurface from '../ui/GlassSurface';
import './Navigation.css';

export default function Navigation() {
  const navRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    // Fade in on load instead of hiding until scroll
    gsap.fromTo(navRef.current, 
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 1, ease: "power2.out" }
    );

    const handleScroll = () => {
      if (window.scrollY > 50) {
        navRef.current.classList.add('scrolled');
      } else {
        navRef.current.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav ref={navRef} className="main-nav">
      
      <div className="nav-left">
        <Link to="/" className="nav-brand" style={{textDecoration: 'none'}}>
          RANGTAL <span className="brand-icon">✦</span>
        </Link>
      </div>

      {isHome && (
        <GlassSurface
          width="auto"
          height="auto"
          borderRadius={50}
          displace={15}
          distortionScale={-150}
          redOffset={5}
          greenOffset={15}
          blueOffset={25}
          brightness={50}
          opacity={0.7}
          mixBlendMode="screen"
          className="nav-center-glass"
        >
          <div className="nav-center">
            <a href="#experience">EXPERIENCE</a>
            <a href="#the-night">THE NIGHT</a>
            <a href="#pass">PASS</a>
            <a href="#about">ABOUT</a>
          </div>
        </GlassSurface>
      )}

      <div className="nav-right">
        <button className="nav-cta" onClick={() => navigate('/register')}>
          GET YOUR PASS <span className="arrow">→</span>
        </button>
      </div>

    </nav>
  );
}
