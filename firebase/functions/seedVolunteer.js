const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp({ projectId: "rhythm-rebel" });

const auth = getAuth();
const db = getFirestore();

async function run() {
  const email = "volunteer1@rangtal.com";
  const password = "VolunteerPassword123";
  const name = "Gate Scanner 1";

  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log("User already exists, updating password...");
      await auth.updateUser(userRecord.uid, { password });
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email,
          password,
          displayName: name,
        });
      } else {
        throw e;
      }
    }

    await auth.setCustomUserClaims(userRecord.uid, { volunteer: true });

    const volunteerData = {
      uid: userRecord.uid,
      email,
      name,
      status: "ACTIVE",
      active: true,
      permissions: ["SCAN_PASS", "MANUAL_CHECKIN", "VIEW_HISTORY"],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: "seed_script"
    };

    await db.collection("volunteers").doc(userRecord.uid).set(volunteerData);

    console.log("SUCCESS! Volunteer created with UID:", userRecord.uid);
    console.log("Login Email:", email);
    console.log("Login Password:", password);
    process.exit(0);
  } catch (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }
}

run();
