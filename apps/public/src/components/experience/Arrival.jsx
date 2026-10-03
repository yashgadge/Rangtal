import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './Scenes.css';

export default function Arrival() {
  const textRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline();
    tl.fromTo(textRef.current, 
      { opacity: 0, scale: 0.9, filter: "blur(10px)" },
      { opacity: 1, scale: 1, filter: "blur(0px)", duration: 2, ease: "power2.out", delay: 0.5 }
    );
    
    gsap.to(containerRef.current, {
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top top",
        end: "bottom top",
        scrub: true
      },
      opacity: 0,
      y: -50
    });
  }, []);

  return (
    <section ref={containerRef} className="scene arrival-scene" id="arrival">
      <div className="text-layer" ref={textRef}>
        <div className="text-body" style={{ color: 'var(--color-gold)', marginBottom: '1rem' }}>ENTER THE CIRCLE</div>
      </div>
    </section>
  );
}
