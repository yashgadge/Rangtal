import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './Scenes.css';

export default function NightScene() {
  const textRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(textRef.current,
      { y: 50, opacity: 0, filter: "blur(5px)" },
      {
        scrollTrigger: {
          trigger: textRef.current,
          start: "top 70%",
          end: "top 40%",
          scrub: true
        },
        y: 0,
        opacity: 1,
        filter: "blur(0px)"
      }
    );
  }, []);

  return (
    <section className="scene night-scene" id="night">
      <div className="text-layer" ref={textRef}>
        <h2 className="text-display-large">THE NIGHT<br/>BEGINS</h2>
      </div>
    </section>
  );
}
