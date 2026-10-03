import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, getCountFromServer, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { Users, Ticket, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalRegistrations: 0,
    verifiedParticipants: 0,
    passesIssued: 0,
    checkIns: 0,
    loading: true,
    error: null
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
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
          loading: false,
          error: null
        });
      } catch (err) {
        console.error("Failed to load stats", err);
        setStats(s => ({ ...s, loading: false, error: err.message }));
      }
    }

    async function loadActivity() {
      try {
        const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(5));
        const snap = await getDocs(q);
        setRecentActivity(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load activity", err);
      } finally {
        setLoadingActivity(false);
      }
    }

    loadStats();
    loadActivity();
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

  if (stats.error) {
    return (
      <div style={{ padding: '2rem' }}>
        <PageHeader title="Good morning, Admin" description="System Overview" />
        <div className="surface" style={{ padding: '3rem', textAlign: 'center' }}>
          <AlertCircle size={48} color="var(--color-error)" style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
          <h3 style={{ color: 'var(--color-error)' }}>Failed to load metrics</h3>
          <p style={{ color: 'var(--text-muted)' }}>{stats.error}</p>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        <div className="surface" style={{ padding: '1.5rem' }}>
          <h3 style={{ color: 'var(--color-gold)', marginBottom: '1.5rem' }}>Recent Activity</h3>
          
          {loadingActivity ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               {[1,2,3].map(i => <div key={i} style={{ height: '40px', background: 'rgba(255,255,255,0.05)', animation: 'pulse 2s infinite' }} />)}
            </div>
          ) : recentActivity.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {recentActivity.map(log => (
                <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--surface-elevated)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'white' }}>{log.action}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{log.actorEmail || 'System'} &rarr; {log.targetCollection}</div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {log.timestamp?.toDate().toLocaleString() || 'Just now'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              NO RECENT ACTIVITY
            </div>
          )}
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
