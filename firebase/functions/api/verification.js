const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { requireAuthenticatedUser, requirePermission, requireAdmin } = require("../shared/auth");
const { createAuditLog } = require("../shared/audit");

const db = getFirestore();

/**
 * Admin action: Approve verification.
 * State transition: VERIFICATION_PENDING -> VERIFIED
 */
exports.approveVerification = onCall(async (request) => {
  const uid = requireAdmin(request);
  const { registrationId } = request.data;
  
  if (!registrationId) throw new HttpsError("invalid-argument", "Missing registrationId");

  try {
    await db.runTransaction(async (t) => {
      const regRef = db.collection("registrations").doc(registrationId);
      const regSnap = await t.get(regRef);
      if (!regSnap.exists) throw new HttpsError("not-found", "Registration not found");
      
      const regData = regSnap.data();
      if (regData.status !== "VERIFICATION_PENDING" && regData.status !== "SUBMITTED") {
        throw new HttpsError("failed-precondition", `Cannot approve registration in status: ${regData.status}`);
      }
      
      t.update(regRef, {
        status: "VERIFIED",
        updatedAt: FieldValue.serverTimestamp()
      });

      // Optionally approve all participants as well
      const partsQuery = db.collection("participants").where("registrationId", "==", registrationId);
      const partsSnap = await t.get(partsQuery);
      partsSnap.forEach(doc => {
        t.update(doc.ref, { 
          verificationStatus: "APPROVED",
          updatedAt: FieldValue.serverTimestamp()
        });
      });
    });

    await createAuditLog({
      actorId: uid, actorRole: "ADMIN", action: "VERIFICATION_APPROVED", targetType: "REGISTRATION", targetId: registrationId
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to approve verification");
  }
});

/**
 * Admin action: Require correction.
 * State transition: VERIFICATION_PENDING -> REQUIRES_CORRECTION
 */
exports.requestVerificationCorrection = onCall(async (request) => {
  const uid = requireAdmin(request);
  const { registrationId, reason } = request.data;
  
  if (!registrationId || !reason) throw new HttpsError("invalid-argument", "Missing registrationId or reason");

  try {
    await db.runTransaction(async (t) => {
      const regRef = db.collection("registrations").doc(registrationId);
      const regSnap = await t.get(regRef);
      if (!regSnap.exists) throw new HttpsError("not-found", "Registration not found");
      
      const regData = regSnap.data();
      if (regData.status !== "VERIFICATION_PENDING" && regData.status !== "SUBMITTED") {
        throw new HttpsError("failed-precondition", "Registration not pending verification");
      }
      
      t.update(regRef, {
        status: "REQUIRES_CORRECTION",
        correctionReason: reason,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    await createAuditLog({
      actorId: uid, actorRole: "ADMIN", action: "VERIFICATION_REQUIRES_CORRECTION", targetType: "REGISTRATION", targetId: registrationId, metadata: { reason }
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
exports.submitVerification = onCall(async (request) => {
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
exports.getVerificationDocumentUrl = onCall(async (request) => {
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
    throw new HttpsError("internal", "Failed to generate signed URL");
  }
});
