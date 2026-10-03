import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { motion } from 'framer-motion';
import { Building, Plus } from 'lucide-react';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';

export default function Colleges() {
  const toast = useToast();
  const [colleges, setColleges] = useState([]);
  const [filteredColleges, setFilteredColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    verified: true,
  });

  useEffect(() => {
    fetchColleges();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      setFilteredColleges(colleges.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())));
    } else {
      setFilteredColleges(colleges);
    }
  }, [colleges, searchTerm]);

  async function fetchColleges() {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'colleges'));
      const snap = await getDocs(q);
      const cols = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setColleges(cols);
    } catch (err) {
      console.error("Error fetching colleges", err);
      setError(err);
      toast.error('Failed to load colleges', normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  function handleRowClick(col) {
    setFormData({ ...col });
    setIsEditing(true);
  }

  function handleCreateNew() {
    setFormData({
      id: `col-${Date.now()}`,
      name: '',
      verified: true,
    });
    setIsEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const toastId = toast.loading('Saving college...');
    try {
      const colRef = doc(db, 'colleges', formData.id);
      await setDoc(colRef, {
        name: formData.name,
        verified: formData.verified
      }, { merge: true });
      
      setIsEditing(false);
      fetchColleges();
      toast.update(toastId, 'success', 'College saved successfully');
    } catch (err) {
      console.error("Error saving college", err);
      toast.update(toastId, 'error', 'Error saving college', normalizeError(err));
    }
  }

  async function handleToggleStatus(colId, currentStatus, e) {
    e.stopPropagation(); // prevent row click
    try {
      const colRef = doc(db, 'colleges', colId);
      await updateDoc(colRef, { verified: !currentStatus });
      fetchColleges();
      toast.success(currentStatus ? 'College disabled' : 'College enabled');
    } catch (err) {
      console.error(err);
      toast.error('Error updating status', normalizeError(err));
    }
  }

  const columns = [
    { 
      header: "College", 
      accessorKey: "name", 
      cell: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '36px', height: '36px', background: 'rgba(255,215,0,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-gold)' }}>
            <Building size={18} />
          </div>
          <span style={{ fontWeight: 500 }}>{r.name}</span>
        </div>
      )
    },
    { header: "ID", accessorKey: "id", cell: (r) => <span style={{fontFamily: 'monospace', fontSize: '0.85rem'}}>{r.id}</span> },
    { header: "Status", accessorKey: "verified", cell: (r) => <span className={`badge ${r.verified ? 'badge-success' : 'badge-neutral'}`}>{r.verified ? 'ACTIVE' : 'DISABLED'}</span> },
    { 
      header: "Actions", 
      accessorKey: "actions",
      cell: (r) => (
        <button 
          className="btn btn-secondary"
          onClick={(e) => handleToggleStatus(r.id, r.verified, e)}
          style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
        >
          {r.verified ? 'Disable' : 'Enable'}
        </button>
      )
    }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="College Configuration" 
        description="Manage the list of eligible colleges for registration." 
        actions={
          <button className="btn btn-primary" onClick={handleCreateNew}>
            <Plus size={16} /> Add College
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="surface" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Colleges</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-gold)' }}>{colleges.length}</div>
          </div>
          <Building size={24} color="var(--color-gold)" style={{ opacity: 0.8 }} />
        </div>
        <div className="surface" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Active</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-success)' }}>{colleges.filter(c => c.verified).length}</div>
          </div>
        </div>
        <div className="surface" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Disabled</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>{colleges.filter(c => !c.verified).length}</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={filteredColleges} 
          loading={loading}
          error={error}
          onRowClick={handleRowClick}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search colleges..."
        />
      </div>

      <DetailDrawer 
        isOpen={isEditing} 
        onClose={() => setIsEditing(false)}
        title={formData.id.startsWith('col-') && !colleges.find(c=>c.id===formData.id) ? 'Add College' : 'Edit College'}
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">College Name</label>
            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="form-input" placeholder="e.g. JSPM University Wagholi" />
          </div>
          
          <div className="surface-flat" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Active Status</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Allow participants to select this college</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={formData.verified} 
                onChange={e => setFormData({...formData, verified: e.target.checked})} 
                style={{ width: '20px', height: '20px', accentColor: 'var(--color-gold)' }} 
              />
            </label>
          </div>
          
          <div style={{ marginTop: 'auto', paddingTop: '2rem', display: 'flex', gap: '1rem' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsEditing(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Save College</button>
          </div>
        </form>
      </DetailDrawer>
    </motion.div>
  );
}
