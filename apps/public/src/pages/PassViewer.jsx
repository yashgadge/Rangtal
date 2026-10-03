import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Calendar, Clock, Sparkles } from 'lucide-react';
import './PassViewer.css';

export default function PassViewer() {
  const { registrationId } = useParams();
  const [passes, setPasses] = useState([]);
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchPasses(user.uid);
      } else {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate, registrationId]);

  async function fetchPasses(uid) {
    try {
      setLoading(true);
      
      const regRef = doc(db, 'registrations', registrationId);
      const regSnap = await getDoc(regRef);
      if (!regSnap.exists()) {
        throw new Error("Registration not found");
      }
      
      const regData = regSnap.data();
      if (regData.uid !== uid) {
        throw new Error("Unauthorized access");
      }
      setRegistration(regData);

      const q = query(collection(db, 'passes'), where('registrationId', '==', registrationId));
      const snap = await getDocs(q);
      
      const passesData = [];
      for (const pDoc of snap.docs) {
        const pass = { id: pDoc.id, ...pDoc.data() };
        
        if (pass.participantId) {
          const partSnap = await getDoc(doc(db, 'participants', pass.participantId));
          if (partSnap.exists()) {
            pass.participant = partSnap.data();
          }
        }
        passesData.push(pass);
      }
      
      setPasses(passesData);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load passes");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="pass-viewer-page app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-heading)', fontSize: '2rem', letterSpacing: '4px' }}>
          RANGTAL
        </motion.div>
      </div>
    );
  }

  if (error || !registration) {
    return (
      <div className="pass-viewer-page app-container">
        <div className="content-layer">
          <div className="pass-container" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <h2 className="text-title" style={{ color: 'var(--color-error)' }}>Pass Unavailable</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{error}</p>
            <button className="btn-primary" onClick={() => navigate('/account')} style={{ margin: '0 auto' }}>Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pass-viewer-page app-container">
      <div className="content-layer">
        <div className="pass-container" style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '4rem' }}>
          
          <div className="pass-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
            <button className="btn-secondary" onClick={() => navigate('/account')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', padding: '0.5rem 0' }}>
              <ArrowLeft size={20} /> Back to Dashboard
            </button>
            <h1 className="text-title" style={{ fontFamily: 'var(--font-heading)', margin: 0, fontSize: '2rem' }}>Digital Passes</h1>
          </div>
          
          {passes.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center', padding: '4rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.2)' }}>
              <p style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'white' }}>No active passes found.</p>
              <p style={{ color: 'var(--text-muted)' }}>If your payment was successful, please allow a few minutes for generation.</p>
            </div>
          ) : (
            <div className="pass-list" style={{ display: 'flex', flexDirection: 'column', gap: '4rem', alignItems: 'center', paddingBottom: '4rem' }}>
              {passes.map((pass, index) => (
                <motion.div 
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.2, type: 'spring', stiffness: 100 }}
                  key={pass.id} 
                  className={`digital-pass-card ${pass.status.toLowerCase()}`}
                  style={{ 
                    width: '100%', 
                    maxWidth: '450px',
                    background: 'linear-gradient(135deg, rgba(20,20,20,0.95), rgba(10,10,10,0.98))',
                    borderRadius: '24px',
                    border: `1px solid ${pass.status === 'ACTIVE' ? 'var(--color-gold)' : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: pass.status === 'ACTIVE' ? '0 20px 50px -10px rgba(255, 158, 0, 0.2)' : '0 20px 50px -10px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                >
                  {/* Decorative Elements */}
                  <div style={{ position: 'absolute', top: '-50px', left: '-50px', width: '150px', height: '150px', background: 'radial-gradient(circle, var(--color-gold-glow) 0%, transparent 70%)', borderRadius: '50%', opacity: pass.status === 'ACTIVE' ? 1 : 0 }} />
                  <div style={{ position: 'absolute', bottom: '-50px', right: '-50px', width: '150px', height: '150px', background: 'radial-gradient(circle, var(--color-gold-glow) 0%, transparent 70%)', borderRadius: '50%', opacity: pass.status === 'ACTIVE' ? 0.5 : 0 }} />

                  {/* Top Section */}
                  <div className="pass-top" style={{ padding: '2.5rem 2rem 1.5rem', textAlign: 'center', borderBottom: '2px dashed rgba(255,255,255,0.15)', position: 'relative' }}>
                    
                    {/* Left/Right Cutouts for Ticket Effect */}
                    <div style={{ position: 'absolute', bottom: '-15px', left: '-15px', width: '30px', height: '30px', background: 'var(--bg-primary)', borderRadius: '50%', borderRight: `1px solid ${pass.status === 'ACTIVE' ? 'var(--color-gold)' : 'rgba(255,255,255,0.1)'}` }} />
                    <div style={{ position: 'absolute', bottom: '-15px', right: '-15px', width: '30px', height: '30px', background: 'var(--bg-primary)', borderRadius: '50%', borderLeft: `1px solid ${pass.status === 'ACTIVE' ? 'var(--color-gold)' : 'rgba(255,255,255,0.1)'}` }} />

                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.5rem', letterSpacing: '4px', margin: 0, color: pass.status === 'ACTIVE' ? 'var(--color-gold)' : 'white', opacity: pass.status === 'ACTIVE' ? 1 : 0.5 }}>
                      RANGTAL
                    </h2>
                    <div style={{ fontSize: '0.9rem', letterSpacing: '8px', color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: '1.5rem', marginLeft: '8px' }}>2026</div>
                    
                    <div className={`status-badge`} style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem', 
                      background: pass.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: pass.status === 'ACTIVE' ? '#22c55e' : '#ef4444',
                      padding: '0.5rem 1.5rem', borderRadius: '999px', fontWeight: 600, letterSpacing: '2px', fontSize: '0.85rem'
                    }}>
                      {pass.status === 'ACTIVE' ? <Sparkles size={16} /> : null}
                      {pass.status}
                    </div>
                  </div>
                  
                  {/* Middle Section (QR) */}
                  <div className="pass-middle" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="qr-container" style={{ 
                      background: 'white', padding: '1rem', borderRadius: '16px', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                      opacity: pass.status === 'ACTIVE' ? 1 : 0.2,
                      filter: pass.status === 'ACTIVE' ? 'none' : 'grayscale(100%)'
                    }}>
                      <QRCodeSVG 
                        value={pass.id} 
                        size={220}
                        bgColor={"#ffffff"}
                        fgColor={"#000000"}
                        level={"Q"}
                        includeMargin={false}
                      />
                    </div>
                    {pass.status === 'ACTIVE' ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1.5rem', textAlign: 'center', maxWidth: '250px', lineHeight: 1.5 }}>
                        Present this QR code at the entrance scanner.
                      </p>
                    ) : (
                      <div style={{ color: '#ef4444', fontSize: '1.25rem', fontWeight: 'bold', marginTop: '1.5rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
                        INVALID PASS
                      </div>
                    )}
                  </div>
                  
                  {/* Bottom Section */}
                  <div className="pass-bottom" style={{ padding: '2rem', borderTop: '2px dashed rgba(255,255,255,0.15)', position: 'relative' }}>
                    
                    {/* Left/Right Cutouts for Ticket Effect */}
                    <div style={{ position: 'absolute', top: '-15px', left: '-15px', width: '30px', height: '30px', background: 'var(--bg-primary)', borderRadius: '50%', borderRight: `1px solid ${pass.status === 'ACTIVE' ? 'var(--color-gold)' : 'rgba(255,255,255,0.1)'}`, borderBottom: `1px solid ${pass.status === 'ACTIVE' ? 'var(--color-gold)' : 'rgba(255,255,255,0.1)'}` }} />
                    <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '30px', height: '30px', background: 'var(--bg-primary)', borderRadius: '50%', borderLeft: `1px solid ${pass.status === 'ACTIVE' ? 'var(--color-gold)' : 'rgba(255,255,255,0.1)'}`, borderBottom: `1px solid ${pass.status === 'ACTIVE' ? 'var(--color-gold)' : 'rgba(255,255,255,0.1)'}` }} />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Participant Name</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>{pass.participant?.fullName || pass.participantName || 'Unknown'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Pass Type</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>{registration.type === 'COUPLE' ? 'Couple Pass' : 'Single Pass'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        <MapPin size={16} color="var(--color-gold)" />
                        <span>JSPM University Wagholi Ground</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        <Calendar size={16} color="var(--color-gold)" />
                        <span>October 15, 2026</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        <Clock size={16} color="var(--color-gold)" />
                        <span>Gate Opens at 6:00 PM</span>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Digital Pass ID</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '1.25rem', letterSpacing: '2px', color: 'rgba(255,255,255,0.8)' }}>{pass.id}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
