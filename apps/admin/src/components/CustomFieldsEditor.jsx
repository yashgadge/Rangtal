import React from 'react';
import { Plus, X, GripVertical, Settings } from 'lucide-react';

const FIELD_TYPES = [
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'image_upload', label: 'Image Upload' }
];

export default function CustomFieldsEditor({ fields = [], onChange }) {
  const addField = () => {
    onChange([
      ...fields, 
      { 
        id: `field-${Date.now()}`, 
        label: '', 
        type: 'short_answer', 
        required: false,
        options: []
      }
    ]);
  };

  const updateField = (id, updates) => {
    onChange(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id) => {
    onChange(fields.filter(f => f.id !== id));
  };

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Custom Registration Fields</h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Ask specific questions when participants select this college.</p>
        </div>
        <button type="button" onClick={addField} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Plus size={14} /> Add Field
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {fields.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>No custom fields added yet.</p>
          </div>
        ) : (
          fields.map((field, index) => (
            <div key={field.id} className="surface-flat" style={{ padding: '1rem', position: 'relative' }}>
              <button 
                type="button" 
                onClick={() => removeField(field.id)}
                style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={16} />
              </button>
              
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', marginTop: '0.5rem' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Field Label</label>
                  <input 
                    type="text" 
                    value={field.label}
                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                    className="form-input" 
                    placeholder="e.g. Upload Student ID"
                    style={{ padding: '0.5rem' }}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Field Type</label>
                  <select 
                    value={field.type}
                    onChange={(e) => updateField(field.id, { type: e.target.value })}
                    className="form-input"
                    style={{ padding: '0.5rem' }}
                  >
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {field.type === 'dropdown' && (
                <div style={{ marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Dropdown Options</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {(field.options || []).map((opt, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.5rem' }}>
                        <input 
                          type="text" 
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...(field.options || [])];
                            newOpts[i] = e.target.value;
                            updateField(field.id, { options: newOpts });
                          }}
                          className="form-input"
                          style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                          placeholder={`Option ${i + 1}`}
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => {
                            const newOpts = (field.options || []).filter((_, idx) => idx !== i);
                            updateField(field.id, { options: newOpts });
                          }}
                          style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', borderRadius: '4px', width: '28px', cursor: 'pointer' }}
                        >
                          <X size={14} style={{ margin: '0 auto' }}/>
                        </button>
                      </div>
                    ))}
                    <button 
                      type="button" 
                      onClick={() => updateField(field.id, { options: [...(field.options || []), ''] })}
                      style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.2)', color: 'var(--text-secondary)', padding: '0.4rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      <Plus size={12} /> Add Option
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id={`req-${field.id}`} 
                  checked={field.required}
                  onChange={(e) => updateField(field.id, { required: e.target.checked })}
                  style={{ accentColor: 'var(--color-gold)' }}
                />
                <label htmlFor={`req-${field.id}`} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Required Field
                </label>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
