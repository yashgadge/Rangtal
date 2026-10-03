const admin = require("firebase-admin");

// Fetch from command line arguments
const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] || "Super Admin";

if (!email || !password) {
  console.error("Usage: node bootstrap.js <email> <password> [name]");
  process.exit(1);
}

// Ensure the serviceAccountKey.json is present
try {
  const serviceAccount = require("./serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  console.error("ERROR: Could not load serviceAccountKey.json. Please generate it from Firebase Console (Project Settings > Service Accounts) and place it in the firebase/functions directory.");
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

async function bootstrap() {
  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`User ${email} already exists. Updating password and claims...`);
      await auth.updateUser(userRecord.uid, { password });
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        console.log(`Creating new user ${email}...`);
        userRecord = await auth.createUser({
          email: email,
          password: password,
          displayName: name,
        });
      } else {
        throw e;
      }
    }

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, { admin: true, super_admin: true });
    console.log("Custom claims set successfully.");

    // Create the admin document in Firestore
    await db.collection("admins").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: email,
      name: name,
      status: "ACTIVE",
      role: "SUPER_ADMIN",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Successfully bootstrapped SUPER_ADMIN: ${email}`);
    process.exit(0);
  } catch (error) {
    console.error("Error bootstrapping admin:", error);
    process.exit(1);
  }
}

bootstrap();
