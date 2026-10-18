import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, getDocs, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { motion } from 'framer-motion';
import { Ticket, Download, AlertTriangle } from 'lucide-react';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';
import { useFirebaseData } from '../../../../shared/hooks/useFirebaseData.js';

// Draws a QR code onto a canvas using the browser's built-in URL API via an <img> tag
// We use the free QR API (no package needed)
function QRImage({ value, size = 120 }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
  return <img src={url} alt="QR" width={size} height={size} style={{ borderRadius: 8, display: 'block' }} crossOrigin="anonymous" />;
}

async function downloadQR(secureCode, readableId, name) {
  const size = 300;
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(secureCode)}`;
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${readableId || 'pass'}_${name || 'onspot'}.png`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Passes() {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPass, setSelectedPass] = useState(null);
  const [showUnknown, setShowUnknown] = useState(false);
  const [tab, setTab] = useState('all'); // 'all' | 'onspot'
  const [displayOverride, setDisplayOverride] = useState(null);

  useEffect(() => {
    getDoc(doc(db, 'eventSettings', 'global')).then(snap => {
      if (snap.exists()) {
        const d = snap.data()?.PASSES_DISPLAY;
        if (d?.enabled && d?.count) setDisplayOverride(d.count);
      }
    }).catch(() => {});
  }, []);

  const { data: passes, loading, error, refresh } = useFirebaseData('admin_passes', async () => {
    const q = query(collection(db, 'passes'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(d => !d.isComplimentary);
  });

  const { data: colleges } = useFirebaseData('colleges', async () => {
    const snap = await getDocs(collection(db, 'colleges'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });

  const collegeMap = useMemo(() => {
    const map = {};
    colleges?.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [colleges]);

  useEffect(() => {
    if (error) toast.error('Failed to load passes', normalizeError(error));
  }, [error, toast]);

  const enrichedPasses = useMemo(() => {
    if (!passes) return [];
    return passes.map(p => ({
      ...p,
      collegeName: collegeMap[p.participantCollegeId] || p.participantCollegeId || 'N/A',
      packageName: p.regType || 'N/A'
    }));
  }, [passes, collegeMap]);

  const allPasses = useMemo(() => {
    let filtered = enrichedPasses.filter(p => !p.isOnSpot);
    if (!showUnknown) filtered = filtered.filter(p => p.participantName && p.participantName.toLowerCase() !== 'unknown');
    if (!searchTerm) return filtered;
    const term = searchTerm.toLowerCase();
    return filtered.filter(p =>
      p.id.toLowerCase().includes(term) ||
      (p.readableId && p.readableId.toLowerCase().includes(term)) ||
      (p.participantName && p.participantName.toLowerCase().includes(term)) ||
      (p.registrationId && p.registrationId.toLowerCase().includes(term))
    );
  }, [enrichedPasses, searchTerm, showUnknown]);

  const onspotPasses = useMemo(() => {
    let filtered = enrichedPasses.filter(p => p.isOnSpot);
    if (!searchTerm) return filtered;
    const term = searchTerm.toLowerCase();
    return filtered.filter(p =>
      p.id.toLowerCase().includes(term) ||
      (p.readableId && p.readableId.toLowerCase().includes(term)) ||
      (p.participantName && p.participantName.toLowerCase().includes(term))
    );
  }, [enrichedPasses, searchTerm]);

  async function handleRevoke(passId) {
    if (!window.confirm('Revoke this pass? It will no longer be scannable.')) return;
    const toastId = toast.loading('Revoking pass...');
    try {
      await updateDoc(doc(db, 'passes', passId), { status: 'REVOKED' });
      refresh();
      if (selectedPass?.id === passId) setSelectedPass({ ...selectedPass, status: 'REVOKED' });
      toast.update(toastId, 'success', 'Pass revoked successfully');
    } catch (err) {
      toast.update(toastId, 'error', 'Error revoking pass', normalizeError(err));
    }
  }

  async function handleDownloadAll() {
    const active = onspotPasses.filter(p => p.secureCode);
    if (!active.length) { toast.warning('No passes', 'No on-spot passes to download'); return; }
    const toastId = toast.loading(`Downloading ${active.length} QR codes...`);
    try {
      for (const p of active) {
        await downloadQR(p.secureCode, p.readableId, p.participantName);
        await new Promise(r => setTimeout(r, 200)); // small delay to avoid rate limit
      }
      toast.update(toastId, 'success', `Downloaded ${active.length} QR codes`);
    } catch (err) {
      toast.update(toastId, 'error', 'Download failed', normalizeError(err));
    }
  }

  const columns = [
    {
      header: 'Pass ID',
      accessorKey: 'id',
      sortKey: 'id',
      cell: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
          <Ticket size={14} color="var(--color-gold)" /> {r.readableId || r.id.slice(0, 10)}
        </div>
      )
    },
    { header: 'Participant', accessorKey: 'participantName', sortKey: 'participantName', cell: (r) => <span style={{ fontWeight: 500 }}>{r.participantName || 'Unknown'}</span> },
    { header: 'Registration', accessorKey: 'registrationId', cell: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.registrationId?.slice(0, 8)}</span> },
    { header: 'Pass Type', accessorKey: 'regType', sortKey: 'regType', cell: (r) => <span className="badge badge-info">{r.regType || 'Single'}</span> },
    { header: 'College', accessorKey: 'collegeName', sortKey: 'collegeName', cell: (r) => <span>{r.collegeName}</span> },
    { header: 'Status', accessorKey: 'status', sortKey: 'status', cell: (r) => <span className={`badge ${r.status === 'ACTIVE' ? 'badge-success' : r.status === 'REVOKED' ? 'badge-error' : 'badge-warning'}`}>{r.status}</span> },
    { header: 'Date Issued', accessorKey: 'createdAt', sortKey: (r) => r.createdAt?.toMillis ? r.createdAt.toMillis() : 0, cell: (r) => <span style={{ fontSize: '0.85rem' }}>{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : 'N/A'}</span> },
  ];

  const onspotColumns = [
    {
      header: 'Pass ID',
      accessorKey: 'readableId',
      cell: (r) => <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-gold)' }}>{r.readableId || r.id.slice(0, 10)}</span>
    },
    { header: 'Name', accessorKey: 'participantName', cell: (r) => <span style={{ fontWeight: 500 }}>{r.participantName || 'Unknown'}</span> },
    { header: 'Package', accessorKey: 'regType', cell: (r) => <span className="badge badge-info">{r.regType || 'Single'}</span> },
    { header: 'Status', accessorKey: 'status', cell: (r) => <span className={`badge ${r.status === 'ACTIVE' ? 'badge-success' : 'badge-error'}`}>{r.status}</span> },
    { header: 'Issued', accessorKey: 'createdAt', cell: (r) => <span style={{ fontSize: '0.85rem' }}>{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : 'N/A'}</span> },
    {
      header: 'QR',
      cell: (r) => r.secureCode ? <QRImage value={r.secureCode} size={48} /> : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>N/A</span>
    },
    {
      header: 'Download',
      cell: (r) => (
        <button
          className="btn btn-secondary"
          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          onClick={(e) => { e.stopPropagation(); downloadQR(r.secureCode, r.readableId, r.participantName); }}
          disabled={!r.secureCode}
        >
          <Download size={13} /> QR
        </button>
      )
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Pass Management" description="Monitor issued digital passes and their status." />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0' }}>
        {[['all', 'All Passes'], ['onspot', `On-Spot Passes (${onspotPasses.length})`]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '0.6rem 1.25rem',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === key ? '2px solid var(--color-gold)' : '2px solid transparent',
              color: tab === key ? 'var(--color-gold)' : 'var(--text-secondary)',
              fontWeight: tab === key ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.95rem',
              marginBottom: '-1px'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'all' ? (
          <DataTable
            columns={columns}
            data={allPasses}
            loading={loading}
            error={error}
            showSerial={true}
            exportable={true}
            exportFilename="passes_export.csv"
            onRowClick={setSelectedPass}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search by Pass ID, Name, or Registration ID..."
            displayTotal={displayOverride !== null ? displayOverride : undefined}
            actions={
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)', background: 'var(--surface-elevated)', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <input type="checkbox" checked={showUnknown} onChange={(e) => setShowUnknown(e.target.checked)} style={{ accentColor: 'var(--color-gold)', cursor: 'pointer' }} />
                Show Unassigned Passes
              </label>
            }
          />
        ) : (
          <DataTable
            columns={onspotColumns}
            data={onspotPasses}
            loading={loading}
            error={error}
            showSerial={true}
            exportable={true}
            exportFilename="onspot_passes_export.csv"
            onRowClick={setSelectedPass}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search on-spot passes by name or pass ID..."
            actions={
              <button
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-gold)', color: '#000' }}
                onClick={handleDownloadAll}
                disabled={!onspotPasses.length}
              >
                <Download size={16} /> Download All QRs
              </button>
            }
          />
        )}
      </div>

      <DetailDrawer isOpen={!!selectedPass} onClose={() => setSelectedPass(null)} title="Pass Details">
        {selectedPass && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="surface" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden', border: '1px solid var(--color-gold)' }}>
              <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'radial-gradient(circle, var(--color-gold-glow) 0%, transparent 70%)', borderRadius: '50%' }}></div>
              <h2 className="font-display" style={{ fontSize: '1.5rem', letterSpacing: '2px', color: 'var(--color-gold)', marginBottom: '1.5rem' }}>RANGTAL</h2>

              <div style={{ width: '150px', height: '150px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', marginBottom: '1.5rem', opacity: selectedPass.status === 'ACTIVE' ? 1 : 0.2 }}>
                {selectedPass.secureCode
                  ? <QRImage value={selectedPass.secureCode} size={140} />
                  : <span style={{ color: '#000', fontWeight: 600 }}>NO QR</span>
                }
              </div>

              <div style={{ textAlign: 'center', zIndex: 1 }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{selectedPass.participantName || 'Unknown'}</h3>
                <div style={{ color: 'var(--color-gold)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{selectedPass.regType || 'General Entry'}</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--color-gold)', fontWeight: 600 }}>{selectedPass.readableId}</div>
                {selectedPass.isOnSpot && <div style={{ marginTop: '0.5rem' }}><span className="badge badge-warning">On-Spot</span></div>}
              </div>

              {selectedPass.status !== 'ACTIVE' && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-15deg)', border: '4px solid var(--color-error)', color: 'var(--color-error)', padding: '0.5rem 1rem', fontSize: '2rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '4px', zIndex: 2, background: 'rgba(0,0,0,0.8)' }}>
                  {selectedPass.status}
                </div>
              )}
            </div>

            {selectedPass.secureCode && selectedPass.status === 'ACTIVE' && (
              <button
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                onClick={() => downloadQR(selectedPass.secureCode, selectedPass.readableId, selectedPass.participantName)}
              >
                <Download size={16} /> Download QR Code
              </button>
            )}

            <div className="surface-flat" style={{ padding: '1.25rem' }}>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Metadata</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Registration ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedPass.registrationId}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Issue Date</div>
                  <div>{selectedPass.createdAt?.toDate().toLocaleString()}</div>
                </div>
              </div>
            </div>

            {selectedPass.status === 'ACTIVE' && (
              <div className="surface" style={{ padding: '1.25rem', borderColor: 'rgba(198, 40, 40, 0.3)' }}>
                <h4 style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <AlertTriangle size={18} /> Danger Zone
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Revoking a pass is permanent. The QR code will immediately become invalid.
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
