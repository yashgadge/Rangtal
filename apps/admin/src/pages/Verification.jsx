import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, getDoc, doc, orderBy, where, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import PageHeader from '../components/PageHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, Check, X, FileText, Download, AlertCircle } from 'lucide-react';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';
import { useFirebaseData } from '../../../../shared/hooks/useFirebaseData.js';

export default function Verification() {
  const toast = useToast();
  
  const [selectedReg, setSelectedReg] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [correctionReason, setCorrectionReason] = useState('');

  const [activeTab, setActiveTab] = useState('VERIFICATION_PENDING');

  const { data, loading, error, refresh } = useFirebaseData(`verification_queue_${activeTab}`, async () => {
    let statuses = [activeTab];
    if (activeTab === 'VERIFICATION_PENDING') {
      statuses = ['VERIFICATION_PENDING', 'SUBMITTED'];
    }
    
    const q = query(collection(db, 'registrations'), where('status', 'in', statuses), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  });

  const registrations = data || [];

  useEffect(() => {
    if (registrations.length > 0 && !selectedReg) {
      handleSelectRegistration(registrations[0]);
    } else if (registrations.length === 0) {
      setSelectedReg(null);
    }
  }, [registrations, selectedReg]);

  useEffect(() => {
    if (error) {
      toast.error('Failed to fetch queue', normalizeError(error));
    }
  }, [error, toast]);

  async function handleSelectRegistration(reg, skipDocs = false) {
    setSelectedReg(reg);
    setLoadingDetails(true);
    setDetailsError(null);
    setParticipants([]);
    if (!skipDocs) {
      setDocuments([]);
    }
    setCorrectionReason('');
    
    try {
      // Refresh the registration doc to get the latest status (e.g. if just approved)
      const regDoc = await getDoc(doc(db, 'registrations', reg.id));
      if (regDoc.exists()) {
        setSelectedReg({ id: regDoc.id, ...regDoc.data() });
      }
      
      const pQuery = query(collection(db, 'participants'), where('registrationId', '==', reg.id));
      const participantsSnap = await getDocs(pQuery);
      const parts = participantsSnap.docs.map(d => ({id: d.id, ...d.data()}));
      setParticipants(parts);
      
      if (skipDocs && documents.length > 0) {
        // Skip document fetching, keep existing
      } else {
        const docs = [];
        if (reg.verificationDocs && reg.verificationDocs.length > 0) {
          const getUrlFn = httpsCallable(functions, 'getVerificationDocumentUrl');
          const docPromises = reg.verificationDocs.map(async (docMeta) => {
            const name = docMeta.filename || (docMeta.path || '').split('/').pop() || 'Document';
            const label = typeof docMeta.participantIndex === 'number' ? `P${docMeta.participantIndex + 1} · ${name}` : name;
            try {
              const res = await getUrlFn({ path: docMeta.path, url: docMeta.url });
              const url = res.data?.url || docMeta.url || null;
              return { name: label, url, missing: !url };
            } catch (e) {
              console.warn("Signed URL unavailable, using stored URL for", docMeta.path, e?.message);
              return { name: label, url: docMeta.url || null, missing: !docMeta.url };
            }
          });
          const results = await Promise.all(docPromises);
          docs.push(...results.filter(Boolean));
        }
        setDocuments(docs);
      }
      
    } catch (err) {
      console.error("Error fetching details", err);
      setDetailsError(err.message);
      toast.error('Failed to load details', normalizeError(err));
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleApprove(participantId) {
    if (!selectedReg) return;
    const toastId = toast.loading('Approving participant...');
    try {
      setLoadingDetails(true);
      const approveFn = httpsCallable(functions, 'approveVerification');
      await approveFn({ participantId });
      
      // refresh details to show updated participant status without refetching docs
      await handleSelectRegistration(selectedReg, true);
      toast.update(toastId, 'success', 'Participant approved');
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error approving', normalizeError(err));
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleRequestCorrection(participantId) {
    if (!selectedReg) return;
    if (!correctionReason) {
      toast.warning('Correction Reason Required', 'Please provide a reason.');
      return;
    }
    const toastId = toast.loading('Requesting correction...');
    try {
      setLoadingDetails(true);
      const correctionFn = httpsCallable(functions, 'requestVerificationCorrection');
      await correctionFn({ participantId, reason: correctionReason });
      
      await handleSelectRegistration(selectedReg, true);
      toast.update(toastId, 'success', 'Correction requested successfully');
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error requesting correction', normalizeError(err));
    } finally {
      setLoadingDetails(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Verification Workstation" 
        description="Review participant registrations and verify documents." 
      />

      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-light)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
        {[
          { id: 'VERIFICATION_PENDING', label: 'Pending Review' },
          { id: 'REQUIRES_CORRECTION', label: 'Correction Required' },
          { id: 'VERIFIED', label: 'Verified' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ 
              background: 'none', border: 'none', padding: '0.5rem 1rem', 
              color: activeTab === tab.id ? 'var(--color-gold)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-gold)' : '2px solid transparent',
              cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '1.5rem', minHeight: 0 }}>
        {/* Left: Queue */}
        <div className="surface" style={{ width: '350px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-light)', background: 'rgba(5,5,5,0.3)' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Queue ({registrations.length})</h3>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {loading ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading queue...</div>
            ) : error ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-error)' }}>
                <AlertCircle size={32} style={{ margin: '0 auto 1rem' }} />
                Error loading queue
              </div>
            ) : registrations.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <CheckSquare size={32} style={{ opacity: 0.5, margin: '0 auto 1rem' }} />
                No registrations in this queue.
              </div>
            ) : (
              registrations.map(reg => (
                <div 
                  key={reg.id}
                  onClick={() => handleSelectRegistration(reg)}
                  style={{
                    padding: '1rem',
                    marginBottom: '0.5rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: selectedReg?.id === reg.id ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                    border: `1px solid ${selectedReg?.id === reg.id ? 'var(--color-gold)' : 'var(--border-light)'}`,
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, color: selectedReg?.id === reg.id ? 'var(--color-gold)' : 'var(--text-primary)' }}>{reg.type} Package</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{reg.createdAt?.toDate?.()?.toLocaleDateString() || ''}</span>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    ID: {reg.id.slice(0, 8)}...
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Workspace */}
        <div className="surface" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedReg ? (
            loadingDetails ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: 'var(--text-muted)', animation: 'pulse 2s infinite' }}>Loading workspace details...</div>
              </div>
            ) : detailsError ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}>
                {detailsError}
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ color: 'var(--color-gold)', fontSize: '1.5rem', marginBottom: '0.25rem' }}>Registration {selectedReg.id.slice(0,8)}</h2>
                    <div style={{ color: 'var(--text-secondary)' }}>{selectedReg.type} • ₹{selectedReg.amount}</div>
                  </div>
                  <span className={`badge ${selectedReg.verificationStatus === 'VERIFIED' ? 'badge-success' : 'badge-warning'}`}>{selectedReg.verificationStatus}</span>
                </div>

                <div className="surface-flat" style={{ padding: '1.5rem' }}>
                  <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '1px' }}>Participant Details</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '1rem' }}>
                    {participants.map((p, i) => (
                      <div key={p.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: `3px solid ${p.verificationStatus === 'APPROVED' ? 'var(--color-success)' : p.verificationStatus === 'REQUIRES_CORRECTION' ? 'var(--color-error)' : 'var(--color-gold)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{p.fullName}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.gender} • Status: {p.verificationStatus}</div>
                          </div>
                          
                          {(selectedReg.status === 'VERIFICATION_PENDING' || selectedReg.status === 'SUBMITTED' || selectedReg.status === 'REQUIRES_CORRECTION') && p.verificationStatus !== 'APPROVED' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '250px' }}>
                              <input 
                                type="text" 
                                className="form-input" 
                                style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                                placeholder="Correction Reason..."
                                value={correctionReason}
                                onChange={e => setCorrectionReason(e.target.value)}
                              />
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', color: 'var(--color-warning)', borderColor: 'var(--color-warning)' }} onClick={() => handleRequestCorrection(p.id)}>
                                  <X size={14} /> Correct
                                </button>
                                <button className="btn btn-primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => handleApprove(p.id)}>
                                  <Check size={14} /> Approve
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="surface-flat" style={{ padding: '1.5rem' }}>
                  <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '1px' }}>Verification Documents</h4>
                  {documents.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      {documents.map((doc, i) => (
                        <a 
                          key={i} 
                          href={doc.missing ? undefined : doc.url} 
                          target="_blank" 
                          rel="noreferrer"
                          aria-disabled={doc.missing || undefined}
                          onClick={doc.missing ? (e) => e.preventDefault() : undefined}
                          style={{ 
                            display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem',
                            background: doc.missing ? 'rgba(255,80,80,0.06)' : 'rgba(255,255,255,0.03)', borderRadius: '8px',
                            border: `1px solid ${doc.missing ? 'rgba(255,80,80,0.35)' : 'var(--border-light)'}`,
                            textDecoration: 'none', color: 'var(--text-primary)', transition: 'all 0.2s',
                            cursor: doc.missing ? 'not-allowed' : 'pointer'
                          }}
                          onMouseEnter={e => { if (!doc.missing) e.currentTarget.style.borderColor = 'var(--color-gold)'; }}
                          onMouseLeave={e => { if (!doc.missing) e.currentTarget.style.borderColor = 'var(--border-light)'; }}
                        >
                          <FileText size={24} color={doc.missing ? 'var(--color-error)' : 'var(--color-gold)'} />
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{doc.name}</div>
                            {doc.missing && <div style={{ fontSize: '0.75rem', color: 'var(--color-error)' }}>File missing in storage</div>}
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)' }}>No documents found.</p>
                  )}
                </div>
                
              </div>
            )
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <CheckSquare size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p>Select a registration from the queue to review.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
