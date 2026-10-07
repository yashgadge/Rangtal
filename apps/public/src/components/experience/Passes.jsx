import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirebaseData } from '../../../../../shared/hooks/useFirebaseData.js';
import './Scenes.css';

const DandiyaIcon = ({ size = 60, className = '' }) => (
  <div className={className} style={{ width: size, height: size, display: 'inline-block' }}>
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="dandiya-icon">
      <path d="M25 75 L75 25" stroke="url(#goldGradient)" strokeWidth="8" strokeLinecap="round" />
      <path d="M25 25 L75 75" stroke="url(#goldGradient)" strokeWidth="8" strokeLinecap="round" />
      <circle cx="25" cy="75" r="6" fill="#FF6B00" />
      <circle cx="75" cy="25" r="6" fill="#FF6B00" />
      <circle cx="25" cy="25" r="6" fill="#FF6B00" />
      <circle cx="75" cy="75" r="6" fill="#FF6B00" />
      <circle cx="50" cy="50" r="20" stroke="#FFD700" strokeWidth="2" fill="none" strokeDasharray="5 5" className="dandiya-spin" />
      <defs>
        <linearGradient id="goldGradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD700" />
          <stop offset="1" stopColor="#FF6B00" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

export default function Passes() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  const { data: settings } = useFirebaseData('passes_event_settings', async () => {
    const snap = await getDoc(doc(db, 'eventSettings', 'global'));
    return snap.exists() ? snap.data() : {};
  });

  const isOpen = settings?.REGISTRATION?.registrationsOpen ?? true;

  useEffect(() => {
    async function loadPackages() {
      try {
        const q = query(collection(db, 'packages'), where('active', '==', true));
        const snap = await getDocs(q);
        const pkgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by price ascending
        pkgs.sort((a, b) => a.price - b.price);
        setPackages(pkgs);
      } catch (err) {
        console.error("Failed to load packages", err);
      } finally {
        setLoading(false);
      }
    }
    loadPackages();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  return (
    <section className="scene-container passes-scene" id="pass" style={{ position: 'relative', zIndex: 10, padding: '6rem 2rem' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <DandiyaIcon />
        <h2 className="text-display-large" style={{ color: 'var(--color-gold)', fontSize: 'clamp(2.5rem, 6vw, 4rem)', margin: '1rem 0 0 0' }}>EVENT PASSES</h2>
        <p className="text-body" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 600 }}>CHOOSE YOUR CELEBRATION STYLE</p>
      </div>
      
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-gold)', fontSize: '1.2rem', padding: '4rem' }}>
          Loading Passes...
        </div>
      ) : (
        <motion.div 
          className="passes-grid" 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', maxWidth: '1200px', margin: '0 auto' }}
        >
          {packages.map((pkg, idx) => {
            const isPopular = pkg.type === 'COUPLE' || pkg.name.toLowerCase().includes('couple');
            const isEarlyBirdActive = pkg.earlyBirdEnabled && (pkg.earlyBirdSoldCount || 0) < (pkg.earlyBirdCapacity || 0);
            const remainingEarlyBird = isEarlyBirdActive ? (pkg.earlyBirdCapacity || 0) - (pkg.earlyBirdSoldCount || 0) : 0;
            return (
              <motion.div key={pkg.id} variants={itemVariants} className="pass-card" style={{ 
                background: 'linear-gradient(145deg, rgba(60,15,30,0.4), rgba(26,5,11,0.7))', 
                backdropFilter: 'blur(20px)',
                border: isPopular ? '2px solid var(--color-gold)' : '1px solid rgba(232,213,181,0.15)', 
                padding: '2rem', 
                borderRadius: '24px', 
                boxShadow: isPopular ? '0 20px 50px rgba(0,0,0,0.8)' : '0 20px 40px rgba(0,0,0,0.5)', 
                position: 'relative', 
                overflow: 'hidden',
                transform: isPopular ? 'scale(1.05)' : 'scale(1)',
                zIndex: isPopular ? 2 : 1
              }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(255, 215, 0, 0.15), transparent 70%)', filter: 'blur(30px)' }} />
                
                {/* Corner Dandiyas */}
                <div style={{ position: 'absolute', top: 15, left: 15, opacity: 0.6 }} className="pass-decor-tl"><DandiyaIcon size={24} /></div>
                <div style={{ position: 'absolute', bottom: 15, right: 15, opacity: 0.6 }} className="pass-decor-br"><DandiyaIcon size={24} /></div>

                {isPopular && (
                  <div style={{ position: 'absolute', top: '15px', right: '-35px', background: 'var(--color-gold)', color: 'black', padding: '0.25rem 3rem', transform: 'rotate(45deg)', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '1px', boxShadow: '0 2px 10px rgba(0,0,0,0.5)', zIndex: 10 }}>POPULAR</div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '1.25rem', marginTop: '1rem', color: 'white', letterSpacing: '1px', textTransform: 'uppercase', position: 'relative', zIndex: 2 }}>{pkg.name}</h3>
                  {isEarlyBirdActive && (
                    <div className="badge" style={{ background: 'rgba(212,175,55,0.1)', color: 'var(--color-gold)', border: '1px solid rgba(212,175,55,0.2)', marginTop: '1rem', position: 'relative', zIndex: 2, display: 'inline-block' }}>
                      ONLY {remainingEarlyBird} LEFT
                    </div>
                  )}
                </div>
                
                <div className="price" style={{ margin: '1rem 0', position: 'relative', zIndex: 2, display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                  {isEarlyBirdActive && (
                    <span style={{ fontSize: '1.5rem', textDecoration: 'line-through', color: 'var(--text-muted)', fontWeight: 600 }}>₹{pkg.price}</span>
                  )}
                  <span style={{ fontSize: '3rem', fontWeight: 800, background: isPopular ? 'linear-gradient(to right, var(--color-gold), var(--color-orange))' : 'none', color: isPopular ? 'transparent' : 'white', WebkitBackgroundClip: isPopular ? 'text' : 'border-box' }}>
                    ₹{isEarlyBirdActive ? pkg.earlyBirdPrice : pkg.price}
                  </span>
                </div>
                
                <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '1.5rem 0' }}></div>
                
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', minHeight: '60px', position: 'relative', zIndex: 2 }}>
                  {pkg.description}
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', color: 'var(--text-secondary)', fontSize: '0.95rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', zIndex: 2 }}>
                  {pkg.features && Array.isArray(pkg.features) && pkg.features.map((feature, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ color: 'var(--color-gold)' }}>✓</span> {feature}
                    </li>
                  ))}
                  {(!pkg.features || pkg.features.length === 0) && (
                    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ color: 'var(--color-gold)' }}>✓</span> Special entry lane
                    </li>
                  )}
                </ul>
                
                <motion.button 
                  whileHover={isOpen ? { scale: 1.05, boxShadow: '0 0 20px rgba(255, 215, 0, 0.4)' } : {}} 
                  whileTap={isOpen ? { scale: 0.95 } : {}} 
                  onClick={() => isOpen && navigate('/account')} 
                  disabled={!isOpen}
                  style={{ 
                    width: '100%', 
                    padding: '1rem', 
                    background: !isOpen ? 'rgba(255,255,255,0.05)' : (isPopular ? 'linear-gradient(135deg, var(--color-gold), var(--color-orange))' : 'rgba(255,255,255,0.05)'), 
                    color: !isOpen ? 'rgba(255,255,255,0.3)' : (isPopular ? '#000' : 'white'), 
                    fontWeight: 'bold', 
                    border: !isOpen ? '1px solid rgba(255,255,255,0.1)' : (isPopular ? 'none' : '1px solid rgba(255,255,255,0.2)'), 
                    borderRadius: '12px', 
                    fontSize: '1rem', 
                    cursor: isOpen ? 'pointer' : 'not-allowed',
                    textTransform: 'uppercase',
                    position: 'relative',
                    zIndex: 2,
                    opacity: isOpen ? 1 : 0.6
                  }}
                >
                  {isOpen ? `Buy ${pkg.name}` : 'SOLD OUT'}
                </motion.button>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </section>
  );
}
