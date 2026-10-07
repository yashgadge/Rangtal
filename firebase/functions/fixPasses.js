const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp({ projectId: "rhythm-rebel" });
const db = getFirestore();
const passes = require("./api/passes");

async function fixMissingPasses() {
  console.log("Looking for registrations with PAYMENT_SUCCESS...");
  const snapshot = await db.collection("registrations").where("status", "==", "PAYMENT_SUCCESS").get();
  
  if (snapshot.empty) {
    console.log("No successful registrations found.");
    return;
  }

  console.log(`Found ${snapshot.docs.length} successful registrations. Checking for missing passes...`);
  
  let fixedCount = 0;
  for (const doc of snapshot.docs) {
    const regId = doc.id;
    
    // Check if passes exist for this registration
    const passesSnap = await db.collection("passes").where("registrationId", "==", regId).get();
    
    if (passesSnap.empty) {
      console.log(`Registration ${regId} is missing passes! Generating now...`);
      try {
        await passes._generatePassInternal(regId, "SYSTEM", true);
        console.log(`✅ Successfully generated pass for ${regId}`);
        fixedCount++;
      } catch (err) {
        console.error(`❌ Failed to generate pass for ${regId}:`, err.message);
      }
    } else {
      console.log(`Registration ${regId} already has ${passesSnap.docs.length} pass(es). Skipping.`);
    }
  }
  
  console.log(`Done! Fixed ${fixedCount} missing passes.`);
}

fixMissingPasses().catch(console.error);
