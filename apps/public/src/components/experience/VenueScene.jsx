import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './Scenes.css';

export default function VenueScene() {
  const textRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(textRef.current,
      { y: 100, opacity: 0 },
      {
        scrollTrigger: {
          trigger: textRef.current,
          start: "top 80%",
          end: "top 40%",
          scrub: true
        },
        y: 0,
        opacity: 1
      }
    );
  }, []);

  return (
    <section className="scene venue-scene" id="venue">
      <div className="text-layer" ref={textRef}>
        <div className="text-body" style={{ color: 'var(--color-saffron)', marginBottom: '1rem' }}>LOCATION</div>
        <h2 className="text-display-large">JSPM CRICKET<br/>GROUND</h2>
      </div>
    </section>
  );
}
