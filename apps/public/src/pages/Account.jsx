import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Ticket, Clock, CheckCircle2, AlertCircle, FileText, User } from 'lucide-react';
import './Account.css';

export default function Account() {
  const [user, setUser] = useState(auth.currentUser);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchRegistrations(currentUser.uid);
      } else {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  async function fetchRegistrations(uid) {
    try {
      setLoading(true);
      const q = query(collection(db, 'registrations'), where('uid', '==', uid));
      const snap = await getDocs(q);
      const regs = [];
      for (const doc of snap.docs) {
        const data = doc.data();
        
        const pQuery = query(collection(db, 'participants'), where('registrationId', '==', doc.id));
        const pSnap = await getDocs(pQuery);
        const participants = pSnap.docs.map(p => ({ id: p.id, ...p.data() }));

        regs.push({
          id: doc.id,
          ...data,
          participants
        });
      }
      
      regs.sort((a, b) => {
        const t1 = a.createdAt?.toMillis() || 0;
        const t2 = b.createdAt?.toMillis() || 0;
        return t2 - t1;
      });
      
      setRegistrations(regs);
    } catch (err) {
      console.error("Error fetching registrations", err);
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="account-page app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-heading)', fontSize: '2rem', letterSpacing: '4px' }}>
          RANGTAL
        </motion.div>
      </div>
    );
  }

  return (
    <div className="account-page app-container">
      <div className="content-layer">
        <div className="account-container" style={{ maxWidth: '900px', margin: '0 auto', paddingTop: '4rem' }}>
          
          <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
            <div>
              <h1 className="text-title" style={{ fontFamily: 'var(--font-heading)', margin: 0, fontSize: '2.5rem' }}>My Dashboard</h1>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{user.email}</div>
            </div>
            <button onClick={handleLogout} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>

          {registrations.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="empty-state" style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.2)' }}>
              <Ticket size={48} style={{ opacity: 0.3, margin: '0 auto 1.5rem', color: 'white' }} />
              <h2 className="text-subtitle" style={{ color: 'white' }}>No registrations found</h2>
              <p className="text-body" style={{ marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem' }}>You haven't booked any passes for Rangtal Garba Night yet.</p>
              <button className="btn-primary" onClick={() => navigate('/register')} style={{ padding: '1rem 3rem' }}>
                Book Your Pass
              </button>
            </motion.div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {registrations.map((reg, index) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: index * 0.1 }}
                  key={reg.id} 
                  className="registration-card"
                  style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}
                >
                  <div className="registration-header" style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}>
                    <div>
                      <h2 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--color-gold)' }}>{reg.type === 'COUPLE' ? 'Couple Pass' : 'Single Pass'}</h2>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>ID: {reg.id}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Amount</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', color: 'white' }}>₹{reg.amount}</div>
                    </div>
                  </div>

                  <div style={{ padding: '2rem' }}>
                    
                    {/* Status Tracking Pipeline */}
                    <div className="status-pipeline" style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                      <StatusStep 
                        label="Documents" 
                        status={reg.verificationStatus === 'VERIFIED' ? 'success' : (reg.verificationStatus === 'REQUIRES_CORRECTION' ? 'error' : 'pending')} 
                      />
                      <div style={{ width: '20px', height: '2px', background: 'rgba(255,255,255,0.2)', alignSelf: 'center', flexShrink: 0 }} />
                      <StatusStep 
                        label="Payment" 
                        status={reg.paymentStatus === 'SUCCESS' ? 'success' : (reg.verificationStatus === 'VERIFIED' ? 'pending' : 'waiting')} 
                      />
                      <div style={{ width: '20px', height: '2px', background: 'rgba(255,255,255,0.2)', alignSelf: 'center', flexShrink: 0 }} />
                      <StatusStep 
                        label="Pass Issued" 
                        status={reg.passIssued ? 'success' : 'waiting'} 
                      />
                    </div>

                    {reg.verificationStatus === 'REQUIRES_CORRECTION' && reg.verificationNotes && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem' }}>
                        <h4 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                          <AlertCircle size={20} /> Action Required: Correction Requested
                        </h4>
                        <p style={{ margin: 0, color: 'white', lineHeight: 1.5 }}>{reg.verificationNotes}</p>
                        <button className="btn-secondary" style={{ marginTop: '1rem', borderColor: '#ef4444', color: '#ef4444' }}>Update Documents</button>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <User size={18} /> Participants
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {reg.participants?.map((p, index) => (
                            <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--color-gold)' }}>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Participant {index + 1}</div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 500, color: 'white' }}>{p.fullName}</div>
                              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{p.gender}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <FileText size={18} /> Uploaded Documents
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {reg.verificationDocs && reg.verificationDocs.length > 0 ? (
                            reg.verificationDocs.map((doc, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <FileText size={16} color="var(--text-muted)" />
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                  <div style={{ fontSize: '0.9rem', color: 'white', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{doc.filename || 'Document'}</div>
                                </div>
                                <CheckCircle2 size={16} color="var(--color-success)" />
                              </div>
                            ))
                          ) : (
                            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                              No documents found.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      {reg.passIssued ? (
                        <div style={{ textAlign: 'center', padding: '2rem', background: 'radial-gradient(circle, rgba(255,215,0,0.1) 0%, rgba(0,0,0,0) 70%)' }}>
                          <h3 style={{ fontSize: '1.5rem', color: 'var(--color-gold)', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>Your Pass is Ready</h3>
                          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Show your digital pass at the entrance.</p>
                          <button className="btn-primary" onClick={() => navigate(`/account/pass/${reg.id}`)} style={{ margin: '0 auto' }}>
                            <Ticket size={18} /> View Digital Pass
                          </button>
                        </div>
                      ) : (
                        reg.verificationStatus === 'VERIFIED' && (!reg.paymentStatus || reg.paymentStatus === 'PENDING') && (
                          <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
                            <h3 style={{ fontSize: '1.5rem', color: 'white', marginBottom: '0.5rem' }}>Complete Payment</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Your documents are verified. Complete the payment to receive your pass.</p>
                            <button className="btn-primary" disabled style={{ margin: '0 auto', opacity: 0.5 }}>
                              Pay ₹{reg.amount} (Integration Pending)
                            </button>
                          </div>
                        )
                      )}
                      
                      {reg.verificationStatus !== 'VERIFIED' && !reg.passIssued && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          <Clock size={24} style={{ opacity: 0.5, margin: '0 auto 0.5rem' }} />
                          <p>Your registration is currently under review by our team.</p>
                        </div>
                      )}
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

function StatusStep({ label, status }) {
  let color = 'rgba(255,255,255,0.2)';
  let bg = 'transparent';
  let icon = <Clock size={16} />;
  
  if (status === 'success') {
    color = 'var(--color-success)';
    bg = 'rgba(34, 197, 94, 0.1)';
    icon = <CheckCircle2 size={16} />;
  } else if (status === 'error') {
    color = 'var(--color-error)';
    bg = 'rgba(239, 68, 68, 0.1)';
    icon = <AlertCircle size={16} />;
  } else if (status === 'pending') {
    color = 'var(--color-gold)';
    bg = 'rgba(255, 215, 0, 0.1)';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', background: bg, border: `1px solid ${status === 'waiting' ? 'rgba(255,255,255,0.1)' : color}`, borderRadius: '999px', flexShrink: 0 }}>
      <div style={{ color: status === 'waiting' ? 'rgba(255,255,255,0.3)' : color }}>{icon}</div>
      <span style={{ fontSize: '0.9rem', fontWeight: 500, color: status === 'waiting' ? 'rgba(255,255,255,0.5)' : 'white' }}>{label}</span>
    </div>
  );
}
