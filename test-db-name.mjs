import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD_cFAU-H7soRuHKCBToQUvPulyzIFU3BA',
  authDomain: 'rhythm-rebel.firebaseapp.com',
  projectId: 'rhythm-rebel',
  storageBucket: 'rhythm-rebel.firebasestorage.app',
  messagingSenderId: '1007937336427',
  appId: '1:1007937336427:web:14cecf3cf7f6c28af3ad2e'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testRules() {
  const ref = doc(db, 'eventSettings', 'global');
  try {
    const snap = await getDoc(ref);
    console.log('SUCCESS: Rules allowed read (snap exists:', snap.exists(), ')');
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}

testRules();
