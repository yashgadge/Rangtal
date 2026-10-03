import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './Scenes.css';

export default function RhythmScene() {
  const textRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(textRef.current,
      { scale: 0.8, opacity: 0 },
      {
        scrollTrigger: {
          trigger: textRef.current,
          start: "top 70%",
          end: "top 30%",
          scrub: true
        },
        scale: 1,
        opacity: 1
      }
    );
  }, []);

  return (
    <section className="scene rhythm-scene" id="rhythm">
      <div className="text-layer" ref={textRef}>
        <h2 className="text-display-large">MOVE WITH<br/>THE RHYTHM</h2>
      </div>
    </section>
  );
}
