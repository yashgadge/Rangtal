import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

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

const email = "yashgadge11155@gmail.com";
const password = "Yash9552273816";

console.log("Automating account creation for", email, "...");

createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    console.log("SUCCESS! Account created.");
    process.exit(0);
  })
  .catch((error) => {
    if (error.code === 'auth/email-already-in-use') {
      console.log("Account already exists! You should be able to log in.");
      process.exit(0);
    } else {
      console.error("Error:", error.message);
      process.exit(1);
    }
  });
