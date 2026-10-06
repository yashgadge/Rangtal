import React, { useState, useEffect } from 'react';
import { Scanner as QrScanner } from '@yudiel/react-qr-scanner';
import { httpsCallable } from 'firebase/functions';
import { collection, query, getDocs } from 'firebase/firestore';
import { functions, db } from '../firebase';
import { ScanLine, CheckCircle2, XCircle, UserCheck, WifiOff } from 'lucide-react';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';
import { useFirebaseData } from '../../../../shared/hooks/useFirebaseData.js';

export default function Scanner() {
  const toast = useToast();
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannerActive, setScannerActive] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const { data: participantsData, refresh: refreshParticipants } = useFirebaseData('vol_participants', async () => {
    const snap = await getDocs(query(collection(db, 'participants')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });

  const { data: passesData, refresh: refreshPasses } = useFirebaseData('vol_passes', async () => {
    const snap = await getDocs(query(collection(db, 'passes')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      refreshParticipants();
      refreshPasses();
      toast.success('Connection Restored', 'Back online. Synced data.');
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.warning('Offline Mode', 'Scanning locally from cached data.');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshParticipants, refreshPasses]);

  const [selectedParticipants, setSelectedParticipants] = useState([]);

  const handleScan = (detectedCodes) => {
    if (!scannerActive || isProcessing || detectedCodes.length === 0) return;
    
    const secureCode = detectedCodes[0].rawValue;
    if (!secureCode) return;

    setIsProcessing(true);
    setScannerActive(false);
    setError(null);
    setScanResult(null);
    setSelectedParticipants([]);
    
    if (!passesData || !participantsData) {
      setError("Data is still loading, please wait a moment.");
      setIsProcessing(false);
      return;
    }

    const pass = passesData.find(p => p.secureCode === secureCode || p.id === secureCode);
    
    if (!pass) {
      setError("Invalid QR Code: Pass not found in system.");
      setIsProcessing(false);
      return;
    }

    const isGroup = pass.type === 'COUPLE' || pass.type === 'GROUP';
    const participant = participantsData.find(p => p.id === pass.participantId);
    
    let result = {
      isGroup,
      status: pass.status,
      type: pass.type,
      secureCode: pass.secureCode,
      passId: pass.id,
      participantName: participant?.fullName || participant?.customFields?.full_name || 'Unknown',
      participantCollege: participant?.customFields?.college_name || participant?.customFields?.custom_other_college_name || 'N/A',
      participantPhone: participant?.mobile || participant?.customFields?.phone_number || 'N/A',
      verificationStatus: participant?.verificationStatus || 'PENDING',
      isAlreadyCheckedIn: participant?.checkInStatus === 'CHECKED_IN'
    };
    
    if (isGroup) {
      result.participants = participantsData.filter(p => p.registrationId === pass.registrationId) || [];
      setSelectedParticipants(result.participants.filter(p => p.checkInStatus !== 'CHECKED_IN').map(p => p.id));
    }

    setScanResult(result);
    setIsProcessing(false);
  };

  const resetScanner = () => {
    setScanResult(null);
    setError(null);
    setScannerActive(true);
    setSelectedParticipants([]);
  };

  const handleCheckIn = async (secureCode) => {
    if (isOffline) {
      toast.error('Offline', 'Cannot securely validate this pass while offline.');
      return;
    }
    
    setLoading(true);
    const toastId = toast.loading('Processing Check-In...');
    try {
      if (scanResult.isGroup) {
        const checkInFn = httpsCallable(functions, 'checkInGroupMembers');
        const res = await checkInFn({ secureCode: secureCode, selectedParticipantIds: selectedParticipants });
        if (res.data && res.data.success === false) throw new Error(res.data.status || 'Check-in failed');
        setScanResult(prev => {
          const updatedParts = prev.participants.map(p => selectedParticipants.includes(p.id) ? { ...p, checkInStatus: 'CHECKED_IN' } : p);
          return { ...prev, status: 'USED', participants: updatedParts };
        });
        toast.update(toastId, 'success', `Successfully checked in ${selectedParticipants.length} participant(s)`);
      } else {
        const checkInFn = httpsCallable(functions, 'checkInParticipant');
        const res = await checkInFn({ secureCode: secureCode });
        if (res.data && res.data.success === false) throw new Error(res.data.status || 'Check-in failed');
        setScanResult(prev => ({ ...prev, isAlreadyCheckedIn: true }));
        toast.update(toastId, 'success', 'Participant checked in successfully');
      }
      refreshParticipants();
      refreshPasses();
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
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {scannerActive ? (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <QrScanner
                onScan={handleScan}
                onError={(e) => console.log('QR error:', e)}
                styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }}
              />
              <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 1000px rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '250px', height: '250px', border: '2px solid rgba(255,255,255,0.2)', borderRadius: '16px', zIndex: 2, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: -2, left: -2, width: '40px', height: '40px', borderTop: '4px solid var(--color-gold)', borderLeft: '4px solid var(--color-gold)', borderRadius: '16px 0 0 0' }} />
                <div style={{ position: 'absolute', top: -2, right: -2, width: '40px', height: '40px', borderTop: '4px solid var(--color-gold)', borderRight: '4px solid var(--color-gold)', borderRadius: '0 16px 0 0' }} />
                <div style={{ position: 'absolute', bottom: -2, left: -2, width: '40px', height: '40px', borderBottom: '4px solid var(--color-gold)', borderLeft: '4px solid var(--color-gold)', borderRadius: '0 0 0 16px' }} />
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: '40px', height: '40px', borderBottom: '4px solid var(--color-gold)', borderRight: '4px solid var(--color-gold)', borderRadius: '0 0 16px 0' }} />
              </div>
              <div style={{ position: 'absolute', bottom: '3rem', left: '0', right: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center', color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem', zIndex: 2, letterSpacing: '1px', textTransform: 'uppercase' }}>
                <ScanLine size={28} style={{ opacity: 0.8 }} />
                <span>Align QR Code within the frame</span>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#111' }} />
          )}
        </div>

        {(!scannerActive && (error || scanResult)) && (
          <div style={{ 
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
            background: 'var(--bg-elevated)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
            padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column',
            maxHeight: '85vh', overflowY: 'auto'
          }}>
            {error && !loading && (
              <div style={{ width: '100%', textAlign: 'center' }}>
                <XCircle size={48} color="var(--color-error)" style={{ margin: '0 auto 1rem' }} />
                <h3 style={{ fontSize: '1.25rem', color: 'white', marginBottom: '0.5rem' }}>Scan Failed</h3>
                <p style={{ color: 'var(--color-error)', marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px' }}>{error}</p>
                <button onClick={resetScanner} style={{ width: '100%', padding: '1rem', background: 'var(--surface-elevated)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '12px', fontSize: '1rem', fontWeight: 600 }}>
                  Scan Again
                </button>
              </div>
            )}

            {scanResult && !error && (
              <div style={{ width: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                  {(scanResult.status === 'ACTIVE' && !scanResult.isAlreadyCheckedIn) || (scanResult.isGroup && scanResult.participants?.some(p => p.checkInStatus !== 'CHECKED_IN')) ? (
                    <CheckCircle2 size={48} color="var(--color-success)" style={{ margin: '0 auto 0.5rem' }} />
                  ) : (
                    <XCircle size={48} color="var(--color-warning)" style={{ margin: '0 auto 0.5rem' }} />
                  )}
                  <h3 style={{ fontSize: '1.25rem', color: 'white', margin: 0 }}>
                    {scanResult.isGroup 
                      ? 'Group Pass' 
                      : (scanResult.status === 'ACTIVE' && !scanResult.isAlreadyCheckedIn && scanResult.verificationStatus !== 'REJECTED' ? 'Valid Pass' : (scanResult.isAlreadyCheckedIn ? 'Already Checked-In' : 'Invalid / Rejected'))
                    }
                  </h3>
                </div>
                
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', margin: '1rem 0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                    {!scanResult.isGroup && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Name:</span>
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>{scanResult.participantName}</span>
                      </div>
                    )}
                    {!scanResult.isGroup && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>College:</span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{scanResult.participantCollege}</span>
                      </div>
                    )}
                    {!scanResult.isGroup && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Phone:</span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{scanResult.participantPhone}</span>
                      </div>
                    )}
                    {!scanResult.isGroup && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Approval:</span>
                        <span style={{ 
                          fontSize: '0.85rem', fontWeight: 600, padding: '0.1rem 0.4rem', borderRadius: '4px',
                          background: scanResult.verificationStatus === 'APPROVED' ? 'rgba(34, 197, 94, 0.2)' : (scanResult.verificationStatus === 'REJECTED' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)'),
                          color: scanResult.verificationStatus === 'APPROVED' ? 'var(--color-success)' : (scanResult.verificationStatus === 'REJECTED' ? 'var(--color-error)' : 'var(--color-warning)')
                        }}>
                          {scanResult.verificationStatus}
                        </span>
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status:</span>
                      <span style={{ 
                        fontSize: '1rem', fontWeight: 600, 
                        color: ((scanResult.status === 'ACTIVE' && !scanResult.isAlreadyCheckedIn) || (scanResult.isGroup && scanResult.participants?.some(p => p.checkInStatus !== 'CHECKED_IN'))) ? 'var(--color-success)' : 'var(--color-error)' 
                      }}>
                        {scanResult.isAlreadyCheckedIn ? 'USED' : scanResult.status}
                      </span>
                    </div>
                  </div>
                </div>

                {scanResult.isGroup && scanResult.participants && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-gold)', marginBottom: '0.5rem', fontWeight: 600 }}>Select Participants</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {scanResult.participants.map(p => {
                        const isCheckedIn = p.checkInStatus === 'CHECKED_IN';
                        const isSelected = selectedParticipants.includes(p.id);
                        return (
                          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <input 
                              type="checkbox" 
                              checked={isSelected || isCheckedIn} 
                              onChange={() => !isCheckedIn && toggleParticipant(p.id)}
                              disabled={isCheckedIn}
                              style={{ width: '20px', height: '20px' }}
                            />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.95rem', color: 'white', fontWeight: 500 }}>{p.fullName || p.customFields?.full_name}</span>
                              <span style={{ fontSize: '0.75rem', color: isCheckedIn ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                                {isCheckedIn ? 'Checked In' : (p.customFields?.college_name || 'N/A')}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {((scanResult.status === 'ACTIVE' && !scanResult.isAlreadyCheckedIn && !scanResult.isGroup && scanResult.verificationStatus !== 'REJECTED') || (scanResult.isGroup && selectedParticipants.length > 0)) ? (
                    <button onClick={() => handleCheckIn(scanResult.secureCode)} disabled={loading} style={{ width: '100%', padding: '0.85rem', background: 'var(--color-success)', color: 'black', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <UserCheck size={18} /> {loading ? 'Processing...' : (scanResult.isGroup ? `Check In (${selectedParticipants.length})` : 'Confirm Check-In')}
                    </button>
                  ) : (
                    <button onClick={resetScanner} style={{ width: '100%', padding: '0.85rem', background: 'var(--color-gold)', color: 'black', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 600 }}>
                      Scan Next Pass
                    </button>
                  )}
                  
                  {((scanResult.status === 'ACTIVE' && !scanResult.isAlreadyCheckedIn) || scanResult.isGroup) && (
                    <button onClick={resetScanner} disabled={loading} style={{ width: '100%', padding: '0.85rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', fontSize: '1rem', fontWeight: 500 }}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
