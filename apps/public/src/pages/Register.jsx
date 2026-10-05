import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, auth, functions, storage } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Upload, AlertCircle, Package, User, Building, FileText, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';
import { useFirebaseData } from '../../../../shared/hooks/useFirebaseData.js';
import { useNavigate } from 'react-router-dom';
import Stepper, { Step } from '../components/Stepper/Stepper.jsx';
import ParticipantUploads from '../components/ui/ParticipantUploads.jsx';
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
  
  // Array of participant objects
  const [participants, setParticipants] = useState([]);
  const [currentParticipantIndex, setCurrentParticipantIndex] = useState(0);
  
  // Documents state
  const [files, setFiles] = useState([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [registrationResult, setRegistrationResult] = useState(null);
  const [error, setError] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
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



  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
    const count = pkg.participantCount || 1;
    // Initialize participants array based on package
    const initialParticipants = Array.from({ length: count }, () => ({ fullName: '', gender: '' }));
    setParticipants(initialParticipants);
    setFiles(Array(count).fill(null));
  };

  const handleParticipantChange = (field, value) => {
    const newParts = [...participants];
    newParts[currentParticipantIndex] = { ...newParts[currentParticipantIndex], [field]: value };
    setParticipants(newParts);
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

  const handleSubmitRegistration = async () => {
    setSubmitting(true);
    setError(null);
    const toastId = toast.loading('Creating your order...', 'Please do not close this window');
    try {
      // 1. Create Registration (Status becomes VERIFIED instantly)
      // Strip File objects from payload to avoid httpsCallable crash
      const cleanedParticipants = participants.map(p => {
        const cleaned = {};
        for (const [key, value] of Object.entries(p)) {
          if (Array.isArray(value) && value.length > 0 && (value[0] instanceof File)) continue;
          cleaned[key] = value;
        }
        // Ensure fullName exists to satisfy live backend validation before it gets updated
        if (!cleaned.fullName) {
          cleaned.fullName = cleaned.custom_name || cleaned.custom_full_name || "Participant";
        }
        return cleaned;
      });

      const createRegistration = httpsCallable(functions, 'createRegistration');
      const regResponse = await createRegistration({
        packageId: selectedPackage.id,
        collegeId: selectedCollege,
        type: selectedPackage.type,
        participants: cleanedParticipants,
        formFields: {}
      });
      
      const regId = regResponse.data.registrationId;
      setRegistrationResult(regResponse.data);

      // 2. Create Payment Order
      const createOrder = httpsCallable(functions, 'createPaymentOrder');
      const orderResponse = await createOrder({ registrationId: regId });
      const orderData = orderResponse.data;

      toast.dismiss(toastId);

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
          try {
            // 4. Verify Payment
            const verifyPayment = httpsCallable(functions, 'verifyPayment');
            await verifyPayment({
              paymentId: orderData.paymentId,
              gatewayPaymentId: response.razorpay_payment_id,
              gatewaySignature: response.razorpay_signature
            });

            toast.update(verifyingToast, 'loading', 'Uploading Documents...', 'Please wait...');
            await handleUploadAndSubmit(regId);

            const generatePass = httpsCallable(functions, 'generatePass');
            await generatePass({ registrationId: regId });

            toast.update(verifyingToast, 'success', 'Payment Successful!', 'Redirecting to your dashboard...');
            window.location.href = '/account';
          } catch (err) {
            console.error("Verification failed", err);
            toast.update(verifyingToast, 'error', 'Payment Failed', normalizeError(err));
            setError("Payment verification failed. Please contact support.");
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: function() {
            setSubmitting(false);
            toast.info('Payment Cancelled');
            window.location.href = '/account'; 
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

  const handleUploadAndSubmit = async (regId) => {
    try {
      const uid = user.uid;
      const documents = [];
      
      for (let i = 0; i < participants.length; i++) {
        const p = participants[i];
        for (const [key, value] of Object.entries(p)) {
          if (Array.isArray(value) && value.length > 0 && value[0] && value[0].size && value[0].type) {
            for (let j = 0; j < value.length; j++) {
              const file = value[j];
              const path = `participants/${uid}/verification/${regId}_p${i+1}_${key}_${Date.now()}_${file.name}`;
              const fileRef = ref(storage, path);
              await uploadBytesResumable(fileRef, file);
              const downloadUrl = await getDownloadURL(fileRef);
              documents.push({
                participantIndex: i,
                fieldId: key,
                filename: file.name,
                contentType: file.type,
                size: file.size,
                path: path,
                url: downloadUrl
              });
            }
          }
        }
      }
      
      const submitRegistration = httpsCallable(functions, 'submitRegistration');
      await submitRegistration({ registrationId: regId, documents });
    } catch (err) {
      console.error("Submission failed", err);
      throw err;
    }
  };



  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = '/account';
    }
  }, [user, authLoading]);
  if (authLoading) {
    return (
      <div className="register-page app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ color: 'var(--color-ivory)', fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '4px' }}>
          RANGTAL
        </motion.div>
      </div>
    );
  }



  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="register-page app-container">
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
                      {packages.map(pkg => (
                        <div 
                          key={pkg.id} 
                          className={`package-row ${selectedPackage?.id === pkg.id ? 'selected' : ''}`}
                          onClick={() => handlePackageSelect(pkg)}
                        >
                          <div className="pkg-info">
                            <div className="pkg-name">
                              {pkg.name} <span className="badge">{pkg.type}</span>
                            </div>
                            <div className="pkg-desc">
                              {pkg.participantCount} Participant{pkg.participantCount > 1 ? 's' : ''} • {pkg.description.substring(0, 40)}{pkg.description.length > 40 ? '...' : ''}
                            </div>
                          </div>
                          <div className="pkg-price-wrap">
                            <div className="pkg-price">₹{pkg.price}</div>
                          </div>
                        </div>
                      ))}
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
                    <div className="badge">
                      PERSON {currentParticipantIndex + 1} OF {participants.length}
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

                  {currentParticipantIndex === 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="text-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Building size={14} /> Select Your College
                        </label>
                        <select disabled={colLoading} className="form-select" value={selectedCollege} onChange={(e) => setSelectedCollege(e.target.value)}>
                          <option value="" disabled>{colLoading ? 'Loading Colleges...' : 'Select College / Institution...'}</option>
                          {colleges && colleges.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: '1rem' }}>
                    {/* Dynamic Custom Fields based on College */}
                    {selectedCollege && colleges?.find(c => c.id === selectedCollege)?.customFields?.map(field => {
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
                            <select className="form-select" value={value} onChange={e => handleParticipantChange(`custom_${field.id}`, e.target.value)}>
                              <option value="" disabled>Select an option...</option>
                              {(field.options || []).map((opt, i) => (
                                <option key={i} value={opt}>{opt}</option>
                              ))}
                            </select>
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
                  </div>

                  <div className="btn-row" style={{ marginTop: '2rem' }}>
                    <button onClick={prevParticipant} className="btn-secondary">Back</button>
                    <button 
                      disabled={
                        (currentParticipantIndex === 0 && !selectedCollege) || 
                        (colleges?.find(c => c.id === selectedCollege)?.customFields?.some(f => {
                          if (!f.required) return false;
                          const val = participants[currentParticipantIndex]?.[`custom_${f.id}`];
                          if (Array.isArray(val)) return val.length === 0;
                          return !val;
                        }))
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
                        <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>₹{selectedPackage?.price}</div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.25rem' }}>College</div>
                      <div style={{ fontSize: '1rem' }}>{colleges?.find(c => c.id === selectedCollege)?.name}</div>
                    </div>

                    <div className="grid-2">
                      {participants.map((p, idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Person {idx + 1}</div>
                          {Object.keys(p).filter(k => k.startsWith('custom_') && p[k]).map(key => {
                            const fieldId = key.replace('custom_', '');
                            const fieldDef = colleges?.find(c => c.id === selectedCollege)?.customFields?.find(f => f.id === fieldId);
                            if (!fieldDef || fieldDef.type === 'image_upload') return null;
                            const displayValue = typeof p[key] === 'boolean' ? (p[key] ? 'Yes' : 'No') : p[key];
                            return (
                              <div key={key} style={{ marginBottom: '0.25rem' }}>
                                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{fieldDef.label}: </span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-ivory)' }}>{displayValue}</span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="terms-row" style={{ marginTop: '1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <input type="checkbox" id="terms" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} style={{ marginTop: '4px' }} />
                    <label htmlFor="terms" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', lineHeight: 1.4 }}>
                      I verify that all information is accurate and matches physical IDs. I agree to the <a href="#" style={{color: '#ffffff', textDecoration: 'underline'}}>Terms of Entry</a>.
                    </label>
                  </div>

                  {error && <div className="error-msg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#ef4444', marginBottom: '1.5rem' }}><AlertCircle size={18} /> {error}</div>}

                  <div className="btn-row">
                    <button onClick={() => { setStep(2); setCurrentParticipantIndex(participants.length - 1); }} disabled={submitting} className="btn-secondary">Edit Details</button>
                    <button className="btn-primary" disabled={!termsAccepted || submitting} onClick={handleSubmitRegistration}>
                      {submitting ? 'Processing...' : 'Confirm & Pay Instantly'}
                    </button>
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
