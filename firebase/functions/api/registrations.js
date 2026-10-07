const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { requireAuthenticatedUser } = require("../shared/auth");
const { createAuditLog } = require("../shared/audit");

let _db; const db = new Proxy({}, { get: (target, prop) => { if (!_db) _db = getFirestore(); const val = _db[prop]; return typeof val === 'function' ? val.bind(_db) : val; }});

exports.createRegistration = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAuthenticatedUser(request);
  const { packageId, collegeId, type, formFields, participants, verificationDocs } = request.data;

  if (!packageId || !collegeId || !type || !participants || !Array.isArray(participants)) {
    throw new HttpsError("invalid-argument", "Missing required registration parameters.");
  }

  // 1. Verify Package & Capacity (but reservation occurs at Payment creation to avoid deadlocking drafts)
  const packageRef = db.collection("packages").doc(packageId);
  const packageSnap = await packageRef.get();
  if (!packageSnap.exists) {
    throw new HttpsError("not-found", "Package not found.");
  }
  
  const packageData = packageSnap.data();
  if (!packageData.active) {
    throw new HttpsError("failed-precondition", "Package is not currently active.");
  }
  
  const expectedCount = packageData.participantCount || 1;
  if (participants.length !== expectedCount) {
    throw new HttpsError("invalid-argument", `This package requires exactly ${expectedCount} participants.`);
  }

  // Calculate authoritative price from the package definition
  const authoritativeAmount = packageData.price;

  // 2. Build explicit Registration Document
  const registrationRef = db.collection("registrations").doc();
  const registrationData = {
    id: registrationRef.id,
    uid: uid,
    email: request.auth?.token?.email || "",
    packageId: packageId,
    packageName: packageData.name,
    collegeId: collegeId,
    type: type,
    participantCount: expectedCount,
    checkedInCount: 0,
    verifiedCount: expectedCount,
    status: "VERIFIED", // Bypass manual verification for instant payment
    amount: authoritativeAmount,
    currency: "INR", // Or pull from package
    formFields: formFields || {},
    verificationDocs: verificationDocs || [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  try {
    const batch = db.batch();
    
    // Create Registration
    batch.set(registrationRef, registrationData);

    // Create Participant records
    participants.forEach((p, index) => {
      const pFullName = p.fullName || "Participant";
      
      const customData = {};
      for (const [key, val] of Object.entries(p)) {
        if (key.startsWith('custom_')) {
          customData[key.replace('custom_', '')] = val;
        }
      }

      const partRef = db.collection("participants").doc();
      batch.set(partRef, {
        id: partRef.id,
        registrationId: registrationRef.id,
        uid: uid,
        email: request.auth?.token?.email || "",
        fullName: pFullName,
        passType: packageData.name,
        gender: p.gender || '',
        collegeId: p.collegeId || collegeId,
        mobile: p.mobile || '',
        participantIndex: index,
        customFields: customData,
        isJspmHostel: p.isJspmHostel || '',
        hostelBuilding: p.hostelBuilding || '',
        hostelRoom: p.hostelRoom || '',
        verificationStatus: "APPROVED",
        checkInStatus: "NOT_CHECKED_IN",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    await createAuditLog({
      actorId: uid,
      actorRole: "PARTICIPANT",
      action: "REGISTRATION_CREATED",
      targetType: "REGISTRATION",
      targetId: registrationRef.id,
      metadata: { type }
    });

    return { 
      success: true, 
      registrationId: registrationRef.id,
      amount: authoritativeAmount
    };
  } catch (error) {
    console.error("Error creating registration:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to create registration.");
  }
});

exports.submitRegistration = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAuthenticatedUser(request);
  const { registrationId, documents } = request.data;
  
  if (!registrationId) throw new HttpsError("invalid-argument", "registrationId required.");

  const regRef = db.collection("registrations").doc(registrationId);
  
  await db.runTransaction(async (t) => {
    const regSnap = await t.get(regRef);
    if (!regSnap.exists) throw new HttpsError("not-found", "Registration not found.");
    
    const regData = regSnap.data();
    if (regData.uid !== uid) throw new HttpsError("permission-denied", "Not your registration.");
    const allowedStatuses = ["DRAFT", "REQUIRES_CORRECTION", "VERIFIED", "PAYMENT_PENDING", "PAYMENT_SUCCESS", "SUBMITTED"];
    if (!allowedStatuses.includes(regData.status)) {
      throw new HttpsError("failed-precondition", `Registration cannot be submitted from current state: ${regData.status}`);
    }
    
    t.update(regRef, {
      status: regData.status === "DRAFT" || regData.status === "REQUIRES_CORRECTION" ? "SUBMITTED" : regData.status,
      verificationDocs: documents || [],
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  await createAuditLog({
    actorId: uid,
    actorRole: "PARTICIPANT",
    action: "REGISTRATION_SUBMITTED",
    targetType: "REGISTRATION",
    targetId: registrationId,
  });
  
  return { success: true };
});

exports.deleteRegistration = onCall({ invoker: "public" }, async (request) => {
  const { requireAdmin } = require("../shared/auth");
  const uid = requireAdmin(request);
  const { registrationId } = request.data;
  
  if (!registrationId) throw new HttpsError("invalid-argument", "registrationId required.");

  try {
    const regRef = db.collection("registrations").doc(registrationId);
    
    // Using batch for atomic deletion of related records
    const batch = db.batch();
    batch.delete(regRef);

    // Delete participants
    const partsSnap = await db.collection("participants").where("registrationId", "==", registrationId).get();
    partsSnap.docs.forEach(doc => batch.delete(doc.ref));

    // Delete passes
    const passesSnap = await db.collection("passes").where("registrationId", "==", registrationId).get();
    passesSnap.docs.forEach(doc => batch.delete(doc.ref));

    // Delete payments
    const paymentsSnap = await db.collection("payments").where("registrationId", "==", registrationId).get();
    paymentsSnap.docs.forEach(doc => batch.delete(doc.ref));

    await batch.commit();

    await createAuditLog({
      actorId: uid,
      actorRole: "ADMIN",
      action: "REGISTRATION_DELETED",
      targetType: "REGISTRATION",
      targetId: registrationId,
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting registration:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to delete registration and associated data.");
  }
});


