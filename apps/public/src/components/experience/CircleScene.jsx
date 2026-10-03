import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './Scenes.css';

export default function CircleScene() {
  const textRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(textRef.current,
      { opacity: 0, rotation: -10 },
      {
        scrollTrigger: {
          trigger: textRef.current,
          start: "top 60%",
          end: "top 40%",
          scrub: true
        },
        opacity: 1,
        rotation: 0
      }
    );
  }, []);

  return (
    <section className="scene circle-scene" id="circle">
      <div className="text-layer" ref={textRef}>
        <div className="text-body" style={{ color: 'var(--color-saffron)' }}>ENTER<br/>THE<br/>CIRCLE</div>
      </div>
    </section>
  );
}
