import React, { useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Upload, File, X, AlertCircle } from 'lucide-react';
import CameraCapture from './CameraCapture.jsx';
import { useToast } from '../../../../../shared/ui/Toast/ToastProvider.jsx';

export default function ParticipantUploads({ participantIndex, participantName, files, onChange, maxFiles = 1, maxSizeMB = 5 }) {
  const [showCamera, setShowCamera] = useState(false);
  const toast = useToast();

  const validateFile = (file) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error('File too large', `Maximum allowed size is ${maxSizeMB}MB.`);
      return false;
    }
    return true;
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const currentFiles = files || [];
      const newFiles = Array.from(e.target.files).filter(validateFile);
      
      if (currentFiles.length + newFiles.length > maxFiles) {
        toast.warning('Limit reached', `You can only upload a maximum of ${maxFiles} document(s).`);
        onChange([...currentFiles, ...newFiles].slice(0, maxFiles));
      } else {
        onChange([...currentFiles, ...newFiles]);
      }
    }
  };

  const handleCapture = (file) => {
    if (validateFile(file)) {
      const currentFiles = files || [];
      if (currentFiles.length >= maxFiles) {
        toast.warning('Limit reached', `You can only upload a maximum of ${maxFiles} document(s).`);
      } else {
        onChange([...currentFiles, file]);
      }
    }
    setShowCamera(false);
  };

  const removeFile = (indexToRemove) => {
    onChange((files || []).filter((_, i) => i !== indexToRemove));
  };

  const currentFiles = files || [];
  const atMaxCapacity = currentFiles.length >= maxFiles;

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 500, margin: 0, color: 'var(--color-ivory)' }}>{participantName}</h3>
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
          {currentFiles.length} / {maxFiles} Added
        </div>
      </div>

      {currentFiles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          {currentFiles.map((file, idx) => {
            const isImage = file.type.startsWith('image/');
            const previewUrl = isImage ? URL.createObjectURL(file) : null;
            
            return (
              <div key={idx} style={{ 
                display: 'flex', alignItems: 'center', gap: '1rem', 
                background: 'rgba(0,0,0,0.4)', padding: '0.75rem', borderRadius: '8px', 
                border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem',
                position: 'relative', flex: '1 1 auto', minWidth: '200px'
              }}>
                {isImage && previewUrl ? (
                  <img src={previewUrl} alt="Preview" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
                ) : (
                  <div style={{ width: '64px', height: '64px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <File size={28} color="rgba(255,255,255,0.5)" />
                  </div>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-ivory)', fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                    {file.name}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)' }}>
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>

                <button 
                  onClick={() => removeFile(idx)}
                  style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', padding: '0.3rem', borderRadius: '4px', color: '#ef4444', cursor: 'pointer', display: 'flex', marginLeft: 'auto' }}
                  title="Remove file"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!atMaxCapacity && (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={() => setShowCamera(true)}
            style={{ 
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.75rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
              color: 'var(--color-ivory)', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.5)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
          >
            <Camera size={18} /> Take Photo
          </button>

          <label style={{ 
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.75rem', background: 'rgba(0,0,0,0.4)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px',
              color: 'var(--color-ivory)', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.5)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
          >
            <Upload size={18} /> Upload File
            <input type="file" multiple={maxFiles > 1} onChange={handleFileChange} style={{ display: 'none' }} accept="image/*,.pdf" />
          </label>
        </div>
      )}

      {showCamera && (
        <CameraCapture 
          onCapture={handleCapture}
          onCancel={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
