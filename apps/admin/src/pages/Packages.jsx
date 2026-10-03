import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import DetailDrawer from '../components/DetailDrawer';
import { motion } from 'framer-motion';
import { PackageOpen, Plus, Edit2, Check, X, AlertTriangle } from 'lucide-react';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';

export default function Packages() {
  const toast = useToast();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    type: 'SINGLE',
    price: 0,
    capacity: 1000,
    soldCount: 0,
    active: true,
    description: '',
    participantCount: 1
  });

  useEffect(() => {
    fetchPackages();
  }, []);

  async function fetchPackages() {
    setLoading(true);
    try {
      const q = query(collection(db, 'packages'));
      const snap = await getDocs(q);
      const pkgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPackages(pkgs);
    } catch (err) {
      console.error("Error fetching packages", err);
      toast.error('Failed to load packages', normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(pkg) {
    setFormData({ ...pkg, participantCount: pkg.participantCount || (pkg.type === 'COUPLE' ? 2 : 1) });
    setIsEditing(true);
  }

  function handleCreateNew() {
    setFormData({
      id: `pkg-${Date.now()}`,
      name: '',
      type: 'SINGLE',
      price: 0,
      capacity: 1000,
      soldCount: 0,
      active: true,
      description: '',
      participantCount: 1
    });
    setIsEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const toastId = toast.loading('Saving package...');
    try {
      const pkgRef = doc(db, 'packages', formData.id);
      
      let pCount = Number(formData.participantCount);
      if (formData.type === 'SINGLE') pCount = 1;
      if (formData.type === 'COUPLE') pCount = 2;

      await setDoc(pkgRef, {
        name: formData.name,
        type: formData.type,
        price: Number(formData.price),
        capacity: Number(formData.capacity),
        soldCount: Number(formData.soldCount),
        active: formData.active,
        description: formData.description,
        participantCount: pCount
      }, { merge: true });
      
      setIsEditing(false);
      fetchPackages();
      toast.update(toastId, 'success', 'Package saved successfully');
    } catch (err) {
      console.error("Error saving package", err);
      toast.update(toastId, 'error', 'Failed to save package', normalizeError(err));
    }
  }

  async function handleToggleStatus(pkg) {
    try {
      const pkgRef = doc(db, 'packages', pkg.id);
      await updateDoc(pkgRef, { active: !pkg.active });
      fetchPackages();
      toast.success(pkg.active ? 'Package disabled' : 'Package enabled');
    } catch (err) {
      console.error(err);
      toast.error('Error updating status', normalizeError(err));
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Package Configuration" 
        description="Manage ticketing packages, pricing, and capacities." 
        actions={
          <button className="btn btn-primary" onClick={handleCreateNew}>
            <Plus size={16} /> New Package
          </button>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {[1,2,3].map(i => (
               <div key={i} className="surface" style={{ height: '220px', animation: 'pulse 2s infinite', opacity: 0.5 }}></div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', paddingBottom: '2rem' }}>
            {packages.map(pkg => {
              const capacityPct = Math.min(100, Math.round(((pkg.soldCount || 0) / (pkg.capacity || 1)) * 100));
              const isLowCapacity = capacityPct > 85;
              const isFull = capacityPct >= 100;
              
              return (
                <motion.div 
                  key={pkg.id} 
                  whileHover={{ y: -4 }}
                  className="surface" 
                  style={{ 
                    padding: '1.5rem', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    borderTop: `4px solid ${pkg.active ? 'var(--color-gold)' : 'var(--text-muted)'}`,
                    opacity: pkg.active ? 1 : 0.7
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{pkg.name}</h3>
                      <span className={`badge ${pkg.type === 'COUPLE' ? 'badge-info' : pkg.type === 'GROUP' ? 'badge-warning' : 'badge-neutral'}`}>{pkg.type}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginLeft: '0.5rem' }}>({pkg.participantCount || 1} Person)</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-gold)', fontFamily: 'var(--font-heading)' }}>
                      ₹{pkg.price}
                    </div>
                  </div>
                  
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', flex: 1 }}>
                    {pkg.description || 'No description provided.'}
                  </p>
                  
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                      <span>Capacity</span>
                      <span>{pkg.soldCount || 0} / {pkg.capacity}</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${capacityPct}%` }}
                        transition={{ duration: 1 }}
                        style={{ 
                          height: '100%', 
                          background: isFull ? 'var(--color-error)' : isLowCapacity ? 'var(--color-warning)' : 'var(--color-gold)' 
                        }}
                      />
                    </div>
                    {isLowCapacity && !isFull && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-warning)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                        <AlertTriangle size={12} /> Running low
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '0.8rem', color: pkg.active ? 'var(--color-success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {pkg.active ? <Check size={14} /> : <X size={14} />}
                      {pkg.active ? 'Active' : 'Disabled'}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => handleToggleStatus(pkg)} 
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        {pkg.active ? 'Disable' : 'Enable'}
                      </button>
                      <button 
                        onClick={() => handleEdit(pkg)} 
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            
            {packages.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <PackageOpen size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                <h3>No packages configured</h3>
                <p>Create a package to start accepting registrations.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <DetailDrawer 
        isOpen={isEditing} 
        onClose={() => setIsEditing(false)}
        title={formData.id.startsWith('pkg-') && !packages.find(p=>p.id===formData.id) ? 'Create Package' : 'Edit Package'}
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Name</label>
            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="form-input" placeholder="e.g. Early Bird Single" />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Description</label>
            <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="form-input" style={{ minHeight: '80px', resize: 'vertical' }} />
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Type</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value, participantCount: e.target.value === 'SINGLE' ? 1 : e.target.value === 'COUPLE' ? 2 : formData.participantCount})} className="form-input">
                <option value="SINGLE">SINGLE</option>
                <option value="COUPLE">COUPLE</option>
                <option value="GROUP">GROUP</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Price (₹)</label>
              <input type="number" required min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="form-input" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Participants Per Pass</label>
              <input type="number" required min="1" disabled={formData.type !== 'GROUP'} value={formData.participantCount} onChange={e => setFormData({...formData, participantCount: e.target.value})} className="form-input" />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Capacity (Passes)</label>
              <input type="number" required min="1" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} className="form-input" />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Sold Count</label>
              <input type="number" min="0" value={formData.soldCount} onChange={e => setFormData({...formData, soldCount: e.target.value})} className="form-input" />
            </div>
          </div>
          
          <div className="surface-flat" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Active Status</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Allow participants to select this package</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={formData.active} 
                onChange={e => setFormData({...formData, active: e.target.checked})} 
                style={{ width: '20px', height: '20px', accentColor: 'var(--color-gold)' }} 
              />
            </label>
          </div>
          
          <div style={{ marginTop: 'auto', paddingTop: '2rem', display: 'flex', gap: '1rem' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsEditing(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Save Package</button>
          </div>
        </form>
      </DetailDrawer>
    </motion.div>
  );
}
