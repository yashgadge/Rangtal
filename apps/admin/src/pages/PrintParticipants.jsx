import React, { useEffect, useState } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function PrintParticipants() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const partsSnap = await getDocs(query(collection(db, 'participants')));
        const passesSnap = await getDocs(query(collection(db, 'passes')));
        
        const passes = passesSnap.docs.reduce((acc, doc) => {
          const p = doc.data();
          if (p.participantId) acc[p.participantId] = p;
          return acc;
        }, {});

        const participants = partsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Group by pass type / readable ID
        const grouped = {};
        for (const p of participants) {
          const pass = passes[p.id];
          if (!pass) continue;
          const key = pass.packageId || 'UNKNOWN';
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push({ ...p, passReadableId: pass.readableId });
        }
        
        // Sort each group
        for (const key in grouped) {
          grouped[key].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
        }

        setData(grouped);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading printable data...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '100%', backgroundColor: 'white', color: 'black' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }} className="no-print">
        <h1 style={{ margin: 0 }}>Print Verification Sheet</h1>
        <button 
          onClick={() => window.print()} 
          style={{ padding: '8px 16px', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Print to PDF
        </button>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break { page-break-before: always; }
          .card-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        }
        .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        .print-card { border: 1px solid #ccc; padding: 15px; border-radius: 8px; display: flex; gap: 15px; page-break-inside: avoid; }
        .print-card img { width: 100px; height: 100px; object-fit: cover; border-radius: 4px; background: #eee; }
        .print-card h3 { margin: 0 0 5px 0; font-size: 1.1rem; }
        .print-card p { margin: 2px 0; font-size: 0.85rem; color: #444; }
      `}</style>

      {Object.entries(data || {}).map(([pkgId, parts], index) => (
        <div key={pkgId} className={index > 0 ? "page-break" : ""}>
          <h2 style={{ borderBottom: '2px solid #000', paddingBottom: '10px', marginTop: index > 0 ? 0 : '20px' }}>
            Package: {pkgId} ({parts.length} Participants)
          </h2>
          <div className="card-grid">
            {parts.map(p => (
              <div key={p.id} className="print-card">
                <div>
                  {p.idImageUrl ? (
                    <img src={p.idImageUrl} alt="ID" crossOrigin="anonymous" />
                  ) : (
                    <div style={{ width: 100, height: 100, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>No ID</div>
                  )}
                </div>
                <div>
                  <h3>{p.fullName || 'No Name'}</h3>
                  <p><strong>Pass ID:</strong> {p.passReadableId || 'N/A'}</p>
                  <p><strong>Gender:</strong> {p.gender || 'N/A'}</p>
                  <p><strong>Status:</strong> {p.status || 'N/A'}</p>
                  {p.hostelResident && <p><strong>Hostel:</strong> Yes ({p.building} - {p.roomNumber})</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
