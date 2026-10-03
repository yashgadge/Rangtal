import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';
import { useFirebaseData } from '../../../../shared/hooks/useFirebaseData.js';

export default function Participants() {
  const toast = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState(null);

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
      (p.registrationId && p.registrationId.toLowerCase().includes(term))
    );
  }, [data, searchTerm]);

  function getBadgeColor(status) {
    if (status === 'VERIFIED') return 'badge-success';
    if (status === 'REQUIRES_CORRECTION') return 'badge-error';
    return 'badge-warning';
  }

  const columns = [
    { 
      header: "Participant", 
      accessorKey: "fullName", 
      cell: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
            {r.fullName?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{r.fullName || 'N/A'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.gender}</div>
          </div>
        </div>
      )
    },
    { header: "ID", accessorKey: "id", cell: (r) => <span style={{fontFamily: 'monospace', fontSize: '0.85rem'}}>{r.id.slice(0,8)}...</span> },
    { header: "Registration", accessorKey: "registrationId", cell: (r) => <span style={{fontFamily: 'monospace', fontSize: '0.85rem'}}>{r.registrationId?.slice(0,8)}...</span> },
    { header: "Status", accessorKey: "verificationStatus", cell: (r) => <span className={`badge ${getBadgeColor(r.verificationStatus)}`}>{r.verificationStatus || 'PENDING'}</span> }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Participants" 
        description="Manage all registered participants." 
        actions={
          <button className="btn btn-secondary" onClick={refresh}>
            <Download size={16} /> Export Recent
          </button>
        }
      />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={filteredParts} 
          loading={loading}
          error={error}
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
                {selectedParticipant.fullName?.charAt(0).toUpperCase() || '?'}
              </div>
              <div>
                <h3 style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>{selectedParticipant.fullName}</h3>
                <div style={{ color: 'var(--text-secondary)' }}>{selectedParticipant.email || 'No email provided'}</div>
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
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Verification</div>
                  <div><span className={`badge ${getBadgeColor(selectedParticipant.verificationStatus)}`}>{selectedParticipant.verificationStatus || 'PENDING'}</span></div>
                </div>
              </div>
            </div>
            
            <div className="surface-flat" style={{ padding: '1.25rem' }}>
               <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Digital Pass</h4>
               {selectedParticipant.passIssued ? (
                  <div style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }}></div>
                    Pass has been issued
                  </div>
               ) : (
                  <div style={{ color: 'var(--text-muted)' }}>No pass issued yet.</div>
               )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </motion.div>
  );
}
