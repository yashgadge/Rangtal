import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { GoogleAuthProvider, onAuthStateChanged, signOut, signInWithRedirect } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, auth, functions, storage } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Upload, AlertCircle, Package, User, Building, FileText, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';
import { useFirebaseData } from '../../../../shared/hooks/useFirebaseData.js';
import { invalidateCache } from '../../../../shared/utils/cache.js';
import { useNavigate } from 'react-router-dom';
import Stepper, { Step } from '../components/Stepper/Stepper.jsx';
import ParticipantUploads from '../components/ui/ParticipantUploads.jsx';
import CustomSelect from '../components/ui/CustomSelect.jsx';
import './Register.css';

export default function Register() {
  const toast = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Form State
  const [step, setStep] = useState(1);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedCollege, setSelectedCollege] = useState('');
  const [otherCollegeName, setOtherCollegeName] = useState('');
  
  // Array of participant objects
  const [participants, setParticipants] = useState([]);
  const [currentParticipantIndex, setCurrentParticipantIndex] = useState(0);
  
  // Documents state
  const [files, setFiles] = useState([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [registrationResult, setRegistrationResult] = useState(null);
  const [error, setError] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [shakeTerms, setShakeTerms] = useState(false);

  useEffect(() => {
    let unmounted = false;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (unmounted) return;
      setUser(currentUser);
      if (currentUser) {
        setAuthLoading(false);
      }
    });

    import('firebase/auth').then(({ getRedirectResult }) => {
      getRedirectResult(auth)
        .then(() => {
          if (!unmounted) setAuthLoading(false);
        })
        .catch((error) => {
          console.warn("Could not get redirect result:", error);
          if (!unmounted) setAuthLoading(false);
        });
    }).catch(e => {
      console.warn("Failed to load firebase/auth module:", e);
      if (!unmounted) setAuthLoading(false);
    });

    return () => {
      unmounted = true;
      unsubscribe();
    };
  }, []);

  const { data: packages, loading: pkgsLoading, error: pkgsError } = useFirebaseData('packages_active', async () => {
    const snap = await getDocs(query(collection(db, 'packages'), where('active', '==', true)));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }, { enabled: !!user });

  const { data: colleges, loading: colLoading, error: colError } = useFirebaseData('colleges_verified', async () => {
    const snap = await getDocs(query(collection(db, 'colleges'), where('verified', '==', true)));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }, { enabled: !!user });

  useEffect(() => {
    if (pkgsError) toast.error('Packages Load Failed', normalizeError(pkgsError));
    if (colError) toast.error('Colleges Load Failed', normalizeError(colError));
  }, [pkgsError, colError]);

  // Prevent accidental refresh
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (window.__isNavigatingAway) return;
      if (step > 1 && step < 4) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [step]);



  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
    
    // Ping the backend to wake up the server (Pre-warming)
    const createOrder = httpsCallable(functions, 'createPaymentOrder');
    createOrder({ ping: true }).catch(() => {});

    const count = pkg.participantCount || 1;
    // Initialize participants array based on package
    const initialParticipants = Array.from({ length: count }, (_, idx) => {
      let initialGender = '';
      if (pkg.type === 'COUPLE' && count === 2) {
        initialGender = idx === 0 ? 'Male' : 'Female';
      }
      return { fullName: '', gender: initialGender };
    });
    setParticipants(initialParticipants);
    setFiles(Array(count).fill(null));
  };

  const handleParticipantChange = (field, value) => {
    setParticipants(prevParts => {
      const newParts = [...prevParts];
      newParts[currentParticipantIndex] = { ...newParts[currentParticipantIndex], [field]: value };
      return newParts;
    });
  };

  const nextParticipant = () => {
    if (currentParticipantIndex < participants.length - 1) {
      setCurrentParticipantIndex(currentParticipantIndex + 1);
    } else {
      setStep(3); // Go to review
    }
  };

  const prevParticipant = () => {
    if (currentParticipantIndex > 0) {
      setCurrentParticipantIndex(currentParticipantIndex - 1);
    } else {
      setStep(1); // Go back to package selection
    }
  };

  const [processingStatus, setProcessingStatus] = useState(null);

  const handleSubmitRegistration = async () => {
    setSubmitting(true);
    setProcessingStatus({ title: 'Creating Order...', desc: 'Please do not close this window.' });
    setError(null);
    const toastId = toast.loading('Creating your order...', 'Please do not close this window');
    try {
      let regId = null;

      if (registrationResult) {
        // Reuse existing registration
        regId = registrationResult.registrationId || registrationResult.id;
      } else {
        setProcessingStatus({ title: 'Uploading Documents...', desc: 'Securely saving your IDs' });
        const uploadedDocs = await handlePreUpload();

        setProcessingStatus({ title: 'Creating Order...', desc: 'Please do not close this window.' });
        
        // 1. Create Registration (Status becomes VERIFIED instantly)
        const cleanedParticipants = participants.map(p => {
          const cleaned = {};
          for (const [key, value] of Object.entries(p)) {
            if (Array.isArray(value) && value.length > 0 && (value[0] instanceof File)) continue;
            cleaned[key] = value;
          }
          if (!cleaned.fullName) {
            cleaned.fullName = cleaned.custom_name || cleaned.custom_full_name || "Participant";
          }
          if (p.collegeId === 'OTHER') {
            cleaned.custom_other_college_name = p.otherCollegeName;
            cleaned.custom_college_name = "Other";
          } else if (p.collegeId) {
            cleaned.custom_college_name = colleges?.find(c => c.id === p.collegeId)?.name || p.collegeId;
          }
          return cleaned;
        });

        const createRegistration = httpsCallable(functions, 'createRegistration');
        const regResponse = await createRegistration({
          packageId: selectedPackage.id,
          collegeId: participants[0]?.collegeId || 'OTHER',
          type: selectedPackage.type,
          participants: cleanedParticipants,
          formFields: {},
          verificationDocs: uploadedDocs
        });
        
        regId = regResponse.data.registrationId;
        setRegistrationResult({ registrationId: regId, ...regResponse.data });
      }

      // 2. Create Payment Order
      const createOrder = httpsCallable(functions, 'createPaymentOrder');
      const orderResponse = await createOrder({ registrationId: regId });
      const orderData = orderResponse.data;

      toast.dismiss(toastId);
      setProcessingStatus(null); // Clear overlay while Razorpay is open

      // 3. Open Razorpay
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_placeholder",
        amount: orderData.amount * 100,
        currency: "INR",
        name: "Rangtal Garba",
        description: `${selectedPackage.name} Payment`,
        order_id: orderData.orderId,
        handler: async function (response) {
          const verifyingToast = toast.loading('Verifying payment...', 'Issuing your passes');
          setProcessingStatus({ title: 'Verifying Payment...', desc: 'Securing your transaction' });
          try {
            // 4. Verify Payment (Automatically generates pass in background or via subsequent call)
            const verifyPayment = httpsCallable(functions, 'verifyPayment');
            await verifyPayment({
              paymentId: orderData.paymentId,
              gatewayPaymentId: response.razorpay_payment_id,
              gatewaySignature: response.razorpay_signature
            });

            // We do NOT block on generatePass here to provide a lightning fast experience.
            // If verifyPayment succeeds, the pass will be generated. We optionally fire and forget.
            const generatePass = httpsCallable(functions, 'generatePass');
            generatePass({ registrationId: regId }).catch(e => console.log("Background pass generation:", e));

            toast.update(verifyingToast, 'success', 'Payment Successful!', 'Redirecting to your dashboard...');
            setProcessingStatus({ title: 'Success!', desc: 'Redirecting to your dashboard...' });
            invalidateCache(); // Clear the data cache to ensure the new passes show up
            window.__isNavigatingAway = true;
            navigate('/account');
          } catch (err) {
            console.error("Verification failed", err);
            toast.update(verifyingToast, 'error', 'Payment Failed', normalizeError(err));
            setError("Payment verification failed. Please contact support.");
            setSubmitting(false);
            setProcessingStatus(null);
          }
        },
        modal: {
          ondismiss: function() {
            setSubmitting(false);
            toast.info('Payment Cancelled. You can review your details and try again.');
          }
        },
        prefill: { email: user.email },
        theme: { color: "#D4AF37" }
      };
      
      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error("Registration failed", err);
      const msg = normalizeError(err);
      setError(msg);
      toast.update(toastId, 'error', 'Error', msg);
      setSubmitting(false);
    }
  };

  const handlePreUpload = async () => {
    try {
      const uid = user.uid;
      const uploadPromises = [];
      const documents = [];
      const tempId = `temp_${Date.now()}`;
      
      for (let i = 0; i < participants.length; i++) {
        const p = participants[i];
        for (const [key, value] of Object.entries(p)) {
          if (Array.isArray(value) && value.length > 0 && value[0] && value[0].size && value[0].type) {
            for (let j = 0; j < value.length; j++) {
              const file = value[j];
              const path = `participants/${uid}/verification/${tempId}_p${i+1}_${key}_${file.name}`;
              const fileRef = ref(storage, path);
              
              const uploadTask = async () => {
                await uploadBytesResumable(fileRef, file);
                const downloadUrl = await getDownloadURL(fileRef);
                return {
                  participantIndex: i,
                  fieldId: key,
                  filename: file.name,
                  contentType: file.type,
                  size: file.size,
                  path: path,
                  url: downloadUrl
                };
              };
              uploadPromises.push(uploadTask());
            }
          }
        }
      }
      
      const uploadedDocs = await Promise.all(uploadPromises);
      documents.push(...uploadedDocs);
      return documents;
    } catch (err) {
      console.error("Upload failed", err);
      throw err;
    }
  };



  const { data: eventSettings } = useFirebaseData('register_event_settings', async () => {
    const snap = await getDoc(doc(db, 'eventSettings', 'global'));
    return snap.exists() ? snap.data() : {};
  });

  const isClosed = eventSettings && eventSettings.REGISTRATION && eventSettings.REGISTRATION.registrationsOpen === false;

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = '/account';
    }
  }, [user, authLoading]);

  // Prevent accidental refresh/back while filling form or processing payment
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (window.__isNavigatingAway) return;
      if (step > 1 || submitting || processingStatus) {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? Your registration progress may be lost.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [step, submitting, processingStatus]);

  if (authLoading) {
    return (
      <div className="register-page app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ color: 'var(--color-ivory)', fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '4px' }}>
          RANGTAL
        </motion.div>
      </div>
    );
  }

  if (isClosed) {
    return (
      <div className="register-page app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <Package size={64} color="var(--color-gold)" style={{ marginBottom: '2rem' }} />
        <h1 className="text-display-large" style={{ color: 'var(--color-ivory)', marginBottom: '1rem' }}>REGISTRATIONS CLOSED</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', textAlign: 'center', maxWidth: '500px' }}>
          We have reached maximum capacity or registrations have been disabled by the organizers. Stay tuned for future events!
        </p>
        <button className="btn btn-secondary" style={{ marginTop: '2rem' }} onClick={() => navigate('/account')}>
          Go to Dashboard
        </button>
      </div>
    );
  }



  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="register-page app-container">
      <AnimatePresence>
        {processingStatus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(10, 10, 10, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFF5E5'
            }}
          >
            <div style={{ width: '80px', height: '80px', border: '4px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <style>{`
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
            <h2 style={{ marginTop: '2.5rem', fontFamily: 'var(--font-display)', letterSpacing: '3px', fontSize: '1.8rem', textAlign: 'center' }}>
              {processingStatus.title}
            </h2>
            <p style={{ marginTop: '0.8rem', color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', textAlign: 'center', maxWidth: '80%' }}>
              {processingStatus.desc}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="content-layer">
        
        <div className="register-container">
          <div className="header-row">
            <h1 className="text-title" style={{ margin: 0 }}>Registration</h1>
            <button onClick={() => { navigate('/account'); }} className="logout-btn">Cancel</button>
          </div>
          
          {step < 5 && (
            <Stepper 
              step={step} 
              onStepChange={setStep} 
              showFooter={false}
              disableStepIndicators={true}
              stepCircleContainerClassName="register-stepper-wrapper"
              style={{ padding: 0 }}
            >
              <Step>
                <div>
                  <h2 className="text-subtitle">Select a Package</h2>
                  {pkgsLoading ? (
                    <div className="grid-packages">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="package-row" style={{ animation: 'pulse 1.5s infinite ease-in-out' }}>
                          <div className="pkg-info" style={{ width: '60%' }}>
                            <div style={{ height: '20px', width: '40%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '0.5rem' }} />
                            <div style={{ height: '14px', width: '80%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
                          </div>
                          <div className="pkg-price-wrap" style={{ width: '20%' }}>
                            <div style={{ height: '30px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : packages && packages.length > 0 ? (
                    <div className="grid-packages">
                      {packages.map(pkg => {
                        const isEarlyBirdActive = pkg.earlyBirdEnabled && (pkg.earlyBirdSoldCount || 0) < (pkg.earlyBirdCapacity || 0);
                        return (
                        <div 
                          key={pkg.id} 
                          className={`package-row ${selectedPackage?.id === pkg.id ? 'selected' : ''}`}
                          onClick={() => handlePackageSelect(pkg)}
                        >
                          <div className="pkg-info">
                            <div className="pkg-name">
                              {pkg.name} <span className="badge">{pkg.type}</span>
                                {isEarlyBirdActive && (
                                  <span className="badge" style={{ background: 'rgba(212,175,55,0.1)', color: 'var(--color-gold)', marginLeft: '0.5rem', border: '1px solid rgba(212,175,55,0.2)' }}>
                                    EARLY BIRD
                                  </span>
                                )}
                            </div>
                            <div className="pkg-desc">
                              {pkg.participantCount} Participant{pkg.participantCount > 1 ? 's' : ''} • {pkg.description.substring(0, 40)}{pkg.description.length > 40 ? '...' : ''}
                            </div>
                          </div>
                          <div className="pkg-price-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                            {isEarlyBirdActive && (
                              <div style={{ fontSize: '0.85rem', textDecoration: 'line-through', color: 'rgba(255,255,255,0.4)', marginBottom: '0.2rem' }}>₹{pkg.price}</div>
                            )}
                            <div className="pkg-price">₹{isEarlyBirdActive ? pkg.earlyBirdPrice : pkg.price}</div>
                          </div>
                        </div>
                      )})}
                    </div>
                  ) : (
                    <p className="text-body" style={{ marginTop: '2rem' }}>No packages are currently available.</p>
                  )}

                  <div className="btn-row btn-row-right">
                    <button disabled={!selectedPackage} onClick={() => { setStep(2); setCurrentParticipantIndex(0); }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Continue <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </Step>

              <Step>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 className="text-subtitle" style={{ margin: 0 }}>Participant Details</h2>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {selectedPackage?.type === 'COUPLE' && (
                        <div className="badge" style={{ background: 'rgba(212,175,55,0.1)', color: 'var(--color-gold)', border: '1px solid rgba(212,175,55,0.2)' }}>
                          {participants[currentParticipantIndex]?.gender.toUpperCase()}
                        </div>
                      )}
                      <div className="badge">
                        PERSON {currentParticipantIndex + 1} OF {participants.length}
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginBottom: '2rem', overflow: 'hidden' }}>
                    <motion.div 
                      initial={{ width: `${(currentParticipantIndex / participants.length) * 100}%` }}
                      animate={{ width: `${((currentParticipantIndex + 1) / participants.length) * 100}%` }}
                      style={{ height: '100%', background: 'var(--color-ivory)', borderRadius: '3px' }}
                    />
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <div className="form-group" style={{ marginBottom: participants[currentParticipantIndex]?.collegeId === 'OTHER' ? '1rem' : 0 }}>
                      <label className="text-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Building size={14} /> Select Your College <span style={{color: '#ef4444'}}>*</span>
                      </label>
                      <CustomSelect 
                        disabled={colLoading} 
                        value={participants[currentParticipantIndex]?.collegeId || ''} 
                        onChange={(e) => handleParticipantChange('collegeId', e.target.value)}
                        placeholder={colLoading ? 'Loading Colleges...' : 'Select College / Institution...'}
                        options={[
                          ...(colleges ? colleges.map(c => ({ value: c.id, label: c.name })) : []),
                          ...(eventSettings?.REGISTRATION?.allowOtherCollege ? [{ value: 'OTHER', label: 'Other (Not Listed)' }] : [])
                        ]}
                      />
                      <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'rgba(239, 68, 68, 0.8)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}>
                        <AlertCircle size={12} /> College Pass-out students are strictly not allowed.
                      </div>
                    </div>
                    
                    {participants[currentParticipantIndex]?.collegeId === 'OTHER' && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="text-label">College Name <span style={{color: '#ef4444'}}>*</span></label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={participants[currentParticipantIndex]?.otherCollegeName || ''} 
                          onChange={(e) => handleParticipantChange('otherCollegeName', e.target.value)} 
                          placeholder="Enter your college or institution name" 
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    {selectedPackage?.type === 'COUPLE' && (
                      <div className="form-group">
                        <label className="text-label">Gender <span style={{color: '#ef4444'}}>*</span></label>
                        <CustomSelect 
                          value={participants[currentParticipantIndex]?.gender || ''} 
                          onChange={() => {}}
                          disabled={true}
                          placeholder="Select Gender..."
                          options={['Male', 'Female', 'Other']}
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="text-label">Full Name <span style={{color: '#ef4444'}}>*</span></label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={participants[currentParticipantIndex]?.fullName || ''} 
                        onChange={e => handleParticipantChange('fullName', e.target.value)} 
                        placeholder="Participant's full name" 
                      />
                    </div>

                    <div className="form-group">
                      <label className="text-label">Mobile Number <span style={{color: '#ef4444'}}>*</span></label>
                      <input 
                        type="tel" 
                        className="form-input" 
                        style={{
                          borderColor: (participants[currentParticipantIndex]?.mobile && participants[currentParticipantIndex].mobile.length > 0 && participants[currentParticipantIndex].mobile.length < 10) ? '#ef4444' : undefined
                        }}
                        value={participants[currentParticipantIndex]?.mobile || ''} 
                        onChange={e => handleParticipantChange('mobile', e.target.value.replace(/[^0-9]/g, ''))} 
                        placeholder="10-digit mobile number" 
                        maxLength={10}
                      />
                      {(participants[currentParticipantIndex]?.mobile && participants[currentParticipantIndex].mobile.length > 0 && participants[currentParticipantIndex].mobile.length < 10) && (
                        <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#ef4444' }}>
                          Mobile number must be exactly 10 digits.
                        </div>
                      )}
                    </div>

                    {selectedPackage?.type !== 'COUPLE' && (
                      <div className="form-group">
                        <label className="text-label">Gender <span style={{color: '#ef4444'}}>*</span></label>
                        <CustomSelect 
                          value={participants[currentParticipantIndex]?.gender || ''} 
                          onChange={e => {
                            handleParticipantChange('gender', e.target.value);
                            if (e.target.value !== 'Female') {
                              handleParticipantChange('isJspmHostel', '');
                              handleParticipantChange('hostelBuilding', '');
                              handleParticipantChange('hostelRoom', '');
                            }
                          }}
                          placeholder="Select Gender..."
                          options={['Male', 'Female', 'Other']}
                        />
                      </div>
                    )}

                    {participants[currentParticipantIndex]?.gender === 'Female' && (
                      <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label className="text-label" style={{ color: 'var(--color-gold)' }}>Are you from JSPM Hostel? <span style={{color: '#ef4444'}}>*</span></label>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.75rem', marginTop: '-0.2rem' }}>
                          We will take permission for you from the hostel authorities.
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', marginBottom: participants[currentParticipantIndex]?.isJspmHostel === 'Yes' ? '1.5rem' : 0 }}>
                          <button
                            type="button"
                            onClick={() => handleParticipantChange('isJspmHostel', 'Yes')}
                            style={{ 
                              flex: 1, 
                              padding: '0.85rem', 
                              borderRadius: '8px', 
                              border: '1px solid',
                              borderColor: participants[currentParticipantIndex]?.isJspmHostel === 'Yes' ? 'var(--color-gold)' : 'rgba(255,255,255,0.1)',
                              background: participants[currentParticipantIndex]?.isJspmHostel === 'Yes' ? 'rgba(212,175,55,0.1)' : 'rgba(0,0,0,0.3)',
                              color: participants[currentParticipantIndex]?.isJspmHostel === 'Yes' ? 'var(--color-gold)' : 'var(--color-ivory)',
                              cursor: 'pointer',
                              fontWeight: participants[currentParticipantIndex]?.isJspmHostel === 'Yes' ? 500 : 400,
                              transition: 'all 0.2s'
                            }}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleParticipantChange('isJspmHostel', 'No');
                              handleParticipantChange('hostelBuilding', '');
                              handleParticipantChange('hostelRoom', '');
                            }}
                            style={{ 
                              flex: 1, 
                              padding: '0.85rem', 
                              borderRadius: '8px', 
                              border: '1px solid',
                              borderColor: participants[currentParticipantIndex]?.isJspmHostel === 'No' ? 'var(--color-gold)' : 'rgba(255,255,255,0.1)',
                              background: participants[currentParticipantIndex]?.isJspmHostel === 'No' ? 'rgba(212,175,55,0.1)' : 'rgba(0,0,0,0.3)',
                              color: participants[currentParticipantIndex]?.isJspmHostel === 'No' ? 'var(--color-gold)' : 'var(--color-ivory)',
                              cursor: 'pointer',
                              fontWeight: participants[currentParticipantIndex]?.isJspmHostel === 'No' ? 500 : 400,
                              transition: 'all 0.2s'
                            }}
                          >
                            No
                          </button>
                        </div>
                        
                        {participants[currentParticipantIndex]?.isJspmHostel === 'Yes' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                              <label className="text-label" style={{ fontSize: '0.85rem' }}>Building Name <span style={{color: '#ef4444'}}>*</span></label>
                              <CustomSelect 
                                value={participants[currentParticipantIndex]?.hostelBuilding || ''}
                                onChange={e => handleParticipantChange('hostelBuilding', e.target.value)}
                                placeholder="Select Building..."
                                options={Array.isArray(eventSettings?.HOSTEL?.buildings) 
                                  ? eventSettings.HOSTEL.buildings.filter(b => b.trim()) 
                                  : (typeof eventSettings?.HOSTEL?.buildings === 'string' 
                                      ? eventSettings.HOSTEL.buildings.split(',').map(b => b.trim()).filter(b => b) 
                                      : [])}
                              />
                            </div>
                            <div>
                              <label className="text-label" style={{ fontSize: '0.85rem' }}>Room Number <span style={{color: '#ef4444'}}>*</span></label>
                              <input 
                                type="text" 
                                className="form-input" 
                                maxLength={3}
                                value={participants[currentParticipantIndex]?.hostelRoom || ''}
                                onChange={e => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  handleParticipantChange('hostelRoom', val);
                                }}
                                placeholder="e.g. 101"
                              />
                              {participants[currentParticipantIndex]?.hostelRoom && participants[currentParticipantIndex].hostelRoom.length !== 3 && (
                                <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>Must be exactly 3 digits.</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Dynamic Custom Fields based on College */}
                    {participants[currentParticipantIndex]?.collegeId && colleges?.find(c => c.id === participants[currentParticipantIndex].collegeId)?.customFields?.map(field => {
                      const value = participants[currentParticipantIndex]?.[`custom_${field.id}`] || '';
                      return (
                        <div key={field.id} className="form-group">
                          <label className="text-label">{field.label} {field.required && <span style={{color: '#ef4444'}}>*</span>}</label>
                          
                          {field.type === 'short_answer' && (
                            <input type="text" className="form-input" value={value} onChange={e => handleParticipantChange(`custom_${field.id}`, e.target.value)} placeholder="Your answer" />
                          )}
                          
                          {field.type === 'phone' && (
                            <input type="tel" className="form-input" value={value} onChange={e => handleParticipantChange(`custom_${field.id}`, e.target.value)} placeholder="Phone number" />
                          )}
                          
                          {field.type === 'dropdown' && (
                            <CustomSelect 
                              value={value} 
                              onChange={e => handleParticipantChange(`custom_${field.id}`, e.target.value)}
                              placeholder="Select an option..."
                              options={field.options || []}
                            />
                          )}
                          
                          {field.type === 'checkbox' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                              <input type="checkbox" checked={!!value} onChange={e => handleParticipantChange(`custom_${field.id}`, e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--color-gold)' }} />
                              <span style={{ fontSize: '0.9rem', color: 'var(--color-ivory)' }}>Yes, I confirm</span>
                            </div>
                          )}

                          {field.type === 'image_upload' && (
                            <div style={{ marginTop: '0.5rem' }}>
                              <ParticipantUploads
                                participantIndex={currentParticipantIndex}
                                participantName={`Document: ${field.label}`}
                                files={value || []}
                                onChange={(newFiles) => handleParticipantChange(`custom_${field.id}`, newFiles)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Generic College ID Upload if required globally */}
                    {eventSettings?.REGISTRATION?.requireCollegeId && (
                      <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label className="text-label">College ID Document <span style={{color: '#ef4444'}}>*</span></label>
                        <div style={{ marginTop: '0.5rem' }}>
                          <ParticipantUploads
                            participantIndex={currentParticipantIndex}
                            participantName="College ID Card"
                            files={participants[currentParticipantIndex]?.collegeIdFiles || []}
                            onChange={(newFiles) => handleParticipantChange('collegeIdFiles', newFiles)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="btn-row" style={{ marginTop: '2rem' }}>
                    <button onClick={prevParticipant} className="btn-secondary">Back</button>
                    <button 
                      disabled={
                        !participants[currentParticipantIndex]?.collegeId || 
                        (participants[currentParticipantIndex]?.collegeId === 'OTHER' && !participants[currentParticipantIndex]?.otherCollegeName?.trim()) ||
                        !participants[currentParticipantIndex]?.fullName ||
                        !participants[currentParticipantIndex]?.mobile || participants[currentParticipantIndex]?.mobile.length !== 10 ||
                        !participants[currentParticipantIndex]?.gender ||
                        (eventSettings?.REGISTRATION?.requireCollegeId && (!participants[currentParticipantIndex]?.collegeIdFiles || participants[currentParticipantIndex]?.collegeIdFiles.length === 0)) ||
                        (colleges?.find(c => c.id === participants[currentParticipantIndex]?.collegeId)?.customFields?.some(f => {
                          if (!f.required) return false;
                          const val = participants[currentParticipantIndex]?.[`custom_${f.id}`];
                          if (Array.isArray(val)) return val.length === 0;
                          return !val;
                        })) || 
                        (participants[currentParticipantIndex]?.gender === 'Female' && !participants[currentParticipantIndex]?.isJspmHostel) ||
                        (participants[currentParticipantIndex]?.isJspmHostel === 'Yes' && (!participants[currentParticipantIndex]?.hostelBuilding || participants[currentParticipantIndex]?.hostelRoom?.length !== 3))
                      }
                      onClick={nextParticipant} 
                      className="btn-primary"
                    >
                      {currentParticipantIndex < participants.length - 1 ? 'Save & Continue' : 'Review Registration'}
                    </button>
                  </div>
                </div>
              </Step>

              <Step>
                <div>
                  <h2 className="text-subtitle">Review & Confirm</h2>
                  
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.25rem' }}>Package</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 500 }}>{selectedPackage?.name}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.25rem' }}>Total Amount</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                          ₹{selectedPackage?.earlyBirdEnabled && (selectedPackage?.earlyBirdSoldCount || 0) < (selectedPackage?.earlyBirdCapacity || 0) ? selectedPackage?.earlyBirdPrice : selectedPackage?.price}
                        </div>
                        {selectedPackage?.earlyBirdEnabled && (selectedPackage?.earlyBirdSoldCount || 0) < (selectedPackage?.earlyBirdCapacity || 0) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-gold)', fontWeight: 600, marginTop: '4px', textAlign: 'right' }}>Early Bird Applied</div>
                        )}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid rgba(212,175,55,0.2)' }}>
                      <div 
                        className="terms-row" 
                        style={{ 
                          marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                          animation: shakeTerms ? 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : 'none',
                          color: shakeTerms ? '#ef4444' : 'inherit'
                        }}
                      >
                        <input type="checkbox" id="terms" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} style={{ marginTop: '4px' }} />
                        <label htmlFor="terms" style={{ color: shakeTerms ? '#ef4444' : 'rgba(255,255,255,0.9)', fontSize: '0.85rem', lineHeight: 1.4, transition: 'color 0.2s' }}>
                          I verify that all information is accurate and matches physical IDs. I agree to the <a href="#" style={{color: 'var(--color-gold)', textDecoration: 'underline'}}>Terms of Entry</a>.
                        </label>
                      </div>

                      {error && <div className="error-msg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#ef4444', marginBottom: '1rem', fontSize: '0.85rem' }}><AlertCircle size={16} /> {error}</div>}

                      <div className="btn-row">
                        <button onClick={() => { setStep(2); setCurrentParticipantIndex(participants.length - 1); }} disabled={submitting} className="btn-secondary">Edit Details</button>
                        <button 
                          className="btn-primary" 
                          disabled={submitting} 
                          onClick={() => {
                            if (!termsAccepted) {
                              setShakeTerms(true);
                              setTimeout(() => setShakeTerms(false), 500);
                              return;
                            }
                            handleSubmitRegistration();
                          }}
                        >
                          {submitting ? 'Processing...' : 'Confirm & Pay Instantly'}
                        </button>
                      </div>
                    </div>

                    <div className="grid-2">
                      {participants.map((p, idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Person {idx + 1}</div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>Full Name</div>
                              <div style={{ fontSize: '0.85rem' }}>{p.fullName}</div>
                            </div>
                            
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>Gender</div>
                              <div style={{ fontSize: '0.85rem' }}>{p.gender}</div>
                            </div>
                          </div>

                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>College</div>
                            <div style={{ fontSize: '0.85rem' }}>{p.collegeId === 'OTHER' ? p.otherCollegeName : colleges?.find(c => c.id === p.collegeId)?.name}</div>
                          </div>

                          {p.isJspmHostel === 'Yes' && (
                            <div style={{ marginBottom: '0.5rem', background: 'rgba(212,175,55,0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                              <div style={{ fontSize: '0.8rem', color: 'var(--color-gold)' }}>JSPM Hostel Details</div>
                              <div style={{ fontSize: '0.95rem' }}>Building: {p.hostelBuilding} • Room: {p.hostelRoom}</div>
                            </div>
                          )}

                          {Object.keys(p).filter(k => k.startsWith('custom_') && p[k]).map(key => {
                            const fieldId = key.replace('custom_', '');
                            const fieldDef = colleges?.find(c => c.id === p.collegeId)?.customFields?.find(f => f.id === fieldId);
                            if (!fieldDef) return null;
                            
                            if (fieldDef.type === 'image_upload') {
                              return (
                                <div key={key} style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
                                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.25rem' }}>{fieldDef.label}</div>
                                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {p[key].map((file, i) => (
                                      <div key={i} style={{ width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        {file.type?.startsWith('image/') ? (
                                          <img src={URL.createObjectURL(file)} alt="Uploaded file" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)' }}>PDF</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }

                            const displayValue = typeof p[key] === 'boolean' ? (p[key] ? 'Yes' : 'No') : p[key];
                            return (
                              <div key={key} style={{ marginBottom: '0.25rem' }}>
                                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{fieldDef.label}: </span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-ivory)' }}>{displayValue}</span>
                              </div>
                            );
                          })}

                          {p.collegeIdFiles && p.collegeIdFiles.length > 0 && (
                            <div style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
                              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.25rem' }}>Student ID / College ID</div>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {p.collegeIdFiles.map((file, i) => (
                                  <div key={i} style={{ width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    {file.type?.startsWith('image/') ? (
                                      <img src={URL.createObjectURL(file)} alt="College ID" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)' }}>PDF</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Step>
            </Stepper>
          )}
        </div>
      </div>
    </div>
  );
}
