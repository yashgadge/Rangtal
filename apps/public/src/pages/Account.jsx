import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Ticket, Clock, CheckCircle2, AlertCircle, FileText, User, Share2, Download, ChevronRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useFirebaseData } from '../../../../shared/hooks/useFirebaseData.js';
import GlassSurface from '../components/ui/GlassSurface.jsx';
import './Account.css';

export default function Account() {
  const [user, setUser] = useState(auth.currentUser);
  const [selectedPass, setSelectedPass] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const navigate = useNavigate();

  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in", error);
    }
  };

  const { data: rawRegistrations, loading, error } = useFirebaseData(`account_regs_${user?.uid}`, async () => {
    if (!user) return [];
    
    const regsSnap = await getDocs(query(collection(db, 'registrations'), where('uid', '==', user.uid)));
    const regsData = regsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const regs = await Promise.all(regsData.map(async (reg) => {
      const partsSnap = await getDocs(query(collection(db, 'participants'), where('registrationId', '==', reg.id), where('uid', '==', user.uid)));
      const passesSnap = await getDocs(query(collection(db, 'passes'), where('registrationId', '==', reg.id), where('uid', '==', user.uid)));
      
      return {
        ...reg,
        participants: partsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        passes: passesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      };
    }));

    regs.sort((a, b) => {
      const t1 = a.createdAt?.toMillis() || 0;
      const t2 = b.createdAt?.toMillis() || 0;
      return t2 - t1;
    });

    return regs;
  }, { enabled: !!user });

  const registrations = rawRegistrations || [];

  const handlePayment = async (reg) => {
    try {
      const createOrder = httpsCallable(functions, 'createPaymentOrder');
      const { data } = await createOrder({ registrationId: reg.id });
      
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_placeholder",
        amount: data.amount * 100,
        currency: "INR",
        name: "Rangtal Garba",
        description: `${reg.type === 'COUPLE' ? 'Couple' : 'Single'} Pass Payment`,
        order_id: data.orderId,
        handler: async function (response) {
          try {
            const verifyPayment = httpsCallable(functions, 'verifyPayment');
            await verifyPayment({
              paymentId: data.paymentId,
              gatewayPaymentId: response.razorpay_payment_id,
              gatewaySignature: response.razorpay_signature
            });
            window.location.reload();
          } catch (err) {
            console.error("Verification failed", err);
            alert("Payment verification failed. Please contact support.");
          }
        },
        prefill: {
          email: user.email
        },
        theme: {
          color: "#D4AF37"
        }
      };
      
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Order creation failed", err);
      alert("Could not initiate payment: " + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const downloadPassPDF = async (passId) => {
    setDownloading(true);
    try {
      const element = document.getElementById(`pass-render-${passId}`);
      if (!element) return;
      
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#0a0a0a' });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Rangtal_Pass_${passId.slice(0,6)}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Failed to download PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const downloadAllPassesPDF = async (passes) => {
    setDownloading(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      for (let i = 0; i < passes.length; i++) {
        const pass = passes[i];
        const element = document.getElementById(`pass-render-${pass.id}`);
        if (!element) continue;

        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#0a0a0a' });
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
      
      pdf.save(`Rangtal_All_Passes.pdf`);
    } catch (err) {
      console.error(err);
      alert("Failed to download PDFs.");
    } finally {
      setDownloading(false);
    }
  };
  const sharePassPDF = async (passId) => {
    setDownloading(true);
    try {
      const element = document.getElementById(`pass-render-${passId}`);
      if (!element) return;
      
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#0a0a0a' });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      
      // Convert PDF to Blob
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], `Rangtal_Pass_${passId.slice(0,6)}.pdf`, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Rangtal Digital Pass',
          text: 'Here is my digital pass for Rangtal Garba Night!',
          files: [file]
        });
      } else {
        alert("Sharing is not supported on this device. The PDF will be downloaded instead.");
        pdf.save(`Rangtal_Pass_${passId.slice(0,6)}.pdf`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to share PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const [activeTab, setActiveTab] = useState('passes'); // 'passes' | 'history'
  if (authLoading || (user && loading)) {
    return (
      <div className="account-page app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-heading)', fontSize: '2rem', letterSpacing: '4px' }}>
          RANGTAL
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="account-page app-container">
        <div className="content-layer">
          <div className="account-container" style={{ maxWidth: '600px', margin: '0 auto', paddingTop: '8rem', textAlign: 'center' }}>
            <h1 className="text-title" style={{ fontFamily: 'var(--font-heading)' }}>Join the Celebration</h1>
            <p className="text-body" style={{ marginBottom: '3rem' }}>Sign in to register for passes and access your dashboard.</p>
            <button onClick={handleLogin} className="btn-primary" style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  const allPasses = registrations?.flatMap(r => 
    r.passes?.map(p => ({
      ...p,
      regType: r.type,
      participantName: p.isGroup ? `Group of ${p.participantCount}` : (r.participants?.find(part => part.id === p.participantId)?.fullName || 'Participant')
    })) || []
  ) || [];

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', backgroundColor: '#1A050B', overflow: 'hidden' }}>
      
      {/* Background Plate matching Hero */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: '120%', height: '120%', top: '-10%', left: '-10%', backgroundImage: 'url("/images/garba_bg.png")', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(14px) brightness(0.7) saturate(1.2)' }} />
        <div style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, background: 'radial-gradient(ellipse at bottom, rgba(210,50,0,0.2) 0%, rgba(26,5,11,0.9) 100%)' }} />
        {/* Subtle animated mandala for premium feel */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '80vw', height: '80vw', transform: 'translate(-50%, -50%)', opacity: 0.3, pointerEvents: 'none' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '1px dashed rgba(232,213,181,0.15)', animation: 'spin 60s linear infinite' }} />
        </div>
      </div>

      <div className="content-layer" style={{ position: 'relative', zIndex: 10, paddingTop: '120px', paddingBottom: '80px', minHeight: '100vh' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 2rem' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', borderBottom: '1px solid rgba(232,213,181,0.1)', paddingBottom: '2rem' }}>
            <div>
              <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '3rem', fontWeight: 700, margin: 0, background: 'linear-gradient(to bottom, #FFF5E5 30%, #E8D5B5 80%, #B73568 150%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.02em' }}>My Dashboard</h1>
              <div style={{ fontFamily: 'var(--font-body)', color: '#E8D5B5', marginTop: '0.5rem', letterSpacing: '2px', fontSize: '0.8rem', textTransform: 'uppercase', opacity: 0.8 }}>{user.email}</div>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <GlassSurface width={200} height={45} borderRadius={8} blur={8} opacity={0.5} borderWidth={0.1} backgroundOpacity={0.1}>
                <button onClick={() => navigate('/register')} style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', color: '#FFF5E5', fontFamily: 'var(--font-body)', fontSize: '0.85rem', letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  BUY MORE PASSES <ChevronRight size={16} />
                </button>
              </GlassSurface>
              <GlassSurface width={140} height={45} borderRadius={8} blur={8} opacity={0.3} borderWidth={0.1} backgroundOpacity={0.05}>
                <button onClick={handleLogout} style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', color: '#E8D5B5', fontFamily: 'var(--font-body)', fontSize: '0.85rem', letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: 0.8 }}>
                  <LogOut size={16} /> SIGN OUT
                </button>
              </GlassSurface>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '3rem', borderBottom: '1px solid rgba(232,213,181,0.05)', marginBottom: '3rem' }}>
            <button 
              onClick={() => setActiveTab('passes')}
              style={{ 
                background: 'transparent', border: 'none', color: activeTab === 'passes' ? '#FFF5E5' : 'rgba(232,213,181,0.5)',
                fontSize: '0.9rem', fontWeight: 600, padding: '0 0 1rem 0', cursor: 'pointer', letterSpacing: '3px', textTransform: 'uppercase',
                borderBottom: activeTab === 'passes' ? '2px solid #E8D5B5' : '2px solid transparent',
                transition: 'all 0.3s ease', fontFamily: 'var(--font-body)'
              }}>
              Digital Passes
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              style={{ 
                background: 'transparent', border: 'none', color: activeTab === 'history' ? '#FFF5E5' : 'rgba(232,213,181,0.5)',
                fontSize: '0.9rem', fontWeight: 600, padding: '0 0 1rem 0', cursor: 'pointer', letterSpacing: '3px', textTransform: 'uppercase',
                borderBottom: activeTab === 'history' ? '2px solid #E8D5B5' : '2px solid transparent',
                transition: 'all 0.3s ease', fontFamily: 'var(--font-body)'
              }}>
              Registration History
            </button>
          </div>

          {activeTab === 'passes' && (
            <div style={{ marginBottom: '4rem' }}>
              {allPasses.length > 0 ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <Ticket size={24} color="#E8D5B5" />
                      <h2 style={{ fontSize: '1.5rem', color: '#FFF5E5', margin: 0, fontFamily: '"Playfair Display", serif', letterSpacing: '0.05em' }}>Your Collection</h2>
                    </div>
                    <GlassSurface width={220} height={40} borderRadius={6} blur={10} opacity={0.6} borderWidth={0.1} backgroundOpacity={0.1}>
                      <button disabled={downloading} onClick={() => downloadAllPassesPDF(allPasses)} style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', color: '#FFF5E5', fontFamily: 'var(--font-body)', fontSize: '0.75rem', letterSpacing: '1px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        {downloading ? 'GENERATING...' : <><Download size={14} /> DOWNLOAD ALL PDF</>}
                      </button>
                    </GlassSurface>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '2rem' }}>
                    {allPasses.map(pass => (
                      <div key={pass.id}>
                        <motion.div 
                          whileHover={{ y: -5 }}
                          onClick={() => setSelectedPass(pass)}
                          style={{ 
                            background: 'rgba(20, 5, 10, 0.6)', backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(232,213,181,0.15)', borderRadius: '16px', 
                            padding: '2rem 1.5rem', cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s ease',
                            boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)'
                          }}
                        >
                          <div style={{ background: '#FFF5E5', padding: '1rem', borderRadius: '12px', display: 'inline-block', marginBottom: '1.5rem', boxShadow: '0 0 20px rgba(255,245,229,0.1)' }}>
                            <QRCodeSVG value={pass.secureCode} size={160} bgColor={"#FFF5E5"} fgColor={"#1A050B"} level={"Q"} />
                          </div>
                          <div style={{ fontSize: '1.2rem', color: '#FFF5E5', fontFamily: '"Playfair Display", serif', fontWeight: 600, letterSpacing: '1px' }}>{pass.participantName}</div>
                          <div style={{ fontSize: '0.7rem', color: '#E8D5B5', marginTop: '0.5rem', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.8 }}>{pass.regType} PASS</div>
                          
                          <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(232,213,181,0.1)', paddingTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button onClick={(e) => { e.stopPropagation(); sharePassPDF(pass.id); }} style={{ padding: '0.5rem 1rem', background: 'rgba(232,213,181,0.1)', border: '1px solid rgba(232,213,181,0.2)', color: '#E8D5B5', borderRadius: '4px', fontSize: '0.7rem', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'background 0.2s' }}>
                              <Share2 size={12} /> Share
                            </button>
                          </div>
                        </motion.div>

                        {/* Hidden Render Element for PDF Generation */}
                        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                          <div id={`pass-render-${pass.id}`} style={{ width: '450px', background: '#0a0a0a', padding: '2rem', color: 'white' }}>
                            <div style={{ textAlign: 'center', borderBottom: '2px dashed #333', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                              <h2 style={{ fontSize: '2rem', color: '#D4AF37', margin: 0 }}>RANGTAL</h2>
                              <div style={{ fontSize: '0.8rem', letterSpacing: '4px', color: '#888' }}>2026</div>
                            </div>
                            <div style={{ background: 'white', padding: '1rem', display: 'inline-block', borderRadius: '12px', margin: '0 auto 1.5rem' }}>
                              <QRCodeSVG value={pass.secureCode} size={200} bgColor={"#ffffff"} fgColor={"#000000"} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', textAlign: 'left', marginBottom: '1.5rem' }}>
                              <div>
                                <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>Participant</div>
                                <div style={{ fontSize: '1.1rem' }}>{pass.participantName}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>Pass Type</div>
                                <div style={{ fontSize: '1.1rem' }}>{pass.regType}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 2rem', background: 'rgba(20, 5, 10, 0.6)', backdropFilter: 'blur(16px)', border: '1px dashed rgba(232,213,181,0.2)', borderRadius: '24px' }}>
                  <Ticket size={48} color="#E8D5B5" style={{ opacity: 0.3, marginBottom: '1.5rem' }} />
                  <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '2rem', color: '#FFF5E5', margin: '0 0 1rem 0' }}>The Celebration Awaits</h2>
                  <p style={{ fontFamily: 'var(--font-body)', color: 'rgba(232,213,181,0.7)', letterSpacing: '1px', marginBottom: '2.5rem', textAlign: 'center', maxWidth: '400px' }}>You haven't secured your digital passes for Rangtal Garba Night yet.</p>
                  
                  <GlassSurface width={250} height={50} borderRadius={8} blur={10} opacity={0.8} borderWidth={0.1} backgroundOpacity={0.2}>
                    <button onClick={() => navigate('/register')} style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', color: '#FFF5E5', fontFamily: 'var(--font-body)', fontSize: '0.9rem', letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      BOOK YOUR PASS <ChevronRight size={16} />
                    </button>
                  </GlassSurface>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div style={{ marginBottom: '4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <Clock size={24} color="#E8D5B5" />
                <h2 style={{ fontSize: '1.5rem', color: '#FFF5E5', margin: 0, fontFamily: '"Playfair Display", serif', letterSpacing: '0.05em' }}>Order History</h2>
              </div>
              {registrations.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 2rem', background: 'rgba(20, 5, 10, 0.6)', backdropFilter: 'blur(16px)', border: '1px dashed rgba(232,213,181,0.2)', borderRadius: '24px' }}>
                  <Clock size={48} color="#E8D5B5" style={{ opacity: 0.3, marginBottom: '1.5rem' }} />
                  <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '2rem', color: '#FFF5E5', margin: '0 0 1rem 0' }}>No History Found</h2>
                  <p style={{ fontFamily: 'var(--font-body)', color: 'rgba(232,213,181,0.7)', letterSpacing: '1px', marginBottom: '2.5rem', textAlign: 'center', maxWidth: '400px' }}>Your registration history is currently empty.</p>
                  
                  <GlassSurface width={250} height={50} borderRadius={8} blur={10} opacity={0.8} borderWidth={0.1} backgroundOpacity={0.2}>
                    <button onClick={() => navigate('/register')} style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', color: '#FFF5E5', fontFamily: 'var(--font-body)', fontSize: '0.9rem', letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      START EXPLORING
                    </button>
                  </GlassSurface>
                </div>
              ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {registrations.map((reg, index) => (
                  <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: index * 0.1 }}
                  key={reg.id} 
                  style={{ background: 'rgba(20, 5, 10, 0.4)', backdropFilter: 'blur(16px)', borderRadius: '16px', border: '1px solid rgba(232,213,181,0.15)', overflow: 'hidden' }}
                >
                  <div style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(232,213,181,0.1)', background: 'rgba(0,0,0,0.2)' }}>
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
                        label="Payment" 
                        status={reg.paymentStatus === 'SUCCESS' || reg.status === 'PASS_ISSUED' ? 'success' : (['VERIFIED'].includes(reg.status) ? 'pending' : 'waiting')} 
                      />
                      <div style={{ width: '20px', height: '2px', background: 'rgba(255,255,255,0.2)', alignSelf: 'center', flexShrink: 0 }} />
                      <StatusStep 
                        label="Pass Issued" 
                        status={reg.status === 'PASS_ISSUED' ? 'success' : 'waiting'} 
                      />
                    </div>

                    {reg.status === 'REQUIRES_CORRECTION' && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem' }}>
                        <h4 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                          <AlertCircle size={20} /> Action Required: Correction Requested
                        </h4>
                        <p style={{ margin: 0, color: 'white', lineHeight: 1.5 }}>Some participant documents require correction. Please review the details below and submit new documents.</p>
                        <button className="btn-secondary" onClick={() => navigate('/account')} style={{ marginTop: '1rem', borderColor: '#ef4444', color: '#ef4444' }}>Update Documents</button>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <User size={18} /> Participants
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {reg.participants?.map((p, index) => {
                            const indPass = reg.passes?.find(pass => pass.participantId === p.id && !pass.isGroup);
                            return (
                              <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', borderLeft: `3px solid ${p.verificationStatus === 'APPROVED' ? 'var(--color-success)' : p.verificationStatus === 'REQUIRES_CORRECTION' ? 'var(--color-error)' : 'var(--color-gold)'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Participant {index + 1}</div>
                                  <div style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', color: p.verificationStatus === 'APPROVED' ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                                    {p.verificationStatus}
                                  </div>
                                </div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 500, color: 'white' }}>{p.fullName}</div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{p.gender}</div>
                                {p.correctionReason && p.verificationStatus === 'REQUIRES_CORRECTION' && (
                                  <div style={{ fontSize: '0.85rem', color: 'var(--color-error)', marginTop: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                                    Reason: {p.correctionReason}
                                  </div>
                                )}
                                {indPass && (
                                  <div style={{ fontSize: '0.8rem', color: 'var(--color-gold)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Ticket size={14} /> Pass Ready
                                  </div>
                                )}
                              </div>
                            );
                          })}
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
                      {reg.status === 'PASS_ISSUED' ? (
                        <div style={{ textAlign: 'center', color: 'var(--color-success)' }}>
                          <CheckCircle2 size={32} style={{ margin: '0 auto 1rem' }} />
                          <h3 style={{ fontSize: '1.25rem', color: 'white', marginBottom: '0.5rem' }}>Pass Issued Successfully</h3>
                          <p style={{ color: 'var(--text-secondary)' }}>View your pass in the digital passes section above.</p>
                        </div>
                      ) : (
                        reg.status === 'VERIFIED' && (!reg.paymentStatus || reg.paymentStatus === 'PENDING') && (
                          <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
                            <h3 style={{ fontSize: '1.5rem', color: 'white', marginBottom: '0.5rem' }}>Complete Payment</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Your registration is reserved. Please complete your payment to receive your digital pass.</p>
                            <button className="btn-primary" onClick={() => handlePayment(reg)} style={{ margin: '0 auto' }}>
                              Pay ₹{reg.amount} Now
                            </button>
                          </div>
                        )
                      )}
                      
                      {reg.status !== 'VERIFIED' && reg.status !== 'PASS_ISSUED' && reg.status !== 'REQUIRES_CORRECTION' && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          <Clock size={24} style={{ opacity: 0.5, margin: '0 auto 0.5rem' }} />
                          <p>Your registration is pending.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          </div>
          )}
        </div>
      </div>

      {selectedPass && (
        <div 
          onClick={() => setSelectedPass(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(10, 2, 5, 0.9)', backdropFilter: 'blur(10px)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '2rem', animation: 'fadeIn 0.3s ease'
          }}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'rgba(20, 5, 10, 0.8)', backdropFilter: 'blur(20px)',
              borderRadius: '24px', border: '1px solid rgba(232,213,181,0.2)',
              padding: '3rem', maxWidth: '450px', width: '100%',
              boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.7)',
              textAlign: 'center', position: 'relative'
            }}
          >
            <button 
              onClick={() => setSelectedPass(null)}
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(232,213,181,0.1)', border: 'none', color: '#E8D5B5', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            >
              &times;
            </button>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '2.5rem', margin: '0 0 0.5rem 0', background: 'linear-gradient(to bottom, #FFF5E5 30%, #E8D5B5 80%, #B73568 150%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>RANGTAL</h2>
            <div style={{ fontSize: '0.7rem', letterSpacing: '4px', color: 'rgba(232,213,181,0.6)', marginBottom: '2rem', fontFamily: 'var(--font-body)', textTransform: 'uppercase' }}>JSPM University</div>
            
            <div style={{ background: '#FFF5E5', padding: '1rem', borderRadius: '16px', display: 'inline-block', marginBottom: '2.5rem', boxShadow: '0 0 30px rgba(232,213,181,0.15)' }}>
              <QRCodeSVG value={selectedPass.secureCode} size={220} bgColor={"#FFF5E5"} fgColor={"#1A050B"} level={"Q"} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', textAlign: 'left', borderTop: '1px solid rgba(232,213,181,0.1)', paddingTop: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(232,213,181,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>Participant</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#FFF5E5', fontFamily: '"Playfair Display", serif', marginTop: '0.25rem' }}>{selectedPass.participantName}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(232,213,181,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>Pass Type</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#FFF5E5', fontFamily: '"Playfair Display", serif', marginTop: '0.25rem' }}>{selectedPass.regType}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <GlassSurface width="50%" height={45} borderRadius={8} blur={8} opacity={0.6} borderWidth={0.1} backgroundOpacity={0.15} style={{ flex: 1 }}>
                <button disabled={downloading} onClick={() => downloadPassPDF(selectedPass.id)} style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', color: '#FFF5E5', fontFamily: 'var(--font-body)', fontSize: '0.75rem', letterSpacing: '1px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  {downloading ? 'WAIT...' : <><Download size={14} /> DOWNLOAD</>}
                </button>
              </GlassSurface>
              <GlassSurface width="50%" height={45} borderRadius={8} blur={8} opacity={0.3} borderWidth={0.1} backgroundOpacity={0.05} style={{ flex: 1 }}>
                <button disabled={downloading} onClick={() => sharePassPDF(selectedPass.id)} style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', color: '#E8D5B5', fontFamily: 'var(--font-body)', fontSize: '0.75rem', letterSpacing: '1px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  {downloading ? 'WAIT...' : <><Share2 size={14} /> SHARE</>}
                </button>
              </GlassSurface>
            </div>
          </motion.div>
        </div>
      )}
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
