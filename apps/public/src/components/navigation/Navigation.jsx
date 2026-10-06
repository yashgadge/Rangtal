import React, { useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import GlassSurface from '../ui/GlassSurface';
import { useFirebaseData } from '../../../../../shared/hooks/useFirebaseData.js';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import './Navigation.css';

export default function Navigation() {
  const navRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  const { data: settings } = useFirebaseData('global_event_settings', async () => {
    const snap = await getDoc(doc(db, 'eventSettings', 'global'));
    return snap.exists() ? snap.data() : {};
  });

  const isOpen = settings?.REGISTRATION?.registrationsOpen ?? true;

  useEffect(() => {
    if (!navRef.current) return;
    
    // Fade in on load instead of hiding until scroll
    gsap.fromTo(navRef.current, 
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 1, ease: "power2.out" }
    );

    const handleScroll = () => {
      if (!navRef.current) return;
      if (window.scrollY > 50) {
        navRef.current.classList.add('scrolled');
      } else {
        navRef.current.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollTo = (e, id) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav ref={navRef} className="main-nav">
      
      <div className="nav-left">
        <Link to="/" className="nav-brand" style={{textDecoration: 'none'}}>
          RANGTAAL 2026
        </Link>
      </div>

      {location.pathname !== '/register' && (
        <>
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
              {isHome ? (
                <>
                  <a href="#experience" onClick={(e) => handleScrollTo(e, 'experience')}>EXPERIENCE</a>
                  <a href="#info" onClick={(e) => handleScrollTo(e, 'info')}>THE NIGHT</a>
                  <a href="#passes" onClick={(e) => handleScrollTo(e, 'passes')}>PASSES</a>
                </>
              ) : (
                <Link to="/">HOME</Link>
              )}
              <Link to="/about">ABOUT</Link>
              <Link to="/about#contact">CONTACT US</Link>
            </div>
          </GlassSurface>

          <div className="nav-right">
            {isOpen ? (
              <button className="nav-cta" onClick={() => navigate('/account')}>
                GET YOUR PASS <span className="arrow">→</span>
              </button>
            ) : (
              <button className="nav-cta" onClick={() => navigate('/account')}>
                MY DASHBOARD <span className="arrow">→</span>
              </button>
            )}
          </div>
        </>
      )}
    </nav>
  );
}
