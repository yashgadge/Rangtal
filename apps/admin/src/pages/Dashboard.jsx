import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, getCountFromServer, where } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { Users, Ticket, CheckCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalRegistrations: 0,
    verifiedParticipants: 0,
    passesIssued: 0,
    checkIns: 0,
    loading: true
  });

  useEffect(() => {
    async function loadStats() {
      try {
        // Optimized dashboard stats: using getCountFromServer instead of downloading all documents
        const regSnap = await getCountFromServer(collection(db, 'registrations'));
        
        const qVerified = query(collection(db, 'registrations'), where('verificationStatus', '==', 'VERIFIED'));
        const verifiedSnap = await getCountFromServer(qVerified);

        const passSnap = await getCountFromServer(collection(db, 'passes'));
        const checkinSnap = await getCountFromServer(collection(db, 'checkins'));

        setStats({
          totalRegistrations: regSnap.data().count,
          verifiedParticipants: verifiedSnap.data().count,
          passesIssued: passSnap.data().count,
          checkIns: checkinSnap.data().count,
          loading: false
        });
      } catch (err) {
        console.error("Failed to load stats", err);
        setStats(s => ({ ...s, loading: false }));
      }
    }
    loadStats();
  }, []);

  if (stats.loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <PageHeader title="Good morning, Admin" description="Loading metrics..." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
          {[1,2,3,4].map(i => (
             <div key={i} className="surface" style={{ height: '140px', opacity: 0.5, animation: 'pulse 2s infinite' }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader 
        title="Good morning, Admin" 
        description="Here's what's happening with Rangtal Garba Night." 
      />

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        <StatCard 
          title="Total Registrations" 
          value={stats.totalRegistrations} 
          icon={Users} 
          color="var(--color-gold)"
        />
        <StatCard 
          title="Verified" 
          value={stats.verifiedParticipants} 
          icon={CheckCircle}
          color="var(--color-success)" 
        />
        <StatCard 
          title="Passes Issued" 
          value={stats.passesIssued} 
          icon={Ticket} 
          color="var(--color-saffron)"
        />
        <StatCard 
          title="Total Check-ins" 
          value={stats.checkIns} 
          icon={Clock} 
          color="var(--color-info)"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="surface" style={{ padding: '1.5rem' }}>
          <h3 style={{ color: 'var(--color-gold)', marginBottom: '1rem' }}>Verification Pipeline</h3>
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Chart visualization will appear here
          </div>
        </div>
        <div className="surface" style={{ padding: '1.5rem' }}>
          <h3 style={{ color: 'var(--color-gold)', marginBottom: '1rem' }}>Recent Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Activity feed loading...</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.3; }
          50% { opacity: 0.6; }
          100% { opacity: 0.3; }
        }
      `}</style>
    </motion.div>
  );
}
