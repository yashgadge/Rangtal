import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { db, auth, functions, storage } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Upload, AlertCircle, Package, User, Building, FileText, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';
import { useFirebaseData } from '../../../../shared/hooks/useFirebaseData.js';
import Stepper, { Step } from '../components/Stepper/Stepper.jsx';
import './Register.css';

export default function Register() {
  const toast = useToast();
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

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success('Signed in successfully');
    } catch (error) {
      console.error("Error signing in", error);
      toast.error('Sign In Failed', normalizeError(error));
    }
  };

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
    if (selectedPackage?.type === 'COUPLE' && currentParticipantIndex === 1) {
      const genders = [participants[0].gender, participants[1].gender];
      if (!genders.includes('M') || !genders.includes('F')) {
        toast.warning('Invalid Participants', "A Couple Pass requires exactly one Male and one Female participant.");
        return;
      }
    }

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
    const toastId = toast.loading('Saving details...', 'Please do not close this window');
    try {
      const createRegistration = httpsCallable(functions, 'createRegistration');
      
      const response = await createRegistration({
        packageId: selectedPackage.id,
        collegeId: selectedCollege,
        type: selectedPackage.type,
        participants: participants,
        formFields: {}
      });
      
      setRegistrationResult(response.data);
      toast.update(toastId, 'success', 'Details Saved', 'Proceed to document upload');
      setStep(4);
    } catch (err) {
      console.error("Registration failed", err);
      const msg = normalizeError(err);
      setError(msg);
      toast.update(toastId, 'error', 'Save Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadAndSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const toastId = toast.loading('Uploading documents...', 'This may take a moment');
    try {
      const regId = registrationResult.registrationId;
      const uid = user.uid;
      const documents = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        
        const path = `participants/${uid}/verification/${regId}_p${i+1}_${file.name}`;
        const fileRef = ref(storage, path);
        await uploadBytesResumable(fileRef, file);
        documents.push({
          participantIndex: i,
          filename: file.name,
          contentType: file.type,
          size: file.size,
          path: path
        });
      }
      
      const submitRegistration = httpsCallable(functions, 'submitRegistration');
      await submitRegistration({ registrationId: regId, documents });
      
      toast.update(toastId, 'success', 'Registration Complete', 'Your documents are under review');
      setStep(5);
    } catch (err) {
      console.error("Submission failed", err);
      const msg = normalizeError(err);
      setError(msg);
      toast.update(toastId, 'error', 'Upload Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };




  if (authLoading) {
    return (
      <div className="register-page app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-heading)', fontSize: '2rem', letterSpacing: '4px' }}>
          RANGTAL
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="register-page app-container">
        <div className="content-layer">
          <div className="register-container register-container-sm" style={{ padding: '3rem 2rem' }}>
            <h1 className="text-title" style={{ fontFamily: 'var(--font-heading)' }}>Join the Celebration</h1>
            <p className="text-body" style={{ marginBottom: '3rem' }}>Sign in to register for passes and manage your bookings.</p>
            <button onClick={handleLogin} className="btn-primary" style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="register-page app-container">
      <div className="content-layer">
        
        <div className="register-container">
          <div className="header-row" style={{ marginBottom: '1rem' }}>
            <h1 className="text-title" style={{ fontFamily: 'var(--font-heading)', margin: 0, fontSize: '2rem' }}>Registration</h1>
            <button onClick={() => { signOut(auth); toast.info('Signed out'); }} className="logout-btn">Cancel</button>
          </div>
          
          {step < 5 ? (
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
                    <div className="grid-2" style={{ marginTop: '2rem' }}>
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', animation: 'pulse 1.5s infinite ease-in-out' }}>
                          <div style={{ height: '24px', width: '60%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '1rem' }} />
                          <div style={{ height: '40px', width: '40%', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', marginBottom: '1rem' }} />
                          <div style={{ height: '14px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '0.5rem' }} />
                          <div style={{ height: '14px', width: '80%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
                        </div>
                      ))}
                    </div>
                  ) : packages && packages.length > 0 ? (
                    <div className="grid-2" style={{ marginTop: '2rem' }}>
                      {packages.map(pkg => (
                        <div 
                          key={pkg.id} 
                          className={`card-pkg ${selectedPackage?.id === pkg.id ? 'selected' : ''}`}
                          onClick={() => handlePackageSelect(pkg)}
                          style={{
                            background: selectedPackage?.id === pkg.id ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${selectedPackage?.id === pkg.id ? 'var(--color-gold)' : 'rgba(255,255,255,0.1)'}`,
                            padding: '2rem',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1.5rem', margin: 0, color: selectedPackage?.id === pkg.id ? 'var(--color-gold)' : 'white' }}>{pkg.name}</h3>
                            <div className="badge badge-neutral" style={{ background: 'rgba(255,255,255,0.1)' }}>{pkg.type}</div>
                          </div>
                          <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>₹{pkg.price}</div>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>{pkg.description}</p>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>{pkg.participantCount} Participant{pkg.participantCount > 1 ? 's' : ''}</div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 className="text-subtitle" style={{ margin: 0 }}>Participant Details</h2>
                    <div className="badge badge-neutral" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', color: 'var(--color-gold)', background: 'rgba(255,215,0,0.1)' }}>
                      PERSON {currentParticipantIndex + 1} OF {participants.length}
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginBottom: '2rem', overflow: 'hidden' }}>
                    <motion.div 
                      initial={{ width: `${(currentParticipantIndex / participants.length) * 100}%` }}
                      animate={{ width: `${((currentParticipantIndex + 1) / participants.length) * 100}%` }}
                      style={{ height: '100%', background: 'var(--color-gold)' }}
                    />
                  </div>

                  {currentParticipantIndex === 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="text-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
                          <Building size={16} color="var(--color-gold)" /> Select Your College
                        </label>
                        <select disabled={colLoading} className="form-select" value={selectedCollege} onChange={(e) => setSelectedCollege(e.target.value)} style={{ marginTop: '1rem', padding: '1rem', fontSize: '1rem' }}>
                          <option value="" disabled>{colLoading ? 'Loading Colleges...' : 'Select College / Institution...'}</option>
                          {colleges && colleges.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--color-gold)' }}>Profile Information</h3>
                    <div className="form-group">
                      <label className="text-label">Full Name</label>
                      <input type="text" className="form-input" value={participants[currentParticipantIndex]?.fullName || ''} onChange={(e) => handleParticipantChange('fullName', e.target.value)} placeholder="As per ID" />
                    </div>
                    <div className="form-group">
                      <label className="text-label">Gender</label>
                      <select className="form-select" value={participants[currentParticipantIndex]?.gender || ''} onChange={(e) => handleParticipantChange('gender', e.target.value)}>
                        <option value="" disabled>Select...</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                        <option value="O">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="btn-row" style={{ marginTop: '2rem' }}>
                    <button onClick={prevParticipant} className="btn-secondary">Back</button>
                    <button 
                      disabled={(currentParticipantIndex === 0 && !selectedCollege) || !participants[currentParticipantIndex]?.fullName || !participants[currentParticipantIndex]?.gender}
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
                  
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Package</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{selectedPackage?.name}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Total Amount</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-gold)' }}>₹{selectedPackage?.price}</div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>College</div>
                      <div style={{ fontSize: '1.1rem' }}>{colleges?.find(c => c.id === selectedCollege)?.name}</div>
                    </div>

                    <div className="grid-2">
                      {participants.map((p, idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-gold)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Person {idx + 1}</div>
                          <div style={{ fontSize: '1.1rem' }}>{p.fullName}</div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Gender: {p.gender}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="terms-row" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                    <input type="checkbox" id="terms" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
                    <label htmlFor="terms" style={{ color: 'var(--text-secondary)' }}>
                      I verify that all information is accurate and matches physical IDs. I agree to the <a href="#" style={{color: 'var(--color-gold)'}}>Terms of Entry</a>.
                    </label>
                  </div>

                  {error && <div className="error-msg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#ef4444', marginBottom: '1.5rem' }}><AlertCircle size={18} /> {error}</div>}

                  <div className="btn-row">
                    <button onClick={() => { setStep(2); setCurrentParticipantIndex(participants.length - 1); }} disabled={submitting} className="btn-secondary">Edit Details</button>
                    <button className="btn-primary" disabled={!termsAccepted || submitting} onClick={handleSubmitRegistration}>
                      {submitting ? 'Processing...' : 'Confirm Registration'}
                    </button>
                  </div>
                </div>
              </Step>

              <Step>
                <div>
                  <h2 className="text-subtitle">ID Verification Upload</h2>
                  <p className="text-body" style={{ marginBottom: '2rem' }}>Please upload clear photos or PDFs of the college ID / Govt ID for all participants.</p>
                  
                  <div className="grid-2" style={{ marginTop: '1rem' }}>
                    {participants.map((p, idx) => (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.2)', textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--color-gold)' }}>Person {idx + 1}: {p.fullName}</h3>
                        <label style={{ display: 'block', padding: '1.5rem', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                          <Upload size={32} color={files[idx] ? 'var(--color-success)' : 'var(--text-muted)'} style={{ margin: '0 auto 1rem' }} />
                          <span style={{ display: 'block', color: files[idx] ? 'var(--color-success)' : 'white' }}>{files[idx] ? files[idx].name : 'Select File'}</span>
                          <input type="file" onChange={(e) => {
                            const newFiles = [...files];
                            newFiles[idx] = e.target.files[0];
                            setFiles(newFiles);
                          }} style={{ display: 'none' }} accept="image/*,.pdf" />
                        </label>
                      </div>
                    ))}
                  </div>
                  
                  {error && <div className="error-msg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#ef4444', marginTop: '1.5rem' }}><AlertCircle size={18} /> {error}</div>}

                  <div className="btn-row btn-row-right" style={{ marginTop: '2rem' }}>
                    <button 
                      className="btn-primary"
                      disabled={submitting || files.some(f => !f)}
                      onClick={handleUploadAndSubmit}
                    >
                      {submitting ? 'Uploading Documents...' : 'Submit Documents'}
                    </button>
                  </div>
                </div>
              </Step>
            </Stepper>
          ) : step === 5 ? (
            <div style={{ position: 'relative', minHeight: '400px' }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
                    <CheckCircle2 size={80} color="var(--color-success)" style={{ margin: '0 auto 2rem' }} />
                  </motion.div>
                  <h2 className="text-title" style={{ fontFamily: 'var(--font-heading)', color: 'white', marginBottom: '1rem' }}>Registration Submitted!</h2>
                  <p className="text-body" style={{ fontSize: '1.1rem' }}>Your registration ID is <br/><span style={{ color: 'var(--color-gold)', fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace', display: 'inline-block', marginTop: '0.5rem' }}>{registrationResult.registrationId}</span></p>
                  
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '16px', maxWidth: '500px', margin: '0 auto 3rem' }}>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                      Your documents have been submitted to the review queue. You can track verification status for each member in your account dashboard.
                    </p>
                  </div>
                  
                  <button onClick={() => window.location.href = "/account"} className="btn-primary" style={{ padding: '1rem 3rem' }}>
                    Go to Dashboard
                  </button>
                </motion.div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
