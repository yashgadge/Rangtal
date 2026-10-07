import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLocation } from 'react-router-dom';

export default function About() {
  const [contactSettings, setContactSettings] = useState(null);
  const location = useLocation();

  useEffect(() => {
    async function loadSettings() {
      try {
        const snap = await getDoc(doc(db, 'eventSettings', 'global'));
        if (snap.exists()) {
          setContactSettings(snap.data().CONTACT);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadSettings();
  }, []);

  useEffect(() => {
    if (location.hash) {
      setTimeout(() => {
        const id = location.hash.replace('#', '');
        const el = document.getElementById(id);
        if (el) {
          const yOffset = -100; 
          const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({top: y, behavior: 'smooth'});
        }
      }, 300);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);

  return (
    <div style={{ paddingTop: '120px', minHeight: '100vh', backgroundColor: '#1A050B', color: 'var(--color-ivory)', padding: '120px 2rem 4rem 2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} transition={{duration: 0.8}}>
          <h1 className="text-display-medium" style={{ color: 'var(--color-gold)', marginBottom: '1.5rem' }}>ABOUT RANGTAL</h1>
          
          <div className="surface" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(60,15,30,0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(232,213,181,0.15)', marginBottom: '3rem' }}>
            <p style={{ fontSize: '1rem', lineHeight: 1.6, marginBottom: '1rem' }}>
              Rangtal is the biggest and most awaited Garba Mahotsav of the year. We bring together culture, devotion, and celebration in a grand festival on 17 October - 2026. Join us for a spectacular experience of traditional music, vibrant attire, and rhythmic dancing.
            </p>
            <p style={{ fontSize: '1rem', lineHeight: 1.6 }}>
              Experience the magic of Navratri with the best artists, premium ambiance, and an unforgettable crowd.
            </p>
          </div>

          <h2 id="contact" className="text-display-medium" style={{ color: 'var(--color-gold)', marginBottom: '2rem' }}>CONTACT US</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {contactSettings?.member1Name && (
              <div className="surface-flat" style={{ padding: '2rem', borderRadius: '12px', background: 'rgba(26,5,11,0.6)', border: '1px solid rgba(232,213,181,0.1)' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--color-gold)' }}>{contactSettings.member1Name}</h3>
                {contactSettings.member1Phone && (
                  <div style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>📞 {contactSettings.member1Phone}</div>
                )}
                {contactSettings.member1Email && (
                  <div style={{ fontSize: '1.1rem' }}>✉️ {contactSettings.member1Email}</div>
                )}
              </div>
            )}
            
            {contactSettings?.member2Name && (
              <div className="surface-flat" style={{ padding: '2rem', borderRadius: '12px', background: 'rgba(26,5,11,0.6)', border: '1px solid rgba(232,213,181,0.1)' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--color-gold)' }}>{contactSettings.member2Name}</h3>
                {contactSettings.member2Phone && (
                  <div style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>📞 {contactSettings.member2Phone}</div>
                )}
                {contactSettings.member2Email && (
                  <div style={{ fontSize: '1.1rem' }}>✉️ {contactSettings.member2Email}</div>
                )}
              </div>
            )}
            
            {!contactSettings?.member1Name && !contactSettings?.member2Name && (
              <div style={{ opacity: 0.7, fontStyle: 'italic' }}>Contact information will be available soon.</div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
