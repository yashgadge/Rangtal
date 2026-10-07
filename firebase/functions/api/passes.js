const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { requireAuthenticatedUser } = require("../shared/auth");
const { createAuditLog, createSecurityEvent } = require("../shared/audit");
const crypto = require("crypto");

let _db; const db = new Proxy({}, { get: (target, prop) => { if (!_db) _db = getFirestore(); const val = _db[prop]; return typeof val === 'function' ? val.bind(_db) : val; }});

/**
 * Generate a pass for a registration.
 * Can be called by the participant who owns it, or an Admin.
 */
const _generatePassInternal = async (registrationId, uid, isAdmin) => {
  try {
    const result = await db.runTransaction(async (t) => {
      const regRef = db.collection("registrations").doc(registrationId);
      const regSnap = await t.get(regRef);
      if (!regSnap.exists) throw new HttpsError("not-found", "Registration not found");
      
      const regData = regSnap.data();
      if (regData.uid !== uid && !isAdmin && uid !== "SYSTEM") {
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
      
      const counterRef = db.collection("counters").doc("passes");
      const counterSnap = await t.get(counterRef);
      let currentSeq = counterSnap.exists && counterSnap.data().seq ? counterSnap.data().seq : 0;

      // Helper to generate next readable ID
      const getNextReadableId = (isGrp) => {
        currentSeq++;
        const prefix = isGrp ? "G" : (regData.type === 'COUPLE' ? "C" : (regData.type === 'GROUP' || regData.type?.startsWith('GROUP') ? "G" : "S"));
        return `RAN-${prefix}-${String(currentSeq).padStart(3, '0')}`;
      };

      // If group, generate one GROUP pass
      if (participantCount > 1) {
        const groupPassRef = db.collection("passes").doc();
        const secureCode = crypto.randomBytes(16).toString('hex');
        t.set(groupPassRef, {
          id: groupPassRef.id,
          readableId: getNextReadableId(true),
          registrationId,
          uid: regData.uid,
          secureCode,
          status: "ACTIVE",
          isGroup: true,
          regType: regData.packageName || regData.type || 'Group',
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
        const partData = partDoc.data();
        
        t.set(passRef, {
          id: passRef.id,
          readableId: getNextReadableId(false),
          registrationId,
          participantId: partDoc.id,
          uid: regData.uid,
          participantName: partData.fullName || 'Participant',
          participantMobile: partData.mobile || '',
          participantCollegeId: partData.collegeId || '',
          secureCode, 
          status: "ACTIVE",
          isGroup: false,
          regType: regData.packageName || regData.type || 'Single',
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

      // Save updated counter
      t.set(counterRef, { seq: currentSeq }, { merge: true });

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
           actorRole: isAdmin ? "ADMIN" : (uid === "SYSTEM" ? "SYSTEM" : "PARTICIPANT"),
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
};

exports.generatePass = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAuthenticatedUser(request);
  const { registrationId } = request.data;
  const isAdmin = request.auth.token.admin || request.auth.token.super_admin;
  
  if (!registrationId) throw new HttpsError("invalid-argument", "Missing registrationId");
  return await _generatePassInternal(registrationId, uid, isAdmin);
});

exports._generatePassInternal = _generatePassInternal;


