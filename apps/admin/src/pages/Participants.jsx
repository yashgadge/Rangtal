import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, limit, orderBy, doc, getDoc, writeBatch, serverTimestamp, increment, startAfter } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { Download, Trash2, CheckCircle, Plus, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';
import { useFirebaseData } from '../../../../shared/hooks/useFirebaseData.js';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

export default function Participants() {
  const toast = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [previewParticipant, setPreviewParticipant] = useState(null);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [regLoading, setRegLoading] = useState(false);
  const [selectedCheckin, setSelectedCheckin] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [showManualModal, setShowManualModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualForm, setManualForm] = useState({ fullName: '', packageId: '', gender: 'Male', mobile: '', paymentMethod: 'CASH', email: '' });

  const { data: packages } = useFirebaseData('admin_packages_active', async () => {
    const snap = await getDocs(query(collection(db, 'packages')));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(p => p.active);
  });
  const { data: passes } = useFirebaseData('admin_passes_lookup', async () => {
    const q = query(collection(db, 'passes'));
    const snap = await getDocs(q);
    return snap.docs.reduce((acc, doc) => {
      const p = doc.data();
      if (p.participantId && (!acc[p.participantId] || (acc[p.participantId].status !== 'ACTIVE' && p.status === 'ACTIVE'))) {
        acc[p.participantId] = { ...p, id: doc.id };
      }
      return acc;
    }, {});
  });

  useEffect(() => {
    if (selectedParticipant?.registrationId) {
      setRegLoading(true);
      getDoc(doc(db, 'registrations', selectedParticipant.registrationId))
        .then(snap => {
          if (snap.exists()) setSelectedRegistration({ id: snap.id, ...snap.data() });
          else setSelectedRegistration(null);
        })
        .catch(console.error)
        .finally(() => setRegLoading(false));
    } else {
      setSelectedRegistration(null);
    }

    if (selectedParticipant?.id && passes?.[selectedParticipant.id]?.id) {
      getDoc(doc(db, 'checkins', `pass_${passes[selectedParticipant.id].id}`))
        .then(snap => {
          if (snap.exists()) setSelectedCheckin(snap.data());
          else setSelectedCheckin(null);
        }).catch(console.error);
    } else {
      setSelectedCheckin(null);
    }
  }, [selectedParticipant, passes]);

  const { data: colleges } = useFirebaseData('admin_colleges_lookup', async () => {
    const q = query(collection(db, 'colleges'));
    const snap = await getDocs(q);
    return snap.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data().name;
      return acc;
    }, {});
  });

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchParticipants = async (loadMore = false) => {
    try {
      if (!loadMore) setLoading(true);
      let q = query(collection(db, 'participants'), limit(100));
      if (loadMore && lastDoc) {
        q = query(collection(db, 'participants'), startAfter(lastDoc), limit(100));
      }
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setHasMore(false);
      } else {
        setLastDoc(snap.docs[snap.docs.length - 1]);
        const newDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setData(prev => loadMore ? [...prev, ...newDocs] : newDocs);
        if (snap.docs.length < 100) setHasMore(false);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipants();
  }, []);

  const refresh = () => {
    setLastDoc(null);
    setHasMore(true);
    fetchParticipants(false);
  };

  useEffect(() => {
    if (error) {
      toast.error('Failed to load participants', normalizeError(error));
    }
  }, [error, toast]);

  const filteredParts = React.useMemo(() => {
    if (!data) return [];
    if (!searchTerm) return data;
    
    const term = searchTerm.toLowerCase();
    return data.filter(p => 
      p.id.toLowerCase().includes(term) || 
      (p.fullName && p.fullName.toLowerCase().includes(term)) ||
      (p.registrationId && p.registrationId.toLowerCase().includes(term)) ||
      (passes?.[p.id]?.readableId && passes[p.id].readableId.toLowerCase().includes(term))
    );
  }, [data, searchTerm, passes]);

  function getBadgeColor(status) {
    if (status === 'VERIFIED') return 'badge-success';
    if (status === 'REQUIRES_CORRECTION') return 'badge-error';
    return 'badge-warning';
  }

  async function handleDelete(e, participant) {
    e.stopPropagation(); // Prevent row click from opening popup
    if (!window.confirm(`Are you sure you want to completely delete ${participant.fullName} and their entire registration/passes? This cannot be undone.`)) {
      return;
    }
    
    const toastId = toast.loading('Deleting participant and associated data...');
    try {
      const deleteFn = httpsCallable(functions, 'deleteRegistration');
      await deleteFn({ registrationId: participant.registrationId });
      toast.update(toastId, 'success', 'Successfully deleted participant and related records');
      refresh();
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error deleting participant', normalizeError(err));
    }
  }

  async function handleManualCheckin(e, participant, pass) {
    e.stopPropagation();
    if (!window.confirm(`Manually check in ${participant.fullName || 'this participant'}?`)) return;
    const toastId = toast.loading('Checking in...');
    try {
      const checkInFn = httpsCallable(functions, 'checkInParticipantV2');
      if (!pass.secureCode) throw new Error('This pass has no secure code');
      const res = await checkInFn({ secureCode: pass.secureCode });
      
      if (res.data && res.data.success === false) {
        throw new Error(res.data.status || 'Check-in failed');
      }
      
      toast.update(toastId, 'success', 'Participant checked in manually');
      refresh();
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error checking in', normalizeError(err));
    }
  }

  const handleSelectRow = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (allIds, isChecked) => {
    if (isChecked) {
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const selectedParts = (data || []).filter(p => selectedIds.has(p.id));
    const regIds = Array.from(new Set(selectedParts.map(p => p.registrationId).filter(Boolean)));

    if (!window.confirm(`Are you sure you want to completely delete ${ids.length} selected participant(s) across ${regIds.length} registration(s)? This cannot be undone.`)) {
      return;
    }

    const toastId = toast.loading(`Deleting ${regIds.length} registration(s)...`);
    try {
      const deleteFn = httpsCallable(functions, 'deleteRegistration');
      for (const regId of regIds) {
        await deleteFn({ registrationId: regId });
      }
      toast.update(toastId, 'success', `Successfully deleted ${ids.length} participant(s)`);
      setSelectedIds(new Set());
      refresh();
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error performing bulk deletion', normalizeError(err));
    }
  }

  async function handleBulkCheckin() {
    const selectedParts = (data || []).filter(p => selectedIds.has(p.id));
    const eligible = selectedParts.filter(p => p.checkInStatus !== 'CHECKED_IN' && passes?.[p.id]);

    if (eligible.length === 0) {
      toast.warning('No Eligible Participants', 'None of the selected participants have passes ready for check-in or are already checked in.');
      return;
    }

    if (!window.confirm(`Manually check in ${eligible.length} eligible participant(s)?`)) return;

    const toastId = toast.loading(`Checking in ${eligible.length} participant(s)...`);
    try {
      const checkInFn = httpsCallable(functions, 'checkInParticipantV2');
      let count = 0;
      for (const p of eligible) {
        const pass = passes[p.id];
        if (!pass.secureCode) throw new Error('This pass has no secure code');
        const res = await checkInFn({ secureCode: pass.secureCode });
        if (res.data?.success !== false) count++;
      }
      toast.update(toastId, 'success', `Successfully checked in ${count} participant(s)`);
      setSelectedIds(new Set());
      refresh();
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error during bulk check-in', normalizeError(err));
    }
  }

  async function handleBulkApprove() {
    const selectedParts = (data || []).filter(p => selectedIds.has(p.id));
    const eligible = selectedParts.filter(p => p.verificationStatus !== 'APPROVED');

    if (eligible.length === 0) {
      toast.info('Already Approved', 'All selected participants are already approved.');
      return;
    }

    if (!window.confirm(`Approve verification for ${eligible.length} participant(s)?`)) return;

    const toastId = toast.loading(`Approving ${eligible.length} participant(s)...`);
    try {
      const approveFn = httpsCallable(functions, 'approveVerification');
      let count = 0;
      for (const p of eligible) {
        await approveFn({ participantId: p.id });
        count++;
      }
      toast.update(toastId, 'success', `Successfully approved ${count} participant(s)`);
      setSelectedIds(new Set());
      refresh();
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error approving participants', normalizeError(err));
    }
  }

  const bulkActions = (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <button 
        className="btn btn-secondary"
        onClick={handleBulkApprove}
        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-success)', borderColor: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
      >
        <CheckCircle size={14} /> Approve Verification
      </button>
      <button 
        className="btn btn-secondary"
        onClick={handleBulkCheckin}
        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-gold)', borderColor: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
      >
        <CheckCircle size={14} /> Check-In Selected
      </button>
      <button 
        className="btn btn-danger"
        onClick={handleBulkDelete}
        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
      >
        <Trash2 size={14} /> Delete Selected
      </button>
    </div>
  );

  const columns = [
    { 
      header: "Participant", 
      accessorKey: "fullName", 
      sortKey: "fullName",
      cell: (r) => {
        const name = r.fullName || r.customFields?.full_name || r.customFields?.name || 'Participant';
        const phone = r.mobile || r.phoneNumber || r.customFields?.phone_number || r.customFields?.mobile || r.customFields?.phone || 'No phone';
        const gender = r.gender || r.customFields?.gender || 'N/A';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{gender} • {phone}</div>
            </div>
          </div>
        );
      }
    },
    { header: "Pass ID", accessorKey: "passId", cell: (r) => <span style={{fontFamily: 'monospace', fontSize: '0.85rem'}}>{passes?.[r.id]?.readableId || (passes?.[r.id] ? passes[r.id].id.slice(0,8).toUpperCase() : 'N/A')}</span> },
    { header: "Linked Email", accessorKey: "email", sortKey: "email", cell: (r) => <span style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>{r.email || 'Legacy'}</span> },
    { header: "College", accessorKey: "collegeId", sortKey: "collegeId", cell: (r) => {
      const cName = colleges ? (colleges[r.collegeId] || r.collegeId) : r.collegeId;
      if (cName && cName.toLowerCase().includes('other')) {
        return r.customFields?.other_college_name || r.customFields?.college_name || cName;
      }
      return cName || 'N/A';
    }},
    { header: "Verification", accessorKey: "verificationStatus", sortKey: "verificationStatus", cell: (r) => <span className={`badge ${getBadgeColor(r.verificationStatus)}`}>{r.verificationStatus || 'PENDING'}</span> },
    { header: "Check-in", accessorKey: "checkInStatus", sortKey: "checkInStatus", cell: (r) => <span className={`badge ${r.checkInStatus === 'CHECKED_IN' ? 'badge-success' : 'badge-warning'}`}>{r.checkInStatus === 'CHECKED_IN' ? 'Checked In' : 'Pending'}</span> },
    {
      header: "Actions",
      cell: (r) => {
        const isCheckedIn = r.checkInStatus === 'CHECKED_IN';
        const pass = passes?.[r.id];
        return (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!isCheckedIn && pass && (
              <button 
                onClick={(e) => handleManualCheckin(e, r, pass)}
                className="btn btn-icon"
                style={{ padding: '0.4rem', color: 'var(--color-success)', background: 'rgba(0,255,0,0.1)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                title="Manual Check-in"
              >
                <CheckCircle size={16} />
              </button>
            )}
            <button 
              onClick={(e) => handleDelete(e, r)}
              className="btn btn-icon"
              style={{ padding: '0.4rem', color: 'var(--color-error)', background: 'rgba(255,0,0,0.1)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              title="Delete Registration"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )
      }
    }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Participants" 
        description="Manage all registered participants." 
        actions={
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className="btn btn-primary"
              onClick={() => setShowManualModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-gold)', color: '#000' }}
            >
              <Plus size={18} />
              On-Spot Registration
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => window.open('/print-participants', '_blank')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Download size={18} />
              Print ID Sheets
            </button>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={filteredParts} 
          loading={loading}
          error={error}
          showSerial={true}
          exportable={true}
          exportFilename="participants_export.csv"
          selectable={true}
          selectedIds={selectedIds}
          onSelectRow={handleSelectRow}
          onSelectAll={handleSelectAll}
          bulkActions={bulkActions}
          actions={
            <>
              {hasMore && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => fetchParticipants(true)}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem' }}
                >
                  <RefreshCw size={16} className={loading ? 'spin' : ''} />
                  Load More (100)
                </button>
              )}
              <button 
                className="btn btn-primary" 
                onClick={() => setShowManualModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-gold)', color: 'black' }}
              >
                <Plus size={16} />
                On-Spot Registration
              </button>
            </>
          }
          onRowClick={setSelectedParticipant}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search recent participants by name or ID..."
        />
      </div>

      <DetailDrawer 
        isOpen={!!selectedParticipant} 
        onClose={() => setSelectedParticipant(null)}
        title="Participant Details"
      >
        {selectedParticipant && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div className="avatar" style={{ width: '64px', height: '64px', fontSize: '1.5rem' }}>
                {(selectedParticipant.fullName || selectedParticipant.custom_full_name || selectedParticipant.custom_name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>{selectedParticipant.fullName || selectedParticipant.custom_full_name || selectedParticipant.custom_name || 'Participant'}</h3>
                <div style={{ color: 'var(--text-secondary)' }}>
                  {selectedParticipant.email || selectedParticipant.custom_email || 'No email'} • {selectedParticipant.mobile || selectedParticipant.phoneNumber || selectedParticipant.custom_phone_number || selectedParticipant.custom_mobile || 'No phone'}
                </div>
              </div>
            </div>

            <div className="surface-flat" style={{ padding: '1.25rem' }}>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Profile Data</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Participant ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedParticipant.id}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Registration ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedParticipant.registrationId}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Gender</div>
                  <div>{selectedParticipant.gender}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Registration Time</div>
                  <div>{selectedParticipant.createdAt?.toDate ? selectedParticipant.createdAt.toDate().toLocaleString() : 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Pass Type</div>
                  <div><span className="badge badge-info">{selectedParticipant.passType || (selectedParticipant.isGroup ? 'Group' : 'Single')}</span></div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>College</div>
                  <div style={{ fontWeight: 500 }}>{(colleges && colleges[selectedParticipant.collegeId]) || selectedParticipant.college || selectedParticipant.collegeId || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Pass ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{passes?.[selectedParticipant.id]?.readableId || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Verification</div>
                  <div><span className={`badge ${getBadgeColor(selectedParticipant.verificationStatus)}`}>{selectedParticipant.verificationStatus || 'PENDING'}</span></div>
                </div>
                {Object.keys(selectedParticipant)
                  .filter(key => key.startsWith('custom_') && key !== 'custom_full_name' && key !== 'custom_phone_number' && key !== 'custom_gender')
                  .map(key => (
                    <div key={key}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'capitalize' }}>
                        {key.replace('custom_', '').replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontWeight: 500 }}>
                        {Array.isArray(selectedParticipant[key]) 
                          ? selectedParticipant[key].join(', ') 
                          : typeof selectedParticipant[key] === 'boolean' 
                            ? (selectedParticipant[key] ? 'Yes' : 'No') 
                            : String(selectedParticipant[key] || 'N/A')}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {selectedParticipant.checkInStatus === 'CHECKED_IN' && (
              <div className="surface-flat" style={{ padding: '1.25rem' }}>
                <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Check-in Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Status</div>
                    <div><span className="badge badge-success">Checked In</span></div>
                  </div>
                  {selectedCheckin ? (
                    <>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Check-in Time</div>
                        <div>{selectedCheckin.timestamp?.toDate ? selectedCheckin.timestamp.toDate().toLocaleString() : 'N/A'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Scanned By</div>
                        <div>{selectedCheckin.volunteerId || 'Unknown'}</div>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>Loading details...</div>
                  )}
                </div>
              </div>
            )}
            
            <div className="surface-flat" style={{ padding: '1.25rem' }}>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Verification Documents</h4>
              {regLoading ? (
                <div style={{ color: 'var(--text-muted)' }}>Loading documents...</div>
              ) : selectedRegistration?.verificationDocs?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {(() => {
                    const groupMembers = data.filter(p => p.registrationId === selectedParticipant.registrationId);
                    groupMembers.sort((a, b) => a.id.localeCompare(b.id));
                    const myIndex = selectedParticipant.participantIndex !== undefined ? selectedParticipant.participantIndex : groupMembers.findIndex(p => p.id === selectedParticipant.id);
                    const myDocs = selectedRegistration.verificationDocs.filter(d => d.participantIndex === myIndex || d.participantIndex === undefined);
                    
                    if (myDocs.length === 0) {
                      return <div style={{ color: 'var(--text-muted)' }}>No verification documents for this specific participant.</div>;
                    }
                    
                    return myDocs.map((doc, idx) => (
                      <div key={idx} style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--color-gold)' }}>{doc.filename || 'Uploaded Document'}</div>
                        {doc.url ? (
                          <a href={doc.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                            <img src={doc.url} alt="Verification" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '4px', objectFit: 'contain' }} />
                          </a>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>URL not available</div>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>No verification documents uploaded.</div>
              )}
            </div>

            <div className="surface-flat" style={{ padding: '1.25rem' }}>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Group Members (Same Registration)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.filter(p => p.registrationId === selectedParticipant.registrationId).map(member => {
                  const mName = member.fullName || member.custom_full_name || member.custom_name || 'Participant';
                  const mGender = member.gender || member.custom_gender || 'N/A';
                  return (
                    <div 
                      key={member.id} 
                      onClick={() => member.id !== selectedParticipant.id && setPreviewParticipant(member)}
                      style={{ 
                        padding: '0.75rem', 
                        background: member.id === selectedParticipant.id ? 'var(--color-primary)' : 'rgba(0,0,0,0.2)', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: '1px solid var(--border-light)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{mName} {member.id === selectedParticipant.id && '(Current)'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{mGender}</div>
                      </div>
                      <div>
                        <span className={`badge ${getBadgeColor(member.verificationStatus)}`}>{member.verificationStatus}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="surface-flat" style={{ padding: '1.25rem' }}>
               <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Pass Status</h4>
               {regLoading ? (
                 <div style={{ color: 'var(--text-muted)' }}>Loading status...</div>
               ) : selectedRegistration?.status === 'PASS_ISSUED' ? (
                  <div style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }}></div>
                    Pass has been successfully issued for this registration
                  </div>
               ) : (
                   <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div>No pass issued yet.</div>
                    <div>Registration Status: <span style={{ color: 'var(--text-primary)' }}>{selectedRegistration?.status || 'N/A'}</span></div>
                    <div>Payment Status: <span style={{ color: 'var(--text-primary)' }}>{selectedRegistration?.paymentStatus || 'N/A'}</span></div>
                    
                    {selectedRegistration?.status === 'PAYMENT_SUCCESS' && (
                      <button 
                        className="btn btn-primary" 
                        onClick={async () => {
                          try {
                            const toastId = toast.loading('Generating pass...');
                            const generatePassFn = httpsCallable(functions, 'generatePass');
                            await generatePassFn({ registrationId: selectedParticipant.registrationId });
                            toast.update(toastId, 'success', 'Pass generated successfully!');
                            refresh();
                          } catch (err) {
                            toast.error('Failed to generate pass', normalizeError(err));
                          }
                        }}
                        style={{ marginTop: '0.5rem', background: 'var(--color-gold)', color: 'black', width: 'max-content' }}
                      >
                        Force Generate Pass
                      </button>
                    )}
                  </div>
               )}
            </div>

            <div className="surface" style={{ padding: '1.25rem', borderColor: 'rgba(198, 40, 40, 0.3)' }}>
              <h4 style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                Actions
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Manage participant status and access.
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={(e) => handleDelete(e, selectedParticipant)}>
                  Delete Registration & All Members
                </button>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Mini Preview Popup for Group Members */}
      {previewParticipant && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setPreviewParticipant(null)}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              padding: '2rem',
              width: '90%',
              maxWidth: '350px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="avatar" style={{ width: '48px', height: '48px', fontSize: '1.2rem' }}>
                {(previewParticipant.fullName || previewParticipant.custom_full_name || previewParticipant.custom_name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{previewParticipant.fullName || previewParticipant.custom_full_name || previewParticipant.custom_name || 'Participant'}</h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{previewParticipant.gender || previewParticipant.custom_gender || 'N/A'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Status</span>
                <span className={`badge ${getBadgeColor(previewParticipant.verificationStatus)}`}>{previewParticipant.verificationStatus}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>College</span>
                <span style={{ fontSize: '0.85rem' }}>{previewParticipant.college || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Pass Type</span>
                <span style={{ fontSize: '0.85rem' }}>{previewParticipant.passType || 'Group'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                onClick={() => setPreviewParticipant(null)}
              >
                Close
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                onClick={() => {
                  setSelectedParticipant(previewParticipant);
                  setPreviewParticipant(null);
                }}
              >
                View Full
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Manual Registration Modal */}
      <AnimatePresence>
        {showManualModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.95, y: 20 }}
              className="surface"
              style={{ width: '100%', maxWidth: '500px', borderRadius: '12px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: 'var(--color-gold)' }}>On-Spot Registration</h2>
                <button onClick={() => setShowManualModal(false)} className="btn btn-icon" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}><X size={20} /></button>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Full Name *</label>
                <input type="text" className="form-input" style={{ width: '100%' }} value={manualForm.fullName} onChange={e => setManualForm({...manualForm, fullName: e.target.value})} placeholder="Participant Name" />
              </div>
              
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Email (Optional)</label>
                <input type="email" className="form-input" style={{ width: '100%' }} value={manualForm.email} onChange={e => setManualForm({...manualForm, email: e.target.value})} placeholder="Participant Email" />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Mobile (Optional)</label>
                <input type="tel" className="form-input" style={{ width: '100%' }} value={manualForm.mobile} onChange={e => setManualForm({...manualForm, mobile: e.target.value})} placeholder="Phone Number" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Gender</label>
                  <select className="form-input" style={{ width: '100%' }} value={manualForm.gender} onChange={e => setManualForm({...manualForm, gender: e.target.value})}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Payment Method</label>
                  <select className="form-input" style={{ width: '100%' }} value={manualForm.paymentMethod} onChange={e => setManualForm({...manualForm, paymentMethod: e.target.value})}>
                    <option value="CASH">Cash</option>
                    <option value="RAZORPAY">Razorpay / UPI</option>
                    <option value="COMPLIMENTARY">Complimentary (Free)</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Select Package *</label>
                <select className="form-input" style={{ width: '100%' }} value={manualForm.packageId} onChange={e => setManualForm({...manualForm, packageId: e.target.value})}>
                  <option value="">-- Choose Package --</option>
                  {packages?.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>
                  ))}
                </select>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '0.75rem' }} 
                disabled={isSubmitting || !manualForm.fullName || !manualForm.packageId}
                onClick={async () => {
                  setIsSubmitting(true);
                  const toastId = toast.loading('Creating on-spot registration...');
                  try {
                    const fn = httpsCallable(functions, 'adminCreateOnSpotRegistration');
                    const res = await fn(manualForm);
                    
                    if (res.data.requiresPayment) {
                      toast.update(toastId, 'info', 'Please scan QR code to pay...');
                      
                      const options = {
                        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_placeholder",
                        amount: res.data.amount * 100,
                        currency: "INR",
                        name: "Rangtal Garba",
                        description: "On-Spot Registration",
                        order_id: res.data.orderId,
                        handler: async function (response) {
                          const paymentToast = toast.loading("Verifying payment...");
                          try {
                            const verifyFn = httpsCallable(functions, 'verifyPayment');
                            await verifyFn({
                              paymentId: res.data.paymentId,
                              gatewayPaymentId: response.razorpay_payment_id,
                              gatewaySignature: response.razorpay_signature
                            });
                            
                            const generatePassFn = httpsCallable(functions, 'generatePass');
                            await generatePassFn({ registrationId: res.data.registrationId });
                            
                            toast.update(paymentToast, 'success', 'Registration and Payment Complete!');
                            setShowManualModal(false);
                            setManualForm({ fullName: '', packageId: '', gender: 'Male', mobile: '', paymentMethod: 'CASH', email: '' });
                            refresh();
                          } catch (err) {
                            console.error("Verification failed", err);
                            toast.update(paymentToast, 'error', 'Payment Verification Failed', normalizeError(err));
                          }
                        },
                        prefill: {
                          name: manualForm.fullName,
                          email: manualForm.email || "onspot@rhythmrebel.com",
                          contact: manualForm.mobile || ""
                        },
                        theme: { color: "#D4AF37" }
                      };
                      
                      const rzp = new window.Razorpay(options);
                      rzp.on('payment.failed', function (response){
                        toast.error('Payment Failed', response.error.description);
                      });
                      rzp.open();
                      setIsSubmitting(false);
                    } else {
                      toast.update(toastId, 'success', `Registration Complete! Pass ID: ${res.data.passId}`);
                      setShowManualModal(false);
                      setManualForm({ fullName: '', packageId: '', gender: 'Male', mobile: '', paymentMethod: 'CASH', email: '' });
                      refresh();
                      setIsSubmitting(false);
                    }
                  } catch (err) {
                    console.error(err);
                    toast.update(toastId, 'error', 'Error creating registration', normalizeError(err));
                    setIsSubmitting(false);
                  }
                }}
              >
                {isSubmitting ? 'Processing...' : 'Complete Registration'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
