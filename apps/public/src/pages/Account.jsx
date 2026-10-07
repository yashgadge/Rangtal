import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
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

// Shown on top of a pass QR only after the pass has actually been checked in.
function CheckedInOverlay({ small = false }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 5,
      background: 'rgba(26,5,11,0.82)', backdropFilter: 'blur(3px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: small ? '0.25rem' : '0.5rem',
      pointerEvents: 'none'
    }}>
      <CheckCircle2 size={small ? 28 : 48} color="#4ade80" />
      <div style={{ color: '#FFF5E5', fontWeight: 700, letterSpacing: '3px', fontSize: small ? '0.7rem' : '1rem', textTransform: 'uppercase' }}>Checked In</div>
      <div style={{ color: '#E8D5B5', opacity: 0.8, fontSize: small ? '0.55rem' : '0.7rem', letterSpacing: '1px' }}>Pass already used</div>
    </div>
  );
}


export default function Account() {
  const [user, setUser] = useState(auth.currentUser);
  const [selectedPass, setSelectedPass] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(null);
  const navigate = useNavigate();

  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let unmounted = false;

    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (unmounted) return;
      setUser(currentUser);
      if (currentUser) {
        setAuthLoading(false);
      }
    });

    import('firebase/auth').then(({ getRedirectResult }) => {
      getRedirectResult(auth)
        .then(() => {
          if (!unmounted) setAuthLoading(false);
        })
        .catch((error) => {
          console.warn("Could not get redirect result:", error);
          if (!unmounted) setAuthLoading(false);
        });
    }).catch(e => {
      console.warn("Failed to load firebase/auth module:", e);
      if (!unmounted) setAuthLoading(false);
    });

    return () => {
      unmounted = true;
      unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    const { GoogleAuthProvider, signInWithPopup, signInWithRedirect, browserPopupRedirectResolver } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    try {
      await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    } catch (error) {
      console.warn("signInWithPopup failed, falling back to signInWithRedirect", error);
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user' || error.message?.includes('Cross-Origin-Opener-Policy')) {
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectError) {
          console.error("Redirect fallback failed", redirectError);
        }
      }
    }
  };

  const [rawRegistrations, setRawRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setRawRegistrations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let unsubRegs, unsubParts, unsubPasses;
    let regs = [], parts = [], passes = [];

    const buildData = () => {
      const built = regs.map(reg => ({
        ...reg,
        participants: parts.filter(p => p.registrationId === reg.id),
        passes: passes.filter(p => p.registrationId === reg.id)
      }));
      built.sort((a, b) => {
        const t1 = a.createdAt?.toMillis() || 0;
        const t2 = b.createdAt?.toMillis() || 0;
        return t2 - t1;
      });
      setRawRegistrations(built);
      setLoading(false);
    };

    unsubRegs = onSnapshot(query(collection(db, 'registrations'), where('uid', '==', user.uid)), (snap) => {
      regs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      buildData();
    }, (err) => { console.error(err); setError(err.message); });

    unsubParts = onSnapshot(query(collection(db, 'participants'), where('uid', '==', user.uid)), (snap) => {
      parts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      buildData();
    });

    unsubPasses = onSnapshot(query(collection(db, 'passes'), where('uid', '==', user.uid)), (snap) => {
      passes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      buildData();
    });

    return () => {
      if (unsubRegs) unsubRegs();
      if (unsubParts) unsubParts();
      if (unsubPasses) unsubPasses();
    };
  }, [user]);

  const { data: collegesData } = useFirebaseData(`colleges_all`, async () => {
    const snap = await getDocs(query(collection(db, 'colleges')));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });

  const registrations = rawRegistrations || [];

  const getCollegeName = (collegeId, participants) => {
    if (collegeId === 'OTHER' && participants && participants.length > 0 && participants[0].custom_other_college_name) {
      return participants[0].custom_other_college_name;
    }
    const found = collegesData?.find(c => c.id === collegeId);
    return found ? found.name : collegeId;
  };

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
    } finally {
      setLoadingPayment(null);
    }
  };

  const handleVerifyPayment = async (reg) => {
    try {
      setLoadingPayment(reg.id);
      const syncPaymentStatus = httpsCallable(functions, 'syncPaymentStatus');
      const response = await syncPaymentStatus({ registrationId: reg.id });
      
      if (response.data.success) {
        alert("Payment verified successfully! Your pass will be issued shortly.");
      } else {
        alert("No completed payment found. Please try paying again.");
      }
    } catch (err) {
      console.error("Verification failed", err);
      alert("Verification failed: " + err.message);
    } finally {
      setLoadingPayment(null);
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
      
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'l' : 'p',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
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
      let pdf;
      for (let i = 0; i < passes.length; i++) {
        const pass = passes[i];
        const element = document.getElementById(`pass-render-${pass.id}`);
        if (!element) continue;

        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#0a0a0a' });
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        
        if (i === 0) {
          pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? 'l' : 'p',
            unit: 'px',
            format: [canvas.width, canvas.height]
          });
        } else {
          pdf.addPage([canvas.width, canvas.height], canvas.width > canvas.height ? 'l' : 'p');
        }
        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      }
      
      if (pdf) pdf.save(`Rangtal_All_Passes.pdf`);
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
      
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'l' : 'p',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      
      // Convert PDF to Blob
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], `Rangtal_Pass_${passId.slice(0,6)}.pdf`, { type: 'application/pdf' });

      if (navigator.share && (typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : true)) {
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
          RANGTAAL
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

  const allPasses = registrations?.reduce((acc, r) => {
    const passes = r.passes?.map(p => {
      const regParts = r.participants || [];
      const relevant = p.isGroup ? regParts : regParts.filter(part => part.id === p.participantId);
      const checkedInCount = relevant.filter(part => part.checkInStatus === 'CHECKED_IN').length;
      const checkedIn = relevant.length > 0 && checkedInCount === relevant.length;
      return {
        ...p,
        regType: r.packageName || r.type,
        collegeName: getCollegeName(r.collegeId, r.participants),
        checkedIn,
        checkedInCount,
        totalMembers: relevant.length,
        participantName: p.isGroup ? `Group of ${p.participantCount}` : (regParts.find(part => part.id === p.participantId)?.fullName || 'Participant')
      };
    }) || [];
    return acc.concat(passes);
  }, []) || [];

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', backgroundColor: '#1A050B', overflow: 'hidden' }}>
      
      {/* Background Plate matching Hero */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: '120%', height: '120%', top: '-10%', left: '-10%', backgroundImage: 'url("https://res.cloudinary.com/sy2pu4gk/image/upload/v1791404106/garba_bg.webp")', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(14px) brightness(0.7) saturate(1.2)' }} />
        <div style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, background: 'radial-gradient(ellipse at bottom, rgba(210,50,0,0.2) 0%, rgba(26,5,11,0.9) 100%)' }} />
        {/* Subtle animated mandala for premium feel */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '80vw', height: '80vw', transform: 'translate(-50%, -50%)', opacity: 0.3, pointerEvents: 'none' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '1px dashed rgba(232,213,181,0.15)', animation: 'spin 60s linear infinite' }} />
        </div>
      </div>

      <div className="content-layer" style={{ position: 'relative', zIndex: 10, paddingTop: '80px', paddingBottom: '80px', minHeight: '100vh' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 2rem' }}>
          
          {/* Header */}
          <div className="account-header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', borderBottom: '1px solid rgba(232,213,181,0.1)', paddingBottom: '1rem' }}>
            <div>
              <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '3rem', fontWeight: 700, margin: 0, background: 'linear-gradient(to bottom, #FFF5E5 30%, #E8D5B5 80%, #B73568 150%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.02em' }}>My Dashboard</h1>
              <div style={{ fontFamily: 'var(--font-body)', color: '#E8D5B5', marginTop: '0.5rem', letterSpacing: '2px', fontSize: '0.8rem', textTransform: 'uppercase', opacity: 0.8, wordBreak: 'break-all' }}>{user.email}</div>
            </div>
            <div className="header-actions" style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ width: '160px', height: '40px' }}>
                <button onClick={() => navigate('/register')} style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #D23200, #B73568)', border: 'none', borderRadius: '8px', color: '#FFF5E5', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '1px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 15px rgba(210, 50, 0, 0.4)' }}>
                  BUY PASSES <ChevronRight size={14} />
                </button>
              </div>
              <GlassSurface width={120} height={40} borderRadius={8} blur={8} opacity={0.3} borderWidth={0.1} backgroundOpacity={0.05}>
                <button onClick={handleLogout} style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', color: '#E8D5B5', fontFamily: 'var(--font-body)', fontSize: '0.75rem', letterSpacing: '1px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: 0.8 }}>
                  <LogOut size={14} /> LOGOUT
                </button>
              </GlassSurface>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="account-tabs" style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid rgba(232,213,181,0.05)', marginBottom: '1.5rem', overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '0.5rem' }}>
            <button 
              onClick={() => setActiveTab('passes')}
              style={{ 
                background: 'transparent', border: 'none', color: activeTab === 'passes' ? '#FFF5E5' : 'rgba(232,213,181,0.5)',
                fontSize: '0.85rem', fontWeight: 600, padding: '0 0 1rem 0', cursor: 'pointer', letterSpacing: '2px', textTransform: 'uppercase',
                borderBottom: activeTab === 'passes' ? '2px solid #E8D5B5' : '2px solid transparent',
                transition: 'all 0.3s ease', fontFamily: 'var(--font-body)'
              }}>
              Digital Passes
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              style={{ 
                background: 'transparent', border: 'none', color: activeTab === 'history' ? '#FFF5E5' : 'rgba(232,213,181,0.5)',
                fontSize: '0.85rem', fontWeight: 600, padding: '0 0 1rem 0', cursor: 'pointer', letterSpacing: '2px', textTransform: 'uppercase',
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
                  <div className="collection-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <Ticket size={20} color="#E8D5B5" />
                      <h2 style={{ fontSize: '1.25rem', color: '#FFF5E5', margin: 0, fontFamily: '"Playfair Display", serif', letterSpacing: '0.05em' }}>Your Collection</h2>
                    </div>
                    <GlassSurface width={180} height={36} borderRadius={6} blur={10} opacity={0.6} borderWidth={0.1} backgroundOpacity={0.1}>
                      <button disabled={downloading} onClick={() => downloadAllPassesPDF(allPasses)} style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', color: '#FFF5E5', fontFamily: 'var(--font-body)', fontSize: '0.65rem', letterSpacing: '1px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        {downloading ? 'GENERATING...' : <><Download size={14} /> DOWNLOAD ALL</>}
                      </button>
                    </GlassSurface>
                  </div>
                  
                  <div className="passes-grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
                    {allPasses.map(pass => (
                      <div key={pass.id}>
                        <motion.div 
                          className="pass-card-ui"
                          whileHover={{ y: -5 }}
                          onClick={() => setSelectedPass(pass)}
                          style={{ 
                            background: 'rgba(20, 5, 10, 0.6)', backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(232,213,181,0.15)', borderRadius: '16px', 
                            padding: '1.5rem 1rem', cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s ease',
                            boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)'
                          }}
                        >
                          <div className="qr-wrapper" style={{ position: 'relative', background: '#FFF5E5', padding: '0.75rem', borderRadius: '12px', display: 'inline-block', marginBottom: '1rem', boxShadow: '0 0 20px rgba(255,245,229,0.1)' }}>
                            <QRCodeSVG value={pass.secureCode} size={140} bgColor={"#FFF5E5"} fgColor={"#1A050B"} level={"Q"} />
                            {pass.checkedIn && <CheckedInOverlay small />}
                          </div>
                          {!pass.checkedIn && pass.isGroup && pass.checkedInCount > 0 && (
                            <div style={{ fontSize: '0.65rem', color: '#D4AF37', marginBottom: '0.5rem', letterSpacing: '1px' }}>{pass.checkedInCount}/{pass.totalMembers} CHECKED IN</div>
                          )}
                          <div className="participant-name" style={{ fontSize: '1.1rem', color: '#FFF5E5', fontFamily: '"Playfair Display", serif', fontWeight: 600, letterSpacing: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pass.participantName}</div>
                          <div style={{ fontSize: '0.65rem', color: '#E8D5B5', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.8 }}>{pass.regType} PASS</div>
                          <div style={{ fontSize: '0.8rem', color: '#D4AF37', marginTop: '0.5rem', fontFamily: 'monospace', letterSpacing: '1px' }}>{pass.readableId || pass.id.slice(0,8).toUpperCase()}</div>
                          {pass.collegeName && <div style={{ fontSize: '0.65rem', color: '#E8D5B5', marginTop: '0.25rem', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pass.collegeName}</div>}
                          
                          <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(232,213,181,0.1)', paddingTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button onClick={(e) => { e.stopPropagation(); sharePassPDF(pass.id); }} style={{ padding: '0.4rem 0.8rem', background: 'rgba(232,213,181,0.1)', border: '1px solid rgba(232,213,181,0.2)', color: '#E8D5B5', borderRadius: '4px', fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'background 0.2s' }}>
                              <Share2 size={12} /> Share
                            </button>
                          </div>
                        </motion.div>

                        {/* Hidden Render Element for PDF Generation */}
                        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                          <div id={`pass-render-${pass.id}`} style={{ width: '450px', background: '#1A050B', padding: '2.5rem', color: '#FFF5E5', borderRadius: '24px', border: '2px solid #D4AF37', position: 'relative', overflow: 'hidden' }}>
                            {/* Decorative Background Elements */}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '8px', background: 'linear-gradient(90deg, #B73568, #D4AF37, #B73568)' }} />
                            <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', borderRadius: '50%', border: '2px dashed rgba(212, 175, 55, 0.2)', opacity: 0.5 }} />
                            <div style={{ position: 'absolute', bottom: '-50px', left: '-50px', width: '150px', height: '150px', borderRadius: '50%', border: '2px dashed rgba(212, 175, 55, 0.2)', opacity: 0.5 }} />

                            <div style={{ textAlign: 'center', borderBottom: '1px solid rgba(212, 175, 55, 0.3)', paddingBottom: '1.5rem', marginBottom: '2rem', position: 'relative', zIndex: 1 }}>
                              <h2 style={{ fontSize: '2.5rem', color: '#D4AF37', margin: '0 0 0.5rem 0', fontFamily: '"Playfair Display", serif', letterSpacing: '4px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>RANGTAAL</h2>
                              <div style={{ fontSize: '0.8rem', letterSpacing: '3px', color: '#E8D5B5', textTransform: 'uppercase', marginBottom: '0.5rem', opacity: 0.9 }}>by Rhythm Rebels</div>
                              <div style={{ fontSize: '0.9rem', letterSpacing: '6px', color: '#B73568', fontWeight: 'bold' }}>2026</div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem', position: 'relative', zIndex: 1 }}>
                              <div style={{ position: 'relative', background: '#FFF5E5', padding: '1.25rem', borderRadius: '16px', display: 'inline-flex', boxShadow: '0 8px 32px rgba(212, 175, 55, 0.15)', border: '1px solid rgba(212, 175, 55, 0.5)' }}>
                                <QRCodeSVG value={pass.secureCode} size={220} bgColor={"#FFF5E5"} fgColor={"#1A050B"} level={"H"} />
                                {pass.checkedIn && <CheckedInOverlay />}
                              </div>
                            </div>

                            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.15)', position: 'relative', zIndex: 1 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', textAlign: 'left' }}>
                                <div>
                                  <div style={{ fontSize: '0.75rem', color: '#E8D5B5', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.25rem', opacity: 0.7 }}>Participant</div>
                                  <div style={{ fontSize: '1.25rem', fontFamily: '"Playfair Display", serif', color: '#FFF5E5', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pass.participantName}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.75rem', color: '#E8D5B5', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.25rem', opacity: 0.7 }}>Pass Type</div>
                                  <div style={{ fontSize: '1.25rem', fontFamily: '"Playfair Display", serif', color: '#FFF5E5', fontWeight: 600 }}>{pass.regType}</div>
                                </div>
                              </div>
                              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed rgba(212, 175, 55, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: '0.65rem', color: '#E8D5B5', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.5 }}>Pass ID</div>
                                  <div style={{ fontSize: '0.85rem', color: '#D4AF37', fontFamily: 'monospace', letterSpacing: '1px' }}>{pass.readableId || pass.id.slice(0,8).toUpperCase()}</div>
                                  {pass.collegeName && <div style={{ fontSize: '0.7rem', color: '#E8D5B5', marginTop: '0.25rem', opacity: 0.8 }}>{pass.collegeName}</div>}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#B73568', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }}>ENTRY VALID</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', background: 'rgba(20, 5, 10, 0.6)', backdropFilter: 'blur(16px)', border: '1px dashed rgba(232,213,181,0.2)', borderRadius: '24px', marginTop: '1rem' }}>
                  <div style={{ marginBottom: '2.5rem', width: '100%', maxWidth: '280px' }}>
                    <button onClick={() => navigate('/register')} style={{ width: '100%', height: '50px', background: 'linear-gradient(90deg, #D23200, #B73568)', border: 'none', borderRadius: '8px', color: '#FFF5E5', fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 'bold', letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 15px rgba(210, 50, 0, 0.4)', transition: 'transform 0.2s' }}>
                      BOOK YOUR PASS <ChevronRight size={16} />
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.6 }}>
                    <Ticket size={32} color="#E8D5B5" style={{ marginBottom: '1rem' }} />
                    <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.5rem', color: '#FFF5E5', margin: '0 0 0.5rem 0', textAlign: 'center' }}>The Celebration Awaits</h2>
                    <p style={{ fontFamily: 'var(--font-body)', color: '#E8D5B5', letterSpacing: '1px', marginBottom: 0, textAlign: 'center', maxWidth: '300px', fontSize: '0.85rem', lineHeight: '1.5' }}>You haven't secured your digital passes for Rangtal Garba Night yet.</p>
                  </div>
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', background: 'rgba(20, 5, 10, 0.6)', backdropFilter: 'blur(16px)', border: '1px dashed rgba(232,213,181,0.2)', borderRadius: '24px' }}>
                  <div style={{ marginBottom: '2.5rem', width: '100%', maxWidth: '280px' }}>
                    <button onClick={() => navigate('/register')} style={{ width: '100%', height: '50px', background: 'linear-gradient(90deg, #D23200, #B73568)', border: 'none', borderRadius: '8px', color: '#FFF5E5', fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 'bold', letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 15px rgba(210, 50, 0, 0.4)', transition: 'transform 0.2s' }}>
                      START EXPLORING <ChevronRight size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.6 }}>
                    <Clock size={32} color="#E8D5B5" style={{ marginBottom: '1rem' }} />
                    <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.5rem', color: '#FFF5E5', margin: '0 0 0.5rem 0', textAlign: 'center' }}>No History Found</h2>
                    <p style={{ fontFamily: 'var(--font-body)', color: '#E8D5B5', letterSpacing: '1px', marginBottom: 0, textAlign: 'center', maxWidth: '300px', fontSize: '0.85rem', lineHeight: '1.5' }}>Your registration history is currently empty.</p>
                  </div>
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
                      {reg.collegeId && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>College: {getCollegeName(reg.collegeId, reg.participants)}</div>}
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
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                              <button className="btn-primary" onClick={() => handlePayment(reg)} disabled={loadingPayment === reg.id}>
                                {loadingPayment === reg.id ? 'Processing...' : `Pay ₹${reg.amount} Now`}
                              </button>
                              <button className="btn-secondary" onClick={() => handleVerifyPayment(reg)} disabled={loadingPayment === reg.id}>
                                Verify Pending Payment
                              </button>
                            </div>
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
            
            <div style={{ position: 'relative', background: '#FFF5E5', padding: '1rem', borderRadius: '16px', display: 'inline-block', marginBottom: '2.5rem', boxShadow: '0 0 30px rgba(232,213,181,0.15)' }}>
              <QRCodeSVG value={selectedPass.secureCode} size={220} bgColor={"#FFF5E5"} fgColor={"#1A050B"} level={"Q"} />
              {selectedPass.checkedIn && <CheckedInOverlay />}
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
              <div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(232,213,181,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>Pass ID</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#D4AF37', fontFamily: 'monospace', marginTop: '0.25rem' }}>{selectedPass.readableId || selectedPass.id.slice(0,8).toUpperCase()}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(232,213,181,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>College</div>
                <div style={{ fontSize: '0.9rem', color: '#FFF5E5', marginTop: '0.25rem' }}>{selectedPass.collegeName || 'N/A'}</div>
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
