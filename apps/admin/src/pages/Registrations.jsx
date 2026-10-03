import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';

export default function Registrations() {
  const toast = useToast();
  const [registrations, setRegistrations] = useState([]);
  const [filteredRegs, setFilteredRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedReg, setSelectedReg] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [correctionReason, setCorrectionReason] = useState('');

  useEffect(() => {
    fetchRegistrations();
  }, []);

  useEffect(() => {
    filterData();
  }, [registrations, statusFilter, searchTerm]);

  async function fetchRegistrations() {
    setLoading(true);
    setError(null);
    try {
      // Use limit to avoid massive collection reads
      const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      const regs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRegistrations(regs);
    } catch (err) {
      console.error("Error fetching registrations:", err);
      setError(err);
      toast.error('Failed to load registrations', normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  function filterData() {
    let result = [...registrations];
    if (statusFilter !== 'ALL') {
      result = result.filter(r => r.status === statusFilter || r.verificationStatus === statusFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r => 
        r.id.toLowerCase().includes(term) || 
        (r.uid && r.uid.toLowerCase().includes(term)) ||
        (r.type && r.type.toLowerCase().includes(term))
      );
    }
    setFilteredRegs(result);
  }

  async function handleRowClick(reg) {
    setSelectedReg(reg);
    setLoadingDetails(true);
    setDetailsError(null);
    setParticipants([]);
    setDocuments([]);
    setCorrectionReason('');
    
    try {
      // Fix N+1 query: Only fetch participants for this specific registration
      const pQuery = query(collection(db, 'participants'), where('registrationId', '==', reg.id));
      const participantsSnap = await getDocs(pQuery);
      const parts = participantsSnap.docs.map(d => ({id: d.id, ...d.data()}));
      setParticipants(parts);
      
      const docs = [];
      if (reg.verificationDocs && reg.verificationDocs.length > 0) {
        const getUrlFn = httpsCallable(functions, 'getVerificationDocumentUrl');
        for (const docMeta of reg.verificationDocs) {
          try {
            const res = await getUrlFn({ path: docMeta.path });
            docs.push({ name: docMeta.filename || docMeta.path.split('/').pop(), url: res.data.url });
          } catch (e) {
            console.error("Failed to fetch signed URL for", docMeta.path, e);
          }
        }
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
      fetchRegistrations();
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
      fetchRegistrations();
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error requesting correction', normalizeError(err));
    } finally {
      setLoadingDetails(false);
    }
  }

  function getBadgeColor(status) {
    if (["VERIFIED", "PAYMENT_SUCCESS", "PASS_ISSUED"].includes(status)) return "badge-success";
    if (["REQUIRES_CORRECTION", "REJECTED", "PAYMENT_FAILED"].includes(status)) return "badge-error";
    if (["VERIFICATION_PENDING", "SUBMITTED"].includes(status)) return "badge-warning";
    return "badge-neutral";
  }

  const columns = [
    { header: "ID", accessorKey: "id", cell: (r) => <span style={{fontFamily: 'monospace'}}>{r.id.slice(0,8)}...</span> },
    { header: "Type", accessorKey: "type" },
    { header: "Amount", accessorKey: "amount", cell: (r) => `₹${r.amount || 0}` },
    { header: "Status", accessorKey: "status", cell: (r) => <span className={`badge ${getBadgeColor(r.status)}`}>{r.status}</span> },
    { header: "Date", accessorKey: "createdAt", cell: (r) => r.createdAt?.toDate().toLocaleDateString() || 'N/A' }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Registrations" 
        description="Manage participant registrations and verification workflow." 
        actions={
          <button className="btn btn-secondary" onClick={fetchRegistrations}>
            <Download size={16} /> Export Recent
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
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              className="form-input"
              style={{ width: 'auto', padding: '0.5rem', height: '100%' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="VERIFICATION_PENDING">Verification Pending</option>
              <option value="VERIFIED">Verified</option>
              <option value="REQUIRES_CORRECTION">Requires Correction</option>
              <option value="PAYMENT_SUCCESS">Payment Success</option>
              <option value="PASS_ISSUED">Pass Issued</option>
            </select>
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
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedReg.id}</div>
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
                    <a key={i} href={doc.url} target="_blank" rel="noreferrer" 
                       className="surface-flat"
                       style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', color: 'var(--color-gold)', textDecoration: 'none' }}>
                      <span>{doc.name}</span>
                      <span>View &rarr;</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>No documents uploaded.</p>
              )}
            </div>

          </div>
        )}
      </DetailDrawer>
    </motion.div>
  );
}
