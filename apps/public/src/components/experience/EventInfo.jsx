import React from 'react';
import { motion } from 'framer-motion';
import useEventSettings, { formatEventDate } from '../../hooks/useEventSettings';
import './Scenes.css';
import './Hero.css';

export default function EventInfo() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" }
    }
  };

  // No hardcoded fallbacks: cached admin values render instantly, then Firestore syncs
  const { event, synced } = useEventSettings();

  const renderWithBr = (text, fallback = 'To be announced') => {
    if (!text) {
      return synced
        ? <span style={{ opacity: 0.6 }}>{fallback}</span>
        : <span className="hero-skeleton" style={{ width: '12ch' }} aria-hidden="true">&nbsp;</span>;
    }
    return text.split('\n').map((line, i, arr) => (
      <React.Fragment key={i}>
        {line}
        {i < arr.length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <section className="scene-container" id="info" style={{ padding: '2rem 2rem 6rem 2rem', position: 'relative', zIndex: 10 }}>
      <motion.div 
        className="info-scene" 
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}
      >
        
        <motion.div variants={itemVariants} className="hero-organized" style={{ marginBottom: '4rem' }}>
          <div className="text-script-medium" style={{ color: 'var(--color-gold)', fontSize: '2.5rem' }}>Celebrate The Culture</div>
          <h2 className="text-display-large" style={{ color: 'var(--color-ivory)', fontSize: 'clamp(2rem, 5vw, 4rem)', marginTop: '0.5rem' }}>THE ULTIMATE GARBA EXPERIENCE</h2>
        </motion.div>
        
        <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
          <motion.div variants={itemVariants} className="info-item" style={{ background: 'linear-gradient(145deg, rgba(60,15,30,0.4), rgba(26,5,11,0.7))', backdropFilter: 'blur(20px)', padding: '2.5rem 2rem', borderRadius: '16px', border: '1px solid rgba(232,213,181,0.15)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <h4 style={{ color: 'var(--color-gold)', fontSize: '1.2rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Date</h4>
            <p style={{ color: 'var(--color-ivory)', fontSize: '1.1rem', lineHeight: 1.6, opacity: 0.9 }}>
              {renderWithBr(formatEventDate(event?.eventDate))}
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="info-item" style={{ background: 'linear-gradient(145deg, rgba(60,15,30,0.4), rgba(26,5,11,0.7))', backdropFilter: 'blur(20px)', padding: '2.5rem 2rem', borderRadius: '16px', border: '1px solid rgba(232,213,181,0.15)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <h4 style={{ color: 'var(--color-gold)', fontSize: '1.2rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Venue</h4>
            <p style={{ color: 'var(--color-ivory)', fontSize: '1.1rem', lineHeight: 1.6, opacity: 0.9 }}>
              {renderWithBr(event?.location)}
            </p>
          </motion.div>
          
          <motion.div variants={itemVariants} className="info-item" style={{ background: 'linear-gradient(145deg, rgba(60,15,30,0.4), rgba(26,5,11,0.7))', backdropFilter: 'blur(20px)', padding: '2.5rem 2rem', borderRadius: '16px', border: '1px solid rgba(232,213,181,0.15)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <h4 style={{ color: 'var(--color-gold)', fontSize: '1.2rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Timing</h4>
            <p style={{ color: 'var(--color-ivory)', fontSize: '1.1rem', lineHeight: 1.6, opacity: 0.9 }}>
              {renderWithBr(event?.timing)}
            </p>
          </motion.div>
          
          <motion.div variants={itemVariants} className="info-item" style={{ background: 'linear-gradient(145deg, rgba(60,15,30,0.4), rgba(26,5,11,0.7))', backdropFilter: 'blur(20px)', padding: '2.5rem 2rem', borderRadius: '16px', border: '1px solid rgba(232,213,181,0.15)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <h4 style={{ color: 'var(--color-gold)', fontSize: '1.2rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Dress Code</h4>
            <p style={{ color: 'var(--color-ivory)', fontSize: '1.1rem', lineHeight: 1.6, opacity: 0.9 }}>
              {renderWithBr(event?.dressCode)}
            </p>
          </motion.div>
        </div>
        
      </motion.div>
    </section>
  );
}
