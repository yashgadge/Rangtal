import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { motion } from 'framer-motion';
import { FileClock, Activity } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      setFilteredLogs(logs.filter(l => 
        (l.action && l.action.toLowerCase().includes(term)) || 
        (l.actorEmail && l.actorEmail.toLowerCase().includes(term)) ||
        (l.targetId && l.targetId.toLowerCase().includes(term))
      ));
    } else {
      setFilteredLogs(logs);
    }
  }, [logs, searchTerm]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(200));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data);
    } catch (err) {
      console.error("Error fetching audit logs", err);
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { 
      header: "Action", 
      accessorKey: "action", 
      cell: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={14} color="var(--color-gold)" /> 
          <span style={{ fontWeight: 500 }}>{r.action}</span>
        </div>
      )
    },
    { header: "Actor", accessorKey: "actorEmail", cell: (r) => r.actorEmail || r.actorUid || 'System' },
    { header: "Target", accessorKey: "targetId", cell: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.targetId || 'N/A'}</span> },
    { header: "Time", accessorKey: "timestamp", cell: (r) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{r.timestamp?.toDate().toLocaleString() || 'N/A'}</span> }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Audit Logs" 
        description="Monitor system activity, security events, and administrative actions." 
      />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={filteredLogs} 
          loading={loading}
          onRowClick={setSelectedLog}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search by action, actor, or target ID..."
        />
      </div>

      <DetailDrawer 
        isOpen={!!selectedLog} 
        onClose={() => setSelectedLog(null)}
        title="Audit Event Details"
      >
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="surface" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '48px', height: '48px', background: 'rgba(255,215,0,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-gold)' }}>
                <FileClock size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{selectedLog.action}</h3>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{selectedLog.timestamp?.toDate().toLocaleString()}</div>
              </div>
            </div>

            <div className="surface-flat" style={{ padding: '1.25rem' }}>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Event Metadata</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Actor UID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedLog.actorUid || 'SYSTEM'}</div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Actor Email</div>
                  <div>{selectedLog.actorEmail || 'N/A'}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Target ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedLog.targetId || 'N/A'}</div>
                </div>

              </div>
            </div>

            {selectedLog.details && (
              <div className="surface-flat" style={{ padding: '1.25rem' }}>
                <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Payload / Details</h4>
                <pre style={{ 
                  background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', 
                  fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-primary)',
                  overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </motion.div>
  );
}
