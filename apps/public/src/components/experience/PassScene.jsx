import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './Scenes.css';

export default function PassScene() {
  const containerRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(textRef.current,
      { opacity: 0 },
      {
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 60%",
          end: "top 30%",
          scrub: true
        },
        opacity: 1
      }
    );
  }, []);

  return (
    <section ref={containerRef} className="scene pass-scene" id="pass">
      <div className="text-layer" ref={textRef} style={{ pointerEvents: 'auto' }}>
        <h2 className="text-display-large" style={{ marginBottom: '2rem' }}>GET YOUR<br/>PASS</h2>
        <button className="nav-cta" style={{ transform: 'scale(1.5)', marginTop: '2rem' }}>JSPM STUDENTS ONLY</button>
      </div>
    </section>
  );
}
