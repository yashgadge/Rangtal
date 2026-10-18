import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { motion } from 'framer-motion';
import { FileClock, Activity, Download } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
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
    setError(null);
    try {
      const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data);
    } catch (err) {
      console.error("Error fetching audit logs", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    const rows = filteredLogs;
    if (!rows || rows.length === 0) return;

    const headers = ['Timestamp', 'Action', 'Result', 'Actor ID', 'Actor Role', 'Target Type', 'Target ID', 'Metadata'];
    const csvRows = rows.map(r => {
      const ts = r.timestamp?.toDate ? r.timestamp.toDate().toLocaleString() : '';
      const metadata = r.metadata ? JSON.stringify(r.metadata).replace(/"/g, '""') : '';
      return [
        `"${ts}"`,
        `"${r.action || ''}"`,
        `"${r.result || ''}"`,
        `"${r.actorId || 'SYSTEM'}"`,
        `"${r.actorRole || ''}"`,
        `"${r.targetType || ''}"`,
        `"${r.targetId || ''}"`,
        `"${metadata}"`
      ].join(',');
    });

    const csv = [headers.map(h => `"${h}"`).join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `audit_logs_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
        actions={
          <button
            className="btn btn-secondary"
            onClick={handleExport}
            disabled={filteredLogs.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Download size={16} />
            Export CSV ({filteredLogs.length})
          </button>
        }
      />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={filteredLogs} 
          loading={loading}
          error={error}
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
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Actor ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedLog.actorId || 'SYSTEM'}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Actor Role</div>
                  <div>{selectedLog.actorRole || 'N/A'}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Result</div>
                  <div style={{ color: selectedLog.result === 'SUCCESS' ? 'var(--color-success)' : 'var(--color-error)' }}>{selectedLog.result || 'N/A'}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Target Type</div>
                  <div>{selectedLog.targetType || 'N/A'}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Target ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedLog.targetId || 'N/A'}</div>
                </div>

              </div>
            </div>

            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div className="surface-flat" style={{ padding: '1.25rem' }}>
                <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Metadata / Payload</h4>
                <pre style={{ 
                  background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', 
                  fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-primary)',
                  overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </motion.div>
  );
}
