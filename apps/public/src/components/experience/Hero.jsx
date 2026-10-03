import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import './Scenes.css';

export default function Hero() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    EVENT: { eventName: 'Rangtal Garba Night', eventDate: '11-19 OCT', location: 'JSPM GROUND', organizer: 'Rhythm Rebels' },
    REGISTRATION: { requireCollegeId: true }
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const snap = await getDoc(doc(db, 'eventSettings', 'global'));
        if (snap.exists()) {
          setSettings(prev => ({ ...prev, ...snap.data() }));
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      }
    }
    loadSettings();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.3 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <section className="scene-container hero-scene" id="experience" style={{ position: 'relative', zIndex: 10 }}>
      
      {/* Decorative Border Frame */}
      <div className="hero-frame" style={{ pointerEvents: 'none', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
        <div className="hero-frame-inner" style={{ border: '1px solid rgba(255, 215, 0, 0.1)' }}></div>
      </div>

      <motion.div 
        className="hero-content" 
        variants={containerVariants} 
        initial="hidden" 
        animate="visible"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}
      >
        <motion.div variants={itemVariants} className="hero-top" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {settings.REGISTRATION?.requireCollegeId && (
            <div className="hero-tagline" style={{ letterSpacing: '4px', fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase' }}>
              ONLY FOR JSPM STUDENTS
            </div>
          )}
          <div className="hero-subtitle" style={{ letterSpacing: '4px', marginTop: '1rem', color: 'var(--text-secondary)' }}>THE BIGGEST GARBA MAHOTSAV</div>
        </motion.div>

        <motion.div variants={itemVariants} className="hero-center" style={{ textAlign: 'center', marginBottom: '3rem', position: 'relative' }}>
          <h1 className="text-display-massive" style={{ 
            textShadow: '0 10px 40px rgba(255, 107, 0, 0.6)', 
            fontSize: 'clamp(5rem, 15vw, 10rem)',
            lineHeight: 1,
            margin: 0,
            background: 'linear-gradient(to bottom, var(--color-gold), var(--color-orange))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {settings.EVENT?.eventName?.split(' ')[0] || 'Rangtal'}
          </h1>
          <div className="text-script-massive" style={{ 
            fontSize: 'clamp(3rem, 8vw, 6rem)', 
            color: 'var(--color-ivory)', 
            marginTop: '-1rem',
            transform: 'rotate(-5deg)'
          }}>
            {settings.EVENT?.eventName?.split(' ').slice(1).join(' ') || 'Garba Night'}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="hero-bottom" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginBottom: '3rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-gold)', letterSpacing: '2px', textTransform: 'uppercase' }}>Date</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'white' }}>{settings.EVENT?.eventDate || 'TBA'}</div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-gold)', letterSpacing: '2px', textTransform: 'uppercase' }}>Venue</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'white' }}>{settings.EVENT?.location || 'TBA'}</div>
            </div>
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(255, 153, 51, 0.6)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/register')}
            style={{ 
              fontSize: '1.2rem', 
              padding: '1.2rem 4rem', 
              borderRadius: '99px', 
              background: 'linear-gradient(135deg, var(--color-gold), var(--color-orange))', 
              color: '#050505', 
              fontWeight: 800, 
              fontFamily: 'var(--font-body)', 
              letterSpacing: '0.1em',
              border: 'none',
              cursor: 'pointer',
              textTransform: 'uppercase'
            }}
          >
            Get Your Pass
          </motion.button>
          
          <div className="hero-organized" style={{ marginTop: '3rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', letterSpacing: '2px' }}>ORGANISED BY</div>
            <div className="text-script-medium" style={{ color: 'var(--color-gold)', fontSize: '2rem', marginTop: '0.5rem' }}>{settings.EVENT?.organizer || 'Rhythm Rebels'}</div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
