import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyD_cFAU-H7soRuHKCBToQUvPulyzIFU3BA",
  authDomain: "rhythm-rebel.firebaseapp.com",
  projectId: "rhythm-rebel",
  storageBucket: "rhythm-rebel.firebasestorage.app",
  messagingSenderId: "1007937336427",
  appId: "1:1007937336427:web:14cecf3cf7f6c28af3ad2e",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, 'us-central1');

async function run() {
  try {
    console.log("Logging in as Super Admin...");
    await signInWithEmailAndPassword(auth, "yashgadge11155@gmail.com", "Yash9552273816");
    console.log("Logged in!");

    console.log("Calling createVolunteer function...");
    const createVolunteerFn = httpsCallable(functions, "createVolunteer");
    
    const volunteerData = {
      email: "volunteer1@rangtal.com",
      password: "VolunteerPassword123",
      name: "Gate Scanner 1",
      permissions: ["SCAN_PASS"]
    };

    const result = await createVolunteerFn(volunteerData);
    console.log("SUCCESS! Volunteer created with UID:", result.data.uid);
    console.log("Login Email:", volunteerData.email);
    console.log("Login Password:", volunteerData.password);
    process.exit(0);
  } catch (error) {
    console.error("Failed:", error.message);
    if (error.details) console.error(error.details);
    process.exit(1);
  }
}

run();
