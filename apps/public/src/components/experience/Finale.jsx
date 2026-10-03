import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './Scenes.css';

export default function Finale() {
  const textRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(textRef.current,
      { scale: 1.2, opacity: 0 },
      {
        scrollTrigger: {
          trigger: textRef.current,
          start: "top 80%",
          end: "top 20%",
          scrub: true
        },
        scale: 1,
        opacity: 1
      }
    );
  }, []);

  return (
    <section className="scene finale-scene" id="finale">
      <div className="text-layer" ref={textRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 className="text-display-massive">RANGTAL</h1>
        <div className="text-body" style={{ marginTop: '2rem' }}>GARBA NIGHT</div>
        <div className="text-body" style={{ marginTop: '4rem', fontSize: '0.8rem', opacity: 0.5 }}>
          RHYTHM REBELS | JSPM CRICKET GROUND
        </div>
      </div>
    </section>
  );
}
