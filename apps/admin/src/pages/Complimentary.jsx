import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../firebase';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DetailDrawer from '../components/DetailDrawer';
import { Plus, QrCode, X, AlertTriangle, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useToast } from '../../../../shared/ui/Toast/ToastProvider.jsx';
import { normalizeError } from '../../../../shared/utils/errorNormalization.js';
import { motion, AnimatePresence } from 'framer-motion';

export default function Complimentary() {
  const toast = useToast();
  const [passes, setPasses] = useState([]);
  const [participantsMap, setParticipantsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPass, setSelectedPass] = useState(null);
  const [packages, setPackages] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [downloading, setDownloading] = useState(false);

  const downloadPassPDF = async (pass) => {
    setDownloading(true);
    try {
      const element = document.getElementById(`comp-pass-render-${pass.id}`);
      if (!element) return;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#1A050B' });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Rangtal_Pass_${pass.readableId || pass.id.slice(0,6)}.pdf`);
    } catch (err) {
      console.error(err);
      toast.error('Download failed', err.message);
    } finally {
      setDownloading(false);
    }
  };

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    gender: 'Male',
    packageId: '',
    collegeId: '',
    isJspmHostel: 'false',
    hostelBuilding: '',
    hostelRoom: ''
  });

  const fetchFormData = async () => {
    try {
      const snap = await getDocs(collection(db, 'packages'));
      setPackages(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.active));
      
      const snapC = await getDocs(collection(db, 'colleges'));
      setColleges(snapC.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPasses = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'passes'), where('isComplimentary', '==', true));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setPasses(docs);
      
      const pSnap = await getDocs(query(collection(db, 'participants'), where('isComplimentary', '==', true)));
      const pMap = {};
      pSnap.docs.forEach(d => { pMap[d.id] = d.data(); });
      setParticipantsMap(pMap);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load complimentary passes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFormData();
    fetchPasses();
  }, []);

  const handleCreate = async () => {
    if (!form.fullName || !form.packageId) return;
    setIsSubmitting(true);
    const toastId = toast.loading('Generating complimentary pass...');
    try {
      const fn = httpsCallable(functions, 'adminCreateOnSpotRegistration');
      const res = await fn({
        fullName: form.fullName,
        email: form.email,
        mobile: form.mobile,
        gender: form.gender,
        packageId: form.packageId,
        paymentMethod: 'COMPLIMENTARY'
      });
      
      const regId = res.data.registrationId;
      
      // Immediately flag them as complimentary so they hide from main lists
      await updateDoc(doc(db, 'registrations', regId), { isComplimentary: true });
      
      const partsQ = query(collection(db, 'participants'), where('registrationId', '==', regId));
      const partsSnap = await getDocs(partsQ);
      for (const pDoc of partsSnap.docs) {
        await updateDoc(doc(db, 'participants', pDoc.id), { 
          isComplimentary: true,
          collegeId: form.collegeId || 'OTHER',
          isJspmHostel: form.isJspmHostel,
          hostelBuilding: form.hostelBuilding,
          hostelRoom: form.hostelRoom
        });
      }
      
      const passesQ = query(collection(db, 'passes'), where('registrationId', '==', regId));
      const passesSnap = await getDocs(passesQ);
      for (const passDoc of passesSnap.docs) {
        await updateDoc(doc(db, 'passes', passDoc.id), { isComplimentary: true });
      }

      toast.update(toastId, 'success', 'Complimentary pass generated successfully!');
      
      setShowModal(false);
      setForm({ fullName: '', email: '', mobile: '', gender: 'Male', packageId: '', collegeId: '', isJspmHostel: 'false', hostelBuilding: '', hostelRoom: '' });
      fetchPasses();
    } catch (error) {
      console.error(error);
      toast.update(toastId, 'error', 'Failed to generate pass');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (passId) => {
    if (!window.confirm("Are you sure you want to revoke this pass? It will no longer be scannable.")) return;
    const toastId = toast.loading('Revoking pass...');
    try {
      await updateDoc(doc(db, 'passes', passId), { status: 'REVOKED' });
      fetchPasses();
      if(selectedPass?.id === passId) {
         setSelectedPass({...selectedPass, status: 'REVOKED'});
      }
      toast.update(toastId, 'success', 'Pass revoked successfully');
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error revoking pass', normalizeError(err));
    }
  };

  const handleDelete = async (passId) => {
    if (!window.confirm("WARNING: Are you sure you want to completely DELETE this pass from the database? This action is irreversible.")) return;
    const toastId = toast.loading('Deleting pass from database...');
    try {
      const pass = selectedPass || passes.find(p => p.id === passId);
      
      // Delete Participant
      if (pass?.participantId) {
        await deleteDoc(doc(db, 'participants', pass.participantId));
      }
      
      // Delete Registration (which is the parent)
      if (pass?.registrationId) {
        await deleteDoc(doc(db, 'registrations', pass.registrationId));
      }
      
      // Delete Pass
      await deleteDoc(doc(db, 'passes', passId));

      toast.update(toastId, 'success', 'Pass completely deleted');
      setSelectedPass(null);
      fetchPasses();
    } catch (err) {
      console.error(err);
      toast.update(toastId, 'error', 'Error deleting pass', normalizeError(err));
    }
  };

  const columns = [
    { header: "Pass ID", accessorKey: "readableId" },
    { header: "Name", cell: (r) => participantsMap[r.participantId]?.fullName || 'Unknown' },
    { header: "Mobile", cell: (r) => participantsMap[r.participantId]?.mobile || 'N/A' },
    { header: "Package", cell: (r) => participantsMap[r.participantId]?.passType || r.type },
    { header: "Status", cell: (r) => <span className={`badge ${r.status === 'ACTIVE' ? 'badge-success' : 'badge-error'}`}>{r.status}</span> },
    { header: "Check-in", cell: (r) => {
      const p = participantsMap[r.participantId];
      const isCheckedIn = p?.checkInStatus === 'CHECKED_IN';
      return <span className={`badge ${isCheckedIn ? 'badge-success' : 'badge-warning'}`}>{isCheckedIn ? 'Checked In' : 'Pending'}</span>;
    }},
    { 
      header: "QR Code", 
      cell: (r) => (
        <button 
          onClick={(e) => { e.stopPropagation(); setSelectedPass(r); }}
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <QrCode size={14} /> Show QR
        </button>
      )
    }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="Complimentary Passes" 
        description="Generate and manage special VIP/Complimentary passes." 
        actions={
          <button 
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-gold)', color: '#000' }}
          >
            <Plus size={18} />
            Generate Pass
          </button>
        }
      />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={passes} 
          loading={loading}
          showSerial={true}
          onRowClick={(row) => setSelectedPass(row)}
        />
      </div>

      <DetailDrawer 
        isOpen={!!selectedPass} 
        onClose={() => setSelectedPass(null)}
        title="Pass Details & QR Code"
      >
        {selectedPass && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
            <h3 style={{ color: 'var(--color-gold)', margin: 0, textAlign: 'center' }}>{participantsMap[selectedPass.participantId]?.fullName || 'VIP Guest'}</h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0, textAlign: 'center' }}>{selectedPass.readableId}</p>
            
            <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', display: 'inline-block' }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${selectedPass.secureCode}`} 
                alt="QR Code" 
                style={{ width: '250px', height: '250px', display: 'block' }} 
              />
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Share this QR code with the guest. They can show it at the gate to check-in.
            </p>

            <button
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}
              disabled={downloading || !selectedPass.secureCode}
              onClick={() => downloadPassPDF(selectedPass)}
            >
              <Download size={16} /> {downloading ? 'Generating PDF...' : 'Download Pass PDF'}
            </button>

            {/* Hidden render element for PDF generation */}
            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
              <div id={`comp-pass-render-${selectedPass.id}`} style={{ width: '450px', background: '#1A050B', padding: '2.5rem', color: '#FFF5E5', borderRadius: '24px', border: '2px solid #D4AF37', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '8px', background: 'linear-gradient(90deg, #B73568, #D4AF37, #B73568)' }} />
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', borderRadius: '50%', border: '2px dashed rgba(212,175,55,0.2)', opacity: 0.5 }} />
                <div style={{ position: 'absolute', bottom: '-50px', left: '-50px', width: '150px', height: '150px', borderRadius: '50%', border: '2px dashed rgba(212,175,55,0.2)', opacity: 0.5 }} />

                <div style={{ textAlign: 'center', borderBottom: '1px solid rgba(212,175,55,0.3)', paddingBottom: '1.5rem', marginBottom: '2rem', position: 'relative', zIndex: 1 }}>
                  <h2 style={{ fontSize: '2.5rem', color: '#D4AF37', margin: '0 0 0.5rem 0', fontFamily: '"Playfair Display", serif', letterSpacing: '4px' }}>RANGTAAL</h2>
                  <div style={{ fontSize: '0.8rem', letterSpacing: '3px', color: '#E8D5B5', textTransform: 'uppercase', marginBottom: '0.5rem', opacity: 0.9 }}>by Rhythm Rebels</div>
                  <div style={{ fontSize: '0.9rem', letterSpacing: '6px', color: '#B73568', fontWeight: 'bold' }}>2026</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem', position: 'relative', zIndex: 1 }}>
                  <div style={{ background: '#FFF5E5', padding: '1.25rem', borderRadius: '16px', display: 'inline-flex', boxShadow: '0 8px 32px rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.5)' }}>
                    <QRCodeSVG value={selectedPass.secureCode} size={220} bgColor="#FFF5E5" fgColor="#1A050B" level="H" />
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(212,175,55,0.15)', position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', textAlign: 'left' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#E8D5B5', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.25rem', opacity: 0.7 }}>Participant</div>
                      <div style={{ fontSize: '1.25rem', fontFamily: '"Playfair Display", serif', color: '#FFF5E5', fontWeight: 600 }}>{participantsMap[selectedPass.participantId]?.fullName || 'VIP Guest'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#E8D5B5', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.25rem', opacity: 0.7 }}>Pass Type</div>
                      <div style={{ fontSize: '1.25rem', fontFamily: '"Playfair Display", serif', color: '#FFF5E5', fontWeight: 600 }}>{participantsMap[selectedPass.participantId]?.passType || selectedPass.regType || selectedPass.type || 'General'}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed rgba(212,175,55,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#E8D5B5', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.5 }}>Pass ID</div>
                      <div style={{ fontSize: '0.85rem', color: '#D4AF37', fontFamily: 'monospace', letterSpacing: '1px' }}>{selectedPass.readableId || selectedPass.id.slice(0,8).toUpperCase()}</div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#B73568', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }}>ENTRY VALID</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="surface" style={{ padding: '1.25rem', borderColor: 'rgba(198, 40, 40, 0.3)', width: '100%', marginTop: '1rem' }}>
              <h4 style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <AlertTriangle size={18} /> Danger Zone
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Revoking a pass is permanent. Deleting a pass removes it from the database entirely.
              </p>
              <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                {selectedPass.status === 'ACTIVE' && (
                  <button className="btn btn-warning" style={{ flex: 1 }} onClick={() => handleRevoke(selectedPass.id)}>
                    Revoke Pass
                  </button>
                )}
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleDelete(selectedPass.id)}>
                  Delete Completely
                </button>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>

      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.95, y: 20 }}
              className="surface"
              style={{ width: '100%', maxWidth: '400px', borderRadius: '12px', padding: '1.5rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: 'var(--color-gold)' }}>Generate Complimentary Pass</h2>
                <button onClick={() => setShowModal(false)} className="btn btn-icon" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}><X size={20} /></button>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Full Name *</label>
                <input type="text" className="form-input" style={{ width: '100%' }} value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} placeholder="Guest Name" />
              </div>
              
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Mobile (Optional)</label>
                <input type="tel" className="form-input" style={{ width: '100%' }} value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} placeholder="Phone Number" />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Gender</label>
                <select className="form-input" style={{ width: '100%' }} value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Select College *</label>
                <select className="form-input" style={{ width: '100%' }} value={form.collegeId} onChange={e => setForm({...form, collegeId: e.target.value})}>
                  <option value="">-- Choose College --</option>
                  <option value="OTHER">Other College</option>
                  {colleges?.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>JSPM Hostel Student?</label>
                <select className="form-input" style={{ width: '100%' }} value={form.isJspmHostel} onChange={e => setForm({...form, isJspmHostel: e.target.value})}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              
              {form.isJspmHostel === 'true' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Building</label>
                    <input type="text" className="form-input" style={{ width: '100%' }} value={form.hostelBuilding} onChange={e => setForm({...form, hostelBuilding: e.target.value})} placeholder="e.g. A" />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Room</label>
                    <input type="text" className="form-input" style={{ width: '100%' }} value={form.hostelRoom} onChange={e => setForm({...form, hostelRoom: e.target.value})} placeholder="e.g. 101" />
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Select Package *</label>
                <select className="form-input" style={{ width: '100%' }} value={form.packageId} onChange={e => setForm({...form, packageId: e.target.value})}>
                  <option value="">-- Choose Package --</option>
                  {packages?.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>
                  ))}
                </select>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '0.75rem', background: 'var(--color-gold)', color: '#000' }} 
                disabled={isSubmitting || !form.fullName || !form.packageId || !form.collegeId}
                onClick={handleCreate}
              >
                {isSubmitting ? 'Generating...' : 'Generate Pass'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
