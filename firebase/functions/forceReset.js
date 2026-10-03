const { onRequest } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");

exports.forceResetPassword = onRequest(async (req, res) => {
  try {
    const auth = getAuth();
    
    // Create or reset volunteer account
    const volEmail = "volunteer1@rangtal.com";
    const volPassword = "VolunteerPassword123";
    let volUser;
    
    try {
      volUser = await auth.getUserByEmail(volEmail);
      await auth.updateUser(volUser.uid, { password: volPassword });
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        volUser = await auth.createUser({
          email: volEmail,
          password: volPassword,
          displayName: "Gate Scanner 1"
        });
      } else throw e;
    }
    
    await auth.setCustomUserClaims(volUser.uid, { volunteer: true, permissions: ["SCAN_PASS", "MANUAL_CHECKIN"] });
    
    const db = require("firebase-admin/firestore").getFirestore();
    await db.collection("volunteers").doc(volUser.uid).set({
      uid: volUser.uid,
      email: volEmail,
      name: "Gate Scanner 1",
      status: "ACTIVE",
      active: true,
      permissions: ["SCAN_PASS", "MANUAL_CHECKIN", "VIEW_HISTORY"],
      createdAt: require("firebase-admin/firestore").FieldValue.serverTimestamp(),
      updatedAt: require("firebase-admin/firestore").FieldValue.serverTimestamp(),
    });

    res.status(200).send(`Volunteer Account Ready:\nEmail: ${volEmail}\nPassword: ${volPassword}`);
  } catch (error) {
    res.status(500).send("Error: " + error.message);
  }
});
