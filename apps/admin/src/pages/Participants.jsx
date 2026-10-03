import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { Download } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Participants() {
  const [participants, setParticipants] = useState([]);
  const [filteredParts, setFilteredParts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  useEffect(() => {
    fetchParticipants();
  }, []);

  useEffect(() => {
    filterData();
  }, [participants, searchTerm]);

  async function fetchParticipants() {
    setLoading(true);
    try {
      const q = query(collection(db, 'participants'), limit(500));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setParticipants(data);
    } catch (err) {
      console.error("Error fetching participants", err);
    } finally {
      setLoading(false);
    }
  }

  function filterData() {
    let result = [...participants];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.id.toLowerCase().includes(term) || 
        (p.fullName && p.fullName.toLowerCase().includes(term)) ||
        (p.registrationId && p.registrationId.toLowerCase().includes(term))
      );
    }
    setFilteredParts(result);
  }

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
          <button className="btn btn-secondary" onClick={fetchParticipants}>
            <Download size={16} /> Export
          </button>
        }
      />

      {/* Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total', val: participants.length },
          { label: 'Verified', val: participants.filter(p => p.verificationStatus === 'VERIFIED').length },
          { label: 'Pending', val: participants.filter(p => p.verificationStatus !== 'VERIFIED' && p.verificationStatus !== 'REQUIRES_CORRECTION').length }
        ].map(stat => (
          <div key={stat.label} className="surface" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)', color: 'var(--color-gold)' }}>{stat.val}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={filteredParts} 
          loading={loading}
          onRowClick={setSelectedParticipant}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search participants by name or ID..."
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
