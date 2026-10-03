import React, { useState } from 'react';
import { Scanner as QrScanner } from '@yudiel/react-qr-scanner';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, CheckCircle2, XCircle, UserCheck, RefreshCw, LogOut } from 'lucide-react';

export default function Scanner() {
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannerActive, setScannerActive] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleScan = async (detectedCodes) => {
    if (!scannerActive || isProcessing || detectedCodes.length === 0) return;
    
    const passId = detectedCodes[0].rawValue;
    if (!passId) return;

    setIsProcessing(true);
    setScannerActive(false);
    setLoading(true);
    setError(null);
    setScanResult(null);
    
    try {
      const verifyPassFn = httpsCallable(functions, 'verifyPass');
      const response = await verifyPassFn({ passId });
      setScanResult(response.data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Invalid or unrecognized pass");
    } finally {
      setLoading(false);
      setIsProcessing(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setError(null);
    setScannerActive(true);
  };

  const handleCheckIn = async (passId) => {
    setLoading(true);
    try {
      const checkInFn = httpsCallable(functions, 'checkInParticipant');
      await checkInFn({ passId });
      setScanResult(prev => ({ ...prev, status: 'USED' }));
    } catch (err) {
      setError(err.message || "Check-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', background: '#050505' }}>
      
      {/* Header */}
      <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-gold)', margin: 0, fontSize: '1.5rem', letterSpacing: '2px' }}>RANGTAL</h1>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.1)', padding: '0.25rem 0.75rem', borderRadius: '999px' }}>Gate Operations</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* Scanner View */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {scannerActive ? (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <QrScanner
                onScan={handleScan}
                onError={(e) => console.log('QR error (expected when no QR found):', e)}
                styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }}
              />
              <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 1000px rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '250px', height: '250px', border: '2px solid rgba(255,255,255,0.2)', borderRadius: '16px', zIndex: 2, pointerEvents: 'none' }}>
                {/* Scanner corners */}
                <div style={{ position: 'absolute', top: -2, left: -2, width: '40px', height: '40px', borderTop: '4px solid var(--color-gold)', borderLeft: '4px solid var(--color-gold)', borderRadius: '16px 0 0 0' }} />
                <div style={{ position: 'absolute', top: -2, right: -2, width: '40px', height: '40px', borderTop: '4px solid var(--color-gold)', borderRight: '4px solid var(--color-gold)', borderRadius: '0 16px 0 0' }} />
                <div style={{ position: 'absolute', bottom: -2, left: -2, width: '40px', height: '40px', borderBottom: '4px solid var(--color-gold)', borderLeft: '4px solid var(--color-gold)', borderRadius: '0 0 0 16px' }} />
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: '40px', height: '40px', borderBottom: '4px solid var(--color-gold)', borderRight: '4px solid var(--color-gold)', borderRadius: '0 0 16px 0' }} />
                
                {/* Scanning animation line */}
                <motion.div
                  animate={{ y: [0, 246, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                  style={{ width: '100%', height: '2px', background: 'var(--color-gold)', boxShadow: '0 0 10px 2px var(--color-gold-glow)', opacity: 0.7 }}
                />
              </div>
              <div style={{ position: 'absolute', bottom: '2rem', left: '0', right: '0', textAlign: 'center', color: 'white', fontSize: '0.9rem', zIndex: 2 }}>
                <ScanLine size={32} style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
                Align QR Code within the frame
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#111' }} />
          )}
        </div>

        {/* Results Overlay */}
        <AnimatePresence>
          {(!scannerActive && (loading || error || scanResult)) && (
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{ 
                position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
                background: 'var(--bg-elevated)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                padding: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
              }}
            >
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 0' }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                    <RefreshCw size={48} color="var(--color-gold)" style={{ opacity: 0.5 }} />
                  </motion.div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Verifying...</p>
                </div>
              )}

              {error && !loading && (
                <div style={{ width: '100%' }}>
                  <XCircle size={64} color="var(--color-error)" style={{ margin: '0 auto 1rem' }} />
                  <h3 style={{ fontSize: '1.5rem', color: 'white', marginBottom: '0.5rem' }}>Scan Failed</h3>
                  <p style={{ color: 'var(--color-error)', marginBottom: '2rem', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px' }}>{error}</p>
                  <button onClick={resetScanner} style={{ width: '100%', padding: '1rem', background: 'var(--surface-elevated)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 600 }}>
                    Scan Again
                  </button>
                </div>
              )}

              {scanResult && !loading && (
                <div style={{ width: '100%' }}>
                  {scanResult.status === 'ISSUED' ? (
                    <CheckCircle2 size={64} color="var(--color-success)" style={{ margin: '0 auto 1rem' }} />
                  ) : (
                    <XCircle size={64} color="var(--color-warning)" style={{ margin: '0 auto 1rem' }} />
                  )}
                  
                  <h3 style={{ fontSize: '1.5rem', color: 'white', marginBottom: '0.25rem' }}>
                    {scanResult.status === 'ISSUED' ? 'Valid Pass' : 'Invalid / Already Used'}
                  </h3>
                  
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem', margin: '1.5rem 0', textAlign: 'left' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Participant</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>{scanResult.participantName || 'Unknown'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>{scanResult.type || 'N/A'}</div>
                      </div>
                      <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</div>
                        <div style={{ 
                          fontSize: '1.1rem', fontWeight: 600, 
                          color: scanResult.status === 'ISSUED' ? 'var(--color-success)' : 'var(--color-error)' 
                        }}>
                          {scanResult.status}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {scanResult.status === 'ISSUED' ? (
                      <button onClick={() => handleCheckIn(scanResult.passId)} style={{ width: '100%', padding: '1rem', background: 'var(--color-success)', color: 'black', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <UserCheck size={20} /> Confirm Check-In
                      </button>
                    ) : (
                      <button onClick={resetScanner} style={{ width: '100%', padding: '1rem', background: 'var(--color-gold)', color: 'black', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 600 }}>
                        Scan Next Pass
                      </button>
                    )}
                    
                    {scanResult.status === 'ISSUED' && (
                      <button onClick={resetScanner} style={{ width: '100%', padding: '1rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', fontSize: '1rem', fontWeight: 600 }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
