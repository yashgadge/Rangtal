const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { requirePermission } = require("../shared/auth");
const { createAuditLog, createSecurityEvent } = require("../shared/audit");

const db = getFirestore();

/**
 * Validates a pass and checks in the participant transactionally.
 */
exports.checkInParticipant = onCall(async (request) => {
  const uid = requirePermission(request, "SCAN_PASS");
  const { secureCode } = request.data;
  
  if (!secureCode) {
    throw new HttpsError("invalid-argument", "Missing secureCode");
  }

  try {
    const result = await db.runTransaction(async (t) => {
      // 1. Find Pass by secureCode
      // Note: Queries in transactions require the query to be executed first, which is allowed.
      const passQuery = db.collection("passes").where("secureCode", "==", secureCode).limit(1);
      const passSnap = await t.get(passQuery);
      
      if (passSnap.empty) {
        return { success: false, status: "INVALID_PASS" };
      }

      const passDoc = passSnap.docs[0];
      const passData = passDoc.data();

      // 2. Validate Pass State
      if (passData.status === "REVOKED") return { success: false, status: "REVOKED_PASS" };
      if (passData.status === "SUPERSEDED") return { success: false, status: "SUPERSEDED_PASS" };
      if (passData.status === "EXPIRED") return { success: false, status: "EXPIRED_PASS" };
      if (passData.status !== "ACTIVE") return { success: false, status: "INVALID_PASS" };

      // 3. Check for existing check-in
      const checkinQuery = db.collection("checkins").where("passId", "==", passDoc.id).limit(1);
      const checkinSnap = await t.get(checkinQuery);
      if (!checkinSnap.empty) {
        return { success: false, status: "ALREADY_CHECKED_IN", checkinTime: checkinSnap.docs[0].data().timestamp };
      }

      // 4. Create Checkin
      const checkinRef = db.collection("checkins").doc();
      t.set(checkinRef, {
        id: checkinRef.id,
        passId: passDoc.id,
        participantId: passData.participantId,
        registrationId: passData.registrationId,
        volunteerId: uid,
        status: "VALID_CHECKED_IN",
        timestamp: FieldValue.serverTimestamp()
      });

      return { 
        success: true, 
        status: "VALID_CHECKED_IN", 
        participantId: passData.participantId,
        checkinId: checkinRef.id
      };
    });

    if (result.success) {
      await createAuditLog({
        actorId: uid,
        actorRole: "VOLUNTEER",
        action: "PARTICIPANT_CHECKED_IN",
        targetType: "PASS",
        targetId: result.participantId, // We don't expose passId back if not needed, but can target passId
      });
    } else {
      await createSecurityEvent({
        actorId: uid,
        actorRole: "VOLUNTEER",
        action: "INVALID_PASS_SCAN",
        targetType: "PASS_CODE",
        targetId: secureCode,
        metadata: { reason: result.status }
      });
    }

    return result;
  } catch (error) {
    console.error("Checkin Error:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to check in participant");
  }
});
