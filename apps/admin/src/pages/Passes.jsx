import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { motion } from 'framer-motion';
import { Ticket, Download, AlertTriangle } from 'lucide-react';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';

export default function Passes() {
  const toast = useToast();
  const [passes, setPasses] = useState([]);
  const [filteredPasses, setFilteredPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPass, setSelectedPass] = useState(null);

  useEffect(() => {
    fetchPasses();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      setFilteredPasses(passes.filter(p => 
        p.id.toLowerCase().includes(term) || 
        (p.participantName && p.participantName.toLowerCase().includes(term)) ||
        (p.registrationId && p.registrationId.toLowerCase().includes(term))
      ));
    } else {
      setFilteredPasses(passes);
    }
  }, [passes, searchTerm]);

  async function fetchPasses() {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'passes'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      const pData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPasses(pData);
    } catch (err) {
      console.error("Error fetching passes", err);
      setError(err);
      toast.error('Failed to load passes', normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(passId) {
    if (!window.confirm("Are you sure you want to revoke this pass? It will no longer be scannable.")) return;
    const toastId = toast.loading('Revoking pass...');
    try {
      await updateDoc(doc(db, 'passes', passId), { status: 'REVOKED' });
      fetchPasses();
      if(selectedPass?.id === passId) {
         setSelectedPass({...selectedPass, status: 'REVOKED'});
      }
      toast.update(toastId, 'success', 'Pass revoked successfully');
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error revoking pass', normalizeError(err));
    }
  }

  const columns = [
    { 
      header: "Pass ID", 
      accessorKey: "id", 
      cell: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
          <Ticket size={14} color="var(--color-gold)" /> {r.id.slice(0, 10)}...
        </div>
      )
    },
    { header: "Participant", accessorKey: "participantName", cell: (r) => <span style={{ fontWeight: 500 }}>{r.participantName || 'Unknown'}</span> },
    { header: "Registration", accessorKey: "registrationId", cell: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.registrationId.slice(0, 8)}...</span> },
    { header: "Status", accessorKey: "status", cell: (r) => <span className={`badge ${r.status === 'ACTIVE' ? 'badge-success' : r.status === 'REVOKED' ? 'badge-error' : 'badge-warning'}`}>{r.status}</span> },
    { header: "Date Issued", accessorKey: "createdAt", cell: (r) => r.createdAt?.toDate().toLocaleDateString() || 'N/A' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Pass Management" 
        description="Monitor issued digital passes and their status." 
        actions={
          <button className="btn btn-secondary" onClick={fetchPasses}>
            <Download size={16} /> Export Recent
          </button>
        }
      />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={filteredPasses} 
          loading={loading}
          error={error}
          onRowClick={setSelectedPass}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search recent passes by Pass ID, Name, or Registration ID..."
        />
      </div>

      <DetailDrawer 
        isOpen={!!selectedPass} 
        onClose={() => setSelectedPass(null)}
        title="Pass Details"
      >
        {selectedPass && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div className="surface" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden', border: '1px solid var(--color-gold)' }}>
              <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'radial-gradient(circle, var(--color-gold-glow) 0%, transparent 70%)', borderRadius: '50%' }}></div>
              
              <h2 className="font-display" style={{ fontSize: '1.5rem', letterSpacing: '2px', color: 'var(--color-gold)', marginBottom: '1.5rem' }}>RANGTAL</h2>
              
              <div style={{ width: '150px', height: '150px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', marginBottom: '1.5rem', opacity: selectedPass.status === 'ACTIVE' ? 1 : 0.2 }}>
                <span style={{ color: '#000', fontWeight: 600 }}>QR CODE</span>
              </div>
              
              <div style={{ textAlign: 'center', zIndex: 1 }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{selectedPass.participantName}</h3>
                <div style={{ color: 'var(--color-gold)', fontSize: '0.9rem', marginBottom: '1rem' }}>General Entry</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', letterSpacing: '1px', opacity: 0.7 }}>{selectedPass.id}</div>
              </div>
              
              {selectedPass.status !== 'ACTIVE' && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-15deg)', border: '4px solid var(--color-error)', color: 'var(--color-error)', padding: '0.5rem 1rem', fontSize: '2rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '4px', zIndex: 2, background: 'rgba(0,0,0,0.8)' }}>
                  {selectedPass.status}
                </div>
              )}
            </div>

            <div className="surface-flat" style={{ padding: '1.25rem' }}>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Metadata</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Registration ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedPass.registrationId}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Participant UID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedPass.participantUid}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Issue Date</div>
                  <div>{selectedPass.createdAt?.toDate().toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Check-in Status</div>
                  <div>{selectedPass.checkInTime ? 'Checked In' : 'Not Checked In'}</div>
                </div>
              </div>
            </div>

            {selectedPass.status === 'ACTIVE' && (
              <div className="surface" style={{ padding: '1.25rem', borderColor: 'rgba(198, 40, 40, 0.3)' }}>
                <h4 style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <AlertTriangle size={18} /> Danger Zone
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Revoking a pass is permanent. The QR code will immediately become invalid for entry.
                </p>
                <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => handleRevoke(selectedPass.id)}>
                  Revoke Pass
                </button>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </motion.div>
  );
}
