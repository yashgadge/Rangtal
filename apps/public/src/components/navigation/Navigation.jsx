import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import './Navigation.css';

export default function Navigation() {
  const navRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Fade in on load instead of hiding until scroll
    gsap.fromTo(navRef.current, 
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 1, ease: "power2.out" }
    );
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <nav ref={navRef} className="main-nav">
      <Link to="/" className="nav-brand" style={{textDecoration: 'none'}}>RANGTAL</Link>
      {isHome && (
        <div className="nav-links">
          <a href="#experience">EXPERIENCE</a>
          <a href="#pass">PASS</a>
          <a href="#info">INFO</a>
        </div>
      )}
      {user ? (
        <button className="nav-cta" onClick={() => navigate('/account')}>MY ACCOUNT</button>
      ) : (
        <button className="nav-cta" onClick={() => navigate('/register')}>GET PASS</button>
      )}
    </nav>
  );
}
