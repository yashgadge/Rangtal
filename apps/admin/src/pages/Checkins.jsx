import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import { motion } from 'framer-motion';
import { RefreshCw, Users, ShieldCheck, Ticket } from 'lucide-react';

export default function Checkins() {
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCheckins, setFilteredCheckins] = useState([]);
  
  const [totalCheckins, setTotalCheckins] = useState(0);
  const [totalPasses, setTotalPasses] = useState(0);

  useEffect(() => {
    fetchCheckins();
    fetchStats();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      setFilteredCheckins(checkins.filter(c => 
        (c.participantName && c.participantName.toLowerCase().includes(term)) ||
        (c.passId && c.passId.toLowerCase().includes(term)) ||
        (c.scannedBy && c.scannedBy.toLowerCase().includes(term))
      ));
    } else {
      setFilteredCheckins(checkins);
    }
  }, [checkins, searchTerm]);

  async function fetchStats() {
    try {
      const passSnap = await getCountFromServer(collection(db, 'passes'));
      const chkSnap = await getCountFromServer(collection(db, 'checkins'));
      setTotalPasses(passSnap.data().count);
      setTotalCheckins(chkSnap.data().count);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchCheckins() {
    setLoading(true);
    try {
      const q = query(collection(db, 'checkins'), orderBy('timestamp', 'desc'), limit(150));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCheckins(data);
    } catch (err) {
      console.error("Error fetching checkins", err);
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { 
      header: "Participant", 
      accessorKey: "participantName", 
      cell: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}>
            <Users size={14} />
          </div>
          <span style={{ fontWeight: 500 }}>{r.participantName || 'Unknown Participant'}</span>
        </div>
      )
    },
    { 
      header: "Pass ID", 
      accessorKey: "passId", 
      cell: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
          <Ticket size={12} style={{ opacity: 0.5 }} /> {r.passId}
        </div>
      )
    },
    { 
      header: "Scanned By (Volunteer)", 
      accessorKey: "scannedBy", 
      cell: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
          <ShieldCheck size={12} color="var(--color-gold)" /> {r.scannedBy}
        </div>
      )
    },
    { 
      header: "Time", 
      accessorKey: "timestamp", 
      cell: (r) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{r.timestamp?.toDate().toLocaleString() || 'N/A'}</span> 
    }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Check-ins & Attendance" 
        description="Monitor real-time event entry operations." 
        actions={
          <button className="btn btn-secondary" onClick={() => { fetchCheckins(); fetchStats(); }}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="surface" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Check-ins</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-gold)' }}>{totalCheckins}</div>
        </div>
        <div className="surface" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Remaining / Expected</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-warning)' }}>{Math.max(0, totalPasses - totalCheckins)}</div>
        </div>
        <div className="surface" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Attendance %</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-success)' }}>
            {totalPasses > 0 ? Math.round((totalCheckins / totalPasses) * 100) : 0}%
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={filteredCheckins} 
          loading={loading}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search participant, pass, or volunteer..."
        />
      </div>
    </motion.div>
  );
}
