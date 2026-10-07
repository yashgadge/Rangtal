const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { requirePermission, requireAnyPermission, requireAdmin } = require("../shared/auth");
const { createAuditLog, createSecurityEvent } = require("../shared/audit");

let _db; const db = new Proxy({}, { get: (target, prop) => { if (!_db) _db = getFirestore(); const val = _db[prop]; return typeof val === 'function' ? val.bind(_db) : val; }});

/**
 * Verify a pass by secureCode (scanned from QR) and return details.
 */
exports.verifyPass = onCall({ invoker: "public" }, async (request) => {
  requirePermission(request, "SCAN_PASS");
  const { passId: secureCode } = request.data;
  
  if (!secureCode) throw new HttpsError("invalid-argument", "Missing secureCode");
  
  const passQuery = await db.collection("passes").where("secureCode", "==", secureCode).limit(1).get();
  if (passQuery.empty) {
    return { status: "INVALID_PASS" };
  }
  
  const passDoc = passQuery.docs[0];
  const passData = passDoc.data();
  
  const regDoc = await db.collection("registrations").doc(passData.registrationId).get();
  const regData = regDoc.exists ? regDoc.data() : { type: "UNKNOWN" };

  if (passData.isGroup) {
    const partsQuery = await db.collection("participants").where("registrationId", "==", passData.registrationId).get();
    const participants = partsQuery.docs.map(d => ({ id: d.id, ...d.data() }));
    
    return {
      status: passData.status === "ACTIVE" ? "ISSUED" : passData.status,
      isGroup: true,
      passId: secureCode,
      type: regData.type,
      participants
    };
  } else {
    let participantName = passData.participantName || "Unknown";
    let participantMobile = passData.participantMobile || '';
    let participantCollegeId = passData.participantCollegeId || '';

    if (passData.participantId) {
      const partDoc = await db.collection("participants").doc(passData.participantId).get();
      if (partDoc.exists) {
        participantName = partDoc.data().fullName || participantName;
        participantMobile = partDoc.data().mobile || participantMobile;
        participantCollegeId = partDoc.data().collegeId || participantCollegeId;
      }
    }
    
    // Check if checked in (use deterministic ID)
    const checkinDoc = await db.collection("checkins").doc(`pass_${passDoc.id}`).get();
    if (checkinDoc.exists) {
      return { status: "ALREADY_USED", participantName, participantMobile, participantCollegeId, type: regData.type, passId: secureCode, readableId: passData.readableId };
    }
    
    return {
      status: passData.status === "ACTIVE" ? "ISSUED" : passData.status,
      isGroup: false,
      participantName,
      participantMobile,
      participantCollegeId,
      type: regData.type,
      passId: secureCode,
      readableId: passData.readableId
    };
  }
});

/**
 * Validates a pass and checks in the participant transactionally.
 */
exports.checkInParticipantV2 = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAnyPermission(request, ["SCAN_PASS", "MANUAL_CHECKIN"]);
  const { secureCode } = request.data;
  
  if (!secureCode) {
    throw new HttpsError("invalid-argument", "Missing secureCode");
  }

  try {
    const result = await db.runTransaction(async (t) => {
      // 1. Find Pass by secureCode
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

      // 3. Check for existing check-in securely using deterministic ID
      const checkinRef = db.collection("checkins").doc(`pass_${passDoc.id}`);
      const checkinSnap = await t.get(checkinRef);
      if (checkinSnap.exists) {
        return { success: false, status: "ALREADY_CHECKED_IN", checkinTime: checkinSnap.data().timestamp };
      }

      // 4. Create Checkin
      const partRef = db.collection("participants").doc(passData.participantId);
      const partSnap = await t.get(partRef);
      const participantName = partSnap.exists ? partSnap.data().fullName : "Unknown";

      t.set(checkinRef, {
        id: checkinRef.id,
        passId: passDoc.id,
        participantId: passData.participantId,
        participantName,
        registrationId: passData.registrationId,
        volunteerId: uid,
        status: "VALID_CHECKED_IN",
        timestamp: FieldValue.serverTimestamp()
      });
      
      // 5. Update Participant Status
      t.update(partRef, {
        checkInStatus: "CHECKED_IN",
        updatedAt: FieldValue.serverTimestamp()
      });

      // 6. Update Registration Check-in Count
      if (passData.registrationId) {
        const regRef = db.collection("registrations").doc(passData.registrationId);
        t.update(regRef, {
          checkedInCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

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
        targetId: result.participantId, 
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

/**
 * Checks in multiple members of a group via the Group Pass.
 */
exports.checkInGroupMembersV2 = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAnyPermission(request, ["SCAN_PASS", "MANUAL_CHECKIN"]);
  const { secureCode, selectedParticipantIds } = request.data;
  
  if (!secureCode || !Array.isArray(selectedParticipantIds) || selectedParticipantIds.length === 0) {
    throw new HttpsError("invalid-argument", "Missing secureCode or selectedParticipantIds");
  }

  try {
    const result = await db.runTransaction(async (t) => {
      // 1. Find Group Pass
      const passQuery = db.collection("passes").where("secureCode", "==", secureCode).where("isGroup", "==", true).limit(1);
      const passSnap = await t.get(passQuery);
      
      if (passSnap.empty) {
        return { success: false, status: "INVALID_GROUP_PASS" };
      }

      const passDoc = passSnap.docs[0];
      const passData = passDoc.data();

      if (passData.status !== "ACTIVE") return { success: false, status: "INVALID_PASS_STATE" };

      const registrationId = passData.registrationId;
      
      let successfulCheckins = 0;
      const checkedInIds = [];

      // PHASE 1: ALL READS
      const partDocs = [];
      const indPassDocs = [];
      const checkinSnaps = [];

      for (const partId of selectedParticipantIds) {
        const partRef = db.collection("participants").doc(partId);
        const partSnap = await t.get(partRef);
        partDocs.push({ partId, partSnap, partRef });
        
        if (partSnap.exists && partSnap.data().registrationId === registrationId) {
          const indPassQuery = db.collection("passes").where("participantId", "==", partId).limit(1);
          const indPassSnap = await t.get(indPassQuery);
          if (!indPassSnap.empty) {
            const indPassDoc = indPassSnap.docs[0];
            indPassDocs.push({ partId, indPassDoc });
            
            const checkinRef = db.collection("checkins").doc(`pass_${indPassDoc.id}`);
            const checkinSnap = await t.get(checkinRef);
            checkinSnaps.push({ partId, checkinSnap, checkinRef });
          }
        }
      }

      // PHASE 2: ALL WRITES
      for (const { partId, partSnap, partRef } of partDocs) {
        if (!partSnap.exists || partSnap.data().registrationId !== registrationId) continue;
        
        const indPassObj = indPassDocs.find(p => p.partId === partId);
        if (!indPassObj) continue;
        const indPassDoc = indPassObj.indPassDoc;

        const checkinObj = checkinSnaps.find(c => c.partId === partId);
        if (!checkinObj || checkinObj.checkinSnap.exists) continue; // Already checked in
        
        const checkinRef = checkinObj.checkinRef;

        // Create checkin
        t.set(checkinRef, {
          id: checkinRef.id,
          passId: indPassDoc.id,
          participantId: partId,
          participantName: partSnap.data().fullName,
          registrationId: registrationId,
          volunteerId: uid,
          status: "VALID_CHECKED_IN",
          timestamp: FieldValue.serverTimestamp()
        });

        // Update Participant Status
        t.update(partRef, {
          checkInStatus: "CHECKED_IN",
          updatedAt: FieldValue.serverTimestamp()
        });

        successfulCheckins++;
        checkedInIds.push(partId);
      }
      
      if (successfulCheckins > 0 && registrationId) {
        // Update Registration Check-in Count
        const regRef = db.collection("registrations").doc(registrationId);
        t.update(regRef, {
          checkedInCount: FieldValue.increment(successfulCheckins),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      return { 
        success: true, 
        checkedInCount: successfulCheckins,
        checkedInIds
      };
    });

    if (result.success && result.checkedInCount > 0) {
      await createAuditLog({
        actorId: uid,
        actorRole: "VOLUNTEER",
        action: "GROUP_PARTICIPANTS_CHECKED_IN",
        targetType: "REGISTRATION",
        targetId: "GROUP_PASS", 
        metadata: { count: result.checkedInCount, participants: result.checkedInIds }
      });
    }

    return result;
  } catch (error) {
    console.error("Group Checkin Error:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to check in group participants");
  }
});

exports.deleteCheckin = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAdmin(request);
  const { checkinId } = request.data;
  
  if (!checkinId) {
    throw new HttpsError("invalid-argument", "Missing checkinId");
  }

  try {
    return await db.runTransaction(async (t) => {
      const checkinRef = db.collection("checkins").doc(checkinId);
      const checkinSnap = await t.get(checkinRef);
      
      if (!checkinSnap.exists) {
        throw new HttpsError("not-found", "Checkin not found");
      }

      const checkinData = checkinSnap.data();

      // Update Participant
      if (checkinData.participantId) {
        const partRef = db.collection("participants").doc(checkinData.participantId);
        t.update(partRef, {
          checkInStatus: "NOT_CHECKED_IN",
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      // Update Registration
      if (checkinData.registrationId) {
        const regRef = db.collection("registrations").doc(checkinData.registrationId);
        t.update(regRef, {
          checkedInCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      // Delete Checkin Document
      t.delete(checkinRef);

      return { success: true };
    });
  } catch (error) {
    console.error("Delete Checkin Error:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to delete checkin");
  }
});




