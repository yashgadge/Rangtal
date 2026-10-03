import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './Scenes.css';

export default function CultureScene() {
  const containerRef = useRef(null);

  useEffect(() => {
    const words = gsap.utils.toArray('.culture-word');
    words.forEach((word, i) => {
      gsap.fromTo(word, 
        { opacity: 0, scale: 0.5 },
        {
          scrollTrigger: {
            trigger: containerRef.current,
            start: `${i * 15}% center`,
            end: `${(i+1) * 15}% center`,
            scrub: true
          },
          opacity: 1,
          scale: 1
        }
      );
    });
  }, []);

  return (
    <section ref={containerRef} className="scene culture-scene" id="culture">
      <div className="text-layer" style={{ display: 'flex', flexDirection: 'column', gap: '20vh' }}>
        <h2 className="text-display-large culture-word">RHYTHM</h2>
        <h2 className="text-display-large culture-word" style={{ color: 'var(--color-saffron)' }}>COLOUR</h2>
        <h2 className="text-display-large culture-word">MOVEMENT</h2>
        <h2 className="text-display-large culture-word" style={{ color: 'var(--color-orange)' }}>TOGETHER</h2>
        <h2 className="text-display-large culture-word">CELEBRATE</h2>
      </div>
    </section>
  );
}
