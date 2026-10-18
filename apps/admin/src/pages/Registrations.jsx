import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, doc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { Download, AlertTriangle, Ticket } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';
import { useFirebaseData } from '../../../../shared/hooks/useFirebaseData.js';

export default function Registrations() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedReg, setSelectedReg] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [passes, setPasses] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [correctionReason, setCorrectionReason] = useState('');

  const { data: registrations, loading, error, refresh } = useFirebaseData('admin_registrations', async () => {
    const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(d => !d.isComplimentary);
  });

  const { data: paymentsLookup } = useFirebaseData('admin_payments_lookup', async () => {
    const q = query(collection(db, 'payments'));
    const snap = await getDocs(q);
    return snap.docs.reduce((acc, doc) => {
      const p = doc.data();
      if (p.registrationId && p.status === 'SUCCESS') {
        acc[p.registrationId] = p;
      }
      return acc;
    }, {});
  });

  useEffect(() => {
    if (error) {
      toast.error('Failed to load registrations', normalizeError(error));
    }
  }, [error, toast]);

  const filteredRegs = React.useMemo(() => {
    if (!registrations) return [];
    let result = [...registrations];
    if (statusFilter !== 'ALL') {
      result = result.filter(r => r.status === statusFilter || r.verificationStatus === statusFilter);
    }
    if (typeFilter !== 'ALL') {
      result = result.filter(r => (r.type || '').toUpperCase().includes(typeFilter));
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r => 
        r.id.toLowerCase().includes(term) || 
        (r.email && r.email.toLowerCase().includes(term)) ||
        (r.uid && r.uid.toLowerCase().includes(term)) ||
        (r.type && r.type.toLowerCase().includes(term))
      );
    }
    return result;
  }, [registrations, statusFilter, typeFilter, searchTerm]);

  async function handleRowClick(reg) {
    setSelectedReg(reg);
    setLoadingDetails(true);
    setDetailsError(null);
    setParticipants([]);
    setPasses([]);
    setDocuments([]);
    setCorrectionReason('');
    
    try {
      // Fetch participants for this specific registration
      const pQuery = query(collection(db, 'participants'), where('registrationId', '==', reg.id));
      const participantsSnap = await getDocs(pQuery);
      const parts = participantsSnap.docs.map(d => ({id: d.id, ...d.data()}));
      setParticipants(parts);
      
      // Fetch passes for this specific registration
      const passQuery = query(collection(db, 'passes'), where('registrationId', '==', reg.id));
      const passesSnap = await getDocs(passQuery);
      setPasses(passesSnap.docs.map(d => ({id: d.id, ...d.data()})));
      
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
      
    } catch (err) {
      console.error("Error fetching details", err);
      setDetailsError(err.message);
      toast.error('Failed to load details', normalizeError(err));
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleApprove() {
    if (!selectedReg) return;
    const toastId = toast.loading('Approving registration...');
    try {
      setLoadingDetails(true);
      const approveFn = httpsCallable(functions, 'approveVerification');
      await approveFn({ registrationId: selectedReg.id });
      toast.update(toastId, 'success', 'Approved successfully.');
      setSelectedReg(null);
      refresh();
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error approving', normalizeError(err));
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleRequestCorrection() {
    if (!selectedReg) return;
    if (!correctionReason) {
      toast.warning('Reason Required', 'Please provide a correction reason.');
      return;
    }
    const toastId = toast.loading('Requesting correction...');
    try {
      setLoadingDetails(true);
      const correctionFn = httpsCallable(functions, 'requestVerificationCorrection');
      await correctionFn({ registrationId: selectedReg.id, reason: correctionReason });
      toast.update(toastId, 'success', 'Correction requested.');
      setSelectedReg(null);
      refresh();
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error requesting correction', normalizeError(err));
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleGeneratePass() {
    if (!selectedReg) return;
    if (!window.confirm(`Generate pass for ${selectedReg.email || selectedReg.uid}?\n\nOnly do this if you have manually confirmed payment was received. This will mark the registration as PASS_ISSUED.`)) return;
    const toastId = toast.loading('Generating pass...');
    try {
      setLoadingDetails(true);
      const generatePassFn = httpsCallable(functions, 'generatePass');
      await generatePassFn({ registrationId: selectedReg.id });
      toast.update(toastId, 'success', 'Pass generated successfully!');
      // Reload passes for this registration
      const passQuery = query(collection(db, 'passes'), where('registrationId', '==', selectedReg.id));
      const passesSnap = await getDocs(passQuery);
      setPasses(passesSnap.docs.map(d => ({id: d.id, ...d.data()})));
      refresh();
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Failed to generate pass', normalizeError(err));
    } finally {
      setLoadingDetails(false);
    }
  }

  function handleExport() {
    const rows = filteredRegs;
    if (!rows || rows.length === 0) return;
    const headers = ['Registration ID', 'Email / UID', 'Type', 'Status', 'Amount Paid', 'Date'];
    const csvRows = rows.map(r => {
      const payment = paymentsLookup?.[r.id];
      const amountPaid = payment?.status === 'SUCCESS' ? payment.amount : 0;
      const date = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : '';
      return [
        `"${r.id}"`,
        `"${r.email || r.uid || ''}"`,
        `"${r.type || 'SINGLE'}"`,
        `"${r.status || ''}"`,
        `"${amountPaid}"`,
        `"${date}"`
      ].join(',');
    });
    const csv = [headers.map(h => `"${h}"`).join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'registrations_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function getBadgeColor(status) {
    if (["VERIFIED", "PAYMENT_SUCCESS", "PASS_ISSUED"].includes(status)) return "badge-success";
    if (["REQUIRES_CORRECTION", "REJECTED", "PAYMENT_FAILED"].includes(status)) return "badge-error";
    if (["VERIFICATION_PENDING", "SUBMITTED"].includes(status)) return "badge-warning";
    return "badge-neutral";
  }

  const columns = [
    { header: "Account", accessorKey: "email", cell: (r) => <span style={{fontWeight: 500}}>{r.email || r.uid}</span> },
    { header: "Type", accessorKey: "type", cell: (r) => <span className="badge badge-info">{r.type || 'SINGLE'}</span> },
    { header: "Amount", accessorKey: "amount", cell: (r) => {
        const payment = paymentsLookup?.[r.id];
        if (payment && payment.status === 'SUCCESS') {
          return <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>₹{payment.amount} (Paid)</span>;
        }
        return <span style={{ color: 'var(--text-muted)' }}>₹{r.amount || 0} (Unpaid)</span>;
    }},
    { header: "Status", accessorKey: "status", cell: (r) => <span className={`badge ${getBadgeColor(r.status)}`}>{r.status}</span> },
    { header: "Date", accessorKey: "createdAt", cell: (r) => r.createdAt?.toDate().toLocaleDateString() || 'N/A' }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Registrations" 
        description="Manage participant registrations and verification workflow." 
        actions={
          <button className="btn btn-secondary" onClick={handleExport} disabled={!filteredRegs?.length}>
            <Download size={16} /> Export CSV
          </button>
        }
      />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={filteredRegs} 
          loading={loading}
          error={error}
          onRowClick={handleRowClick}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search recent registrations..."
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', height: '100%' }}>
              <select 
                value={typeFilter} 
                onChange={e => setTypeFilter(e.target.value)}
                className="form-input"
                style={{ width: 'auto', padding: '0.5rem' }}
              >
                <option value="ALL">All Types</option>
                <option value="SINGLE">Single</option>
                <option value="COUPLE">Couple</option>
                <option value="GROUP">Group</option>
              </select>
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
                className="form-input"
                style={{ width: 'auto', padding: '0.5rem' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="VERIFICATION_PENDING">Verification Pending</option>
                <option value="VERIFIED">Verified</option>
                <option value="REQUIRES_CORRECTION">Requires Correction</option>
                <option value="PAYMENT_SUCCESS">Payment Success</option>
                <option value="PASS_ISSUED">Pass Issued</option>
              </select>
            </div>
          }
        />
      </div>

      <DetailDrawer 
        isOpen={!!selectedReg} 
        onClose={() => setSelectedReg(null)}
        title="Registration Details"
      >
        {loadingDetails ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading details...</div>
        ) : detailsError ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-error)' }}>{detailsError}</div>
        ) : !selectedReg ? null : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Overview */}
            <div className="surface-flat" style={{ padding: '1.25rem' }}>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Overview</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Account</div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{selectedReg.email || selectedReg.uid}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Type</div>
                  <div>{selectedReg.type}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Amount</div>
                  <div>₹{selectedReg.amount}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Status</div>
                  <div><span className={`badge ${getBadgeColor(selectedReg.status)}`}>{selectedReg.status}</span></div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Participants</div>
                  <div>{selectedReg.participantCount || 1} Total</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Stats</div>
                  <div>{selectedReg.verifiedCount || 0} Verified, {selectedReg.checkedInCount || 0} Checked-In</div>
                </div>
                {passes.length > 0 && (
                  <div style={{ gridColumn: 'span 2', marginTop: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem' }}>
                    <div style={{ color: 'var(--color-success)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Issued Passes (IDs)</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {passes.map(p => (
                        <span key={p.id} className="badge badge-success" style={{ fontFamily: 'monospace' }}>{p.readableId || p.id.slice(0,8)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Participants */}
            <div>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Participants</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {participants.length > 0 ? participants.map((p, i) => (
                  <div key={p.id} className="surface-flat" style={{ padding: '1rem', borderLeft: '3px solid var(--color-gold)' }}>
                    <div style={{ fontWeight: 600 }}>{p.fullName}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{p.gender} • Verification: {p.verificationStatus}</div>
                  </div>
                )) : (
                  <div style={{ color: 'var(--text-muted)' }}>No participants linked.</div>
                )}
              </div>
            </div>

            {/* Documents */}
            <div>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Verification Documents</h4>
              {documents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {documents.map((doc, i) => (
                    <a key={i} href={doc.missing ? undefined : doc.url} target="_blank" rel="noreferrer" 
                       onClick={doc.missing ? (e) => e.preventDefault() : undefined}
                       className="surface-flat"
                       style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', color: doc.missing ? 'var(--color-error)' : 'var(--color-gold)', textDecoration: 'none', cursor: doc.missing ? 'not-allowed' : 'pointer' }}>
                      <span>{doc.name}</span>
                      <span>{doc.missing ? 'Missing' : <>View &rarr;</>}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>No documents uploaded.</p>
              )}
            </div>

            {/* Admin Override: Generate Pass for VERIFIED registrations */}
            {selectedReg.status === 'VERIFIED' && passes.length === 0 && (
              <div className="surface-flat" style={{ padding: '1.25rem', border: '1px solid rgba(255,165,0,0.4)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
                  <AlertTriangle size={18} color="orange" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 600, color: 'orange', marginBottom: '0.25rem' }}>Pass Not Generated</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      This registration is <strong>VERIFIED</strong> but has no passes issued. This usually means payment was received outside the normal flow or the payment webhook failed.
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      Only click below if you have <strong>manually confirmed payment was received</strong> from this participant.
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleGeneratePass}
                  disabled={loadingDetails}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'center' }}
                >
                  <Ticket size={16} />
                  Generate Pass (Admin Override)
                </button>
              </div>
            )}

          </div>
        )}
      </DetailDrawer>
    </motion.div>
  );
}
