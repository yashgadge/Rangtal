import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { motion } from 'framer-motion';
import { CreditCard, Download } from 'lucide-react';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);

  useEffect(() => {
    fetchPayments();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      setFilteredPayments(payments.filter(p => 
        (p.id && p.id.toLowerCase().includes(term)) || 
        (p.registrationId && p.registrationId.toLowerCase().includes(term)) ||
        (p.participantName && p.participantName.toLowerCase().includes(term))
      ));
    } else {
      setFilteredPayments(payments);
    }
  }, [payments, searchTerm]);

  async function fetchPayments() {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      const pData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPayments(pData);
    } catch (err) {
      console.error("Error fetching payments", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { 
      header: "Payment ID", 
      accessorKey: "id", 
      cell: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
          <CreditCard size={14} color="var(--text-muted)" /> {r.id.slice(0, 10)}...
        </div>
      )
    },
    { header: "Participant", accessorKey: "participantName", cell: (r) => <span style={{ fontWeight: 500 }}>{r.participantName || 'N/A'}</span> },
    { header: "Amount", accessorKey: "amount", cell: (r) => `₹${r.amount || 0}` },
    { header: "Status", accessorKey: "status", cell: (r) => <span className={`badge ${r.status === 'SUCCESS' ? 'badge-success' : r.status === 'FAILED' ? 'badge-error' : 'badge-warning'}`}>{r.status}</span> },
    { header: "Date", accessorKey: "createdAt", cell: (r) => r.createdAt?.toDate().toLocaleString() || 'N/A' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Payment Logs" 
        description="Monitor financial transactions." 
        actions={
          <button className="btn btn-secondary" onClick={fetchPayments}>
            <Download size={16} /> Export Recent
          </button>
        }
      />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={filteredPayments} 
          loading={loading}
          error={error}
          onRowClick={setSelectedPayment}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search recent payments by Payment ID, Name, or Registration ID..."
        />
      </div>

      <DetailDrawer 
        isOpen={!!selectedPayment} 
        onClose={() => setSelectedPayment(null)}
        title="Payment Details"
      >
        {selectedPayment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="surface" style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 600, color: 'var(--color-gold)', fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>
                ₹{selectedPayment.amount}
              </div>
              <div className={`badge ${selectedPayment.status === 'SUCCESS' ? 'badge-success' : selectedPayment.status === 'FAILED' ? 'badge-error' : 'badge-warning'}`}>
                {selectedPayment.status}
              </div>
            </div>

            <div className="surface-flat" style={{ padding: '1.25rem' }}>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Transaction Metadata</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Payment ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedPayment.id}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Registration ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedPayment.registrationId}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Reference</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedPayment.referenceId || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Timestamp</div>
                  <div>{selectedPayment.createdAt?.toDate().toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </motion.div>
  );
}
