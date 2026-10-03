import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './Scenes.css';

export default function Reveal() {
  const textRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(textRef.current,
      { y: 100, opacity: 0 },
      {
        scrollTrigger: {
          trigger: textRef.current,
          start: "top 80%",
          end: "top 20%",
          scrub: true
        },
        y: 0,
        opacity: 1
      }
    );
  }, []);

  return (
    <section className="scene reveal-scene" id="reveal">
      <div className="text-layer" ref={textRef}>
        <h1 className="text-display-massive">RANGTAL</h1>
      </div>
    </section>
  );
}
