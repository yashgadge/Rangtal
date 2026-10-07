import React, { useState, useMemo } from 'react';
import { collection, query, getDocs, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import { Download, Building } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';
import { useFirebaseData } from '../../../../shared/hooks/useFirebaseData.js';

export default function HostelList() {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const { data, loading, error } = useFirebaseData('admin_hostel_participants', async () => {
    // Only get participants where isJspmHostel === 'Yes'
    const q = query(collection(db, 'participants'), where('isJspmHostel', '==', 'Yes'), limit(2000));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(p => 
      (p.fullName && p.fullName.toLowerCase().includes(term)) ||
      (p.hostelBuilding && p.hostelBuilding.toLowerCase().includes(term)) ||
      (p.hostelRoom && p.hostelRoom.toLowerCase().includes(term))
    );
  }, [data, searchTerm]);

  const handleDownloadCSV = () => {
    if (!filteredData || filteredData.length === 0) {
      toast.warning('No Data', 'There is no data to download.');
      return;
    }
    
    const headers = ['Full Name', 'Gender', 'Mobile Number', 'Building', 'Room', 'Verification Status', 'Check-in Status'];
    const csvData = filteredData.map(p => [
      p.fullName || '',
      p.gender || '',
      p.mobile || p.phoneNumber || p.customFields?.phone_number || p.customFields?.mobile || p.customFields?.phone || '',
      p.hostelBuilding || '',
      p.hostelRoom || '',
      p.verificationStatus || 'PENDING',
      p.checkInStatus || 'PENDING'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `jspm_hostel_students_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    { 
      header: 'Student Name', 
      accessorKey: 'fullName',
      cell: (p) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.fullName}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.gender} {(p.mobile || p.phoneNumber || p.customFields?.phone_number || p.customFields?.mobile || p.customFields?.phone) ? `• ${p.mobile || p.phoneNumber || p.customFields?.phone_number || p.customFields?.mobile || p.customFields?.phone}` : ''}</span>
        </div>
      )
    },
    { 
      header: 'Mobile', 
      accessorKey: 'mobile',
      cell: (p) => p.mobile || p.phoneNumber || p.customFields?.phone_number || p.customFields?.mobile || p.customFields?.phone || ''
    },
    { 
      header: 'Building', 
      accessorKey: 'hostelBuilding',
      cell: (p) => (
        <span style={{ color: 'var(--color-gold)', fontWeight: 500 }}>{p.hostelBuilding}</span>
      )
    },
    { 
      header: 'Room', 
      accessorKey: 'hostelRoom'
    },
    { 
      header: 'Status', 
      accessorKey: 'verificationStatus',
      cell: (p) => (
        <span className={`badge ${p.verificationStatus === 'APPROVED' ? 'badge-success' : p.verificationStatus === 'REJECTED' ? 'badge-error' : 'badge-warning'}`}>
          {p.verificationStatus || 'PENDING'}
        </span>
      )
    }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="JSPM Hostel Students" 
        description="List of all female participants staying in JSPM Hostels." 
        actions={
          <button className="btn btn-primary" onClick={handleDownloadCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={18} /> Export CSV
          </button>
        }
      />

      <div className="surface" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search by name, building, or room..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: '300px' }}
          />
          <div style={{ flex: 1 }}></div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Total: <strong>{filteredData.length}</strong> Students
          </div>
        </div>

        {error ? (
          <div style={{ padding: '2rem', color: 'var(--color-error)', textAlign: 'center' }}>
            Failed to load data. {normalizeError(error)}
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <DataTable 
              columns={columns} 
              data={filteredData} 
              loading={loading}
              onRowClick={() => {}} 
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
