const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { requireAuthenticatedUser } = require("../shared/auth");
const { createAuditLog } = require("../shared/audit");

let _db; const db = new Proxy({}, { get: (target, prop) => { if (!_db) _db = getFirestore(); const val = _db[prop]; return typeof val === 'function' ? val.bind(_db) : val; }});

exports.createRegistration = onCall(async (request) => {
  const uid = requireAuthenticatedUser(request);
  const { packageId, collegeId, type, formFields, participants } = request.data;

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
    packageId: packageId,
    collegeId: collegeId,
    type: type,
    participantCount: expectedCount,
    checkedInCount: 0,
    verifiedCount: 0,
    status: "DRAFT", // Always initial state
    amount: authoritativeAmount,
    currency: "INR", // Or pull from package
    formFields: formFields || {},
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  try {
    const batch = db.batch();
    
    // Create Registration
    batch.set(registrationRef, registrationData);

    // Create Participant records
    for (const p of participants) {
      if (!p.fullName) {
        throw new HttpsError("invalid-argument", "Participant missing required fields.");
      }
      const partRef = db.collection("participants").doc();
      batch.set(partRef, {
        id: partRef.id,
        registrationId: registrationRef.id,
        uid: uid,
        fullName: p.fullName,
        gender: p.gender || '',
        college: p.college || '',
        mobile: p.mobile || '',
        verificationStatus: "PENDING",
        checkInStatus: "NOT_CHECKED_IN",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }

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

exports.submitRegistration = onCall(async (request) => {
  const uid = requireAuthenticatedUser(request);
  const { registrationId, documents } = request.data;
  
  if (!registrationId) throw new HttpsError("invalid-argument", "registrationId required.");

  const regRef = db.collection("registrations").doc(registrationId);
  
  await db.runTransaction(async (t) => {
    const regSnap = await t.get(regRef);
    if (!regSnap.exists) throw new HttpsError("not-found", "Registration not found.");
    
    const regData = regSnap.data();
    if (regData.uid !== uid) throw new HttpsError("permission-denied", "Not your registration.");
    if (regData.status !== "DRAFT" && regData.status !== "REQUIRES_CORRECTION") {
      throw new HttpsError("failed-precondition", "Registration cannot be submitted from current state.");
    }
    
    t.update(regRef, {
      status: "SUBMITTED",
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

