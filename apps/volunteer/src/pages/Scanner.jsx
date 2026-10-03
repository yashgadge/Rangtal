import React, { useState, useEffect } from 'react';
import { Scanner as QrScanner } from '@yudiel/react-qr-scanner';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, CheckCircle2, XCircle, UserCheck, RefreshCw, WifiOff } from 'lucide-react';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';

export default function Scanner() {
  const toast = useToast();
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannerActive, setScannerActive] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Connection Restored', 'Back online and ready to scan.');
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error('Connection Lost', 'Cannot scan passes offline.');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [selectedParticipants, setSelectedParticipants] = useState([]);

  const handleScan = async (detectedCodes) => {
    if (isOffline || !scannerActive || isProcessing || detectedCodes.length === 0) return;
    
    const passId = detectedCodes[0].rawValue;
    if (!passId) return;

    setIsProcessing(true);
    setScannerActive(false);
    setLoading(true);
    setError(null);
    setScanResult(null);
    setSelectedParticipants([]);
    
    try {
      const verifyPassFn = httpsCallable(functions, 'verifyPass');
      const response = await verifyPassFn({ passId });
      setScanResult(response.data);
      if (response.data.isGroup && response.data.participants) {
        // pre-select those who are not checked in
        setSelectedParticipants(response.data.participants.filter(p => p.checkInStatus !== 'CHECKED_IN').map(p => p.id));
      }
    } catch (err) {
      console.error(err);
      const normalized = normalizeError(err);
      setError(normalized);
      toast.error('Scan Failed', normalized);
    } finally {
      setLoading(false);
      setIsProcessing(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setError(null);
    setScannerActive(true);
    setSelectedParticipants([]);
  };

  const handleCheckIn = async (passId) => {
    if (isOffline) {
      setError("Cannot securely validate this pass while offline.");
      toast.error('Offline', 'Cannot securely validate this pass while offline.');
      return;
    }
    
    setLoading(true);
    const toastId = toast.loading('Processing Check-In...');
    try {
      if (scanResult.isGroup) {
        const checkInFn = httpsCallable(functions, 'checkInGroupMembers');
        await checkInFn({ secureCode: passId, selectedParticipantIds: selectedParticipants });
        setScanResult(prev => {
          const updatedParts = prev.participants.map(p => selectedParticipants.includes(p.id) ? { ...p, checkInStatus: 'CHECKED_IN' } : p);
          return { ...prev, status: 'USED', participants: updatedParts };
        });
        toast.update(toastId, 'success', `Successfully checked in ${selectedParticipants.length} participant(s)`);
      } else {
        const checkInFn = httpsCallable(functions, 'checkInParticipant');
        await checkInFn({ secureCode: passId });
        setScanResult(prev => ({ ...prev, status: 'USED' }));
        toast.update(toastId, 'success', 'Participant checked in successfully');
      }
    } catch (err) {
      console.error(err);
      const normalized = normalizeError(err);
      setError(normalized);
      toast.update(toastId, 'error', 'Check-In Failed', normalized);
    } finally {
      setLoading(false);
    }
  };

  const toggleParticipant = (id) => {
    setSelectedParticipants(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', background: '#050505' }}>
      
      {/* Header */}
      <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-gold)', margin: 0, fontSize: '1.5rem', letterSpacing: '2px' }}>RANGTAL</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {isOffline && <WifiOff size={16} color="var(--color-error)" />}
          <div style={{ fontSize: '0.8rem', color: isOffline ? 'var(--color-error)' : 'var(--text-secondary)', background: isOffline ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.1)', padding: '0.25rem 0.75rem', borderRadius: '999px', fontWeight: 600 }}>
            {isOffline ? 'OFFLINE' : 'Gate Operations'}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* Scanner View */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {isOffline ? (
            <div style={{ width: '100%', height: '100%', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
              <WifiOff size={64} color="var(--color-error)" style={{ marginBottom: '1rem' }} />
              <h2 style={{ color: 'white', marginBottom: '1rem' }}>NETWORK UNAVAILABLE</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Cannot securely validate passes without an active internet connection. Please reconnect to continue scanning.</p>
            </div>
          ) : scannerActive ? (
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
          {(!scannerActive && (loading || error || scanResult) && !isOffline) && (
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
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                maxHeight: '90vh', overflowY: 'auto'
              }}
            >
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 0' }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                    <RefreshCw size={48} color="var(--color-gold)" style={{ opacity: 0.5 }} />
                  </motion.div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Processing...</p>
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
                  {scanResult.status === 'ISSUED' || (scanResult.isGroup && scanResult.participants?.some(p => p.checkInStatus !== 'CHECKED_IN')) ? (
                    <CheckCircle2 size={64} color="var(--color-success)" style={{ margin: '0 auto 1rem' }} />
                  ) : (
                    <XCircle size={64} color="var(--color-warning)" style={{ margin: '0 auto 1rem' }} />
                  )}
                  
                  <h3 style={{ fontSize: '1.5rem', color: 'white', marginBottom: '0.25rem' }}>
                    {scanResult.isGroup ? 'Group Pass' : (scanResult.status === 'ISSUED' ? 'Valid Pass' : 'Invalid / Already Used')}
                  </h3>
                  
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem', margin: '1.5rem 0', textAlign: 'left' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      {!scanResult.isGroup && (
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Participant</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>{scanResult.participantName || 'Unknown'}</div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>{scanResult.type || 'N/A'}</div>
                      </div>
                      <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</div>
                        <div style={{ 
                          fontSize: '1.1rem', fontWeight: 600, 
                          color: (scanResult.status === 'ISSUED' || (scanResult.isGroup && scanResult.participants?.some(p => p.checkInStatus !== 'CHECKED_IN'))) ? 'var(--color-success)' : 'var(--color-error)' 
                        }}>
                          {scanResult.status}
                        </div>
                      </div>
                    </div>
                  </div>

                  {scanResult.isGroup && scanResult.participants && (
                    <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                      <h4 style={{ fontSize: '1rem', color: 'var(--color-gold)', marginBottom: '1rem' }}>Select Participants to Check-in</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {scanResult.participants.map(p => {
                          const isCheckedIn = p.checkInStatus === 'CHECKED_IN';
                          const isSelected = selectedParticipants.includes(p.id);
                          return (
                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: isCheckedIn ? 'not-allowed' : 'pointer', opacity: isCheckedIn ? 0.5 : 1 }}>
                              <input 
                                type="checkbox" 
                                checked={isSelected || isCheckedIn} 
                                onChange={() => !isCheckedIn && toggleParticipant(p.id)}
                                disabled={isCheckedIn}
                                style={{ transform: 'scale(1.5)' }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1.1rem', color: 'white', fontWeight: 500 }}>{p.fullName}</div>
                                <div style={{ fontSize: '0.85rem', color: isCheckedIn ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                                  {isCheckedIn ? 'Already Checked In' : p.verificationStatus}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {(scanResult.status === 'ISSUED' || (scanResult.isGroup && selectedParticipants.length > 0)) ? (
                      <button onClick={() => handleCheckIn(scanResult.passId)} style={{ width: '100%', padding: '1rem', background: 'var(--color-success)', color: 'black', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <UserCheck size={20} /> {scanResult.isGroup ? `Check In Selected (${selectedParticipants.length})` : 'Confirm Check-In'}
                      </button>
                    ) : (
                      <button onClick={resetScanner} style={{ width: '100%', padding: '1rem', background: 'var(--color-gold)', color: 'black', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 600 }}>
                        Scan Next Pass
                      </button>
                    )}
                    
                    {(scanResult.status === 'ISSUED' || scanResult.isGroup) && (
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
