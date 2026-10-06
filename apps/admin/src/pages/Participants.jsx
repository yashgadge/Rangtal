import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, limit, orderBy, doc, getDoc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { Download, Trash2, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
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

  const { data: passes } = useFirebaseData('admin_passes_lookup', async () => {
    const q = query(collection(db, 'passes'));
    const snap = await getDocs(q);
    return snap.docs.reduce((acc, doc) => {
      const p = doc.data();
      if (p.participantId) {
        acc[p.participantId] = p;
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

  const { data, loading, error, refresh } = useFirebaseData('admin_participants', async () => {
    const q = query(collection(db, 'participants'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });

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
      const res = await checkInFn({ secureCode: pass.secureCode || pass.id });
      
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
    { header: "Pass ID", accessorKey: "passId", cell: (r) => <span style={{fontFamily: 'monospace', fontSize: '0.85rem'}}>{passes?.[r.id]?.readableId || 'N/A'}</span> },
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
          <button 
            className="btn btn-secondary"
            onClick={() => window.open('/print-participants', '_blank')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Download size={18} />
            Print ID Sheets
          </button>
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
                  {selectedParticipant.email || selectedParticipant.custom_email || 'No email'} • {selectedParticipant.phoneNumber || selectedParticipant.custom_phone_number || selectedParticipant.custom_mobile || 'No phone'}
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
                  <div style={{ fontWeight: 500 }}>{selectedParticipant.college || 'N/A'}</div>
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
                  {selectedRegistration.verificationDocs.map((doc, idx) => (
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
                  ))}
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
    </motion.div>
  );
}
