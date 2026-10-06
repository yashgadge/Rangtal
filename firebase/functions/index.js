const { initializeApp } = require("firebase-admin/app");
const { setGlobalOptions } = require("firebase-functions/v2");

// Fix container timeout by increasing memory and allow public invocations, keep 1 instance warm
setGlobalOptions({ minInstances: 1, maxInstances: 10, memory: "512MiB", timeoutSeconds: 60, invoker: "public" });

// Initialize Firebase Admin once
initializeApp({
  storageBucket: "rhythm-rebel.appspot.com"
});

// API Exports
const registrations = require("./api/registrations");
exports.createRegistration = registrations.createRegistration;
exports.submitRegistration = registrations.submitRegistration;
exports.deleteRegistration = registrations.deleteRegistration;

const payments = require("./api/payments");
exports.createPaymentOrder = payments.createPaymentOrder;
exports.verifyPayment = payments.verifyPayment;

const passes = require("./api/passes");
exports.generatePass = passes.generatePass;

const checkins = require("./api/checkins");
exports.checkInParticipantV2 = checkins.checkInParticipantV2;
exports.checkInGroupMembersV2 = checkins.checkInGroupMembersV2;
exports.verifyPass = checkins.verifyPass;

const verification = require("./api/verification");
exports.approveVerification = verification.approveVerification;
exports.requestVerificationCorrection = verification.requestVerificationCorrection;
exports.submitVerification = verification.submitVerification;
exports.getVerificationDocumentUrl = verification.getVerificationDocumentUrl;

const volunteers = require("./api/volunteers");
exports.createVolunteer = volunteers.createVolunteer;
exports.disableVolunteer = volunteers.disableVolunteer;
exports.updateVolunteerPermissions = volunteers.updateVolunteerPermissions;

// Utility for development testing/initialization
const forceReset = require("./forceReset");
exports.forceResetPassword = forceReset.forceResetPassword;

const { onCall } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");

exports.seedData = onCall({ invoker: "public" }, async (request) => {
  require("./shared/auth").requireAdmin(request);
  const db = getFirestore();
  await db.collection("packages").doc("pkg-season-pass").set({
    active: true, price: 349, capacity: 1000, soldCount: 0, name: "Single Pass", type: "SINGLE", participantCount: 1, description: "Valid for single person entry"
  });
  await db.collection("packages").doc("pkg-couple-pass").set({
    active: true, price: 549, capacity: 500, soldCount: 0, name: "Couple Pass", type: "COUPLE", participantCount: 2, description: "Access for one boy and one girl"
  });
  await db.collection("packages").doc("pkg-5-person").set({
    active: true, price: 1499, capacity: 200, soldCount: 0, name: "5 Person Pass", type: "GROUP_5", participantCount: 5, description: "Group access for 5 participants"
  });
  await db.collection("packages").doc("pkg-11-person").set({
    active: true, price: 2999, capacity: 50, soldCount: 0, name: "11 Person Pass", type: "GROUP_11", participantCount: 11, description: "Group access for 11 participants"
  });
  await db.collection("colleges").doc("col-jspm").set({
    verified: true, name: "JSPM University"
  });
  await db.collection("colleges").doc("col-pune").set({
    verified: true, name: "Pune Institute of Technology"
  });
  return { success: true };
});

