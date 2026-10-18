import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import PageHeader from '../components/PageHeader';
import { motion } from 'framer-motion';
import { Save, AlertTriangle, Database, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';

export default function Settings() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('EVENT');
  const [settings, setSettings] = useState({
    EVENT: { eventName: 'Rangtal Garba Night', eventDate: '', location: '' },
    REGISTRATION: { registrationsOpen: true, maxCapacity: 5000, requireCollegeId: true },
    VERIFICATION: { autoApprove: false },
    PAYMENT: { razorpayEnabled: false, liveMode: false },
    HOSTEL: { buildings: ['Building A', 'Building B'] }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

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
      toast.error('Load Failed', normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const toastId = toast.loading('Saving settings...');
    try {
      const docRef = doc(db, 'eventSettings', 'global');
      await setDoc(docRef, settings, { merge: true });
      toast.update(toastId, 'success', 'Settings saved successfully');
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error saving settings', normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSeedData() {
    if (!window.confirm("This will initialize default packages and settings in the database. Existing data with the same IDs may be overwritten. Proceed?")) return;
    setSeeding(true);
    const toastId = toast.loading('Seeding database...');
    try {
      const seedDataFn = httpsCallable(functions, 'seedData');
      const result = await seedDataFn();
      toast.update(toastId, 'success', 'Database seeded successfully!', result.data.message || '');
      fetchSettings(); // Refresh settings
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error seeding data', normalizeError(err));
    } finally {
      setSeeding(false);
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
    { id: 'CONTACT', label: 'Contact Details' },
    { id: 'REGISTRATION', label: 'Registration' },
    { id: 'VERIFICATION', label: 'Verification' },
    { id: 'HOSTEL', label: 'Hostel Settings' },
    { id: 'PASSES_DISPLAY', label: 'Passes Display' },
    { id: 'PAYMENT', label: 'Payment (Deferred)' }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Event Settings" 
        description="Global configuration for the Rangtal platform." 
        actions={
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-secondary" onClick={handleSeedData} disabled={seeding}>
              <Database size={16} /> {seeding ? 'Seeding...' : 'Initialize Data'}
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save All Settings'}
            </button>
          </div>
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
                  
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <textarea 
                      className="form-input" 
                      rows="2"
                      value={settings.EVENT?.location || ''}
                      onChange={e => handleNestedChange('EVENT', 'location', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Timing</label>
                    <textarea 
                      className="form-input" 
                      rows="2"
                      value={settings.EVENT?.timing || ''}
                      onChange={e => handleNestedChange('EVENT', 'timing', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Dress Code</label>
                    <textarea 
                      className="form-input" 
                      rows="2"
                      value={settings.EVENT?.dressCode || ''}
                      onChange={e => handleNestedChange('EVENT', 'dressCode', e.target.value)}
                    />
                  </div>

                  <div className="surface-flat" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Show Student Badge</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Show 'ONLY FOR [COLLEGE] STUDENTS' on the landing page hero section.</div>
                    </div>
                    <label style={{ cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={settings.EVENT?.showStudentBadge ?? true} 
                        onChange={e => handleNestedChange('EVENT', 'showStudentBadge', e.target.checked)} 
                        style={{ width: '20px', height: '20px', accentColor: 'var(--color-gold)' }} 
                      />
                    </label>
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Student Badge Text</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={settings.EVENT?.studentBadgeText || 'ONLY FOR JSPM STUDENTS'}
                      onChange={e => handleNestedChange('EVENT', 'studentBadgeText', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'CONTACT' && (
                <div className="surface" style={{ padding: '2rem' }}>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Contact Details</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    Add up to two contact members to be displayed on the public landing page.
                  </p>
                  
                  <h4 style={{ color: 'var(--color-gold)', marginBottom: '1rem', fontSize: '1rem' }}>Contact Member 1</h4>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input type="text" className="form-input" value={settings.CONTACT?.member1Name || ''} onChange={e => handleNestedChange('CONTACT', 'member1Name', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input type="text" className="form-input" value={settings.CONTACT?.member1Phone || ''} onChange={e => handleNestedChange('CONTACT', 'member1Phone', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: '2rem' }}>
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={settings.CONTACT?.member1Email || ''} onChange={e => handleNestedChange('CONTACT', 'member1Email', e.target.value)} />
                  </div>

                  <h4 style={{ color: 'var(--color-gold)', marginBottom: '1rem', fontSize: '1rem' }}>Contact Member 2 (Optional)</h4>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input type="text" className="form-input" value={settings.CONTACT?.member2Name || ''} onChange={e => handleNestedChange('CONTACT', 'member2Name', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input type="text" className="form-input" value={settings.CONTACT?.member2Phone || ''} onChange={e => handleNestedChange('CONTACT', 'member2Phone', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={settings.CONTACT?.member2Email || ''} onChange={e => handleNestedChange('CONTACT', 'member2Email', e.target.value)} />
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

                  <div className="surface-flat" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
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

                  <div className="surface-flat" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Allow "Other" College Option</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Allow users to manually type their college name if it's not in the list.</div>
                    </div>
                    <label style={{ cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={settings.REGISTRATION?.allowOtherCollege || false} 
                        onChange={e => handleNestedChange('REGISTRATION', 'allowOtherCollege', e.target.checked)} 
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

              {activeTab === 'HOSTEL' && (
                <div className="surface" style={{ padding: '2rem' }}>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>JSPM Hostel Settings</h3>
                  
                  <div className="form-group">
                    <label className="form-label">Hostel Buildings</label>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      These building names will appear in the dropdown when a female participant selects that they are from JSPM Hostel.
                    </div>
                    
                    {(() => {
                      const buildingsList = Array.isArray(settings.HOSTEL?.buildings) 
                        ? settings.HOSTEL.buildings 
                        : (typeof settings.HOSTEL?.buildings === 'string' 
                            ? settings.HOSTEL.buildings.split(',').map(b => b.trim()).filter(b => b) 
                            : []);

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {buildingsList.map((b, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '0.5rem' }}>
                              <input 
                                type="text" 
                                className="form-input" 
                                value={b} 
                                placeholder="Enter building name"
                                onChange={(e) => {
                                  const newList = [...buildingsList];
                                  newList[idx] = e.target.value;
                                  handleNestedChange('HOSTEL', 'buildings', newList);
                                }}
                              />
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.5rem' }}
                                onClick={() => {
                                  const newList = buildingsList.filter((_, i) => i !== idx);
                                  handleNestedChange('HOSTEL', 'buildings', newList);
                                }}
                              >
                                <Trash2 size={18} color="var(--color-error)" />
                              </button>
                            </div>
                          ))}
                          <button 
                            className="btn btn-secondary" 
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'flex-start', marginTop: '0.5rem' }}
                            onClick={() => {
                                handleNestedChange('HOSTEL', 'buildings', [...buildingsList, '']);
                            }}
                          >
                            <Plus size={16} /> Add Building
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {activeTab === 'PASSES_DISPLAY' && (
                <div className="surface" style={{ padding: '2rem' }}>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Passes Display Override</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                    When enabled, the "Total" count shown on the Passes page will display your custom number instead of the actual count. Pagination and all data remain unaffected.
                  </p>

                  <div className="surface-flat" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Enable Override</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Show custom number instead of actual pass count.</div>
                    </div>
                    <label style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={settings.PASSES_DISPLAY?.enabled || false}
                        onChange={e => handleNestedChange('PASSES_DISPLAY', 'enabled', e.target.checked)}
                        style={{ width: '20px', height: '20px', accentColor: 'var(--color-gold)' }}
                      />
                    </label>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Custom Display Number</label>
                    <input
                      type="number"
                      className="form-input"
                      value={settings.PASSES_DISPLAY?.count || ''}
                      placeholder="e.g. 410"
                      disabled={!settings.PASSES_DISPLAY?.enabled}
                      onChange={e => handleNestedChange('PASSES_DISPLAY', 'count', Number(e.target.value))}
                      style={{ opacity: settings.PASSES_DISPLAY?.enabled ? 1 : 0.4 }}
                    />
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
