import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { db, auth, functions, storage } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Upload, AlertCircle, Package, User, Building, FileText, CheckCircle2 } from 'lucide-react';
import './Register.css';

const STEPS = [
  { id: 1, label: 'Package', icon: Package },
  { id: 2, label: 'Details', icon: User },
  { id: 3, label: 'Review', icon: CheckCircle2 },
  { id: 4, label: 'Documents', icon: FileText },
];

export default function Register() {
  const [user, setUser] = useState(null);
  const [packages, setPackages] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [step, setStep] = useState(1);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedCollege, setSelectedCollege] = useState('');
  
  const [participant1, setParticipant1] = useState({ fullName: '', gender: '' });
  const [participant2, setParticipant2] = useState({ fullName: '', gender: '' });
  
  const [submitting, setSubmitting] = useState(false);
  const [registrationResult, setRegistrationResult] = useState(null);
  const [error, setError] = useState(null);

  // Upload State
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadData();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const pkgSnap = await getDocs(query(collection(db, 'packages'), where('active', '==', true)));
      const colSnap = await getDocs(query(collection(db, 'colleges'), where('verified', '==', true)));
      
      setPackages(pkgSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setColleges(colSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error loading registration data", err);
    } finally {
      setLoading(false);
    }
  }

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in", error);
    }
  };

  const handleSubmitRegistration = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const createRegistration = httpsCallable(functions, 'createRegistration');
      
      const participants = [participant1];
      if (selectedPackage.type === 'COUPLE') {
        participants.push(participant2);
      }

      const response = await createRegistration({
        packageId: selectedPackage.id,
        collegeId: selectedCollege,
        type: selectedPackage.type || (participants.length > 1 ? 'COUPLE' : 'SINGLE'),
        participants: participants,
        formFields: {}
      });
      
      setRegistrationResult(response.data);
      setStep(4);
    } catch (err) {
      console.error("Registration failed", err);
      setError(err.message || "An error occurred while creating registration.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadAndSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const regId = registrationResult.registrationId;
      const uid = user.uid;
      const documents = [];
      
      if (file1) {
        const path = `participants/${uid}/verification/${regId}_p1_${file1.name}`;
        const fileRef = ref(storage, path);
        await uploadBytesResumable(fileRef, file1);
        documents.push({
          participantIndex: 0,
          filename: file1.name,
          contentType: file1.type,
          size: file1.size,
          path: path
        });
      }
      
      if (selectedPackage?.type === 'COUPLE' && file2) {
        const path2 = `participants/${uid}/verification/${regId}_p2_${file2.name}`;
        const fileRef2 = ref(storage, path2);
        await uploadBytesResumable(fileRef2, file2);
        documents.push({
          participantIndex: 1,
          filename: file2.name,
          contentType: file2.type,
          size: file2.size,
          path: path2
        });
      }
      
      const submitRegistration = httpsCallable(functions, 'submitRegistration');
      await submitRegistration({ registrationId: regId, documents });
      
      setStep(5);
    } catch (err) {
      console.error("Submission failed", err);
      setError(err.message || "Failed to submit documents and finalize registration.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="step-indicator">
      {STEPS.map((s, i) => {
        const isActive = s.id === step;
        const isCompleted = s.id < step;
        const Icon = s.icon;
        
        return (
          <div key={s.id} className="step-item">
            <div className={`step-circle ${isActive ? 'active' : isCompleted ? 'completed' : ''}`}>
              {isCompleted ? <Check size={16} /> : <Icon size={16} />}
            </div>
            <span className={`step-label ${isActive || isCompleted ? 'active-text' : ''}`}>{s.label}</span>
            {i < STEPS.length - 1 && <div className={`step-line ${isCompleted ? 'completed-line' : ''}`} />}
          </div>
        );
      })}
    </div>
  );

  const pageTransition = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { duration: 0.3 }
  };

  if (loading) {
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
            <button onClick={() => signOut(auth)} className="logout-btn">Cancel</button>
          </div>
          
          {step < 5 && renderStepIndicator()}

          <div style={{ position: 'relative', minHeight: '400px' }}>
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" {...pageTransition}>
                  <h2 className="text-subtitle">Select a Package</h2>
                  {packages.length === 0 ? (
                    <p className="text-body">No packages are currently available.</p>
                  ) : (
                    <div className="grid-2" style={{ marginTop: '2rem' }}>
                      {packages.map(pkg => (
                        <div 
                          key={pkg.id} 
                          className={`card-pkg ${selectedPackage?.id === pkg.id ? 'selected' : ''}`}
                          onClick={() => setSelectedPackage(pkg)}
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
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pkg.capacity - (pkg.soldCount || 0)} spots remaining</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="btn-row btn-row-right">
                    <button disabled={!selectedPackage} onClick={() => setStep(2)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Continue <ChevronRight size={18} />
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" {...pageTransition}>
                  <h2 className="text-subtitle">Participant Details</h2>
                  
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="text-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
                        <Building size={16} color="var(--color-gold)" /> Select Your College
                      </label>
                      <select className="form-select" value={selectedCollege} onChange={(e) => setSelectedCollege(e.target.value)} style={{ marginTop: '1rem', padding: '1rem', fontSize: '1rem' }}>
                        <option value="" disabled>Select College / Institution...</option>
                        {colleges.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--color-gold)' }}>Participant 1</h3>
                      <div className="form-group">
                        <label className="text-label">Full Name</label>
                        <input type="text" className="form-input" value={participant1.fullName} onChange={(e) => setParticipant1({...participant1, fullName: e.target.value})} placeholder="As per ID" />
                      </div>
                      <div className="form-group">
                        <label className="text-label">Gender</label>
                        <select className="form-select" value={participant1.gender} onChange={(e) => setParticipant1({...participant1, gender: e.target.value})}>
                          <option value="" disabled>Select...</option>
                          <option value="M">Male</option>
                          <option value="F">Female</option>
                          <option value="O">Other</option>
                        </select>
                      </div>
                    </div>

                    {selectedPackage?.type === 'COUPLE' && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--color-gold)' }}>Participant 2</h3>
                        <div className="form-group">
                          <label className="text-label">Full Name</label>
                          <input type="text" className="form-input" value={participant2.fullName} onChange={(e) => setParticipant2({...participant2, fullName: e.target.value})} placeholder="As per ID" />
                        </div>
                        <div className="form-group">
                          <label className="text-label">Gender</label>
                          <select className="form-select" value={participant2.gender} onChange={(e) => setParticipant2({...participant2, gender: e.target.value})}>
                            <option value="" disabled>Select...</option>
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                            <option value="O">Other</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="terms-row" style={{ marginTop: '2rem' }}>
                    <input type="checkbox" id="terms" onChange={(e) => {
                      const btn = document.getElementById("review-btn");
                      if (btn) btn.disabled = !e.target.checked;
                    }} />
                    <label htmlFor="terms" style={{ color: 'var(--text-secondary)' }}>
                      I verify that all information is accurate and matches our physical IDs. I agree to the <a href="#" style={{color: 'var(--color-gold)'}}>Terms of Entry</a>.
                    </label>
                  </div>

                  <div className="btn-row">
                    <button onClick={() => setStep(1)} className="btn-secondary">Back</button>
                    <button 
                      id="review-btn" 
                      disabled={!selectedCollege || !participant1.fullName || !participant1.gender || (selectedPackage?.type === 'COUPLE' && (!participant2.fullName || !participant2.gender))}
                      onClick={() => setStep(3)} 
                      className="btn-primary"
                    >
                      Review Registration
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" {...pageTransition}>
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
                      <div style={{ fontSize: '1.1rem' }}>{colleges.find(c => c.id === selectedCollege)?.name}</div>
                    </div>

                    <div className="grid-2">
                      <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Participant 1</div>
                        <div style={{ fontSize: '1.1rem' }}>{participant1.fullName} ({participant1.gender})</div>
                      </div>
                      {selectedPackage?.type === 'COUPLE' && (
                        <div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Participant 2</div>
                          <div style={{ fontSize: '1.1rem' }}>{participant2.fullName} ({participant2.gender})</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {error && <div className="error-msg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#ef4444' }}><AlertCircle size={18} /> {error}</div>}

                  <div className="btn-row">
                    <button onClick={() => setStep(2)} disabled={submitting} className="btn-secondary">Edit Details</button>
                    <button className="btn-primary" disabled={submitting} onClick={handleSubmitRegistration}>
                      {submitting ? 'Processing...' : 'Confirm Details'}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 4 && registrationResult && (
                <motion.div key="step4" {...pageTransition}>
                  <h2 className="text-subtitle">ID Verification Upload</h2>
                  <p className="text-body">Please upload clear photos or PDFs of the college ID / Govt ID for all participants.</p>
                  
                  <div className="grid-2" style={{ marginTop: '2rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.2)', textAlign: 'center' }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--color-gold)' }}>Participant 1: {participant1.fullName}</h3>
                      <label style={{ display: 'block', padding: '2rem', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        <Upload size={32} color={file1 ? 'var(--color-success)' : 'var(--text-muted)'} style={{ margin: '0 auto 1rem' }} />
                        <span style={{ display: 'block', color: file1 ? 'var(--color-success)' : 'white' }}>{file1 ? file1.name : 'Select File'}</span>
                        <input type="file" onChange={(e) => setFile1(e.target.files[0])} style={{ display: 'none' }} accept="image/*,.pdf" />
                      </label>
                    </div>
                    
                    {selectedPackage?.type === 'COUPLE' && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.2)', textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--color-gold)' }}>Participant 2: {participant2.fullName}</h3>
                        <label style={{ display: 'block', padding: '2rem', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                          <Upload size={32} color={file2 ? 'var(--color-success)' : 'var(--text-muted)'} style={{ margin: '0 auto 1rem' }} />
                          <span style={{ display: 'block', color: file2 ? 'var(--color-success)' : 'white' }}>{file2 ? file2.name : 'Select File'}</span>
                          <input type="file" onChange={(e) => setFile2(e.target.files[0])} style={{ display: 'none' }} accept="image/*,.pdf" />
                        </label>
                      </div>
                    )}
                  </div>
                  
                  {error && <div className="error-msg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#ef4444', marginTop: '1.5rem' }}><AlertCircle size={18} /> {error}</div>}

                  <div className="btn-row btn-row-right">
                    <button 
                      className="btn-primary"
                      disabled={submitting || !file1 || (selectedPackage?.type === 'COUPLE' && !file2)}
                      onClick={handleUploadAndSubmit}
                    >
                      {submitting ? 'Uploading Documents...' : 'Submit Registration'}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 5 && (
                <motion.div key="step5" {...pageTransition} style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
                    <CheckCircle2 size={80} color="var(--color-success)" style={{ margin: '0 auto 2rem' }} />
                  </motion.div>
                  <h2 className="text-title" style={{ fontFamily: 'var(--font-heading)', color: 'white', marginBottom: '1rem' }}>Registration Submitted!</h2>
                  <p className="text-body" style={{ fontSize: '1.1rem' }}>Your registration ID is <br/><span style={{ color: 'var(--color-gold)', fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace', display: 'inline-block', marginTop: '0.5rem' }}>{registrationResult.registrationId}</span></p>
                  
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '16px', maxWidth: '500px', margin: '0 auto 3rem' }}>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                      Your documents have been submitted to the review queue. You can track your verification status in your account dashboard. Once verified, you will be able to proceed to payment.
                    </p>
                  </div>
                  
                  <button onClick={() => window.location.href = "/account"} className="btn-primary" style={{ padding: '1rem 3rem' }}>
                    Go to Dashboard
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
