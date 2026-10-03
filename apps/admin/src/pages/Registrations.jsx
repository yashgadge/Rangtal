import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { Download } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Registrations() {
  const [registrations, setRegistrations] = useState([]);
  const [filteredRegs, setFilteredRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedReg, setSelectedReg] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');

  useEffect(() => {
    fetchRegistrations();
  }, []);

  useEffect(() => {
    filterData();
  }, [registrations, statusFilter, searchTerm]);

  async function fetchRegistrations() {
    setLoading(true);
    try {
      const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const regs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRegistrations(regs);
    } catch (err) {
      console.error("Error fetching registrations:", err);
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
    setParticipants([]);
    setDocuments([]);
    setCorrectionReason('');
    
    try {
      const participantsSnap = await getDocs(collection(db, 'participants'));
      const parts = participantsSnap.docs
        .map(d => ({id: d.id, ...d.data()}))
        .filter(p => p.registrationId === reg.id);
      
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
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleApprove() {
    if (!selectedReg) return;
    try {
      setLoadingDetails(true);
      const approveFn = httpsCallable(functions, 'approveVerification');
      await approveFn({ registrationId: selectedReg.id });
      alert("Approved successfully.");
      setSelectedReg(null);
      fetchRegistrations();
    } catch (err) {
      console.error(err);
      alert("Error approving: " + err.message);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleRequestCorrection() {
    if (!selectedReg) return;
    if (!correctionReason) return alert("Please provide a reason.");
    try {
      setLoadingDetails(true);
      const correctionFn = httpsCallable(functions, 'requestVerificationCorrection');
      await correctionFn({ registrationId: selectedReg.id, reason: correctionReason });
      alert("Correction requested.");
      setSelectedReg(null);
      fetchRegistrations();
    } catch (err) {
      console.error(err);
      alert("Error requesting correction: " + err.message);
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
            <Download size={16} /> Export
          </button>
        }
      />

      {/* Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total', val: registrations.length },
          { label: 'Pending', val: registrations.filter(r => r.status === 'SUBMITTED' || r.verificationStatus === 'VERIFICATION_PENDING').length },
          { label: 'Verified', val: registrations.filter(r => r.status === 'VERIFIED' || r.verificationStatus === 'VERIFIED').length },
          { label: 'Correction', val: registrations.filter(r => r.status === 'REQUIRES_CORRECTION' || r.verificationStatus === 'REQUIRES_CORRECTION').length }
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
          data={filteredRegs} 
          loading={loading}
          onRowClick={handleRowClick}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search registrations..."
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
        {loadingDetails || !selectedReg ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading details...</div>
        ) : (
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
              </div>
            </div>

            {/* Participants */}
            <div>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Participants</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {participants.length > 0 ? participants.map((p, i) => (
                  <div key={p.id} className="surface-flat" style={{ padding: '1rem', borderLeft: '3px solid var(--color-gold)' }}>
                    <div style={{ fontWeight: 600 }}>{p.fullName}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{p.gender} • {p.email || 'No email'}</div>
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

            {/* Verification Actions */}
            {(selectedReg.status === 'VERIFICATION_PENDING' || selectedReg.status === 'SUBMITTED') && (
              <div className="surface" style={{ padding: '1.25rem', marginTop: '1rem' }}>
                <h4 style={{ color: 'var(--color-gold)', marginBottom: '1rem' }}>Verification Decision</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <input 
                    type="text" 
                    placeholder="Reason for correction (required if requesting)" 
                    value={correctionReason}
                    onChange={e => setCorrectionReason(e.target.value)}
                    className="form-input"
                  />
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-secondary" style={{ flex: 1, color: 'var(--color-warning)', borderColor: 'var(--color-warning)' }} onClick={handleRequestCorrection}>
                      Request Correction
                    </button>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleApprove}>
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </DetailDrawer>
    </motion.div>
  );
}
