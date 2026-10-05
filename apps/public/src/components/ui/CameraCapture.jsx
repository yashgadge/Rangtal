import React, { useRef, useState, useCallback } from 'react';
import { Camera, X, Check } from 'lucide-react';

export default function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check permissions.");
      onCancel();
    }
  };

  React.useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        alert("Camera not ready yet. Please try again.");
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error("Failed to create image blob");
          return;
        }
        // Polyfill File for WebViews that don't support the File constructor
        blob.name = `capture_${Date.now()}.jpg`;
        blob.lastModified = Date.now();
        setCapturedImage({ url: URL.createObjectURL(blob), file: blob });
      }, 'image/jpeg', 0.8);
    }
  };

  const handleConfirm = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (capturedImage) {
      onCapture(capturedImage.file);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '400px', 
        background: '#111', 
        borderRadius: '24px', 
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        
        <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: '#000' }}>
          {!capturedImage ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <img 
              src={capturedImage.url} 
              alt="Captured" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          
          <button 
            onClick={onCancel}
            style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', padding: '8px', color: 'white', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
          {!capturedImage ? (
            <button 
              onClick={takePhoto}
              style={{
                width: '64px', height: '64px', 
                borderRadius: '50%', 
                background: '#fff', 
                border: '4px solid #333',
                cursor: 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center'
              }}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #000' }} />
            </button>
          ) : (
            <>
              <button 
                onClick={handleRetake}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Retake
              </button>
              <button 
                onClick={handleConfirm}
                className="btn-primary"
                style={{ flex: 1 }}
              >
                <Check size={18} /> Use Photo
              </button>
            </>
          )}
        </div>
      </div>
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
