import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD_cFAU-H7soRuHKCBToQUvPulyzIFU3BA",
  authDomain: "rhythm-rebel.firebaseapp.com",
  projectId: "rhythm-rebel",
  storageBucket: "rhythm-rebel.firebasestorage.app",
  messagingSenderId: "1007937336427",
  appId: "1:1007937336427:web:14cecf3cf7f6c28af3ad2e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testLiveDb() {
  const ref = doc(db, 'eventSettings', 'global');
  const snap = await getDoc(ref);
  console.log("Current Data:", snap.data());
  
  // Safe update: Add a test timestamp
  await updateDoc(ref, {
    lastVerifiedByDev: new Date().toISOString()
  });
  
  const snap2 = await getDoc(ref);
  console.log("Updated Data:", snap2.data());
}

testLiveDb().catch(console.error);
