const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { requireAuthenticatedUser } = require("../shared/auth");
const { createAuditLog, createSecurityEvent } = require("../shared/audit");
const crypto = require("crypto");

const db = getFirestore();

/**
 * Generate a pass for a registration.
 * Can be called by the participant who owns it, or an Admin.
 */
exports.generatePass = onCall(async (request) => {
  const uid = requireAuthenticatedUser(request);
  const { registrationId } = request.data;
  const isAdmin = request.auth.token.admin || request.auth.token.super_admin;
  
  if (!registrationId) throw new HttpsError("invalid-argument", "Missing registrationId");

  try {
    const result = await db.runTransaction(async (t) => {
      const regRef = db.collection("registrations").doc(registrationId);
      const regSnap = await t.get(regRef);
      if (!regSnap.exists) throw new HttpsError("not-found", "Registration not found");
      
      const regData = regSnap.data();
      if (regData.uid !== uid && !isAdmin) {
        throw new HttpsError("permission-denied", "Unauthorized");
      }

      if (regData.status !== "PAYMENT_SUCCESS") {
        throw new HttpsError("failed-precondition", "Payment must be successful to generate a pass.");
      }

      // Check if passes already exist
      const passesRef = db.collection("passes").where("registrationId", "==", registrationId).where("status", "==", "ACTIVE");
      const passesSnap = await t.get(passesRef);
      if (!passesSnap.empty) {
        return { success: true, alreadyGenerated: true };
      }

      // Fetch participants for this registration to create pass records for them
      const partsRef = db.collection("participants").where("registrationId", "==", registrationId);
      const partsSnap = await t.get(partsRef);
      
      const passIds = [];
      const participantCount = regData.participantCount || partsSnap.docs.length;
      
      // If group, generate one GROUP pass
      if (participantCount > 1) {
        const groupPassRef = db.collection("passes").doc();
        const secureCode = crypto.randomBytes(16).toString('hex');
        t.set(groupPassRef, {
          id: groupPassRef.id,
          registrationId,
          uid: regData.uid,
          secureCode,
          status: "ACTIVE",
          isGroup: true,
          participantCount,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        passIds.push(groupPassRef.id);
      }
      
      // Generate individual passes
      for (const partDoc of partsSnap.docs) {
        const passRef = db.collection("passes").doc();
        const secureCode = crypto.randomBytes(16).toString('hex'); 
        
        t.set(passRef, {
          id: passRef.id,
          registrationId,
          participantId: partDoc.id,
          uid: regData.uid,
          secureCode, 
          status: "ACTIVE",
          isGroup: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        const passEventRef = db.collection("passEvents").doc();
        t.set(passEventRef, {
          id: passEventRef.id,
          passId: passRef.id,
          type: "ISSUED",
          timestamp: FieldValue.serverTimestamp()
        });
        
        passIds.push(passRef.id);
      }

      // Update Registration State
      t.update(regRef, {
        status: "PASS_ISSUED",
        updatedAt: FieldValue.serverTimestamp()
      });

      return { success: true, passIds };
    });

    if (result.passIds) {
      for(const pId of result.passIds) {
         await createAuditLog({
           actorId: uid,
           actorRole: isAdmin ? "ADMIN" : "PARTICIPANT",
           action: "PASS_GENERATED",
           targetType: "PASS",
           targetId: pId
         });
      }
    }

    return result;
  } catch (error) {
    console.error("Generate Pass Error:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to generate pass");
  }
});
