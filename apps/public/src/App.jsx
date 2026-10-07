import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import Navigation from './components/navigation/Navigation.jsx';
import NetworkIndicator from './components/NetworkIndicator.jsx';

const Home = lazy(() => import('./pages/Home.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const PassViewer = lazy(() => import('./pages/PassViewer.jsx'));
const About = lazy(() => import('./pages/About.jsx'));

gsap.registerPlugin(ScrollTrigger);

function App() {
  useEffect(() => {
    // Prevent GSAP from recalculating on mobile URL bar show/hide which causes layout shifts
    ScrollTrigger.config({ ignoreMobileResize: true });

    // Only initialize Lenis smooth scrolling on desktop devices
    const isMobile = window.matchMedia('(max-width: 768px)').matches || ('ontouchstart' in window);
    
    if (isMobile) {
      return; // Use native scrolling on mobile to prevent animation jank
    }

    // Initialize Lenis for smooth scrolling (Desktop only)
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Sync Lenis with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0, 0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(lenis.raf);
    };
  }, []);

  return (
    <BrowserRouter>
      <NetworkIndicator />
      <Navigation />
      <Suspense fallback={<div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' }}><div className="loading-spinner"></div></div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/register" element={<Register />} />
          <Route path="/account" element={<Account />} />
          <Route path="/account/pass/:passId" element={<PassViewer />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
