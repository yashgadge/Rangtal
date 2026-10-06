import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, Check, Zap, ZapOff, RefreshCcw } from 'lucide-react';

export default function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  useEffect(() => {
    let currentStream = null;
    
    const initCam = async () => {
      try {
        let mediaStream;
        let environmentSucceeded = false;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: facingMode } 
          });
          if (facingMode === 'environment') environmentSucceeded = true;
        } catch (err) {
          // Fallback to any available camera if preferred facing is not found
          mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: true
          });
        }
        currentStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        // Check for multiple cameras to show flip button
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          if (videoDevices.length > 1) {
            setHasMultipleCameras(true);
          }
        } catch (e) {}
        
        // Browsers are terrible at reporting getCapabilities().torch
        // So if we successfully got the environment (back) camera, just assume it might have a torch!
        if (environmentSucceeded) {
          setTorchSupported(true);
        } else {
          setTorchSupported(false);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Could not access camera. Please check permissions.");
        onCancel();
      }
    };
    
    initCam();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [facingMode]);

  const switchCamera = () => {
    setIsVideoReady(false);
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    setTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn }]
      });
      setTorchOn(!torchOn);
    } catch (err) {
      console.error("Error toggling torch:", err);
      alert("Flashlight/Torch is not supported on this specific device or browser.");
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!isVideoReady || video.videoWidth === 0 || video.videoHeight === 0) {
        alert("Camera is starting up. Please wait a second and try again.");
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
        let finalFile = blob;
        try {
          finalFile = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        } catch (e) {
          // Fallback for older browsers/webviews that don't support File constructor
          try {
            blob.name = `capture_${Date.now()}.jpg`;
            blob.lastModified = Date.now();
          } catch (err) {}
        }
        setCapturedImage({ url: URL.createObjectURL(blob), file: finalFile });
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

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '400px', 
        maxHeight: '85vh',
        background: '#111', 
        borderRadius: '24px', 
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: '300px', background: '#000' }}>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline
            onLoadedMetadata={() => setIsVideoReady(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: capturedImage ? 'none' : 'block' }}
          />
          {capturedImage && (
            <img 
              src={capturedImage.url} 
              alt="Captured" 
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
          
          <button 
            onClick={() => {
              if (stream) {
                stream.getTracks().forEach(track => track.stop());
              }
              onCancel();
            }}
            style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', padding: '8px', color: 'white', cursor: 'pointer', zIndex: 10 }}
          >
            <X size={20} />
          </button>
          
          {torchSupported && !capturedImage && (
            <button 
              onClick={toggleTorch}
              style={{ position: 'absolute', top: '16px', left: '16px', background: torchOn ? 'rgba(212,175,55,0.9)' : 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', padding: '8px', color: torchOn ? 'black' : 'white', cursor: 'pointer', zIndex: 10, transition: 'all 0.3s' }}
            >
              {torchOn ? <Zap size={20} /> : <ZapOff size={20} />}
            </button>
          )}
        </div>

        <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', background: 'rgba(20, 5, 10, 0.9)', borderTop: '1px solid rgba(255,215,0,0.1)', position: 'relative' }}>
          {!capturedImage ? (
            <>
              <button 
                onClick={takePhoto}
                disabled={!isVideoReady}
                style={{
                  width: '64px', height: '64px', 
                  borderRadius: '50%', 
                  background: '#fff', 
                  border: '4px solid #333',
                  cursor: isVideoReady ? 'pointer' : 'not-allowed',
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                  opacity: isVideoReady ? 1 : 0.5,
                  transition: 'all 0.3s'
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #000' }} />
              </button>
              
              {hasMultipleCameras && (
                <button 
                  onClick={switchCamera}
                  style={{ position: 'absolute', right: '30px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', padding: '12px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                >
                  <RefreshCcw size={20} />
                </button>
              )}
            </>
          ) : (
            <>
              <button 
                onClick={handleRetake}
                className="btn-secondary"
                style={{ flex: 1, padding: '0.8rem' }}
              >
                Retake
              </button>
              <button 
                onClick={handleConfirm}
                className="btn-primary"
                style={{ flex: 1, padding: '0.8rem', background: 'var(--color-gold)', color: 'black' }}
              >
                <Check size={18} /> Use Photo
              </button>
            </>
          )}
        </div>
      </div>
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>,
    document.body
  );
}
