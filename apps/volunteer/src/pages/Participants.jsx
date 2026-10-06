import React, { useState, useMemo } from 'react';
import { collection, query, limit, getDocs, doc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { Search, UserCheck, XCircle, CheckCircle2 } from 'lucide-react';
import { useFirebaseData } from '../../../../shared/hooks/useFirebaseData.js';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';

export default function Participants() {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Same queries as admin, but limit differently or just fetch recent
  const { data: participants, loading, refresh } = useFirebaseData('vol_participants', async () => {
    const q = query(collection(db, 'participants'), limit(200)); // Pull up to 200 for local search in volunteer
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });

  const { data: passes } = useFirebaseData('vol_passes', async () => {
    const snap = await getDocs(query(collection(db, 'passes')));
    return snap.docs.reduce((acc, doc) => {
      const p = doc.data();
      if (p.participantId) {
        acc[p.participantId] = p;
      }
      return acc;
    }, {});
  });

  const filtered = useMemo(() => {
    if (!participants) return [];
    if (!searchTerm) return participants;
    const lower = searchTerm.toLowerCase();
    return participants.filter(p => {
      const pass = passes?.[p.id];
      return (
        p.fullName?.toLowerCase().includes(lower) ||
        p.customFields?.full_name?.toLowerCase().includes(lower) ||
        p.email?.toLowerCase().includes(lower) ||
        pass?.readableId?.toLowerCase().includes(lower) ||
        p.mobile?.toLowerCase().includes(lower) ||
        p.id.toLowerCase().includes(lower)
      );
    });
  }, [participants, searchTerm, passes]);

  const handleManualCheckin = async (participant, pass) => {
    if (!window.confirm(`Manually check in ${participant.fullName || 'this participant'}?`)) return;
    
    const toastId = toast.loading('Checking in...');
    try {
      const checkInFn = httpsCallable(functions, 'checkInParticipant');
      const res = await checkInFn({ secureCode: pass.secureCode || pass.id });
      
      if (res.data && res.data.success === false) {
        throw new Error(res.data.status || 'Check-in failed');
      }
      
      toast.update(toastId, 'success', 'Checked in successfully');
      refresh();
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Check-in Failed', normalizeError(err));
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#050505', color: 'white' }}>
      
      {/* Header */}
      <div style={{ padding: '1.5rem', zIndex: 10, background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-gold)', margin: '0 0 1rem 0', fontSize: '1.5rem', letterSpacing: '2px' }}>PARTICIPANTS</h1>
        
        <div style={{ position: 'relative' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Search by name, pass ID, email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 1rem 2rem 1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>Loading participants...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>No participants found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.map(p => {
              const pass = passes?.[p.id];
              // Skip participants who don't have a pass
              if (!pass) return null;
              
              const isCheckedIn = p.checkInStatus === 'CHECKED_IN';
              
              return (
                <div key={p.id} style={{ padding: '1rem', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{p.fullName || p.customFields?.full_name || 'Unknown'}</div>
                    <div style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: isCheckedIn ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)', color: isCheckedIn ? '#22c55e' : '#eab308' }}>
                      {isCheckedIn ? 'Checked In' : 'Pending'}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    <div>Pass ID: <span style={{ fontFamily: 'monospace', color: 'white' }}>{pass.id || pass.readableId || 'N/A'}</span></div>
                    <div>Email: {p.email || 'N/A'}</div>
                    <div>Phone: {p.mobile || p.customFields?.phone_number || 'N/A'}</div>
                    <div>Verification: {p.verificationStatus || 'PENDING'}</div>
                  </div>
                  
                  {!isCheckedIn && pass && p.verificationStatus !== 'REJECTED' && pass.status === 'ACTIVE' && (
                    <button 
                      onClick={() => handleManualCheckin(p, pass)}
                      style={{ width: '100%', padding: '0.75rem', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 600 }}
                    >
                      <UserCheck size={16} /> Manual Check-in
                    </button>
                  )}
                  {(!isCheckedIn && (p.verificationStatus === 'REJECTED' || pass.status !== 'ACTIVE')) && (
                    <div style={{ width: '100%', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 500 }}>
                      <XCircle size={16} /> {p.verificationStatus === 'REJECTED' ? 'Rejected' : 'Pass Not Active'}
                    </div>
                  )}
                  {isCheckedIn && (
                    <div style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 500 }}>
                      <CheckCircle2 size={16} /> Already Checked In
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
