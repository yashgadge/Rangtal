const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { requireAdmin } = require("../shared/auth");
const { createAuditLog } = require("../shared/audit");

const db = getFirestore();
const auth = getAuth();

/**
 * Creates a volunteer account.
 */
exports.createVolunteer = onCall(async (request) => {
  const uid = requireAdmin(request);
  const { admin, super_admin, email: userEmail } = request.auth.token;
  const isMaster = userEmail === 'yashgadge11155@gmail.com';

  const { email, password, name, permissions } = request.data;
  if (!email || !password || !name) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    await auth.setCustomUserClaims(userRecord.uid, { volunteer: true });

    const volunteerData = {
      uid: userRecord.uid,
      email,
      name,
      status: "ACTIVE",
      active: true,
      permissions: permissions || ["SCAN_PASS"],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: uid
    };

    await db.collection("volunteers").doc(userRecord.uid).set(volunteerData);

    await createAuditLog({
      actorId: uid,
      actorRole: (super_admin || isMaster) ? "SUPER_ADMIN" : "ADMIN",
      action: "VOLUNTEER_CREATED",
      targetType: "VOLUNTEER",
      targetId: userRecord.uid,
    });

    return { success: true, uid: userRecord.uid };
  } catch (error) {
    console.error("Error creating volunteer:", error);
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Disables a volunteer account.
 */
exports.disableVolunteer = onCall(async (request) => {
  const uid = requireAdmin(request);
  const { admin, super_admin, email: userEmail } = request.auth.token;
  const isMaster = userEmail === 'yashgadge11155@gmail.com';

  const { uid: targetUid } = request.data;
  if (!targetUid) throw new HttpsError("invalid-argument", "Missing uid");

  try {
    await db.collection("volunteers").doc(targetUid).update({
      status: "DISABLED",
      active: false,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await auth.revokeRefreshTokens(targetUid);

    await createAuditLog({
      actorId: uid,
      actorRole: (super_admin || isMaster) ? "SUPER_ADMIN" : "ADMIN",
      action: "VOLUNTEER_DISABLED",
      targetType: "VOLUNTEER",
      targetId: targetUid,
    });

    return { success: true };
  } catch (error) {
    console.error("Error disabling volunteer:", error);
    throw new HttpsError("internal", error.message);
  }
});
