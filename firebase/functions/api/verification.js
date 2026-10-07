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

      const regRef = registrationId ? db.collection("registrations").doc(registrationId) : null;
      const regSnap = regRef ? await t.get(regRef) : null;

      // Idempotent: already approved participants must not inflate verifiedCount
      if (partData.verificationStatus === "APPROVED") return;

      t.update(partRef, {
        verificationStatus: "APPROVED",
        correctionReason: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      });

      // Update registration verified count
      if (regSnap && regSnap.exists) {
        const regData = regSnap.data();
        const newVerifiedCount = Math.min(
          (regData.verifiedCount || 0) + 1,
          regData.participantCount || Number.MAX_SAFE_INTEGER
        );
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
 * Normalize whatever was stored as a document reference into a bucket-relative object path.
 * Handles: plain paths, leading slashes, gs:// URIs and Firebase download URLs.
 */
function normalizeStoragePath(raw) {
  if (!raw || typeof raw !== "string") return null;
  let p = raw.trim();
  try {
    if (p.startsWith("gs://")) {
      p = p.replace(/^gs:\/\/[^/]+\//, "");
    } else if (p.startsWith("http")) {
      const m = p.match(/\/o\/([^?]+)/);
      if (m) p = decodeURIComponent(m[1]);
    }
  } catch (_) { /* keep raw */ }
  return p.replace(/^\/+/, "");
}

async function resolveUrlForFile(file) {
  try {
    const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 3600000 });
    return url;
  } catch (signErr) {
    // Service account may lack iam.serviceAccounts.signBlob — fall back to token URL
    console.warn("getSignedUrl failed, falling back to download URL:", signErr.message);
    const { getDownloadURL } = require("firebase-admin/storage");
    return await getDownloadURL(file);
  }
}

/**
 * Admin action: Get short-lived signed URL for a verification document.
 */
exports.getVerificationDocumentUrl = onCall({ invoker: "public" }, async (request) => {
  requireAdmin(request);
  const { path: rawPath, url: storedUrl } = request.data || {};

  const path = normalizeStoragePath(rawPath) || normalizeStoragePath(storedUrl);
  if (!path) throw new HttpsError("invalid-argument", "Missing path");

  try {
    const { getStorage } = require("firebase-admin/storage");
    const bucket = getStorage().bucket();

    // 1. Exact path
    let file = bucket.file(path);
    let [exists] = await file.exists();

    // 2. Legacy fallback: files were uploaded with a different prefix (temp_xxx vs registrationId).
    //    Search the same folder for a file ending with the same "_pN_field_filename" suffix.
    if (!exists) {
      const slash = path.lastIndexOf("/");
      const folder = slash >= 0 ? path.slice(0, slash + 1) : "";
      const base = slash >= 0 ? path.slice(slash + 1) : path;
      const suffixMatch = base.match(/_p\d+_.+$/);
      const suffix = suffixMatch ? suffixMatch[0] : base;

      if (folder) {
        const [files] = await bucket.getFiles({ prefix: folder });
        const candidate = files.find(f => f.name.endsWith(suffix));
        if (candidate) {
          file = candidate;
          exists = true;
        }
      }
    }

    if (!exists) {
      // Soft failure — avoids noisy 404s in the admin console; client can fall back to stored URL
      console.warn("Verification document missing in storage:", path);
      return { url: null, missing: true, path };
    }

    const url = await resolveUrlForFile(file);
    return { url, path: file.name };
  } catch (error) {
    console.error("Error generating document URL:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", `Failed to load document: ${error.message}`);
  }
});


