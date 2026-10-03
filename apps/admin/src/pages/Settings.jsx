import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import PageHeader from '../components/PageHeader';
import { motion } from 'framer-motion';
import { Save, AlertTriangle } from 'lucide-react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('EVENT');
  const [settings, setSettings] = useState({
    EVENT: { eventName: 'Rangtal Garba Night', eventDate: '', location: '' },
    REGISTRATION: { registrationsOpen: true, maxCapacity: 5000, requireCollegeId: true },
    VERIFICATION: { autoApprove: false },
    PAYMENT: { razorpayEnabled: false, liveMode: false }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const docRef = doc(db, 'eventSettings', 'global');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setSettings(prev => ({
          ...prev,
          ...data
        }));
      }
    } catch (err) {
      console.error("Error fetching settings", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const docRef = doc(db, 'eventSettings', 'global');
      await setDoc(docRef, settings, { merge: true });
      alert("Settings saved successfully.");
    } catch (err) {
      console.error(err);
      alert("Error saving settings: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleNestedChange(category, field, value) {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  }

  const tabs = [
    { id: 'EVENT', label: 'Event Configuration' },
    { id: 'REGISTRATION', label: 'Registration' },
    { id: 'VERIFICATION', label: 'Verification' },
    { id: 'PAYMENT', label: 'Payment (Deferred)' }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Event Settings" 
        description="Global configuration for the Rangtal platform." 
        actions={
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save All Settings'}
          </button>
        }
      />

      <div style={{ display: 'flex', flex: 1, gap: '2rem', minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                textAlign: 'left',
                padding: '0.75rem 1rem',
                background: activeTab === tab.id ? 'var(--surface-elevated)' : 'transparent',
                color: activeTab === tab.id ? 'var(--color-gold)' : 'var(--text-secondary)',
                border: 'none',
                borderLeft: activeTab === tab.id ? '3px solid var(--color-gold)' : '3px solid transparent',
                borderRadius: '0 8px 8px 0',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '1rem' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading configuration...</div>
          ) : (
            <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {activeTab === 'EVENT' && (
                <div className="surface" style={{ padding: '2rem' }}>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Event Configuration</h3>
                  
                  <div className="form-group">
                    <label className="form-label">Event Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={settings.EVENT?.eventName || ''}
                      onChange={e => handleNestedChange('EVENT', 'eventName', e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Event Date</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={settings.EVENT?.eventDate || ''}
                      onChange={e => handleNestedChange('EVENT', 'eventDate', e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Location</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={settings.EVENT?.location || ''}
                      onChange={e => handleNestedChange('EVENT', 'location', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'REGISTRATION' && (
                <div className="surface" style={{ padding: '2rem' }}>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Registration Settings</h3>
                  
                  <div className="surface-flat" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Registrations Open</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Allow new users to register for the event.</div>
                    </div>
                    <label style={{ cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={settings.REGISTRATION?.registrationsOpen || false} 
                        onChange={e => handleNestedChange('REGISTRATION', 'registrationsOpen', e.target.checked)} 
                        style={{ width: '20px', height: '20px', accentColor: 'var(--color-gold)' }} 
                      />
                    </label>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Maximum Total Capacity</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={settings.REGISTRATION?.maxCapacity || 0}
                      onChange={e => handleNestedChange('REGISTRATION', 'maxCapacity', Number(e.target.value))}
                    />
                  </div>

                  <div className="surface-flat" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Require College ID Upload</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Users must upload an ID document during registration.</div>
                    </div>
                    <label style={{ cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={settings.REGISTRATION?.requireCollegeId || false} 
                        onChange={e => handleNestedChange('REGISTRATION', 'requireCollegeId', e.target.checked)} 
                        style={{ width: '20px', height: '20px', accentColor: 'var(--color-gold)' }} 
                      />
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'VERIFICATION' && (
                <div className="surface" style={{ padding: '2rem' }}>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Verification Settings</h3>
                  
                  <div className="surface-flat" style={{ padding: '1rem', display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: 0, borderColor: 'rgba(245, 127, 23, 0.3)' }}>
                    <AlertTriangle size={24} color="var(--color-warning)" style={{ marginTop: '0.2rem' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                        Auto-Approve Registrations
                        <input 
                          type="checkbox" 
                          checked={settings.VERIFICATION?.autoApprove || false} 
                          onChange={e => {
                            if(e.target.checked && !window.confirm("WARNING: This will bypass manual document verification for all new registrations. Are you sure?")) return;
                            handleNestedChange('VERIFICATION', 'autoApprove', e.target.checked)
                          }} 
                          style={{ width: '20px', height: '20px', accentColor: 'var(--color-warning)' }} 
                        />
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        If enabled, registrations will immediately proceed to payment (or pass issuance) without manual verification by an admin.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'PAYMENT' && (
                <div className="surface" style={{ padding: '2rem' }}>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Payment Gateway</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    Payment integration (Razorpay) is currently deferred. These settings are placeholders for future implementation.
                  </p>
                  
                  <div className="surface-flat" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', opacity: 0.5 }}>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Enable Razorpay Gateway</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Require payment before pass issuance.</div>
                    </div>
                    <input type="checkbox" disabled style={{ width: '20px', height: '20px' }} />
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
