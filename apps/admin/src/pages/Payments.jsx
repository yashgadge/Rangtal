import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { motion } from 'framer-motion';
import { CreditCard, Download } from 'lucide-react';
import { useFirebaseData } from '../../../../shared/hooks/useFirebaseData.js';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: partsLookup } = useFirebaseData('admin_parts_for_payments', async () => {
    const q = query(collection(db, 'participants'));
    const snap = await getDocs(q);
    return snap.docs.reduce((acc, doc) => {
      const p = doc.data();
      if (p.registrationId) {
        if (!acc[p.registrationId]) acc[p.registrationId] = [];
        acc[p.registrationId].push(p);
      }
      return acc;
    }, {});
  });

  useEffect(() => {
    fetchPayments();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      setFilteredPayments(payments.filter(p => 
        (p.id && p.id.toLowerCase().includes(term)) || 
        (p.registrationId && p.registrationId.toLowerCase().includes(term)) ||
        (p.gatewayPaymentId && p.gatewayPaymentId.toLowerCase().includes(term)) ||
        (p.gatewayOrderId && p.gatewayOrderId.toLowerCase().includes(term))
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

  const handleForceApprove = async (paymentId) => {
    if (!window.confirm("Are you sure you want to force approve this payment? This will issue a pass immediately.")) return;
    setIsProcessing(true);
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../firebase');
      const adminForceApprovePayment = httpsCallable(functions, 'adminForceApprovePayment');
      const res = await adminForceApprovePayment({ paymentId, transactionNote: note });
      if (res.data.success) {
        alert("Payment force approved successfully.");
        setSelectedPayment(null);
        setNote('');
        fetchPayments();
      } else {
        alert("Force approve failed: " + res.data.reason);
      }
    } catch (err) {
      console.error("Force approve error", err);
      alert("Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const columns = [
    { 
      header: "Payment ID", 
      accessorKey: "id", 
      sortKey: "id",
      cell: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
          <CreditCard size={14} color="var(--text-muted)" /> {r.id.slice(0, 8)}
        </div>
      )
    },
    { 
      header: "Participant Info", 
      accessorKey: "registrationId", 
      cell: (r) => {
        const parts = partsLookup?.[r.registrationId] || [];
        const mainPart = parts[0] || {};
        const name = mainPart.fullName || mainPart.customFields?.full_name || r.participantName || 'Unknown';
        const email = mainPart.email || mainPart.customFields?.email || 'N/A';
        const phone = mainPart.mobile || mainPart.phoneNumber || mainPart.customFields?.phone_number || 'N/A';
        
        return (
          <div>
            <div style={{ fontWeight: 600 }}>{name} {parts.length > 1 ? `(+${parts.length-1})` : ''}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{email}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{phone}</div>
          </div>
        );
      }
    },
    { header: "Amount", accessorKey: "amount", sortKey: "amount", cell: (r) => `₹${r.amount || 0}` },
    { header: "Gateway ID", accessorKey: "gatewayPaymentId", cell: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.gatewayPaymentId || r.gatewayOrderId || 'N/A'}</span> },
    { header: "Status", accessorKey: "status", sortKey: "status", cell: (r) => <span className={`badge ${r.status === 'SUCCESS' ? 'badge-success' : r.status === 'FAILED' ? 'badge-error' : 'badge-warning'}`}>{r.status}</span> },
    { header: "Date", accessorKey: "createdAt", sortKey: (r) => r.createdAt?.toMillis ? r.createdAt.toMillis() : 0, cell: (r) => <span style={{fontSize: '0.85rem'}}>{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : 'N/A'}</span> },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Payment Logs" 
        description="Monitor financial transactions." 
      />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={filteredPayments} 
          loading={loading}
          error={error}
          showSerial={true}
          exportable={true}
          exportFilename="payments_export.csv"
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
            <div className="surface" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 600, color: 'var(--color-gold)', fontFamily: 'var(--font-heading)' }}>
                ₹{selectedPayment.amount}
              </div>
              <div className={`badge ${selectedPayment.status === 'SUCCESS' ? 'badge-success' : selectedPayment.status === 'FAILED' ? 'badge-error' : 'badge-warning'}`}>
                {selectedPayment.status}
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 500 }}>{selectedPayment.participantName || 'Unknown Participant'}</div>
              {selectedPayment.participantEmail && <div style={{ color: 'var(--text-muted)' }}>{selectedPayment.participantEmail}</div>}
            </div>

            <div className="surface-flat" style={{ padding: '1.25rem' }}>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Transaction Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Payment ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedPayment.id}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Registration ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedPayment.registrationId}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Reference (Gateway ID)</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedPayment.referenceId || selectedPayment.razorpayPaymentId || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Timestamp</div>
                  <div>{selectedPayment.createdAt?.toDate ? selectedPayment.createdAt.toDate().toLocaleString() : 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Payment Method</div>
                  <div><span className="badge badge-neutral">{selectedPayment.method || 'Online (Razorpay)'}</span></div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Order ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{selectedPayment.orderId || 'N/A'}</div>
                </div>
              </div>
            </div>

            {selectedPayment.status !== 'SUCCESS' && (
              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px' }}>
                <h4 style={{ color: 'white', margin: 0 }}>Manual Action</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>Force approve if payment was received via alternate channels.</p>
                <input 
                  type="text" 
                  placeholder="Note (e.g. Received via Cash/UPI)" 
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '4px' }}
                />
                <button 
                  className="btn-primary" 
                  style={{ width: '100%', background: 'var(--color-error)' }}
                  onClick={() => handleForceApprove(selectedPayment.id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'Force Approve Payment'}
                </button>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </motion.div>
  );
}
