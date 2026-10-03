import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './CustomCursor.css';

export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    const onMouseMove = (e) => {
      gsap.to(dotRef.current, { x: e.clientX, y: e.clientY, duration: 0.1 });
      gsap.to(ringRef.current, { x: e.clientX, y: e.clientY, duration: 0.3 });
    };

    const onMouseDown = () => {
      gsap.to(ringRef.current, { scale: 0.8, duration: 0.2 });
    };

    const onMouseUp = () => {
      gsap.to(ringRef.current, { scale: 1, duration: 0.2 });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  );
}
