import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { httpsCallable } from 'firebase/functions';
import { collection, query, getDocs, doc, getDoc, where, limit } from 'firebase/firestore';
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
  
  const scannerRef = useRef(null);
  const html5QrCode = useRef(null);
  const [cameraError, setCameraError] = useState(null);

  const { data: collegesData } = useFirebaseData('adm_scanner_colleges', async () => {
    const snap = await getDocs(query(collection(db, 'colleges')));
    return snap.docs.reduce((acc, d) => { acc[d.id] = d.data().name; return acc; }, {});
  });
  const resolveCollege = (collegeId) => {
    if (!collegeId || collegeId === 'N/A') return 'N/A';
    return (collegesData && collegesData[collegeId]) || collegeId;
  };

  const isDataLoading = false;

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setIsOffline(false);
      toast.success('Connection Restored', 'Back online. Ready to scan.');
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
  }, []);

  const [selectedParticipants, setSelectedParticipants] = useState([]);

  useEffect(() => {
    if (!scannerRef.current) return;

    if (!html5QrCode.current) {
      html5QrCode.current = new Html5Qrcode(scannerRef.current.id);
      const onDecode = (decodedText) => {
        if (handleScanRef.current) handleScanRef.current(decodedText);
      };
      const cfg = { fps: 10, qrbox: { width: 250, height: 250 } };
      const explain = (err) => {
        const n = err?.name || '';
        if (n === 'NotAllowedError' || /permission/i.test(String(err))) return 'Camera permission denied. Click the camera icon in the address bar, allow access, then reload.';
        if (n === 'NotFoundError') return 'No camera found on this device.';
        if (n === 'NotReadableError') return 'Camera is in use by another app (Teams/Zoom/other tab). Close it and reload.';
        return String(err?.message || err || 'Camera failed to start.');
      };
      html5QrCode.current.start({ facingMode: "environment" }, cfg, onDecode, () => {})
        .catch(async (err) => {
          console.warn("Rear camera failed, trying any camera", err);
          try {
            const cams = await Html5Qrcode.getCameras();
            if (!cams || cams.length === 0) throw new Error('No camera found on this device.');
            await html5QrCode.current.start(cams[0].id, cfg, onDecode, () => {});
          } catch (err2) {
            console.error("Error starting scanner", err2);
            const msg = explain(err2);
            setCameraError(msg);
            toast.error("Camera Error", msg);
          }
        });
    }

    return () => {
      // We only clean up when component unmounts (handled by the empty dep array below)
    };
  }, [scannerActive]);

  const handleScanRef = useRef();
  
  useEffect(() => {
    return () => {
      if (html5QrCode.current) {
         try {
           const state = html5QrCode.current.getState();
           if (state === 2) { // 2 = SCANNING
             html5QrCode.current.stop().then(() => {
               html5QrCode.current.clear();
             }).catch(console.error);
           } else {
             html5QrCode.current.clear();
           }
         } catch (e) {
           // Ignore errors during cleanup
         }
      }
    }
  }, []);

  const handleScan = async (secureCode) => {
    if (!scannerActive || isProcessing || !secureCode) return;
    
    setIsProcessing(true);
    setScannerActive(false);
    setError(null);
    setScanResult(null);
    setSelectedParticipants([]);
    
    try {
      // 1. Fetch Pass
      const passesRef = collection(db, 'passes');
      const q = query(passesRef, where('secureCode', '==', secureCode), limit(1));
      const passSnap = await getDocs(q);
      
      let passDoc = null;
      if (!passSnap.empty) {
        passDoc = passSnap.docs[0];
      } else {
        // Fallback to searching by document ID
        const docRef = doc(db, 'passes', secureCode);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) passDoc = docSnap;
      }
      
      if (!passDoc) {
        setError("Invalid QR Code: Pass not found in system.");
        setIsProcessing(false);
        return;
      }
      
      const pass = { id: passDoc.id, ...passDoc.data() };
      
      // 2. Fetch Participant(s)
      const isGroup = pass.isGroup === true;
      
      let participant = null;
      let groupParticipants = [];
      
      if (pass.participantId) {
        const partSnap = await getDoc(doc(db, 'participants', pass.participantId));
        if (partSnap.exists()) participant = { id: partSnap.id, ...partSnap.data() };
      }
      
      if (isGroup && pass.registrationId) {
        const qParts = query(collection(db, 'participants'), where('registrationId', '==', pass.registrationId));
        const partsSnap = await getDocs(qParts);
        groupParticipants = partsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      
      let result = {
        isGroup,
        status: pass.status,
        type: pass.regType || pass.type || 'Unknown',
        secureCode: pass.secureCode,
        passId: pass.id,
        readableId: pass.readableId || null,
        participantName: participant?.fullName || participant?.customFields?.full_name || pass.participantName || 'Unknown',
        participantCollege: participant?.collegeId || pass.participantCollegeId || 'N/A',
        participantPhone: participant?.mobile || pass.participantMobile || 'N/A',
        verificationStatus: participant?.verificationStatus || 'PENDING',
        isAlreadyCheckedIn: participant?.checkInStatus === 'CHECKED_IN'
      };
      
      if (isGroup) {
        result.participants = groupParticipants;
        setSelectedParticipants(groupParticipants.filter(p => p.checkInStatus !== 'CHECKED_IN').map(p => p.id));
      }
      
      setScanResult(result);
    } catch (err) {
      console.error(err);
      setError(normalizeError(err));
    } finally {
      setIsProcessing(false);
    }
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
        const checkInFn = httpsCallable(functions, 'checkInGroupMembersV2');
        const res = await checkInFn({ secureCode: secureCode, selectedParticipantIds: selectedParticipants });
        if (res.data && res.data.success === false) throw new Error(res.data.status || 'Check-in failed');
        setScanResult(prev => {
          const updatedParts = prev.participants.map(p => selectedParticipants.includes(p.id) ? { ...p, checkInStatus: 'CHECKED_IN' } : p);
          return { ...prev, status: 'USED', participants: updatedParts };
        });
        toast.update(toastId, 'success', `Successfully checked in ${selectedParticipants.length} participant(s)`);
      } else {
        const checkInFn = httpsCallable(functions, 'checkInParticipantV2');
        const res = await checkInFn({ secureCode: secureCode });
        if (res.data && res.data.success === false) throw new Error(res.data.status || 'Check-in failed');
        setScanResult(prev => ({ ...prev, isAlreadyCheckedIn: true }));
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

  useEffect(() => {
    handleScanRef.current = handleScan;
  }, [handleScan]);

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
          {isDataLoading && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                width: '48px', height: '48px', border: '3px solid rgba(255,255,255,0.1)', 
                borderTopColor: 'var(--color-gold)', borderRadius: '50%',
                animation: 'spin 1s linear infinite', marginBottom: '1.5rem'
              }}></div>
              <h3 style={{ color: 'var(--color-gold)', margin: '0 0 0.5rem 0', letterSpacing: '1px' }}>Syncing Database</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Downloading latest passes...</p>
            </div>
          )}

          <div style={{ width: '100%', height: '100%', position: 'relative', opacity: scannerActive ? 1 : 0, pointerEvents: scannerActive ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
            <div id="qr-reader" ref={scannerRef} style={{ width: '100%', height: '100%' }}></div>
            {cameraError && (
              <div style={{ position: 'absolute', top: '5rem', left: '1rem', right: '1rem', zIndex: 5, background: 'rgba(239,68,68,0.15)', border: '1px solid var(--color-error)', color: 'white', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                {cameraError}
              </div>
            )}
            <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 1000px rgba(0,0,0,0.25)', pointerEvents: 'none', zIndex: 1 }} />
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
          {!scannerActive && (
             <div style={{ position: 'absolute', inset: 0, background: '#111', zIndex: 0 }} />
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
                <p style={{ color: 'var(--color-error)', marginBottom: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px' }}>{error}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '1.5rem', wordBreak: 'break-all' }}>Raw error: {typeof error === 'object' ? JSON.stringify(error) : error}</p>
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
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'right', maxWidth: '60%' }}>{resolveCollege(scanResult.participantCollege)}</span>
                      </div>
                    )}
                    {scanResult.readableId && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pass ID:</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-gold)', letterSpacing: '1px' }}>{scanResult.readableId}</span>
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
