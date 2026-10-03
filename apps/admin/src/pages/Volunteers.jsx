import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { motion } from 'framer-motion';
import { ShieldCheck, Plus, Check } from 'lucide-react';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';

export default function Volunteers() {
  const toast = useToast();
  const [volunteers, setVolunteers] = useState([]);
  const [filteredVolunteers, setFilteredVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    email: '',
    password: '',
    permissions: ['SCAN_PASS', 'MANUAL_CHECKIN'],
    status: 'ACTIVE'
  });

  useEffect(() => {
    fetchVolunteers();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      setFilteredVolunteers(volunteers.filter(v => 
        v.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        v.email?.toLowerCase().includes(searchTerm.toLowerCase())
      ));
    } else {
      setFilteredVolunteers(volunteers);
    }
  }, [volunteers, searchTerm]);

  async function fetchVolunteers() {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'volunteers'));
      const snap = await getDocs(q);
      const vols = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVolunteers(vols);
    } catch (err) {
      console.error("Error fetching volunteers", err);
      setError(err);
      toast.error('Failed to load volunteers', normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  function handleRowClick(vol) {
    setSelectedVolunteer(vol);
  }

  function handleCreateNew() {
    setFormData({
      id: '',
      name: '',
      email: '',
      password: '',
      permissions: ['SCAN_PASS', 'MANUAL_CHECKIN'],
      status: 'ACTIVE'
    });
    setIsEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const toastId = toast.loading('Creating volunteer...');
    try {
      const functions = getFunctions();
      const createVolunteer = httpsCallable(functions, 'createVolunteer');
      
      const payload = {
        email: formData.email,
        password: formData.password,
        displayName: formData.name,
        permissions: formData.permissions
      };
      
      await createVolunteer(payload);
      
      setIsEditing(false);
      fetchVolunteers();
      toast.update(toastId, 'success', 'Volunteer created successfully');
    } catch (err) {
      console.error("Error creating volunteer", err);
      toast.update(toastId, 'error', 'Error creating volunteer', normalizeError(err));
    }
  }

  async function handleToggleStatus(vol, e) {
    if(e) e.stopPropagation();
    const toastId = toast.loading('Updating status...');
    try {
      const functions = getFunctions();
      const disableVolunteer = httpsCallable(functions, 'disableVolunteer');
      
      await disableVolunteer({
        uid: vol.uid || vol.id,
        disabled: vol.status === 'ACTIVE'
      });
      
      fetchVolunteers();
      if (selectedVolunteer?.id === vol.id) {
         setSelectedVolunteer({...vol, status: vol.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'});
      }
      toast.update(toastId, 'success', 'Status updated successfully');
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error updating status', normalizeError(err));
    }
  }

  const columns = [
    { 
      header: "Volunteer", 
      accessorKey: "name", 
      cell: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="avatar" style={{ width: '36px', height: '36px', fontSize: '0.8rem' }}>
            {r.name?.charAt(0).toUpperCase() || 'V'}
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{r.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.email}</div>
          </div>
        </div>
      )
    },
    { 
      header: "Permissions", 
      accessorKey: "permissions", 
      cell: (r) => (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {(r.permissions || []).slice(0, 2).map(p => (
            <span key={p} className="badge badge-info" style={{ fontSize: '0.65rem' }}>{p}</span>
          ))}
          {(r.permissions?.length > 2) && (
            <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>+{r.permissions.length - 2}</span>
          )}
        </div>
      )
    },
    { header: "Status", accessorKey: "status", cell: (r) => <span className={`badge ${r.status === 'ACTIVE' ? 'badge-success' : 'badge-error'}`}>{r.status}</span> },
    { 
      header: "Actions", 
      accessorKey: "actions",
      cell: (r) => (
        <button 
          className="btn btn-secondary"
          onClick={(e) => handleToggleStatus(r, e)}
          style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
        >
          {r.status === 'ACTIVE' ? 'Disable' : 'Enable'}
        </button>
      )
    }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Volunteer Management" 
        description="Manage on-ground team members and their scanner access." 
        actions={
          <button className="btn btn-primary" onClick={handleCreateNew}>
            <Plus size={16} /> Add Volunteer
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="surface" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Team</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-gold)' }}>{volunteers.length}</div>
          </div>
          <ShieldCheck size={24} color="var(--color-gold)" style={{ opacity: 0.8 }} />
        </div>
        <div className="surface" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Active</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-success)' }}>{volunteers.filter(c => c.status === 'ACTIVE').length}</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={filteredVolunteers} 
          loading={loading}
          error={error}
          onRowClick={handleRowClick}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search volunteers by name or email..."
        />
      </div>

      <DetailDrawer 
        isOpen={isEditing} 
        onClose={() => setIsEditing(false)}
        title="Create Volunteer"
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Full Name</label>
            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="form-input" placeholder="e.g. Rahul Sharma" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email</label>
            <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="form-input" placeholder="volunteer@example.com" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Temporary Password</label>
            <input type="text" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="form-input" placeholder="e.g. Volunteer123!" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Permissions (Comma separated)</label>
            <input type="text" value={formData.permissions.join(', ')} onChange={e => setFormData({...formData, permissions: e.target.value.split(',').map(s=>s.trim())})} className="form-input" />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Common: SCAN_PASS, MANUAL_CHECKIN</div>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '2rem', display: 'flex', gap: '1rem' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsEditing(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Create Volunteer</button>
          </div>
        </form>
      </DetailDrawer>

      <DetailDrawer 
        isOpen={!!selectedVolunteer} 
        onClose={() => setSelectedVolunteer(null)}
        title="Volunteer Profile"
      >
        {selectedVolunteer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div className="avatar" style={{ width: '64px', height: '64px', fontSize: '1.5rem' }}>
                {selectedVolunteer.name?.charAt(0).toUpperCase() || 'V'}
              </div>
              <div>
                <h3 style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>{selectedVolunteer.name}</h3>
                <div style={{ color: 'var(--text-secondary)' }}>{selectedVolunteer.email}</div>
              </div>
            </div>

            <div className="surface-flat" style={{ padding: '1.25rem' }}>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Account Status</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`badge ${selectedVolunteer.status === 'ACTIVE' ? 'badge-success' : 'badge-error'}`}>{selectedVolunteer.status}</span>
                <button className="btn btn-secondary" onClick={() => handleToggleStatus(selectedVolunteer)}>
                  {selectedVolunteer.status === 'ACTIVE' ? 'Disable Account' : 'Enable Account'}
                </button>
              </div>
            </div>

            <div className="surface-flat" style={{ padding: '1.25rem' }}>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Permissions</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(selectedVolunteer.permissions || []).map(p => (
                   <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                     <Check size={16} color="var(--color-success)" />
                     {p}
                   </div>
                ))}
              </div>
            </div>
            
            <div className="surface-flat" style={{ padding: '1.25rem' }}>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Recent Scans</h4>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Activity feed will appear here.</div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </motion.div>
  );
}
