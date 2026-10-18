import React from 'react';
import { collection, query, getDocs, getCountFromServer, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { Users, Ticket, CheckCircle, Clock, AlertCircle, IndianRupee } from 'lucide-react';
import { motion } from 'framer-motion';
import { useFirebaseData } from '../../../../shared/hooks/useFirebaseData.js';

export default function Dashboard() {
  const { data: stats, loading: statsLoading, error: statsError } = useFirebaseData('dashboard_stats', async () => {
    const [regSnap, verifiedSnap, passSnap, checkinSnap, paymentsSnap] = await Promise.all([
      getCountFromServer(collection(db, 'registrations')),
      getCountFromServer(query(collection(db, 'registrations'), where('verificationStatus', '==', 'VERIFIED'))),
      getCountFromServer(collection(db, 'passes')),
      getCountFromServer(collection(db, 'checkins')),
      getDocs(query(collection(db, 'payments'), where('status', '==', 'SUCCESS')))
    ]);

    const totalRevenue = paymentsSnap.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);

    return {
      totalRegistrations: regSnap.data().count,
      verifiedParticipants: verifiedSnap.data().count,
      passesIssued: passSnap.data().count,
      checkIns: checkinSnap.data().count,
      totalRevenue
    };
  });

  const { data: recentActivity, loading: loadingActivity } = useFirebaseData('dashboard_activity', async () => {
    const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(5));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader 
        title="Good morning, Admin" 
        description="Here's what's happening with Rangtal Garba Night." 
      />

      {statsError ? (
        <div className="surface" style={{ padding: '3rem', textAlign: 'center', marginBottom: '3rem' }}>
          <AlertCircle size={48} color="var(--color-error)" style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
          <h3 style={{ color: 'var(--color-error)' }}>Failed to load metrics</h3>
          <p style={{ color: 'var(--text-muted)' }}>{statsError.message}</p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '3rem'
        }}>
          {statsLoading ? (
            [1,2,3,4].map(i => (
              <div key={i} className="surface" style={{ height: '140px', opacity: 0.5, animation: 'pulse 2s infinite' }}></div>
            ))
          ) : (
            <>
              <StatCard 
                title="Total Registrations" 
                value={stats?.totalRegistrations || 0} 
                icon={Users} 
                color="var(--color-gold)"
              />
              <StatCard 
                title="Verified" 
                value={stats?.verifiedParticipants || 0} 
                icon={CheckCircle}
                color="var(--color-success)" 
              />
              <StatCard 
                title="Passes Issued" 
                value={stats?.passesIssued || 0} 
                icon={Ticket} 
                color="var(--color-saffron)"
              />
              <StatCard 
                title="Total Check-ins" 
                value={stats?.checkIns || 0} 
                icon={Clock} 
                color="var(--color-info)"
              />
              <StatCard 
                title="Total Collection" 
                value={`₹${stats?.totalRevenue || 0}`} 
                icon={IndianRupee} 
                color="#00E676"
              />
            </>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        <div className="surface" style={{ padding: '1.5rem' }}>
          <h3 style={{ color: 'var(--color-gold)', marginBottom: '1.5rem' }}>Recent Activity</h3>
          
          {loadingActivity ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               {[1,2,3].map(i => <div key={i} style={{ height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', animation: 'pulse 2s infinite' }} />)}
            </div>
          ) : recentActivity && recentActivity.length > 0 ? (
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
