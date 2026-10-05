const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { requireAuthenticatedUser, requirePermission, requireAdmin } = require("../shared/auth");
const { createAuditLog } = require("../shared/audit");

let _db; const db = new Proxy({}, { get: (target, prop) => { if (!_db) _db = getFirestore(); const val = _db[prop]; return typeof val === 'function' ? val.bind(_db) : val; }});

/**
 * Admin action: Approve verification for a specific participant.
 */
exports.approveVerification = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAdmin(request);
  const { participantId } = request.data;
  
  if (!participantId) throw new HttpsError("invalid-argument", "Missing participantId");

  try {
    await db.runTransaction(async (t) => {
      const partRef = db.collection("participants").doc(participantId);
      const partSnap = await t.get(partRef);
      if (!partSnap.exists) throw new HttpsError("not-found", "Participant not found");
      
      const partData = partSnap.data();
      const registrationId = partData.registrationId;

      const regRef = db.collection("registrations").doc(registrationId);
      const regSnap = await t.get(regRef);

      t.update(partRef, {
        verificationStatus: "APPROVED",
        updatedAt: FieldValue.serverTimestamp()
      });

      // Update registration verified count
      if (regSnap.exists) {
        const regData = regSnap.data();
        const newVerifiedCount = (regData.verifiedCount || 0) + 1;
        const updates = {
          verifiedCount: newVerifiedCount,
          updatedAt: FieldValue.serverTimestamp()
        };
        
        // If all participants are verified, set status to VERIFIED
        if (newVerifiedCount >= regData.participantCount) {
          updates.status = "VERIFIED";
        }
        
        t.update(regRef, updates);
      }
    });

    await createAuditLog({
      actorId: uid, actorRole: "ADMIN", action: "VERIFICATION_APPROVED", targetType: "PARTICIPANT", targetId: participantId
    });

    return { success: true };
  } catch (error) {
    console.error("approveVerification error:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", `Debug Error: ${error.message} - Stack: ${error.stack}`);
  }
});

/**
 * Admin action: Require correction for a specific participant.
 */
exports.requestVerificationCorrection = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAdmin(request);
  const { participantId, reason } = request.data;
  
  if (!participantId || !reason) throw new HttpsError("invalid-argument", "Missing participantId or reason");

  try {
    await db.runTransaction(async (t) => {
      const partRef = db.collection("participants").doc(participantId);
      const partSnap = await t.get(partRef);
      if (!partSnap.exists) throw new HttpsError("not-found", "Participant not found");
      
      const partData = partSnap.data();
      const registrationId = partData.registrationId;

      t.update(partRef, {
        verificationStatus: "REQUIRES_CORRECTION",
        correctionReason: reason,
        updatedAt: FieldValue.serverTimestamp()
      });

      const regRef = db.collection("registrations").doc(registrationId);
      t.update(regRef, {
        status: "REQUIRES_CORRECTION", // Mark the whole registration as needing attention
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    await createAuditLog({
      actorId: uid, actorRole: "ADMIN", action: "VERIFICATION_REQUIRES_CORRECTION", targetType: "PARTICIPANT", targetId: participantId, metadata: { reason }
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to request correction");
  }
});

/**
 * Participant action: Resubmit verification.
 * State transition: REQUIRES_CORRECTION -> VERIFICATION_PENDING
 */
exports.submitVerification = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAuthenticatedUser(request);
  const { registrationId, documents } = request.data;
  
  if (!registrationId) throw new HttpsError("invalid-argument", "Missing registrationId");

  try {
    await db.runTransaction(async (t) => {
      const regRef = db.collection("registrations").doc(registrationId);
      const regSnap = await t.get(regRef);
      if (!regSnap.exists) throw new HttpsError("not-found", "Registration not found");
      
      const regData = regSnap.data();
      if (regData.uid !== uid) {
         throw new HttpsError("permission-denied", "You do not own this registration");
      }

      // Can transition from SUBMITTED or REQUIRES_CORRECTION
      if (regData.status !== "SUBMITTED" && regData.status !== "REQUIRES_CORRECTION") {
        throw new HttpsError("failed-precondition", "Registration cannot be submitted for verification right now");
      }
      
      const updateData = {
        status: "VERIFICATION_PENDING",
        updatedAt: FieldValue.serverTimestamp()
      };
      
      if (documents && Array.isArray(documents)) {
        updateData.verificationDocs = documents;
      }
      
      t.update(regRef, updateData);
    });

    await createAuditLog({
      actorId: uid, actorRole: "PARTICIPANT", action: "VERIFICATION_SUBMITTED", targetType: "REGISTRATION", targetId: registrationId
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to submit verification");
  }
});

/**
 * Admin action: Get short-lived signed URL for a verification document.
 */
exports.getVerificationDocumentUrl = onCall({ invoker: "public" }, async (request) => {
  requireAdmin(request);
  const { path } = request.data;
  
  if (!path) throw new HttpsError("invalid-argument", "Missing path");

  try {
    const { getStorage } = require("firebase-admin/storage");
    const bucket = getStorage().bucket();
    const file = bucket.file(path);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError("not-found", "Document not found in storage");
    }
    
    // Generate a signed URL that expires in 1 hour (3600000 ms)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 3600000,
    });
    
    return { url };
  } catch (error) {
    console.error("Error generating signed URL:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", `Debug Error: ${error.message} - Stack: ${error.stack}`);
  }
});


