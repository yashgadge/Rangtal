const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function patchVolunteers() {
  console.log("Fetching volunteers...");
  const snapshot = await db.collection("volunteers").get();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const uid = doc.id;
    const permissions = data.permissions || ["SCAN_PASS"];
    
    try {
      const userRecord = await auth.getUser(uid);
      const claims = userRecord.customClaims || {};
      
      console.log(`Updating ${uid} (${data.email}) with permissions: ${permissions.join(", ")}`);
      
      claims.volunteer = true;
      claims.permissions = permissions;
      
      await auth.setCustomUserClaims(uid, claims);
      console.log(`Success: ${uid}`);
    } catch (err) {
      console.error(`Failed to update ${uid}:`, err.message);
    }
  }
  
  console.log("Done.");
}

patchVolunteers();
