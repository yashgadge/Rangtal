const { initializeApp } = require("firebase-admin/app");
const { setGlobalOptions } = require("firebase-functions/v2");

// Fix container timeout by increasing memory
setGlobalOptions({ maxInstances: 10, memory: "512MiB", timeoutSeconds: 60 });

// Initialize Firebase Admin once
initializeApp();

// API Exports
const registrations = require("./api/registrations");
exports.createRegistration = registrations.createRegistration;
exports.submitRegistration = registrations.submitRegistration;

const payments = require("./api/payments");
exports.createPaymentOrder = payments.createPaymentOrder;
exports.verifyPayment = payments.verifyPayment;

const passes = require("./api/passes");
exports.generatePass = passes.generatePass;

const checkins = require("./api/checkins");
exports.checkInParticipant = checkins.checkInParticipant;

const verification = require("./api/verification");
exports.approveVerification = verification.approveVerification;
exports.requestVerificationCorrection = verification.requestVerificationCorrection;
exports.submitVerification = verification.submitVerification;
exports.getVerificationDocumentUrl = verification.getVerificationDocumentUrl;

const volunteers = require("./api/volunteers");
exports.createVolunteer = volunteers.createVolunteer;
exports.disableVolunteer = volunteers.disableVolunteer;

// Utility for development testing/initialization
const forceReset = require("./forceReset");
exports.forceResetPassword = forceReset.forceResetPassword;

const { onCall } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");

exports.seedData = onCall(async (request) => {
  require("./shared/auth").requireAdmin(request);
  const db = getFirestore();
  await db.collection("packages").doc("pkg-season-pass").set({
    active: true, price: 1499, capacity: 1000, soldCount: 0, name: "Season Pass", type: "SINGLE", description: "Access to all 9 nights of Navratri"
  });
  await db.collection("packages").doc("pkg-daily-pass").set({
    active: true, price: 299, capacity: 5000, soldCount: 0, name: "Daily Pass", type: "SINGLE", description: "Valid for single day entry"
  });
  await db.collection("packages").doc("pkg-couple-pass").set({
    active: true, price: 2499, capacity: 500, soldCount: 0, name: "Couple Pass", type: "COUPLE", description: "Access for two participants"
  });
  await db.collection("colleges").doc("col-jspm").set({
    verified: true, name: "JSPM University"
  });
  await db.collection("colleges").doc("col-pune").set({
    verified: true, name: "Pune Institute of Technology"
  });
  return { success: true };
});
